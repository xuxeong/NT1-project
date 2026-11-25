import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BatteryIcon, DistanceIcon, PinIcon, SignalIcon } from '@/components/icons';
import { StatusChip } from '@/components/StatusChip';
import type { LatLng, Vehicle } from '@/types/vehicle';
import { distanceReference, formatDistance, haversineMeters } from '@/utils/geo';
import { getVehicleStatus } from '@/utils/vehicleStatus';
import { colors, radius, typography } from '@/theme';

const vehicleImage = require('../../assets/images/vehicle-n3-card.png');

type Props = {
  vehicle: Vehicle;
  /** 사용자 위치. C-Track 밖이거나 모르면 C-Track 기준점과의 거리를 표시합니다. */
  userLocation: LatLng | null;
  /** 검색어. 차량 ID에서 이 부분을 파란색으로 강조합니다 (대소문자 구분 없음). */
  highlight?: string;
  onPress: () => void;
};

/** 차량 목록의 카드 한 장 */
export function VehicleCard({ vehicle, userLocation, highlight = '', onPress }: Props) {
  const status = getVehicleStatus(vehicle);
  const distance = formatDistance(haversineMeters(distanceReference(userLocation), vehicle.position));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${vehicle.vin}, ${status.label}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Image source={vehicleImage} style={styles.image} resizeMode="cover" />
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.id} numberOfLines={1}>
            <Highlighted text={vehicle.vin} query={highlight} />
          </Text>
          <StatusChip label={status.label} tone={status.tone} />
        </View>
        <View style={styles.locationRow}>
          <PinIcon width={14} height={14} />
          <Text style={styles.location} numberOfLines={1}>
            {vehicle.parkName}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <Stat icon={<DistanceIcon width={14} height={14} />} value={distance} />
          <Stat icon={<BatteryIcon width={14} height={14} />} value={`${Math.round(vehicle.realBattery)}%`} />
          <Stat icon={<SignalIcon width={14} height={14} />} value={`${vehicle.latencyMs} ms`} />
        </View>
      </View>
    </Pressable>
  );
}

/** text 안에서 query와 같은 부분(처음 한 군데)을 파란색으로 */
function Highlighted({ text, query }: { text: string; query: string }) {
  const i = query ? text.toUpperCase().indexOf(query.toUpperCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <Text style={{ color: colors.accent }}>{text.slice(i, i + query.length)}</Text>
      {text.slice(i + query.length)}
    </>
  );
}

function Stat({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.statText}>{value}</Text>
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
  pressed: { opacity: 0.85 },
  image: { width: 96, height: 88 },
  info: { flex: 1, minWidth: 0, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  id: { ...typography.value18, color: colors.ink, flexShrink: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { ...typography.body13, color: colors.textSecondary, flex: 1 },
  // 큰 글자 설정에서 한 줄에 안 들어가면 다음 줄로 넘깁니다
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { ...typography.num13, color: colors.textSecondary },
});
