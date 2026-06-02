import { Platform } from 'react-native';

// NOTE FOR PHYSICAL PHONE TESTING:
// If you are running the app on a physical phone using 'Expo Go',
// replace 'localhost' with your computer's local network IP address (e.g., '192.168.1.100').
// For iOS Simulator or Android Emulator, 'localhost' or '10.0.2.2' will work perfectly.

const DEV_API_URL = Platform.select({
  android: 'http://10.0.2.2:4000',
  ios: 'http://localhost:4000',
  default: 'http://localhost:4000',
});

export const CONFIG = {
  API_URL: DEV_API_URL,
  SOCKET_URL: DEV_API_URL,
  
  // Simulated Location Coordinates (Delhi Central Area)
  DEFAULT_LATITUDE: 28.6139,
  DEFAULT_LONGITUDE: 77.2090,
};
