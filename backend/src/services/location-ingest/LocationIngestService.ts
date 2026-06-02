import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../../config.js';
import { eventBus, TOPICS } from '../../shared/EventBus.js';

interface SocketAuthPayload {
  token: string;
}

export class LocationIngestService {
  private io: SocketIOServer;

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });
  }

  public initialize(): void {
    console.log('📡 [LocationIngest] Initializing Real-time Ingestion Service...');

    // Subscribe to shop status changes to push alerts to online subscribers
    eventBus.subscribe('websocket-broadcaster', TOPICS.SHOP_STATUS_CHANGES, (payload) => {
      const { shopId, isActive, name, category, subscribers } = payload;

      if (isActive && Array.isArray(subscribers) && subscribers.length > 0) {
        console.log(`🔔 [LocationIngest] Broadcasting Shop [${name}] Open Alert to ${subscribers.length} subscribers...`);

        // Find connected sockets matching subscriber user IDs and dispatch event
        this.io.sockets.sockets.forEach((socket) => {
          const user = socket.data?.user;
          if (user && subscribers.includes(user.id)) {
            socket.emit('shop-opened-alert', {
              shopId,
              shopName: name,
              category,
              message: `🏪 Great news! "${name}" (${category}) is now OPEN near you! Tap to view on map.`,
            });
            console.log(`✉️ [LocationIngest] Alert dispatched to connected subscriber: ${user.name}`);
          }
        });
      }
    });


    // Socket.io Authentication Middleware
    this.io.use((socket, next) => {
      const auth = socket.handshake.auth as SocketAuthPayload;
      const token = auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      jwt.verify(token, CONFIG.JWT_SECRET, (err, decoded) => {
        if (err || !decoded) {
          return next(new Error('Authentication error: Invalid token'));
        }
        
        socket.data.user = decoded;
        next();
      });
    });

    this.io.on('connection', (socket) => {
      const user = socket.data.user;
      console.log(`🔌 [LocationIngest] WebSocket connection established for User: ${user.name} (${user.role}) [ID: ${socket.id}]`);

      // Vendors join special track room to stream coordinates
      if (user.role === 'VENDOR') {
        socket.join(`vendor-${user.id}`);
        console.log(`👤 [LocationIngest] Vendor ${user.name} joined personal tracking room.`);
      } else {
        // Customers/systems join generic streaming rooms
        socket.join('tracking-broadcasts');
      }

      // Handle coordinate updates from vendors
      socket.on('update-location', async (coordinates: { latitude: number; longitude: number; speed?: number; heading?: number }) => {
        if (user.role !== 'VENDOR') {
          return socket.emit('error', 'Only vendors can stream coordinates');
        }

        const { latitude, longitude } = coordinates;
        if (latitude === undefined || longitude === undefined) {
          return socket.emit('error', 'Invalid coordinate arguments');
        }

        console.log(`📍 [LocationIngest] Location received from Vendor [${user.name}]: Lat ${latitude}, Lng ${longitude}`);

        // Construct Event Payload (representing high-throughput stream ingestion)
        const locationPayload = {
          vendorId: user.id,
          vendorName: user.name,
          latitude,
          longitude,
          speed: coordinates.speed || 0,
          heading: coordinates.heading || 0,
          timestamp: Date.now(),
        };

        // Publish to Kafka event bus asynchronously
        await eventBus.publish(TOPICS.VENDOR_LOCATION_UPDATES, locationPayload);
      });

      // Simple real-time chat/alert support for orders
      socket.on('join-order-room', (orderId: string) => {
        socket.join(`order-${orderId}`);
        console.log(`📦 [LocationIngest] Socket joined Order room: order-${orderId}`);
      });

      socket.on('disconnect', () => {
        console.log(`🔌 [LocationIngest] Connection closed for: ${user.name} [ID: ${socket.id}]`);
      });
    });
  }
}
