import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  daysAvailable: string;
  unavailabilities: { date: string }[];
}

export const MenuManagementScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { fetchVendorMenuItems, addMenuItem, toggleItemAvailability, deleteMenuItem } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);

  // New Item State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  const [adding, setAdding] = useState(false);

  // Date selection state for overrides (Next 7 days tracker)
  const [datesList, setDatesList] = useState<{ label: string; dateStr: string }[]>([]);
  const [activeDateIndex, setActiveDateIndex] = useState(0);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Initialize next 7 days list
  useEffect(() => {
    const dates = [];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`;
      
      let label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
      dates.push({ label, dateStr });
    }
    setDatesList(dates);
  }, []);

  const loadMenu = async () => {
    setLoading(true);
    try {
      const data = await fetchVendorMenuItems();
      setMenuItems(data);
    } catch (err: any) {
      Alert.alert('Load Menu Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const handleToggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleAddItem = async () => {
    if (!name || !price || selectedDays.length === 0) {
      Alert.alert('Incomplete Form', 'Please enter a name, price, and select at least one day.');
      return;
    }

    setAdding(true);
    try {
      await addMenuItem(name, description, parseFloat(price), selectedDays.join(','));
      Alert.alert('Success', `"${name}" added successfully to your rate card.`);
      setName('');
      setDescription('');
      setPrice('');
      setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
      loadMenu();
    } catch (err: any) {
      Alert.alert('Add Failed', err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    Alert.alert(
      'Delete Menu Item',
      `Are you sure you want to permanently delete "${itemName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMenuItem(itemId);
              setMenuItems(menuItems.filter((item) => item.id !== itemId));
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message);
            }
          },
        },
      ]
    );
  };

  const handleToggleItemStatus = async (itemId: string, isAvailable: boolean) => {
    if (datesList.length === 0) return;
    const targetDate = datesList[activeDateIndex].dateStr;
    
    try {
      await toggleItemAvailability(itemId, targetDate, isAvailable);
      
      // Update local state to show correct toggle instantly
      setMenuItems((prevItems) =>
        prevItems.map((item) => {
          if (item.id === itemId) {
            const updatedUnavail = isAvailable
              ? item.unavailabilities.filter((u) => u.date !== targetDate)
              : [...item.unavailabilities, { date: targetDate }];
            return { ...item, unavailabilities: updatedUnavail };
          }
          return item;
        })
      );
    } catch (err: any) {
      Alert.alert('Status Update Failed', err.message);
    }
  };

  const getAvailabilityStatus = (item: MenuItem) => {
    if (datesList.length === 0) return { offered: false, active: false };
    
    const activeDateObj = datesList[activeDateIndex];
    const targetDateStr = activeDateObj.dateStr;
    
    // Check if day matches
    const dateObj = new Date(targetDateStr);
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const activeDayName = weekdays[dateObj.getDay()];
    
    const isOfferedOnDay = item.daysAvailable
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .includes(activeDayName.toLowerCase());
      
    // Check if date blocked
    const isBlockedOnDate = item.unavailabilities.some((u) => u.date === targetDateStr);
    
    return {
      offered: isOfferedOnDay,
      active: isOfferedOnDay && !isBlockedOnDate,
    };
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>🏪 Rate Card & Menu</Text>
          <Text style={styles.headerSubtitle}>Configure items & dates availability</Text>
        </View>
      </View>

      {/* Form: Add New Menu Item */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>✨ Add New Item to Menu</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Item Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Special Aloo Chaat, Samosa"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Price (INR)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="e.g. 50"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe what makes this item special..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Days of Week Available</Text>
          <View style={styles.daysRow}>
            {daysOfWeek.map((day) => {
              const selected = selectedDays.includes(day);
              const shortDay = day.substring(0, 3);
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, selected && styles.dayChipActive]}
                  onPress={() => handleToggleDay(day)}
                >
                  <Text style={[styles.dayChipText, selected && styles.dayChipTextActive]}>
                    {shortDay}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleAddItem} disabled={adding}>
          {adding ? (
            <ActivityIndicator color="#121214" />
          ) : (
            <Text style={styles.saveBtnText}>➕ Add Item to Rate Card</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Availability Selector (Choose specific date to configure overrides) */}
      <View style={styles.datesHeaderContainer}>
        <Text style={styles.datesHeaderTitle}>📅 Select Date to Toggle Availability:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesScroll}>
          {datesList.map((dt, idx) => {
            const isActive = idx === activeDateIndex;
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.dateBlock, isActive && styles.dateBlockActive]}
                onPress={() => setActiveDateIndex(idx)}
              >
                <Text style={[styles.dateBlockLabel, isActive && styles.dateBlockLabelActive]}>
                  {dt.label}
                </Text>
                <Text style={styles.dateBlockSub}>{dt.dateStr.substring(5)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Menu List */}
      <View style={[styles.card, styles.menuListCard]}>
        <Text style={styles.cardHeader}>📋 Current Menu & Availability Status</Text>
        <Text style={styles.activeDateBanner}>
          Configuring overrides for: <Text style={styles.highlightText}>{datesList[activeDateIndex]?.label} ({datesList[activeDateIndex]?.dateStr})</Text>
        </Text>

        {loading && <ActivityIndicator color="#00ffcc" style={{ margin: 24 }} />}
        
        {!loading && menuItems.length === 0 && (
          <Text style={styles.emptyText}>No items added to your menu yet. Create one above to start!</Text>
        )}

        {menuItems.map((item) => {
          const { offered, active } = getAvailabilityStatus(item);
          return (
            <View key={item.id} style={styles.menuItemRow}>
              <View style={styles.menuItemMeta}>
                <View style={styles.nameRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>₹{item.price}</Text>
                </View>
                {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
                <Text style={styles.itemDays}>Offered on: {item.daysAvailable.replace(/,/g, ', ')}</Text>
                
                {/* Visual day status indicator */}
                <View style={styles.badgesRow}>
                  {offered ? (
                    <Text style={[styles.statusBadge, styles.badgeOffered]}>📅 Offered Today</Text>
                  ) : (
                    <Text style={[styles.statusBadge, styles.badgeNotOffered]}>❌ Closed Today</Text>
                  )}
                  {offered && !active && (
                    <Text style={[styles.statusBadge, styles.badgeBlocked]}>🚫 Paused on Date</Text>
                  )}
                </View>
              </View>

              <View style={styles.itemActions}>
                {offered ? (
                  <View style={styles.toggleWrap}>
                    <Text style={styles.toggleLabel}>{active ? 'Available' : 'Sold Out'}</Text>
                    <Switch
                      value={active}
                      onValueChange={(val) => handleToggleItemStatus(item.id, val)}
                      trackColor={{ false: '#3a3a3c', true: '#00ffcc' }}
                      thumbColor={active ? '#121214' : '#8e8e93'}
                    />
                  </View>
                ) : (
                  <Text style={styles.disabledText}>Off-Day</Text>
                )}

                <TouchableOpacity 
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteItem(item.id, item.name)}
                >
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
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
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#1c1c1e',
    borderBottomWidth: 1,
    borderColor: '#2c2c2e',
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2c2c2e',
    marginRight: 15,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitleWrap: {
    flex: 1,
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
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  menuListCard: {
    borderColor: 'rgba(0, 255, 204, 0.1)',
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#00ffcc',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#eaeaea',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  textArea: {
    height: 60,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#2c2c2e',
    marginRight: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  dayChipActive: {
    backgroundColor: '#00ffcc',
    borderColor: '#00ffcc',
  },
  dayChipText: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '700',
  },
  dayChipTextActive: {
    color: '#121214',
  },
  saveBtn: {
    backgroundColor: '#00ffcc',
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#00ffcc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#121214',
    fontWeight: '800',
    fontSize: 14,
  },
  datesHeaderContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  datesHeaderTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  datesScroll: {
    flexDirection: 'row',
  },
  dateBlock: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    minWidth: 80,
  },
  dateBlockActive: {
    backgroundColor: 'rgba(0, 255, 204, 0.1)',
    borderColor: '#00ffcc',
  },
  dateBlockLabel: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '700',
  },
  dateBlockLabelActive: {
    color: '#00ffcc',
  },
  dateBlockSub: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
  },
  activeDateBanner: {
    color: '#8e8e93',
    fontSize: 12,
    backgroundColor: '#2c2c2e',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  highlightText: {
    color: '#00ffcc',
    fontWeight: '700',
  },
  menuItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  menuItemMeta: {
    flex: 1,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginRight: 10,
  },
  itemPrice: {
    color: '#00ffcc',
    fontSize: 13,
    fontWeight: '800',
  },
  itemDesc: {
    color: '#8e8e93',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 6,
  },
  itemDays: {
    color: '#666',
    fontSize: 10,
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  statusBadge: {
    fontSize: 9,
    fontWeight: '800',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginRight: 6,
    overflow: 'hidden',
  },
  badgeOffered: {
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    color: '#30d158',
  },
  badgeNotOffered: {
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
    color: '#ff453a',
  },
  badgeBlocked: {
    backgroundColor: 'rgba(255, 159, 10, 0.12)',
    color: '#ff9f0a',
  },
  itemActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  toggleWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleLabel: {
    color: '#eaeaea',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  disabledText: {
    color: '#555',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 12,
  },
  deleteBtn: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 8,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  deleteBtnText: {
    fontSize: 12,
  },
  emptyText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 20,
  },
});
