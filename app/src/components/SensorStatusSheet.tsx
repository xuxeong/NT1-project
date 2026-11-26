import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckCircleIcon, WarningIcon } from '@/components/icons';
import { colors, radius, typography } from '@/theme';
import type { Vehicle } from '@/types/vehicle';
import { getSensorItems, isSensorDataAvailable, type SensorItem, type SensorLevel } from '@/utils/sensorStatus';

type Props = {
  visible: boolean;
  vehicle: Vehicle;
  onClose: () => void;
};

/**
 * 센서 상태 바텀 시트 (Figma: 차량 상세 화면 · 센서 상태 / 이상 있음 / 수신 없음).
 * 전원이 꺼졌거나 오프라인이면 값 대신 '수신 없음'을 보여 줍니다.
 */
export function SensorStatusSheet({ visible, vehicle, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const available = isSensorDataAvailable(vehicle);
  const items = getSensorItems(vehicle);
  const notice =
    vehicle.driveMode === 0
      ? '전원이 꺼져 있어 센서 정보를 받을 수 없어요'
      : '차량과 연결이 끊겨 센서 정보를 받을 수 없어요';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: 8 + insets.bottom }]}>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">
          센서 상태
        </Text>
        {!available && <Text style={styles.notice}>{notice}</Text>}
        <View style={styles.list}>
          {items.map((item) => (
            <SensorRow key={item.key} item={item} available={available} />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const LEVEL_LABEL: Record<SensorLevel, string> = { ok: '정상', warn: '주의', error: '이상' };

/** 센서 한 줄 (Figma: Sensor Row) */
function SensorRow({ item, available }: { item: SensorItem; available: boolean }) {
  const stateLabel = !available ? '수신 없음' : item.kind === 'value' ? item.value : LEVEL_LABEL[item.level];
  return (
    <View style={styles.row} accessible accessibilityLabel={`${item.name}, ${stateLabel}`}>
      <View style={styles.rowText}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.description}>
          {available && item.detail ? `${item.description} · ${item.detail}` : item.description}
        </Text>
      </View>
      {!available ? (
        <Text style={styles.noData}>수신 없음</Text>
      ) : item.kind === 'value' ? (
        <Text style={styles.value}>{item.value}</Text>
      ) : (
        <LevelBadge level={item.level} />
      )}
    </View>
  );
}

function LevelBadge({ level }: { level: SensorLevel }) {
  if (level === 'ok') return <CheckCircleIcon width={22} height={22} />;
  const color = level === 'warn' ? colors.warn : colors.danger;
  return (
    <View style={styles.badge}>
      <WarningIcon width={18} height={18} color={color} />
      <Text style={[styles.badgeLabel, { color }]}>{LEVEL_LABEL[level]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(14, 17, 22, 0.45)' },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    gap: 20,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.hairline },
  title: { ...typography.title17, color: colors.ink },
  notice: { ...typography.body13, color: colors.textSecondary, marginTop: -8 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.subtle,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.section14, color: colors.ink },
  description: { ...typography.body13, color: colors.textSecondary },
  value: { ...typography.section14, color: colors.ink },
  noData: { ...typography.label12, color: colors.textTertiary },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeLabel: typography.label12,
});
