import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { CONFIG } from '../config';

// Safe conditional import for native MapView to prevent blank screens/crashes in browsers
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Circle = Maps.Circle;
  } catch (err) {
    console.warn('⚠️ MapView load failed on native framework:', err);
  }
}

interface Shop {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  rating?: number;
  reviewCount?: number;
}

export const CustomerMapScreen: React.FC = () => {
  const { api, user, logout, fetchMenuItems } = useAuth();
  const { socket } = useSocket();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  
  // Default Customer Coordinate (Delhi Connaught Place)
  const [customerLat, setCustomerLat] = useState(CONFIG.DEFAULT_LATITUDE);
  const [customerLng, setCustomerLng] = useState(CONFIG.DEFAULT_LONGITUDE);
  const [searchRadius, setSearchRadius] = useState('5');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Ordering State
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [orderItems, setOrderItems] = useState('1x Tangy Golgappa Plate, 1x Aloo Tikki Chaat');
  const [totalAmount, setTotalAmount] = useState('120');
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // Subscription State
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  // Rating State
  const [customerStars, setCustomerStars] = useState(5);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // Menu / Rate Card States
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  // Proximity Grid & Expanding Chevron States
  const [activeTab, setActiveTab] = useState<'map' | 'grid'>('map');
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null);
  const [expandedMenu, setExpandedMenu] = useState<any[]>([]);
  const [expandedReviews, setExpandedReviews] = useState<any[]>([]);
  const [loadingExpanded, setLoadingExpanded] = useState(false);

  const categories = ['All', 'Chaat & Snacks', 'Vegetables', 'Fruits', 'General'];

  // 1. Fetch active shops from REST
  const fetchNearbyShops = async () => {
    setLoading(true);
    try {
      const url = `/api/shops/nearby?lat=${customerLat}&lng=${customerLng}&radiusKm=${searchRadius}${
        selectedCategory && selectedCategory !== 'All' ? `&category=${encodeURIComponent(selectedCategory)}` : ''
      }`;
      const res = await api.get(url);
      setShops(res.data);

      // DEEP LINKING: Check if a shopId is provided in the URL parameters
      if (typeof window !== 'undefined' && window.location) {
        const params = new URLSearchParams(window.location.search);
        const urlShopId = params.get('shopId');
        if (urlShopId) {
          const foundShop = res.data.find((s: any) => s.id === urlShopId);
          if (foundShop) {
            setSelectedShop(foundShop);
            setCustomerLat(foundShop.latitude);
            setCustomerLng(foundShop.longitude);
            console.log(`🔗 [Deep Link] Automatically focused and opened shop: ${foundShop.name}`);
          }
        }
      }
    } catch (err: any) {
      console.warn('❌ Fetching nearby shops failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Poll fallback local real-time coordinates every 3 seconds to animate markers
  useEffect(() => {
    fetchNearbyShops();
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/api/shops/mock-locations');
        const liveCoordinatesMap = res.data; // { "shopId": { latitude, longitude, name, category, isActive } }
        
        setShops((prevShops) =>
          prevShops.map((shop) => {
            const liveData = liveCoordinatesMap[shop.id];
            if (liveData && liveData.isActive) {
              return { ...shop, latitude: liveData.latitude, longitude: liveData.longitude };
            }
            return shop;
          })
        );
      } catch (err) {
        // Silent catch for dev polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedCategory, searchRadius]);

  // 3. Listen to Socket.io Alerts for Shop opening notifications
  useEffect(() => {
    if (socket) {
      console.log('📡 [MapScreen] Binding shop opened listener on Socket client...');
      socket.on('shop-opened-alert', (data: { shopId: string; shopName: string; message: string }) => {
        Alert.alert(
          '🔔 Shop Opened Alert!',
          data.message,
          [
            { text: 'Ignore', style: 'cancel' },
            {
              text: '🔍 Track on Map',
              onPress: () => {
                fetchNearbyShops();
              },
            },
          ]
        );
      });

      return () => {
        socket.off('shop-opened-alert');
      };
    }
  }, [socket]);

  // 4. Fetch subscription status of selected shop
  const fetchSubscriptionStatus = async (shopId: string) => {
    try {
      const res = await api.get(`/api/shops/${shopId}/subscription-status`);
      setIsSubscribed(res.data.subscribed);
    } catch (err) {
      console.warn('❌ Fetch subscription status error:', err);
    }
  };

  useEffect(() => {
    if (selectedShop) {
      fetchSubscriptionStatus(selectedShop.id);
    }
  }, [selectedShop]);

  // Menu Loader Effect
  const loadShopMenu = async (shopId: string) => {
    setLoadingMenu(true);
    try {
      const data = await fetchMenuItems(shopId);
      setMenuItems(data.menu || []);
    } catch (err) {
      console.warn('❌ Failed loading shop menu:', err);
      setMenuItems([]);
    } finally {
      setLoadingMenu(false);
    }
  };

  useEffect(() => {
    if (selectedShop) {
      loadShopMenu(selectedShop.id);
    } else {
      setMenuItems([]);
    }
  }, [selectedShop]);

  // Toggle Proximity Card expansion (Queries Menu + Reviews in parallel)
  const handleToggleExpandShop = async (shopId: string) => {
    if (expandedShopId === shopId) {
      setExpandedShopId(null);
      return;
    }
    setExpandedShopId(shopId);
    setLoadingExpanded(true);
    try {
      // 1. Fetch menu items
      const menuData = await fetchMenuItems(shopId);
      setExpandedMenu(menuData.menu || []);

      // 2. Fetch reviews
      const reviewRes = await api.get(`/api/shops/${shopId}/reviews`);
      setExpandedReviews(reviewRes.data || []);
    } catch (err) {
      console.warn('❌ Failed loading expanded shop details:', err);
      setExpandedMenu([]);
      setExpandedReviews([]);
    } finally {
      setLoadingExpanded(false);
    }
  };

  // Switch to Map tab, pan camera to coordinates and focus open shop details sheet
  const handleTrackOnMap = (shop: any) => {
    setSelectedShop(shop);
    setCustomerLat(shop.latitude);
    setCustomerLng(shop.longitude);
    setActiveTab('map');
  };

  // 5. Toggle Notification subscription
  const toggleSubscription = async () => {
    if (!selectedShop) return;
    setSubscribing(true);
    try {
      const res = await api.post(`/api/shops/${selectedShop.id}/subscribe`);
      setIsSubscribed(res.data.subscribed);
      Alert.alert(
        res.data.subscribed ? '🔔 Subscribed!' : '🔕 Unsubscribed',
        res.data.message
      );
    } catch (err: any) {
      Alert.alert('Subscription Failed', err.response?.data?.error || 'Failed to toggle alert settings.');
    } finally {
      setSubscribing(false);
    }
  };

  // 6. Share Shop profile deep-link URL
  const handleShareShop = async () => {
    if (!selectedShop) return;
    const shareUrl = `${window.location.origin}/?shopId=${selectedShop.id}`;
    
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        Alert.alert(
          '🔗 Profile Link Copied!',
          `You can now paste and share "${selectedShop.name}"'s live location and today's rate card with others!`
        );
      } else {
        Alert.alert('Share Shop Link', `Copy and share this URL: ${shareUrl}`);
      }
    } catch (err) {
      Alert.alert('Share Shop Link', `Copy and share this URL: ${shareUrl}`);
    }
  };

  // 7. Submit star rating
  const handleRateShop = async () => {
    if (!selectedShop) return;
    setRatingSubmitting(true);
    try {
      await api.post(`/api/shops/${selectedShop.id}/rate`, {
        stars: customerStars,
        comment: ratingComment,
      });
      
      Alert.alert('⭐ Thank You!', 'Your feedback helps other customers discover best local vendors.');
      setRatingModalVisible(false);
      setRatingComment('');
      
      fetchNearbyShops();
      setSelectedShop(null);
    } catch (err: any) {
      Alert.alert('Rating Failed', err.response?.data?.error || 'Could not submit rating.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedShop) return;
    setOrderSubmitting(true);
    try {
      const orderPayload = {
        shopId: selectedShop.id,
        items: [{ name: orderItems, qty: 1, price: parseFloat(totalAmount) }],
        totalAmount: parseFloat(totalAmount),
        deliveryLat: customerLat + 0.002,
        deliveryLng: customerLng + 0.002,
      };

      await api.post('/api/orders/create', orderPayload);
      Alert.alert(
        '🎉 Order Placed!',
        `Your order has been sent to ${selectedShop.name}. The vendor will respond shortly. You can track status in real-time.`,
        [{ text: 'OK', onPress: () => {
          setOrderModalVisible(false);
          setSelectedShop(null);
        }}]
      );
    } catch (err: any) {
      Alert.alert('Order Failed', err.response?.data?.error || 'Could not place order.');
    } finally {
      setOrderSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>👋 Hey, {user?.name}</Text>
          <Text style={styles.headerSubtitle}>Discover and track street shops</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* View Selector Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'map' && styles.tabBtnActive]}
          onPress={() => setActiveTab('map')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'map' && styles.tabBtnTextActive]}>
            🗺️ Live Radar Map
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'grid' && styles.tabBtnActive]}
          onPress={() => setActiveTab('grid')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'grid' && styles.tabBtnTextActive]}>
            📋 Proximity Grid
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category selector */}
      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                (selectedCategory === item || (item === 'All' && !selectedCategory)) && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(item === 'All' ? null : item)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  (selectedCategory === item || (item === 'All' && !selectedCategory)) && styles.categoryChipTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {activeTab === 'map' ? (
        /* Map area viewport */
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' ? (
            /* High-fidelity web radar map blueprint simulation */
            <View style={styles.webMapContainer}>
              <View style={styles.webRadarLinesContainer}>
                <View style={styles.radarRing1} />
                <View style={styles.radarRing2} />
                <View style={styles.radarRing3} />
                <View style={styles.radarCrossLineV} />
                <View style={styles.radarCrossLineH} />
              </View>

              {/* Customer coordinates indicator */}
              <View style={[styles.webMarker, styles.customerWebMarker]}>
                <View style={styles.pulsingUserRing} />
                <Text style={styles.webMarkerText}>👤</Text>
                <Text style={styles.customerMarkerLabel}>You</Text>
              </View>

              {/* Active vendors coordinates dynamic projection */}
              {shops.map((shop) => {
                const dLat = shop.latitude - customerLat;
                const dLng = shop.longitude - customerLng;
                
                // Plot offset inside grid (scale factor mapped to CP central area offsets)
                const scale = 3000; 
                const topOffset = 50 - (dLat * scale);
                const leftOffset = 50 + (dLng * scale);

                return (
                  <TouchableOpacity
                    key={shop.id}
                    style={[
                      styles.webMarker,
                      styles.vendorWebMarker,
                      {
                        top: `${Math.max(10, Math.min(90, topOffset))}%`,
                        left: `${Math.max(10, Math.min(90, leftOffset))}%`,
                      },
                    ]}
                    onPress={() => setSelectedShop(shop)}
                  >
                    <View style={styles.pulsingVendorRing} />
                    <Text style={styles.webMarkerText}>
                      {shop.category === 'Vegetables' ? '🥦' : shop.category === 'Fruits' ? '🍎' : '🏪'}
                    </Text>
                    <Text style={styles.vendorMarkerLabel}>{shop.name}</Text>
                    <Text style={styles.vendorMarkerSubLabel}>⭐ {shop.rating || '5.0'}</Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={styles.radarCoordinatesText}>Connaught Place Radar | Radius: {searchRadius} km</Text>
            </View>
          ) : (
            /* Native maps fallback */
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: customerLat,
                longitude: customerLng,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
              }}
            >
              <Marker
                coordinate={{ latitude: customerLat, longitude: customerLng }}
                title="Your Location"
                pinColor="#007aff"
              />
              <Circle
                center={{ latitude: customerLat, longitude: customerLng }}
                radius={parseFloat(searchRadius) * 1000}
                strokeWidth={1}
                strokeColor="rgba(0, 255, 204, 0.3)"
                fillColor="rgba(0, 255, 204, 0.05)"
              />

              {shops.map((shop) => (
                <Marker
                  key={shop.id}
                  coordinate={{ latitude: shop.latitude, longitude: shop.longitude }}
                  title={shop.name}
                  description={`⭐ ${shop.rating || '5.0'} (${shop.reviewCount || 0} reviews)`}
                  onPress={() => setSelectedShop(shop)}
                >
                  <View style={styles.markerContainer}>
                    <Text style={styles.markerEmoji}>
                      {shop.category === 'Vegetables' ? '🥦' : shop.category === 'Fruits' ? '🍎' : '🏪'}
                    </Text>
                  </View>
                </Marker>
              ))}
            </MapView>
          )}

          {loading && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#00ffcc" />
            </View>
          )}
        </View>
      ) : (
        /* Proximity Sorted 2-Column Responsive Card Grid */
        <ScrollView style={styles.gridScrollView} contentContainerStyle={styles.gridScrollViewContent}>
          <Text style={styles.gridTitle}>📋 Proximity Directory (Sorted by Proximity)</Text>
          
          {shops.length === 0 ? (
            <Text style={styles.noShopsText}>No active vendors found within search radius.</Text>
          ) : (
            <View style={styles.gridRow}>
              {[...shops]
                .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
                .map((shop) => {
                  const isExpanded = expandedShopId === shop.id;
                  return (
                    <View key={shop.id} style={[styles.gridCard, isExpanded && styles.gridCardExpanded]}>
                      {/* Card mini metadata row */}
                      <View style={styles.gridCardHeader}>
                        <View style={styles.categoryBadgeMini}>
                          <Text style={styles.categoryBadgeMiniText}>{shop.category}</Text>
                        </View>
                        <Text style={styles.gridDistance}>📍 {(shop.distanceKm || 0).toFixed(1)} km</Text>
                        
                        {/* Green Arrow expanding Chevron */}
                        <TouchableOpacity
                          style={[styles.expandChevron, isExpanded && styles.expandChevronActive]}
                          onPress={() => handleToggleExpandShop(shop.id)}
                        >
                          <Text style={styles.expandChevronText}>{isExpanded ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.gridShopName} numberOfLines={1}>{shop.name}</Text>
                      <Text style={styles.gridShopStars}>⭐️ {shop.rating || '5.0'} ({shop.reviewCount || 0})</Text>

                      {/* Expandable Section: Today's Items + Customer Reviews */}
                      {isExpanded && (
                        <View style={styles.expandedContent}>
                          {loadingExpanded ? (
                            <ActivityIndicator color="#00ffcc" style={{ marginVertical: 12 }} />
                          ) : (
                            <>
                              {/* Inline Rate Card */}
                              <Text style={styles.expandedSubTitle}>🛒 Today's Rate Card:</Text>
                              {expandedMenu.length === 0 ? (
                                <Text style={styles.expandedEmptyText}>No items available today.</Text>
                              ) : (
                                expandedMenu.map((item) => (
                                  <View key={item.id} style={styles.expandedMenuRow}>
                                    <Text style={[styles.expandedMenuName, !item.isAvailable && styles.strikeText]} numberOfLines={1}>
                                      • {item.name}
                                    </Text>
                                    <Text style={styles.expandedMenuPrice}>₹{item.price}</Text>
                                  </View>
                                ))
                              )}

                              {/* Inline Comments/Reviews */}
                              <Text style={[styles.expandedSubTitle, { marginTop: 12 }]}>💬 Customer Feedback:</Text>
                              {expandedReviews.length === 0 ? (
                                <Text style={styles.expandedEmptyText}>No reviews yet.</Text>
                              ) : (
                                expandedReviews.map((rev) => (
                                  <View key={rev.id} style={styles.expandedReviewRow}>
                                    <Text style={styles.expandedReviewMeta}>
                                      👤 {rev.customerName} | {'★'.repeat(rev.stars)}
                                    </Text>
                                    {rev.comment ? (
                                      <Text style={styles.expandedReviewComment}>"{rev.comment}"</Text>
                                    ) : null}
                                  </View>
                                ))
                              )}
                            </>
                          )}
                        </View>
                      )}

                      {/* Card Action footer (map locator) */}
                      <View style={styles.gridActions}>
                        <TouchableOpacity
                          style={styles.gridTrackBtn}
                          onPress={() => handleTrackOnMap(shop)}
                        >
                          <Text style={styles.gridTrackBtnText}>📍 Track Live</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Slide up details sheet */}
      {selectedShop && (
        <View style={styles.detailSheet}>
          <View style={styles.detailHeader}>
            <View style={styles.leftMeta}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{selectedShop.category}</Text>
              </View>
              <Text style={styles.starsText}>⭐️ {selectedShop.rating || '5.0'} ({selectedShop.reviewCount || 0})</Text>
            </View>

            <TouchableOpacity 
              style={[styles.bellButton, isSubscribed && styles.bellButtonActive]} 
              onPress={toggleSubscription}
              disabled={subscribing}
            >
              {subscribing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.bellEmoji}>{isSubscribed ? '🔔' : '🔕'}</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <Text style={styles.shopName}>{selectedShop.name}</Text>
          <Text style={styles.shopDesc}>{selectedShop.description || 'No description provided.'}</Text>

          {/* Today's Rate Card / Menu List inside slide up sheet */}
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>📋 Today's Rate Card & Menu:</Text>
            {loadingMenu ? (
              <ActivityIndicator color="#00ffcc" style={{ marginVertical: 12 }} />
            ) : menuItems.length === 0 ? (
              <Text style={styles.noMenuText}>No items added to the menu yet.</Text>
            ) : (
              <ScrollView style={styles.menuScroll} nestedScrollEnabled={true}>
                {menuItems.map((item) => {
                  const isAvailable = item.isAvailable;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.menuItemRow, !isAvailable && styles.menuItemRowDisabled]}
                      onPress={() => {
                        if (isAvailable) {
                          setOrderItems(`1x ${item.name}`);
                          setTotalAmount(String(item.price));
                          setOrderModalVisible(true);
                        } else {
                          Alert.alert('Item Unavailable', `"${item.name}" is not available today/on this specific date.`);
                        }
                      }}
                    >
                      <View style={styles.menuItemInfo}>
                        <View style={styles.menuItemNameRow}>
                          <Text style={[styles.menuItemName, !isAvailable && styles.menuItemDisabledText]}>
                            {item.name}
                          </Text>
                          {!isAvailable && (
                            <Text style={styles.unavailableBadge}>Unavailable</Text>
                          )}
                        </View>
                        {item.description ? (
                          <Text style={[styles.menuItemDesc, !isAvailable && styles.menuItemDisabledText]} numberOfLines={1}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.menuItemPrice, !isAvailable && styles.menuItemDisabledText]}>
                        ₹{item.price}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.orderBtn}
              onPress={() => setOrderModalVisible(true)}
            >
              <Text style={styles.orderBtnText}>🛍️ Order Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShareShop}
            >
              <Text style={styles.shareBtnText}>🔗 Share</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.rateBtn}
              onPress={() => setRatingModalVisible(true)}
            >
              <Text style={styles.rateBtnText}>⭐️ Rate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedShop(null)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Order Placement Dialog */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={orderModalVisible}
        onRequestClose={() => setOrderModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📦 Checkout - {selectedShop?.name}</Text>
            
            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>Items to Order</Text>
              <TextInput
                style={styles.textInput}
                value={orderItems}
                onChangeText={setOrderItems}
                placeholder="Items list"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>Total Estimated Price (INR)</Text>
              <TextInput
                style={styles.textInput}
                value={totalAmount}
                onChangeText={setTotalAmount}
                keyboardType="numeric"
                placeholder="Price"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSubmit]}
                onPress={handlePlaceOrder}
                disabled={orderSubmitting}
              >
                {orderSubmitting ? (
                  <ActivityIndicator color="#121214" />
                ) : (
                  <Text style={styles.modalBtnSubmitText}>Confirm & Send Order</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setOrderModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rate Shop Dialog */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={ratingModalVisible}
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⭐️ Rate Shop - {selectedShop?.name}</Text>
            
            <View style={styles.starsPicker}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setCustomerStars(star)}>
                  <Text style={styles.starTextLarge}>
                    {star <= customerStars ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>Leave a Review (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={ratingComment}
                onChangeText={setRatingComment}
                placeholder="How was your experience?"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSubmit]}
                onPress={handleRateShop}
                disabled={ratingSubmitting}
              >
                {ratingSubmitting ? (
                  <ActivityIndicator color="#121214" />
                ) : (
                  <Text style={styles.modalBtnSubmitText}>Submit Review</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setRatingModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#1c1c1e',
  },
  headerTitle: {
    fontSize: 20,
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
  categoriesContainer: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#1c1c1e',
    borderBottomWidth: 1,
    borderColor: '#2c2c2e',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2c2c2e',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  categoryChipActive: {
    backgroundColor: '#00ffcc',
    borderColor: '#00ffcc',
  },
  categoryChipText: {
    color: '#8e8e93',
    fontWeight: '700',
    fontSize: 13,
  },
  categoryChipTextActive: {
    color: '#121214',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 18, 20, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerContainer: {
    backgroundColor: '#1c1c1e',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#00ffcc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  markerEmoji: {
    fontSize: 16,
  },
  detailSheet: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leftMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(0, 255, 204, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#00ffcc',
    marginRight: 10,
  },
  categoryBadgeText: {
    color: '#00ffcc',
    fontSize: 11,
    fontWeight: '800',
  },
  starsText: {
    color: '#ffcc00',
    fontSize: 13,
    fontWeight: '700',
  },
  bellButton: {
    backgroundColor: '#2c2c2e',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  bellButtonActive: {
    backgroundColor: '#00ffcc',
    borderColor: '#00ffcc',
  },
  bellEmoji: {
    fontSize: 14,
  },
  distanceText: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '600',
  },
  shopName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  shopDesc: {
    fontSize: 13,
    color: '#8e8e93',
    lineHeight: 18,
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderBtn: {
    flex: 0.38,
    backgroundColor: '#00ffcc',
    borderRadius: 10,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderBtnText: {
    color: '#121214',
    fontWeight: '800',
    fontSize: 13,
  },
  shareBtn: {
    flex: 0.24,
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00ffcc',
  },
  shareBtnText: {
    color: '#00ffcc',
    fontWeight: '700',
    fontSize: 12,
  },
  rateBtn: {
    flex: 0.22,
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  rateBtnText: {
    color: '#eaeaea',
    fontWeight: '700',
    fontSize: 12,
  },
  closeBtn: {
    flex: 0.14,
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  closeBtnText: {
    color: '#8e8e93',
    fontWeight: '700',
    fontSize: 12,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 20, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: '#2c2c2e',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
  },
  inputBox: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#eaeaea',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalBtn: {
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnSubmit: {
    flex: 0.68,
    backgroundColor: '#00ffcc',
  },
  modalBtnSubmitText: {
    color: '#121214',
    fontWeight: '800',
    fontSize: 14,
  },
  modalBtnCancel: {
    flex: 0.28,
    backgroundColor: '#ff453a',
  },
  modalBtnCancelText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  starsPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  starTextLarge: {
    fontSize: 40,
    color: '#ffcc00',
    marginHorizontal: 6,
  },
  
  /* HIGH-FIDELITY SIMULATED RADAR GRID STYLING FOR CRASH-FREE BROWSER RUNS */
  webMapContainer: {
    flex: 1,
    backgroundColor: '#121214',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  webRadarLinesContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarRing1: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 204, 0.08)',
    position: 'absolute',
  },
  radarRing2: {
    width: 350,
    height: 350,
    borderRadius: 175,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 204, 0.05)',
    position: 'absolute',
  },
  radarRing3: {
    width: 600,
    height: 600,
    borderRadius: 300,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 204, 0.02)',
    position: 'absolute',
  },
  radarCrossLineV: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    position: 'absolute',
  },
  radarCrossLineH: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    position: 'absolute',
  },
  webMarker: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    zIndex: 10,
  },
  customerWebMarker: {
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  vendorWebMarker: {
    zIndex: 15,
  },
  webMarkerText: {
    fontSize: 22,
    textAlign: 'center',
  },
  customerMarkerLabel: {
    color: '#007aff',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  vendorMarkerLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
    width: 120,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  vendorMarkerSubLabel: {
    color: '#ffcc00',
    fontSize: 9,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  pulsingUserRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#007aff',
    opacity: 0.3,
  },
  pulsingVendorRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#00ffcc',
    opacity: 0.3,
  },
  radarCoordinatesText: {
    position: 'absolute',
    bottom: 20,
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  menuSection: {
    marginTop: 14,
    marginBottom: 16,
    borderTopWidth: 1,
    borderColor: '#2c2c2e',
    paddingTop: 14,
  },
  menuSectionTitle: {
    color: '#00ffcc',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  noMenuText: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 10,
  },
  menuScroll: {
    maxHeight: 130,
  },
  menuItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  menuItemRowDisabled: {
    backgroundColor: '#1c1c1e',
    borderColor: '#2c2c2e',
    opacity: 0.5,
  },
  menuItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  menuItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 6,
  },
  menuItemDisabledText: {
    color: '#666',
  },
  unavailableBadge: {
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    color: '#ff453a',
    fontSize: 8,
    fontWeight: '800',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3,
    overflow: 'hidden',
  },
  menuItemDesc: {
    color: '#8e8e93',
    fontSize: 10,
    marginTop: 2,
  },
  menuItemPrice: {
    color: '#00ffcc',
    fontSize: 12,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1e',
    borderBottomWidth: 1,
    borderColor: '#2c2c2e',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  tabBtnActive: {
    borderColor: '#00ffcc',
  },
  tabBtnText: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#00ffcc',
  },
  gridScrollView: {
    flex: 1,
    backgroundColor: '#121214',
  },
  gridScrollViewContent: {
    padding: 16,
    paddingBottom: 40,
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
  },
  noShopsText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 40,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48.5%',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    justifyContent: 'space-between',
    elevation: 3,
  },
  gridCardExpanded: {
    width: '100%', // Expand full width when clicked!
    borderColor: '#00ffcc',
    shadowColor: '#00ffcc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadgeMini: {
    backgroundColor: 'rgba(0, 255, 204, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#00ffcc',
    marginRight: 6,
  },
  categoryBadgeMiniText: {
    color: '#00ffcc',
    fontSize: 9,
    fontWeight: '800',
  },
  gridDistance: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '700',
  },
  expandChevron: {
    backgroundColor: 'rgba(48, 209, 88, 0.1)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.4)',
  },
  expandChevronActive: {
    backgroundColor: '#30d158',
    borderColor: '#30d158',
  },
  expandChevronText: {
    color: '#30d158',
    fontSize: 9,
    fontWeight: '800',
  },
  gridShopName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  gridShopStars: {
    color: '#ffcc00',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
  },
  expandedContent: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#2c2c2e',
    marginBottom: 10,
  },
  expandedSubTitle: {
    color: '#00ffcc',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  expandedEmptyText: {
    color: '#555',
    fontSize: 10,
    marginVertical: 4,
    fontStyle: 'italic',
  },
  expandedMenuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  expandedMenuName: {
    color: '#eaeaea',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  expandedMenuPrice: {
    color: '#00ffcc',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 10,
  },
  strikeText: {
    textDecorationLine: 'line-through',
    color: '#555',
  },
  expandedReviewRow: {
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  expandedReviewMeta: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '700',
  },
  expandedReviewComment: {
    color: '#666',
    fontSize: 9,
    fontStyle: 'italic',
    marginTop: 2,
  },
  gridActions: {
    marginTop: 6,
  },
  gridTrackBtn: {
    backgroundColor: 'rgba(0, 255, 204, 0.1)',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00ffcc',
  },
  gridTrackBtnText: {
    color: '#00ffcc',
    fontSize: 11,
    fontWeight: '800',
  },
});
