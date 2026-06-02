import { Router, Response } from 'express';
import { prisma } from '../../shared/db.js';
import { authenticateJWT, AuthenticatedRequest } from '../../middleware/auth.js';
import { eventBus, TOPICS } from '../../shared/EventBus.js';
import { FirebaseService, mockFirebaseDB } from '../../shared/firebase.js';

const router = Router();

// Haversine formula to compute distance in km between two lat/lng pairs
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// 1. Get vendor's own shop details
router.get('/my-shop', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    return res.status(403).json({ error: 'Access denied: Vendors only' });
  }

  try {
    const shop = await prisma.shop.findUnique({
      where: { vendorId: req.user.id },
      include: { operatingHours: true },
    });

    if (!shop) return res.status(404).json({ error: 'Shop profile not found' });
    return res.status(200).json(shop);
  } catch (err) {
    console.error('❌ [My Shop Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Update shop profile
router.put('/update', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    return res.status(403).json({ error: 'Access denied: Vendors only' });
  }

  const { name, description, category } = req.body;

  try {
    const updatedShop = await prisma.shop.update({
      where: { vendorId: req.user.id },
      data: { name, description, category },
    });

    return res.status(200).json({ message: 'Shop profile updated successfully', shop: updatedShop });
  } catch (err) {
    console.error('❌ [Shop Update Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Configure Regular Operating Hours
router.post('/hours', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    return res.status(403).json({ error: 'Access denied: Vendors only' });
  }

  const { schedule } = req.body; // Array: [{ day: 'Monday', openTime: '09:00', closeTime: '18:00' }]

  if (!Array.isArray(schedule)) {
    return res.status(400).json({ error: 'Schedule must be an array' });
  }

  try {
    const shop = await prisma.shop.findUnique({ where: { vendorId: req.user.id } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    // Clean existing hours
    await prisma.operatingHours.deleteMany({ where: { shopId: shop.id } });

    // Insert new hours
    const operations = schedule.map((hour) => ({
      shopId: shop.id,
      day: hour.day,
      openTime: hour.openTime,
      closeTime: hour.closeTime,
    }));

    await prisma.operatingHours.createMany({ data: operations });

    const updatedHours = await prisma.operatingHours.findMany({ where: { shopId: shop.id } });

    return res.status(200).json({ message: 'Operating hours configured successfully', schedule: updatedHours });
  } catch (err) {
    console.error('❌ [Hours Config Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Toggle Active (Open/Close Shop)
router.post('/toggle-active', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    return res.status(403).json({ error: 'Access denied: Vendors only' });
  }

  const { isActive, latitude, longitude } = req.body;

  try {
    const shop = await prisma.shop.findUnique({ where: { vendorId: req.user.id } });
    if (!shop) return res.status(404).json({ error: 'Shop profile not found' });

    const updatedShop = await prisma.shop.update({
      where: { id: shop.id },
      data: {
        isActive,
        latitude: isActive ? latitude : null,
        longitude: isActive ? longitude : null,
      },
    });

    let subscriberUserIds: string[] = [];

    if (isActive) {
      console.log(`🟢 Shop [${shop.name}] is now OPEN at coordinates:`, latitude, longitude);
      // Synchronize with Firebase
      await FirebaseService.updateShopLocation(shop.id, {
        latitude,
        longitude,
        name: shop.name,
        category: shop.category,
        isActive: true,
      });

      // Gather subscribers to notify them when shop opens
      const subscriptions = await prisma.notificationSubscription.findMany({
        where: { shopId: shop.id },
      });
      subscriberUserIds = subscriptions.map((sub) => sub.userId);
    } else {
      console.log(`🔴 Shop [${shop.name}] is now CLOSED.`);
      await FirebaseService.removeShopLocation(shop.id);
    }

    // Publish event onto the bus
    await eventBus.publish(TOPICS.SHOP_STATUS_CHANGES, {
      shopId: shop.id,
      isActive,
      latitude: isActive ? latitude : null,
      longitude: isActive ? longitude : null,
      name: shop.name,
      category: shop.category,
      subscribers: subscriberUserIds,
    });

    return res.status(200).json({ message: `Shop is now ${isActive ? 'OPEN' : 'CLOSED'}`, shop: updatedShop });
  } catch (err) {
    console.error('❌ [Toggle Active Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 5. Search Nearby active shops & search by category (Customer feature)
router.get('/nearby', async (req, res) => {
  const { lat, lng, radiusKm = '5', category } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Missing customer lat and lng coordinates' });
  }

  const customerLat = parseFloat(lat as string);
  const customerLng = parseFloat(lng as string);
  const searchRadius = parseFloat(radiusKm as string);

  try {
    // 1. Fetch active shops from SQLite with ratings
    const whereClause: any = { isActive: true };
    if (category) {
      whereClause.category = category as string;
    }

    const activeShops = await prisma.shop.findMany({
      where: whereClause,
      include: {
        operatingHours: true,
        ratings: true,
      },
    });

    // 2. Perform distance calculations and average rating calculations
    const nearbyShops = activeShops
      .map((shop) => {
        const dist = getHaversineDistance(
          customerLat,
          customerLng,
          shop.latitude || 0,
          shop.longitude || 0
        );

        // Compute average ratings dynamically
        const averageRating =
          shop.ratings.length > 0
            ? parseFloat((shop.ratings.reduce((acc, curr) => acc + curr.stars, 0) / shop.ratings.length).toFixed(1))
            : 5.0; // Default rating if no reviews yet

        // Strip raw ratings for payload cleanliness, append averageRating
        const { ratings, ...shopData } = shop;

        return {
          ...shopData,
          distanceKm: parseFloat(dist.toFixed(2)),
          rating: averageRating,
          reviewCount: ratings.length,
        };
      })
      .filter((shop) => shop.distanceKm <= searchRadius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return res.status(200).json(nearbyShops);
  } catch (err) {
    console.error('❌ [Nearby Search Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 6. Direct retrieval of Mock coordinates (for fallback clients that cannot use Firebase websocket stream)
router.get('/mock-locations', async (req, res) => {
  const allShops = mockFirebaseDB.getAll();
  return res.status(200).json(allShops);
});

// 7. Submit a Shop Rating (Customer feature)
router.post('/:shopId/rate', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Access denied: Customers only' });
  }

  const { shopId } = req.params;
  const { stars, comment } = req.body;

  if (stars === undefined || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Rating stars must be an integer between 1 and 5' });
  }

  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    // Check if customer already rated this shop - if so, update it, otherwise create
    const existingRating = await prisma.rating.findFirst({
      where: { shopId, customerId: req.user.id },
    });

    let ratingRecord;
    if (existingRating) {
      ratingRecord = await prisma.rating.update({
        where: { id: existingRating.id },
        data: { stars, comment },
      });
    } else {
      ratingRecord = await prisma.rating.create({
        data: {
          shopId,
          customerId: req.user.id,
          stars,
          comment,
        },
      });
    }

    return res.status(201).json({ message: 'Rating submitted successfully', rating: ratingRecord });
  } catch (err) {
    console.error('❌ [Submit Rating Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 8. Toggle Shop Notification Subscription (Customer feature)
router.post('/:shopId/subscribe', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { shopId } = req.params;

  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const existingSub = await prisma.notificationSubscription.findFirst({
      where: { shopId, userId: req.user.id },
    });

    if (existingSub) {
      await prisma.notificationSubscription.delete({ where: { id: existingSub.id } });
      return res.status(200).json({ subscribed: false, message: 'Unsubscribed from shop alerts.' });
    } else {
      await prisma.notificationSubscription.create({
        data: {
          shopId,
          userId: req.user.id,
        },
      });
      return res.status(201).json({ subscribed: true, message: 'Subscribed to shop active opening alerts!' });
    }
  } catch (err) {
    console.error('❌ [Subscribe Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 9. Check Shop Subscription Status
router.get('/:shopId/subscription-status', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { shopId } = req.params;

  try {
    const sub = await prisma.notificationSubscription.findFirst({
      where: { shopId, userId: req.user.id },
    });
    return res.status(200).json({ subscribed: !!sub });
  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 10. Get all reviews and comments for a Shop
router.get('/:shopId/reviews', async (req: Response | any, res: Response) => {
  const { shopId } = req.params;

  try {
    const reviews = await prisma.rating.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
    });

    const customerIds = reviews.map((r) => r.customerId);
    const customers = await prisma.user.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true },
    });

    const customerMap = new Map(customers.map((c) => [c.id, c.name]));

    const enrichedReviews = reviews.map((r) => ({
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      createdAt: r.createdAt,
      customerName: customerMap.get(r.customerId) || 'Anonymous Customer',
    }));

    return res.status(200).json(enrichedReviews);
  } catch (err) {
    console.error('❌ [Get Reviews Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
