import { Router, Response } from 'express';
import { prisma } from '../../shared/db.js';
import { authenticateJWT, AuthenticatedRequest } from '../../middleware/auth.js';

const router = Router();
// does this file need to import the LocationProcessorService? No, it is a separate service that runs independently and does not directly interact with the menu routes. The menu routes handle CRUD operations for menu items, while the LocationProcessorService handles real-time location updates for vendors. They operate in different domains of the application and do not have direct dependencies on each other.
// Helper to check if a day of the week is matched by a comma-separated string
function isAvailableOnDay(daysAvailable: string, dayOfWeek: string): boolean {
  const normalizedDay = dayOfWeek.trim().toLowerCase();
  return daysAvailable
    .split(',')
    .map((day) => day.trim().toLowerCase())
    .includes(normalizedDay);
}

// 1. Add new Menu Item (Vendor Only)
router.post('/add', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    return res.status(403).json({ error: 'Access denied: Vendors only' });
  }

  const { name, description, price, daysAvailable } = req.body;

  if (!name || price === undefined || !daysAvailable) {
    return res.status(400).json({ error: 'Missing required fields: name, price, daysAvailable' });
  }

  try {
    const shop = await prisma.shop.findUnique({ where: { vendorId: req.user.id } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    // Validate daysAvailable
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const inputDays = daysAvailable.split(',').map((d: string) => d.trim());
    const invalidDays = inputDays.filter((d: string) => !validDays.includes(d));
    if (invalidDays.length > 0) {
      return res.status(400).json({ error: `Invalid days of week: ${invalidDays.join(', ')}` });
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        shopId: shop.id,
        name,
        description,
        price: parseFloat(price),
        daysAvailable: inputDays.join(','),
      },
    });

    return res.status(201).json({ message: 'Menu item added successfully', menuItem });
  } catch (err) {
    console.error('❌ [Menu Add Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Delete Menu Item (Vendor Only)
router.delete('/:id', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    return res.status(403).json({ error: 'Access denied: Vendors only' });
  }

  const { id } = req.params;

  try {
    const shop = await prisma.shop.findUnique({ where: { vendorId: req.user.id } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const menuItem = await prisma.menuItem.findUnique({ where: { id } });
    if (!menuItem) return res.status(404).json({ error: 'Menu item not found' });

    if (menuItem.shopId !== shop.id) {
      return res.status(403).json({ error: 'Unauthorized: You do not own this menu item' });
    }

    await prisma.menuItem.delete({ where: { id } });
    return res.status(200).json({ message: 'Menu item deleted successfully' });
  } catch (err) {
    console.error('❌ [Menu Delete Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Get all Menu Items for Vendor Dashboard
router.get('/vendor', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    return res.status(403).json({ error: 'Access denied: Vendors only' });
  }

  try {
    const shop = await prisma.shop.findUnique({ where: { vendorId: req.user.id } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const menuItems = await prisma.menuItem.findMany({
      where: { shopId: shop.id },
      include: { unavailabilities: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json(menuItems);
  } catch (err) {
    console.error('❌ [Menu Vendor Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Toggle Date-Specific Menu Item Availability (Vendor Only)
router.post('/toggle-availability', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    return res.status(403).json({ error: 'Access denied: Vendors only' });
  }

  const { menuItemId, date, isAvailable } = req.body; // date: "YYYY-MM-DD", isAvailable: boolean

  if (!menuItemId || !date || isAvailable === undefined) {
    return res.status(400).json({ error: 'Missing required fields: menuItemId, date, isAvailable' });
  }

  try {
    const shop = await prisma.shop.findUnique({ where: { vendorId: req.user.id } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) return res.status(404).json({ error: 'Menu item not found' });

    if (menuItem.shopId !== shop.id) {
      return res.status(403).json({ error: 'Unauthorized: You do not own this menu item' });
    }

    if (!isAvailable) {
      // Create date-specific unavailability record (if it doesn't already exist)
      await prisma.menuUnavailability.upsert({
        where: {
          menuItemId_date: {
            menuItemId,
            date,
          },
        },
        update: {},
        create: {
          menuItemId,
          date,
        },
      });
      console.log(`🚫 [Menu Service] Marked item [${menuItem.name}] as UNAVAILABLE on date: ${date}`);
    } else {
      // Remove date-specific unavailability record
      await prisma.menuUnavailability.deleteMany({
        where: {
          menuItemId,
          date,
        },
      });
      console.log(`✅ [Menu Service] Restored item [${menuItem.name}] availability on date: ${date}`);
    }

    return res.status(200).json({
      message: 'Item availability status updated successfully',
      menuItemId,
      date,
      isAvailable,
    });
  } catch (err) {
    console.error('❌ [Menu Toggle Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 5. Get Menu Items for a Shop with dynamic availability filters (Public/Customer)
router.get('/shop/:shopId', async (req: Response | any, res: Response) => {
  const { shopId } = req.params;
  const requestedDate = (req.query.date as string) || new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    // Fetch all menu items for the shop
    const menuItems = await prisma.menuItem.findMany({
      where: { shopId },
      include: {
        unavailabilities: {
          where: { date: requestedDate },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Parse the requested date to determine the day of the week
    const dateObj = new Date(requestedDate);
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = daysOfWeek[dateObj.getDay()];

    // Add dynamic availability flags
    const processedMenuItems = menuItems.map((item) => {
      const isOfferedOnDay = isAvailableOnDay(item.daysAvailable, dayOfWeek);
      const isBlockedOnDate = item.unavailabilities.length > 0;
      
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        daysAvailable: item.daysAvailable,
        isAvailableDay: isOfferedOnDay,
        isUnavailableDate: isBlockedOnDate,
        isAvailable: isOfferedOnDay && !isBlockedOnDate,
      };
    });

    return res.status(200).json({
      shopId,
      date: requestedDate,
      dayOfWeek,
      menu: processedMenuItems,
    });
  } catch (err) {
    console.error('❌ [Menu Fetch Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
