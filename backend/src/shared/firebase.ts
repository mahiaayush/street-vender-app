import admin from 'firebase-admin';
import fs from 'fs';
import { CONFIG } from '../config.js';

// Local Realtime DB Mock Cache
class LocalRealtimeDB {
  private data: Record<string, any> = {};

  set(path: string, val: any): void {
    this.data[path] = val;
    console.log(`💾 [Mock Firebase] Path: "${path}" updated with coordinates:`, val);
  }

  get(path: string): any {
    return this.data[path] || null;
  }

  getAll(): Record<string, any> {
    return this.data;
  }
}

export const mockFirebaseDB = new LocalRealtimeDB();

let firebaseDb: admin.database.Database | null = null;

if (CONFIG.USE_FIREBASE) {
  try {
    console.log('🔥 [Firebase] Initializing Firebase Admin SDK...');
    let credentialOptions: admin.ServiceAccount | undefined;

    if (CONFIG.FIREBASE_CREDENTIALS_PATH && fs.existsSync(CONFIG.FIREBASE_CREDENTIALS_PATH)) {
      const rawCreds = fs.readFileSync(CONFIG.FIREBASE_CREDENTIALS_PATH, 'utf8');
      credentialOptions = JSON.parse(rawCreds);
    }

    admin.initializeApp({
      credential: credentialOptions ? admin.credential.cert(credentialOptions) : admin.credential.applicationDefault(),
      databaseURL: CONFIG.FIREBASE_DATABASE_URL,
    });

    firebaseDb = admin.database();
    console.log('✅ [Firebase] Firebase Admin SDK initialized successfully.');
  } catch (err) {
    console.warn('⚠️ [Firebase] Failed to initialize Firebase Admin SDK. Defaulting to Local Memory Store.', err);
  }
} else {
  console.log('🔥 [Firebase] Running with Local Realtime Mock Database (No Firebase required).');
}

export const FirebaseService = {
  updateShopLocation: async (shopId: string, location: { latitude: number; longitude: number; name: string; category: string; isActive: boolean }) => {
    const timestamp = Date.now();
    const payload = {
      ...location,
      timestamp,
    };

    if (firebaseDb) {
      try {
        await firebaseDb.ref(`active_shops/${shopId}`).set(payload);
      } catch (err) {
        console.error('❌ [Firebase] Failed to write coordinate to Firebase Realtime DB:', err);
        mockFirebaseDB.set(shopId, payload);
      }
    } else {
      mockFirebaseDB.set(shopId, payload);
    }
  },

  removeShopLocation: async (shopId: string) => {
    if (firebaseDb) {
      try {
        await firebaseDb.ref(`active_shops/${shopId}`).remove();
      } catch (err) {
        console.error('❌ [Firebase] Failed to delete coordinate from Firebase Realtime DB:', err);
        mockFirebaseDB.set(shopId, null);
      }
    } else {
      mockFirebaseDB.set(shopId, null);
    }
  },
};
