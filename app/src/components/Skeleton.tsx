import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';

/**
 * 데이터를 불러오는 동안 내용 자리에 보여 주는 회색 뼈대 (Figma: Skeleton).
 * 한 화면의 막대들이 같이 깜박이도록 SkeletonGroup 안에서 깜박임 값을 나눠 씁니다.
 */
const PulseContext = createContext<Animated.Value | null>(null);

export function SkeletonGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <PulseContext.Provider value={pulse}>
      <View
        style={style}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="불러오는 중"
        accessibilityState={{ busy: true }}
      >
        {children}
      </View>
    </PulseContext.Provider>
  );
}

/** 회색 막대 하나 */
export function SkeletonBlock({
  width,
  height,
  radius: r = 6,
  style,
}: {
  width: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useContext(PulseContext);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: r, backgroundColor: colors.hairline }, pulse && { opacity: pulse }, style]}
    />
  );
}

/** 차량 카드 자리 (Figma: Skeleton / Vehicle Card). VehicleCard와 같은 크기 */
export function VehicleCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonBlock width={96} height={88} radius={14} />
      <View style={styles.cardInfo}>
        <View style={styles.cardTitleRow}>
          <SkeletonBlock width={88} height={20} />
          <SkeletonBlock width={64} height={24} radius={12} />
        </View>
        <SkeletonBlock width={120} height={14} />
        <SkeletonBlock width="85%" height={14} />
      </View>
    </View>
  );
}

/** 차량 상세 바텀 시트 내용 자리 (Figma: 차량 상세 화면 · 로딩) */
export function VehicleDetailSkeleton() {
  return (
    <View style={styles.detail}>
      <View style={styles.detailInfo}>
        <SkeletonBlock width={120} height={105} radius={16} />
        <View style={styles.detailInfoText}>
          <SkeletonBlock width={110} height={14} />
          <SkeletonBlock width={140} height={28} radius={8} />
          <SkeletonBlock width={68} height={26} radius={13} />
        </View>
      </View>
      <View style={styles.detailStats}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.detailStat}>
            <SkeletonBlock width={44} height={12} />
            <SkeletonBlock width={60} height={18} />
          </View>
        ))}
      </View>
      <SkeletonBlock width="100%" height={66} radius={radius.lg} />
      <SkeletonBlock width="100%" height={54} radius={radius.lg} />
      <View style={styles.detailControls}>
        <SkeletonBlock width={64} height={16} />
        {[0, 1].map((r) => (
          <View key={r} style={styles.detailControlRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.detailControl}>
                <SkeletonBlock width={56} height={56} radius={18} />
                <SkeletonBlock width={40} height={12} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.sheet,
  },
  cardInfo: { flex: 1, gap: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  detail: { gap: 16 },
  detailInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailInfoText: { flex: 1, alignItems: 'flex-end', gap: 8 },
  detailStats: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  detailStat: { alignItems: 'center', gap: 6 },
  detailControls: { gap: 16, paddingTop: 8 },
  detailControlRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailControl: { alignItems: 'center', gap: 8 },
});
