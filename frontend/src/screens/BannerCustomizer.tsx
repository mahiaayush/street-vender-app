import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  PanResponder,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';

// Screen Dimensions
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Available Preset Background Images (from Unsplash corresponding to categories)
const BACKGROUND_TEMPLATES = [
  {
    id: 'veggies',
    name: 'Fresh Greens',
    url: 'https://images.unsplash.com/photo-1566385962061-6d44810c561d?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'fruits',
    name: 'Fruit Stall',
    url: 'https://images.unsplash.com/photo-1610832958506-ee56336191a1?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'chaat',
    name: 'Warm Snacks',
    url: 'https://images.unsplash.com/photo-1601050690597-df056fb49785?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'grocery',
    name: 'General Store',
    url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'abstract',
    name: 'Vibrant Neon',
    url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80',
  },
];

interface BannerCustomizerProps {
  visible: boolean;
  onClose: () => void;
  vendorName: string;
  shopName: string;
  shopCategory: string;
  shopPhone: string;
  // Sharing toggles passed from settings
  showProfilePic: boolean;
  showBusinessName: boolean;
  showMobile: boolean;
  showAddress: boolean;
  // Shared coordinates
  latitude: number | null;
  longitude: number | null;
}

export const BannerCustomizer: React.FC<BannerCustomizerProps> = ({
  visible,
  onClose,
  vendorName,
  shopName,
  shopCategory,
  shopPhone,
  showProfilePic,
  showBusinessName,
  showMobile,
  showAddress,
  latitude,
  longitude,
}) => {
  // 1. Customizer Config State
  const [selectedBg, setSelectedBg] = useState(BACKGROUND_TEMPLATES[0].url);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16'>('1:1');
  const [footerTemplate, setFooterTemplate] = useState<'classic' | 'floating'>('classic');

  // 2. Adjustments State
  const [footerHeight, setFooterHeight] = useState(80); // range: 50-120
  const [footerPadding, setFooterPadding] = useState(12); // range: 5-25
  const [footerOpacity, setFooterOpacity] = useState(0.85); // range: 0.2 - 1.0
  const [avatarScale, setAvatarScale] = useState(1.0); // range: 0.6 - 1.8

  // Base Avatar Size
  const BASE_AVATAR_SIZE = 64;
  const avatarSize = BASE_AVATAR_SIZE * avatarScale;

  // Formatting strings
  const formattedPhone = shopPhone || 'Not Shared';
  const formattedAddress =
    latitude && longitude ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : 'Delhi Central Area';

  // Dimensions of Canvas Workspace (Scaled to fit the screen nicely)
  const CANVAS_WIDTH = SCREEN_WIDTH - 40; // 20px padding left & right
  const CANVAS_HEIGHT = aspectRatio === '1:1' ? CANVAS_WIDTH : (CANVAS_WIDTH * 16) / 9;

  // View shot reference for capturing composition
  const viewShotRef = useRef<any>(null);

  // 3. Floating Layers Draggable Coordinates State
  // Initial positions
  const [avatarPos, setAvatarPos] = useState({ x: 20, y: 20 });
  const [badgePos, setBadgePos] = useState({ x: 20, y: 140 });

  // Size of Floating Badge container (approximate)
  const badgeWidth = 160;
  const badgeHeight = 90;

  // Accumulator references to track the final dropped position
  const avatarOffset = useRef({ x: 20, y: 20 });
  const badgeOffset = useRef({ x: 20, y: 140 });

  // Update offset values when canvas bounds or coordinates reset
  useEffect(() => {
    // Keep elements inside bounds if canvas height changes
    setAvatarPos((prev) => {
      const clampedX = Math.max(0, Math.min(CANVAS_WIDTH - avatarSize, prev.x));
      const clampedY = Math.max(0, Math.min(CANVAS_HEIGHT - avatarSize, prev.y));
      avatarOffset.current = { x: clampedX, y: clampedY };
      return { x: clampedX, y: clampedY };
    });

    setBadgePos((prev) => {
      const clampedX = Math.max(0, Math.min(CANVAS_WIDTH - badgeWidth, prev.x));
      const clampedY = Math.max(0, Math.min(CANVAS_HEIGHT - badgeHeight, prev.y));
      badgeOffset.current = { x: clampedX, y: clampedY };
      return { x: clampedX, y: clampedY };
    });
  }, [aspectRatio, avatarScale]);

  // Draggable Avatar PanResponder
  const avatarPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        let newX = avatarOffset.current.x + gestureState.dx;
        let newY = avatarOffset.current.y + gestureState.dy;

        // Bounding clamp checks
        newX = Math.max(0, Math.min(CANVAS_WIDTH - avatarSize, newX));
        newY = Math.max(0, Math.min(CANVAS_HEIGHT - avatarSize, newY));

        setAvatarPos({ x: newX, y: newY });
      },
      onPanResponderRelease: (evt, gestureState) => {
        let finalX = avatarOffset.current.x + gestureState.dx;
        let finalY = avatarOffset.current.y + gestureState.dy;

        finalX = Math.max(0, Math.min(CANVAS_WIDTH - avatarSize, finalX));
        finalY = Math.max(0, Math.min(CANVAS_HEIGHT - avatarSize, finalY));

        avatarOffset.current = { x: finalX, y: finalY };
      },
    })
  ).current;

  // Draggable Badge PanResponder
  const badgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        let newX = badgeOffset.current.x + gestureState.dx;
        let newY = badgeOffset.current.y + gestureState.dy;

        // Bounding clamp checks
        newX = Math.max(0, Math.min(CANVAS_WIDTH - badgeWidth, newX));
        newY = Math.max(0, Math.min(CANVAS_HEIGHT - badgeHeight, newY));

        setBadgePos({ x: newX, y: newY });
      },
      onPanResponderRelease: (evt, gestureState) => {
        let finalX = badgeOffset.current.x + gestureState.dx;
        let finalY = badgeOffset.current.y + gestureState.dy;

        finalX = Math.max(0, Math.min(CANVAS_WIDTH - badgeWidth, finalX));
        finalY = Math.max(0, Math.min(CANVAS_HEIGHT - badgeHeight, finalY));

        badgeOffset.current = { x: finalX, y: finalY };
      },
    })
  ).current;

  // Quick Snapping Positions for Floating Overlay Badge
  const snapToCorner = (corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    let x = 0;
    let y = 0;

    switch (corner) {
      case 'top-left':
        x = 15;
        y = 15;
        break;
      case 'top-right':
        x = CANVAS_WIDTH - badgeWidth - 15;
        y = 15;
        break;
      case 'bottom-left':
        x = 15;
        y = CANVAS_HEIGHT - badgeHeight - 15;
        break;
      case 'bottom-right':
        x = CANVAS_WIDTH - badgeWidth - 15;
        y = CANVAS_HEIGHT - badgeHeight - 15;
        break;
    }

    setBadgePos({ x, y });
    badgeOffset.current = { x, y };
  };

  // Export/Capture Handler
  const handleExport = async () => {
    if (Platform.OS === 'web') {
      try {
        const canvas = document.createElement('canvas');
        const exportWidth = aspectRatio === '1:1' ? 1080 : 1080;
        const exportHeight = aspectRatio === '1:1' ? 1080 : 1920;
        canvas.width = exportWidth;
        canvas.height = exportHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context not available');

        // Draw base image
        const baseImg = new window.Image();
        baseImg.crossOrigin = 'anonymous';
        baseImg.src = selectedBg;

        baseImg.onload = () => {
          ctx.drawImage(baseImg, 0, 0, exportWidth, exportHeight);

          // Scaling calculations
          const scaleX = exportWidth / CANVAS_WIDTH;
          const scaleY = exportHeight / CANVAS_HEIGHT;

          // Helper to draw details after profile picture is processed
          const drawDetails = () => {
            if (footerTemplate === 'classic') {
              const fHeight = footerHeight * scaleY;
              ctx.fillStyle = `rgba(28, 28, 30, ${footerOpacity})`;
              ctx.fillRect(0, exportHeight - fHeight, exportWidth, fHeight);

              // Setup text styling
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';

              let lineY = exportHeight - fHeight + footerPadding * scaleY + 25;

              if (showBusinessName) {
                ctx.font = `bold ${Math.round(24 * scaleX)}px sans-serif`;
                ctx.fillText(shopName, exportWidth / 2, lineY);
                lineY += 34 * scaleY;
              }

              ctx.font = `${Math.round(18 * scaleX)}px sans-serif`;
              let subtextParts = [];
              if (showMobile) subtextParts.push(`📞 ${formattedPhone}`);
              if (showAddress) subtextParts.push(`📍 ${formattedAddress}`);

              if (subtextParts.length > 0) {
                ctx.fillText(subtextParts.join('  |  '), exportWidth / 2, lineY);
              }
            } else {
              // Floating Overlay Badge
              const bWidth = badgeWidth * scaleX;
              const bHeight = badgeHeight * scaleY;
              const bX = badgePos.x * scaleX;
              const bY = badgePos.y * scaleY;

              // Draw Glass Card Background
              ctx.fillStyle = `rgba(28, 28, 30, ${footerOpacity})`;
              ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
              ctx.lineWidth = Math.round(2 * scaleX);
              ctx.beginPath();
              
              const radius = Math.round(14 * scaleX);
              // Draw rounded rect
              ctx.moveTo(bX + radius, bY);
              ctx.lineTo(bX + bWidth - radius, bY);
              ctx.quadraticCurveTo(bX + bWidth, bY, bX + bWidth, bY + radius);
              ctx.lineTo(bX + bWidth, bY + bHeight - radius);
              ctx.quadraticCurveTo(bX + bWidth, bY + bHeight, bX + bWidth - radius, bY + bHeight);
              ctx.lineTo(bX + radius, bY + bHeight);
              ctx.quadraticCurveTo(bX, bY + bHeight, bX, bY + bHeight - radius);
              ctx.lineTo(bX, bY + radius);
              ctx.quadraticCurveTo(bX, bY, bX + radius, bY);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              // Draw Badge Content
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'left';

              let textX = bX + 16 * scaleX;
              let textY = bY + 28 * scaleY;

              if (showBusinessName) {
                ctx.font = `bold ${Math.round(18 * scaleX)}px sans-serif`;
                ctx.fillText(shopName, textX, textY);
                textY += 24 * scaleY;
              }

              ctx.font = `${Math.round(14 * scaleX)}px sans-serif`;
              if (showMobile) {
                ctx.fillText(`📞 ${formattedPhone}`, textX, textY);
                textY += 20 * scaleY;
              }
              if (showAddress) {
                ctx.fillText(`📍 ${formattedAddress}`, textX, textY);
              }
            }

            // Trigger browser download
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.download = `${shopName.replace(/\s+/g, '_')}_banner.jpg`;
            link.href = dataUrl;
            link.click();
            Alert.alert('Success', 'Banner image compiled and downloaded successfully!');
          };

          // Draw Profile Picture (Avatar)
          if (showProfilePic) {
            const avatarImg = new window.Image();
            avatarImg.crossOrigin = 'anonymous';
            // standard beautiful avatar or initials fallback
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
              shopName
            )}&background=00ffcc&color=121214&size=200&bold=true`;

            avatarImg.onload = () => {
              const dSize = avatarSize * scaleX;
              const dX = avatarPos.x * scaleX;
              const dY = avatarPos.y * scaleY;

              ctx.save();
              // Create circular clipping path
              ctx.beginPath();
              ctx.arc(dX + dSize / 2, dY + dSize / 2, dSize / 2, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(avatarImg, dX, dY, dSize, dSize);
              ctx.restore();

              // Draw gold frame border
              ctx.strokeStyle = '#00ffcc';
              ctx.lineWidth = Math.round(3 * scaleX);
              ctx.beginPath();
              ctx.arc(dX + dSize / 2, dY + dSize / 2, dSize / 2, 0, Math.PI * 2);
              ctx.stroke();

              drawDetails();
            };
            avatarImg.onerror = () => {
              drawDetails();
            };
          } else {
            drawDetails();
          }
        };
      } catch (err: any) {
        Alert.alert('Export Failed', 'Unable to render image in browser: ' + err.message);
      }
    } else {
      // Native (Expo/iOS/Android) ViewShot Capture
      try {
        const uri = await captureRef(viewShotRef, {
          format: 'jpg',
          quality: 0.95,
          result: 'tmpfile',
        });
        Alert.alert(
          '🎉 Banner Created!',
          'Your personalized multi-layer status banner has been flattened into a high-res asset.',
          [
            { text: 'Copy Temp URI', onPress: () => console.log('Banner URI:', uri) },
            { text: 'OK', style: 'default' },
          ]
        );
      } catch (err: any) {
        Alert.alert('Error Capturing Workspace', err.message);
      }
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.modalBg}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎨 Canvas Customizer</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {/* Aspect Ratio and Template Selection Buttons */}
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.sectionTitle}>Ratio</Text>
            <View style={styles.btnGroup}>
              <TouchableOpacity
                style={[styles.btn, aspectRatio === '1:1' && styles.btnActive]}
                onPress={() => setAspectRatio('1:1')}
              >
                <Text style={[styles.btnText, aspectRatio === '1:1' && styles.btnTextActive]}>1:1 Post</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, aspectRatio === '9:16' && styles.btnActive]}
                onPress={() => setAspectRatio('9:16')}
              >
                <Text style={[styles.btnText, aspectRatio === '9:16' && styles.btnTextActive]}>9:16 Story</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Layout Style</Text>
            <View style={styles.btnGroup}>
              <TouchableOpacity
                style={[styles.btn, footerTemplate === 'classic' && styles.btnActive]}
                onPress={() => setFooterTemplate('classic')}
              >
                <Text style={[styles.btnText, footerTemplate === 'classic' && styles.btnTextActive]}>Docked Footer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, footerTemplate === 'floating' && styles.btnActive]}
                onPress={() => setFooterTemplate('floating')}
              >
                <Text style={[styles.btnText, footerTemplate === 'floating' && styles.btnTextActive]}>Badge Card</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 🎨 Background Template Row */}
        <Text style={styles.sectionTitle}>Select Banner Background</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bgSelector}>
          {BACKGROUND_TEMPLATES.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.bgThumbContainer, selectedBg === item.url && styles.bgThumbActive]}
              onPress={() => setSelectedBg(item.url)}
            >
              <Image source={{ uri: item.url }} style={styles.bgThumb} />
              <Text style={styles.bgThumbLabel}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 🛠 Interactive Multi-Layer Canvas Workspace Container */}
        <Text style={styles.canvasHelper}>👇 Drag layers directly on the image to position them!</Text>
        
        <ViewShot
          ref={viewShotRef}
          options={{ format: 'jpg', quality: 0.95 }}
          style={[
            styles.canvasContainer,
            { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
          ]}
        >
          {/* Base Layer (Z=1): Selected Background Image */}
          <Image source={{ uri: selectedBg }} style={styles.canvasBackground} resizeMode="cover" />

          {/* Middle Layer (Z=2): Floating Profile Picture Avatar Frame */}
          {showProfilePic && (
            <View
              style={[
                styles.floatingAvatarContainer,
                {
                  left: avatarPos.x,
                  top: avatarPos.y,
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                },
              ]}
              {...avatarPanResponder.panHandlers}
            >
              <Image
                source={{
                  uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    shopName || 'Shop'
                  )}&background=00ffcc&color=121214&size=128&bold=true`,
                }}
                style={[styles.avatarImg, { borderRadius: avatarSize / 2 }]}
              />
            </View>
          )}

          {/* Upper Layer (Z=3): Classic Docked Footer */}
          {footerTemplate === 'classic' && (
            <View
              style={[
                styles.dockedFooter,
                {
                  height: footerHeight,
                  padding: footerPadding,
                  backgroundColor: `rgba(28, 28, 30, ${footerOpacity})`,
                },
              ]}
            >
              {showBusinessName && <Text style={styles.footerShopName}>{shopName || 'Business Name'}</Text>}
              <View style={styles.footerDetailsRow}>
                {showMobile && <Text style={styles.footerDetailText}>📞 {formattedPhone}</Text>}
                {showAddress && <Text style={styles.footerDetailText}>📍 {formattedAddress}</Text>}
              </View>
            </View>
          )}

          {/* Upper Layer (Z=3): Floating Overlay Badge */}
          {footerTemplate === 'floating' && (
            <View
              style={[
                styles.floatingBadgeCard,
                {
                  left: badgePos.x,
                  top: badgePos.y,
                  width: badgeWidth,
                  height: badgeHeight,
                  backgroundColor: `rgba(28, 28, 30, ${footerOpacity})`,
                },
              ]}
              {...badgePanResponder.panHandlers}
            >
              {showBusinessName && <Text style={styles.badgeShopName} numberOfLines={1}>{shopName || 'Business'}</Text>}
              {showMobile && <Text style={styles.badgeText} numberOfLines={1}>📞 {formattedPhone}</Text>}
              {showAddress && <Text style={styles.badgeText} numberOfLines={1}>📍 {formattedAddress}</Text>}
            </View>
          )}
        </ViewShot>

        {/* Snapping controls (Only for Badge Card Template) */}
        {footerTemplate === 'floating' && (
          <View style={styles.snapBox}>
            <Text style={styles.sectionTitle}>Align Badge Quick Snapping</Text>
            <View style={styles.snapGrid}>
              <TouchableOpacity style={styles.snapBtn} onPress={() => snapToCorner('top-left')}>
                <Text style={styles.snapBtnText}>↖️ Top-Left</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.snapBtn} onPress={() => snapToCorner('top-right')}>
                <Text style={styles.snapBtnText}>↗️ Top-Right</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.snapBtn} onPress={() => snapToCorner('bottom-left')}>
                <Text style={styles.snapBtnText}>↙️ Bottom-Left</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.snapBtn} onPress={() => snapToCorner('bottom-right')}>
                <Text style={styles.snapBtnText}>↘️ Bottom-Right</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 🎛 Sliding scale and Stepper controllers */}
        <View style={styles.controllerCard}>
          <Text style={styles.controllerCardHeader}>⚙️ Workspace Fine-Tuning</Text>

          {/* Opacity Control */}
          <View style={styles.controlRow}>
            <View>
              <Text style={styles.controlLabel}>Footer Opacity</Text>
              <Text style={styles.controlValue}>{Math.round(footerOpacity * 100)}%</Text>
            </View>
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setFooterOpacity((o) => Math.max(0.2, +(o - 0.05).toFixed(2)))}
              >
                <Text style={styles.stepText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setFooterOpacity((o) => Math.min(1.0, +(o + 0.05).toFixed(2)))}
              >
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar Scale Control */}
          {showProfilePic && (
            <View style={styles.controlRow}>
              <View>
                <Text style={styles.controlLabel}>Avatar Scale</Text>
                <Text style={styles.controlValue}>{Math.round(avatarScale * 100)}%</Text>
              </View>
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setAvatarScale((s) => Math.max(0.6, +(s - 0.1).toFixed(1)))}
                >
                  <Text style={styles.stepText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setAvatarScale((s) => Math.min(1.8, +(s + 0.1).toFixed(1)))}
                >
                  <Text style={styles.stepText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Padding Control */}
          <View style={styles.controlRow}>
            <View>
              <Text style={styles.controlLabel}>Branding Spacing / Padding</Text>
              <Text style={styles.controlValue}>{footerPadding}px</Text>
            </View>
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setFooterPadding((p) => Math.max(5, p - 2))}
              >
                <Text style={styles.stepText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setFooterPadding((p) => Math.min(25, p + 2))}
              >
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer Height Control (Classic Docked Footer Only) */}
          {footerTemplate === 'classic' && (
            <View style={styles.controlRow}>
              <View>
                <Text style={styles.controlLabel}>Footer Height Block</Text>
                <Text style={styles.controlValue}>{footerHeight}px</Text>
              </View>
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setFooterHeight((h) => Math.max(50, h - 5))}
                >
                  <Text style={styles.stepText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setFooterHeight((h) => Math.min(120, h + 5))}
                >
                  <Text style={styles.stepText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* 💾 Flatten and Capture action button */}
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Text style={styles.exportButtonText}>💾 Export & Flatten Banner Composition</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  modalBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#121214',
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1c1c1e',
    borderBottomWidth: 1,
    borderColor: '#2c2c2e',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#3a3a3c',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 15,
  },
  sectionTitle: {
    color: '#eaeaea',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  btnGroup: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    padding: 3,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnActive: {
    backgroundColor: '#00ffcc',
  },
  btnText: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '700',
  },
  btnTextActive: {
    color: '#121214',
  },
  bgSelector: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  bgThumbContainer: {
    marginRight: 12,
    alignItems: 'center',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#1c1c1e',
    paddingBottom: 6,
  },
  bgThumbActive: {
    borderColor: '#00ffcc',
  },
  bgThumb: {
    width: 80,
    height: 60,
    borderRadius: 8,
  },
  bgThumbLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  canvasHelper: {
    color: '#00ffcc',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  canvasContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  canvasBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingAvatarContainer: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#00ffcc',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
    backgroundColor: '#1c1c1e',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  dockedFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerShopName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  footerDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  footerDetailText: {
    color: '#eaeaea',
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  floatingBadgeCard: {
    position: 'absolute',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  badgeShopName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  badgeText: {
    color: '#d1d1d6',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  snapBox: {
    marginBottom: 20,
  },
  snapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  snapBtn: {
    width: '48%',
    backgroundColor: '#1c1c1e',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    alignItems: 'center',
    marginBottom: 8,
  },
  snapBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  controllerCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    marginBottom: 24,
  },
  controllerCardHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#00ffcc',
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#2c2c2e',
  },
  controlLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  controlValue: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    padding: 3,
  },
  stepBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 6,
  },
  stepText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  exportButton: {
    backgroundColor: '#00ffcc',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00ffcc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exportButtonText: {
    color: '#121214',
    fontSize: 14,
    fontWeight: '800',
  },
});
