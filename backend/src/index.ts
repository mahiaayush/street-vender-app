import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { CONFIG } from './config.js';
import { eventBus } from './shared/EventBus.js';
import { seedDatabase } from './shared/seed.js';

// Route Handlers
import authRouter from './services/api-service/auth.js';
import shopsRouter from './services/api-service/shops.js';
import ordersRouter from './services/api-service/orders.js';
import menuRouter from './services/api-service/menu.js';

// Socket.io & Event Consumers
import { LocationIngestService } from './services/location-ingest/LocationIngestService.js';
import { LocationProcessorService } from './services/location-processor/LocationProcessorService.js';

const app = express();
const httpServer = createServer(app);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// REST API Routes
app.use('/api/auth', authRouter);
app.use('/api/shops', shopsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/menu', menuRouter);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      useKafka: CONFIG.USE_KAFKA,
      useFirebase: CONFIG.USE_FIREBASE,
    },
  });
});

async function main() {
  console.log('🚀 [System] Starting Street Vendor Tracking System...');

  try {
    // 1. Initialize Event Bus (Kafka/InMemory)
    await eventBus.connectProducer();

    // 2. Start Location Ingest WebSocket Server
    const ingestService = new LocationIngestService(httpServer);
    ingestService.initialize();

    // 3. Start Location Processing Event Consumer
    const processorService = new LocationProcessorService();
    processorService.initialize();

    // 4. Seed Database (mock records)
    await seedDatabase();

    // 5. Start Server
    const PORT = CONFIG.PORT;
    httpServer.listen(PORT, () => {
      console.log(`🚀 [System] Microservices running synchronously on http://localhost:${PORT}`);
      console.log(`📡 WebSocket server mapped to standard socket.io namespace.`);
    });
  } catch (err) {
    console.error('❌ [System] Fatal boot failure:', err);
    process.exit(1);
  }
}

main();
