import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { CONFIG } from '../config';
import { MenuManagementScreen } from './MenuManagementScreen';

interface Order {
  id: string;
  items: string;
  totalAmount: number;
  status: string;
  deliveryLat: number;
  deliveryLng: number;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
  };
}

export const VendorDashboardScreen: React.FC = () => {
  const { user, shop, setShopActiveStatus, updateShop, api, logout } = useAuth();
  const { emitLocation, isConnected } = useSocket();
  const [viewMenu, setViewMenu] = useState(false);

  // Shop Settings
  const [shopName, setShopName] = useState(shop?.name || '');
  const [shopDesc, setShopDesc] = useState(shop?.description || '');
  const [shopCategory, setShopCategory] = useState(shop?.category || 'General');

  // Location Tracking State
  const [isActive, setIsActive] = useState(shop?.isActive || false);
  const [lat, setLat] = useState(shop?.latitude || CONFIG.DEFAULT_LATITUDE);
  const [lng, setLng] = useState(shop?.longitude || CONFIG.DEFAULT_LONGITUDE);

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const categories = ['Chaat & Snacks', 'Vegetables', 'Fruits', 'General'];

  const fetchOrders = async () => {
    if (!isActive) return;
    setLoadingOrders(true);
    try {
      const res = await api.get('/api/orders/vendor-queue');
      setOrders(res.data);
    } catch (err) {
      console.warn('❌ Failed fetching vendor orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      fetchOrders();
      const interval = setInterval(fetchOrders, 5000);
      return () => clearInterval(interval);
    } else {
      setOrders([]);
    }
  }, [isActive]);

  const handleToggleActive = async (value: boolean) => {
    try {
      await setShopActiveStatus(value, lat, lng);
      setIsActive(value);
      if (value) {
        emitLocation(lat, lng);
        Alert.alert('🏪 Shop Opened', 'Your location is now public and customers can track you.');
      } else {
        Alert.alert('🏪 Shop Closed', 'Location tracking deactivated. You are now offline.');
      }
    } catch (err: any) {
      Alert.alert('Action Failed', err.message);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await updateShop(shopName, shopDesc, shopCategory);
      Alert.alert('Success', 'Shop profile details updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // Location simulation utilities
  const moveLocation = (direction: 'N' | 'S' | 'E' | 'W') => {
    const delta = 0.0008; // Roughly 80-100 meters
    let newLat = lat;
    let newLng = lng;

    if (direction === 'N') newLat += delta;
    if (direction === 'S') newLat -= delta;
    if (direction === 'E') newLng += delta;
    if (direction === 'W') newLng -= delta;

    setLat(newLat);
    setLng(newLng);

    if (isActive) {
      emitLocation(newLat, newLng);
      // Optimistically push status to update Prisma coordinate
      api.post('/api/shops/toggle-active', { isActive: true, latitude: newLat, longitude: newLng }).catch(() => {});
    }
  };

  const handleRespondOrder = async (orderId: string, action: 'ACCEPT' | 'DECLINE') => {
    try {
      await api.post(`/api/orders/${orderId}/respond`, { action });
      Alert.alert('Order Updated', `You have ${action.toLowerCase()}ed the order.`);
      fetchOrders();
    } catch (err: any) {
      Alert.alert('Failed', err.response?.data?.error || 'Update failed.');
    }
  };

  const handleProgressOrder = async (orderId: string, status: 'OUT_FOR_DELIVERY' | 'DELIVERED') => {
    try {
      await api.post(`/api/orders/${orderId}/status`, { status });
      Alert.alert('Status Updated', `Order state is now: ${status.replace(/_/g, ' ')}`);
      fetchOrders();
    } catch (err: any) {
      Alert.alert('Failed', err.response?.data?.error || 'Update failed.');
    }
  };

  if (viewMenu) {
    return <MenuManagementScreen onBack={() => setViewMenu(false)} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🏪 Vendor Center</Text>
          <Text style={styles.headerSubtitle}>{user?.name} | {shopCategory}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setViewMenu(true)}>
            <Text style={styles.menuBtnText}>📋 Edit Menu</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Online Status Toggle */}
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusTitle}>Shop Opening Location Status</Text>
            <Text style={[styles.statusSubtitle, isActive ? styles.onlineText : styles.offlineText]}>
              {isActive ? '🟢 ONLINE (Customers see you on Map)' : '🔴 OFFLINE (Shop is Closed)'}
            </Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={handleToggleActive}
            trackColor={{ false: '#3a3a3c', true: '#00ffcc' }}
            thumbColor={isActive ? '#121214' : '#8e8e93'}
          />
        </View>

        {isActive && (
          <View style={styles.coordinateContainer}>
            <Text style={styles.coordinateText}>📍 Live Coordinates: {lat.toFixed(6)}, {lng.toFixed(6)}</Text>
            <Text style={styles.connectionText}>
              WS State: {isConnected ? '✅ Synced to Ingest Gateway' : '⚠️ Offline/Connecting'}
            </Text>
            
            {/* GPS Spoofing Map Movement Controls */}
            <Text style={styles.spoofTitle}>🎮 Spoof & Simulate Vendor Movement:</Text>
            <View style={styles.buttonGrid}>
              <View style={styles.row}>
                <TouchableOpacity style={styles.movementBtn} onPress={() => moveLocation('N')}>
                  <Text style={styles.movementBtnText}>⬆️ North</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.rowBetween}>
                <TouchableOpacity style={styles.movementBtn} onPress={() => moveLocation('W')}>
                  <Text style={styles.movementBtnText}>⬅️ West</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.movementBtn} onPress={() => moveLocation('E')}>
                  <Text style={styles.movementBtnText}>➡️ East</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.row}>
                <TouchableOpacity style={styles.movementBtn} onPress={() => moveLocation('S')}>
                  <Text style={styles.movementBtnText}>⬇️ South</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Active Orders Queue */}
      <View style={[styles.card, styles.ordersCard]}>
        <Text style={styles.cardHeader}>📦 Incoming Orders Queue ({orders.length})</Text>
        {loadingOrders && orders.length === 0 && <ActivityIndicator color="#00ffcc" style={{ margin: 20 }} />}
        
        {!isActive && (
          <Text style={styles.emptyOrdersText}>Open your shop location to start receiving customer orders.</Text>
        )}

        {isActive && orders.length === 0 && !loadingOrders && (
          <Text style={styles.emptyOrdersText}>No active orders. Waiting for customers...</Text>
        )}

        {orders.map((item) => {
          let parsedItems = [];
          try {
            parsedItems = JSON.parse(item.items);
          } catch {
            parsedItems = [{ name: item.items }];
          }

          return (
            <View key={item.id} style={styles.orderItem}>
              <View style={styles.orderHeader}>
                <Text style={styles.customerName}>👤 {item.customer.name}</Text>
                <Text style={styles.orderPrice}>INR {item.totalAmount}</Text>
              </View>
              <Text style={styles.customerPhone}>📞 {item.customer.phone}</Text>
              
              <View style={styles.orderItemsBox}>
                {parsedItems.map((prod: any, idx: number) => (
                  <Text key={idx} style={styles.itemName}>• {prod.name}</Text>
                ))}
              </View>

              <Text style={[styles.orderStatusBadge, styles[`status_${item.status}` as keyof typeof styles]]}>
                Status: {item.status}
              </Text>

              {item.status === 'PENDING' && (
                <View style={styles.orderActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn]}
                    onPress={() => handleRespondOrder(item.id, 'ACCEPT')}
                  >
                    <Text style={styles.actionBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.declineBtn]}
                    onPress={() => handleRespondOrder(item.id, 'DECLINE')}
                  >
                    <Text style={styles.actionBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              )}

              {item.status === 'ACCEPTED' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.progressBtn]}
                  onPress={() => handleProgressOrder(item.id, 'OUT_FOR_DELIVERY')}
                >
                  <Text style={styles.actionBtnText}>🚀 Mark Out For Delivery</Text>
                </TouchableOpacity>
              )}

              {item.status === 'OUT_FOR_DELIVERY' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.progressBtn]}
                  onPress={() => handleProgressOrder(item.id, 'DELIVERED')}
                >
                  <Text style={styles.actionBtnText}>✅ Mark as Delivered</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Shop Profile settings */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>⚙️ Edit Shop Profile Settings</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Shop Display Name</Text>
          <TextInput
            style={styles.input}
            value={shopName}
            onChangeText={setShopName}
            placeholder="Shop name"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Description (Items / Deals)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={shopDesc}
            onChangeText={setShopDesc}
            placeholder="What are you selling today?"
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Category</Text>
          <View style={styles.chipRow}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  shopCategory === cat && styles.categoryChipActive,
                ]}
                onPress={() => setShopCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    shopCategory === cat && styles.categoryChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile}>
          <Text style={styles.saveBtnText}>Save Profile Updates</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#1c1c1e',
    borderBottomWidth: 1,
    borderColor: '#2c2c2e',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2,
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ff453a',
  },
  logoutBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#00ffcc',
    marginRight: 10,
  },
  menuBtnText: {
    color: '#121214',
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  ordersCard: {
    borderColor: 'rgba(0, 255, 204, 0.2)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusTitle: {
    color: '#eaeaea',
    fontSize: 15,
    fontWeight: '700',
  },
  statusSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  onlineText: {
    color: '#00ffcc',
  },
  offlineText: {
    color: '#ff453a',
  },
  coordinateContainer: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: '#2c2c2e',
  },
  coordinateText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  connectionText: {
    color: '#8e8e93',
    fontSize: 11,
    marginTop: 4,
  },
  spoofTitle: {
    color: '#eaeaea',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 10,
  },
  buttonGrid: {
    alignItems: 'center',
    marginVertical: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginVertical: 8,
  },
  movementBtn: {
    backgroundColor: '#2c2c2e',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    alignItems: 'center',
    minWidth: 100,
  },
  movementBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
  },
  emptyOrdersText: {
    color: '#8e8e93',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 12,
  },
  orderItem: {
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  customerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  orderPrice: {
    color: '#00ffcc',
    fontSize: 14,
    fontWeight: '800',
  },
  customerPhone: {
    color: '#8e8e93',
    fontSize: 12,
    marginBottom: 10,
  },
  orderItemsBox: {
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  itemName: {
    color: '#eaeaea',
    fontSize: 12,
    lineHeight: 18,
  },
  orderStatusBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
    overflow: 'hidden',
  },
  status_PENDING: {
    backgroundColor: 'rgba(255, 159, 10, 0.15)',
    color: '#ff9f0a',
  },
  status_ACCEPTED: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    color: '#30d158',
  },
  status_OUT_FOR_DELIVERY: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    color: '#0a84ff',
  },
  status_DELIVERED: {
    backgroundColor: 'rgba(48, 209, 88, 0.25)',
    color: '#30d158',
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    flex: 0.48,
    backgroundColor: '#30d158',
  },
  declineBtn: {
    flex: 0.48,
    backgroundColor: '#ff453a',
  },
  progressBtn: {
    width: '100%',
    backgroundColor: '#00ffcc',
  },
  actionBtnText: {
    color: '#121214',
    fontWeight: '800',
    fontSize: 13,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#eaeaea',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#2c2c2e',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  categoryChipActive: {
    backgroundColor: '#00ffcc',
    borderColor: '#00ffcc',
  },
  categoryChipText: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#121214',
  },
  saveBtn: {
    backgroundColor: '#00ffcc',
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: '#121214',
    fontWeight: '800',
    fontSize: 14,
  },
});
