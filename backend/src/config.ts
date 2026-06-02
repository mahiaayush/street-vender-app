import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const CONFIG = {
  PORT: process.env.PORT || '4000',
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-vendor-key-123',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  
  // Kafka Event Bus Configuration
  KAFKA_BROKERS: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'street-vendor-tracker',
  USE_KAFKA: process.env.USE_KAFKA === 'true', // Set to true if they run actual Kafka, default false triggers fallback
  
  // Firebase Realtime DB Configuration
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || '',
  FIREBASE_CREDENTIALS_PATH: process.env.FIREBASE_CREDENTIALS_PATH || '',
  USE_FIREBASE: process.env.USE_FIREBASE === 'true' && !!process.env.FIREBASE_DATABASE_URL,
};
