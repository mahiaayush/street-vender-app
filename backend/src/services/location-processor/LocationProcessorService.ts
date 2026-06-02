import { eventBus, TOPICS } from '../../shared/EventBus.js';
import { prisma } from '../../shared/db.js';
import { FirebaseService } from '../../shared/firebase.js';

export class LocationProcessorService {
  public initialize(): void {
    console.log('⚙️ [LocationProcessor] Starting Location Stream Processor Consumer...');

    // Subscribe to vendor coordinate updates topic
    eventBus.subscribe('location-processor-group', TOPICS.VENDOR_LOCATION_UPDATES, async (payload) => {
      const { vendorId, vendorName, latitude, longitude, speed, heading, timestamp } = payload;

      try {
        // 1. Fetch vendor's shop
        const shop = await prisma.shop.findUnique({
          where: { vendorId },
        });

        if (!shop) {
          console.warn(`⚠️ [LocationProcessor] Shop not found for vendor matching ID: ${vendorId}`);
          return;
        }

        // 2. Perform validation (e.g. check if the shop is currently active/open)
        if (!shop.isActive) {
          console.warn(`⚠️ [LocationProcessor] Ignoring coordinate feed. Shop [${shop.name}] is closed.`);
          return;
        }

        // 3. Persist coordinates to main relational database
        await prisma.shop.update({
          where: { id: shop.id },
          data: {
            latitude,
            longitude,
          },
        });

        console.log(`✅ [LocationProcessor] Saved live coordinate in main DB for [${shop.name}]: ${latitude}, ${longitude}`);

        // 4. Stream to Firebase Realtime Database for high-speed client maps sync
        await FirebaseService.updateShopLocation(shop.id, {
          latitude,
          longitude,
          name: shop.name,
          category: shop.category,
          isActive: true,
        });

        console.log(`🔥 [LocationProcessor] Streamed location update to Firebase Realtime DB for Shop ID: ${shop.id}`);
      } catch (err) {
        console.error('❌ [LocationProcessor] Error consuming or processing location update event:', err);
      }
    });
  }
}
export const locationProcessorService = new LocationProcessorService();
