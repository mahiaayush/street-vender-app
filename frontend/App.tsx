import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { CustomerMapScreen } from './src/screens/CustomerMapScreen';
import { VendorDashboardScreen } from './src/screens/VendorDashboardScreen';

// Internal component to handle authentication-based screen routing
const RootNavigator: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return user?.role === 'VENDOR' ? <VendorDashboardScreen /> : <CustomerMapScreen />;
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <View style={styles.container}>
          <RootNavigator />
          <StatusBar style="light" />
        </View>
      </SocketProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
});
