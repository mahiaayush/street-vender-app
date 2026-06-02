import { Kafka, Producer, Consumer } from 'kafkajs';
import { EventEmitter } from 'events';
import { CONFIG } from '../config.js';

class InMemoryBroker extends EventEmitter {
  private static instance: InMemoryBroker;
  private constructor() {
    super();
    // Allow unlimited listeners for modular microservice scaling
    this.setMaxListeners(0);
  }
  public static getInstance(): InMemoryBroker {
    if (!InMemoryBroker.instance) {
      InMemoryBroker.instance = new InMemoryBroker();
    }
    return InMemoryBroker.instance;
  }
}

export class EventBus {
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();
  private inMemoryBroker = InMemoryBroker.getInstance();
  private useKafka: boolean = CONFIG.USE_KAFKA;

  constructor() {
    if (this.useKafka) {
      console.log('⚡ [EventBus] Initializing with production Kafka clusters...');
      this.kafka = new Kafka({
        clientId: CONFIG.KAFKA_CLIENT_ID,
        brokers: CONFIG.KAFKA_BROKERS,
        retry: {
          retries: 2,
        }
      });
    } else {
      console.log('📡 [EventBus] Running with decoupled In-Memory Event Pub/Sub Fallback (No Kafka required).');
    }
  }

  // Initialize Producer
  async connectProducer(): Promise<void> {
    if (this.useKafka && this.kafka) {
      try {
        this.producer = this.kafka.producer();
        await this.producer.connect();
        console.log('✅ [EventBus] Kafka Producer connected successfully.');
      } catch (err) {
        console.warn('⚠️ [EventBus] Kafka connection failed. Falling back to In-Memory Event Bus.', err);
        this.useKafka = false;
      }
    }
  }

  // Publish message to a topic
  async publish(topic: string, message: any): Promise<void> {
    const payload = JSON.stringify(message);
    
    if (this.useKafka && this.producer) {
      try {
        await this.producer.send({
          topic,
          messages: [{ value: payload }],
        });
      } catch (err) {
        console.error(`❌ [EventBus] Error producing message to topic ${topic}:`, err);
        // Fallback live to in-memory on producer failures
        this.inMemoryBroker.emit(topic, payload);
      }
    } else {
      // Direct in-memory event stream
      this.inMemoryBroker.emit(topic, payload);
    }
  }

  // Subscribe consumer to a topic
  async subscribe(groupId: string, topic: string, onMessage: (message: any) => void): Promise<void> {
    if (this.useKafka && this.kafka) {
      try {
        const consumer = this.kafka.consumer({ groupId });
        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning: false });
        
        await consumer.run({
          eachMessage: async ({ message }) => {
            if (message.value) {
              const decoded = JSON.parse(message.value.toString());
              onMessage(decoded);
            }
          },
        });
        
        this.consumers.set(`${groupId}-${topic}`, consumer);
        console.log(`✅ [EventBus] Kafka Consumer [${groupId}] subscribed to topic: ${topic}`);
      } catch (err) {
        console.warn(`⚠️ [EventBus] Kafka subscription failed for [${groupId}] on topic ${topic}. Using In-Memory fallback.`);
        this.subscribeInMemory(topic, onMessage);
      }
    } else {
      this.subscribeInMemory(topic, onMessage);
    }
  }

  private subscribeInMemory(topic: string, onMessage: (message: any) => void) {
    this.inMemoryBroker.on(topic, (rawPayload: string) => {
      try {
        const decoded = JSON.parse(rawPayload);
        onMessage(decoded);
      } catch (err) {
        console.error('❌ [EventBus] Failed to parse in-memory event payload:', err);
      }
    });
    console.log(`📡 [EventBus] Connected In-Memory subscriber to topic: ${topic}`);
  }

  async disconnect(): Promise<void> {
    if (this.producer) await this.producer.disconnect();
    for (const consumer of this.consumers.values()) {
      await consumer.disconnect();
    }
    console.log('⚡ [EventBus] Disconnected successfully.');
  }
}

// Export a single singleton instance
export const eventBus = new EventBus();
export const TOPICS = {
  VENDOR_LOCATION_UPDATES: 'vendor-location-updates',
  ORDER_STATUS_CHANGES: 'order-status-changes',
  SHOP_STATUS_CHANGES: 'shop-status-changes',
};
