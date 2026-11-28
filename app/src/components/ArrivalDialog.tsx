import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FlagLineIcon } from '@/components/icons';
import { colors, radius, typography } from '@/theme';
import { formatClock, formatDuration } from '@/utils/format';

export type ArrivalInfo = {
  vehicleId: string;
  /** 목적지 이름 (출발할 때 입력한 이름) */
  targetName: string;
  /** 도착 시각 (ms) */
  arrivedAt: number;
  /** 출발 시각 (ms). 모르면 null → 걸린 시간 '-' */
  startedAt: number | null;
};

type Props = {
  arrival: ArrivalInfo | null;
  /** 그 차량 상세를 보고 있으면 true → '확인' 버튼 하나 */
  onVehicleScreen: boolean;
  onClose: () => void;
  onOpenVehicle: () => void;
};

/**
 * 차량 도착 확인 창 (Figma: 차량 목록 · 도착 확인 창 / 차량 상세 화면 · 도착 확인 창).
 * 앱 어느 화면에서나 도착 알림이 오면 띄웁니다 (state/notifications.tsx).
 */
export function ArrivalDialog({ arrival, onVehicleScreen, onClose, onOpenVehicle }: Props) {
  return (
    <Modal visible={arrival !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {arrival && (
          <View style={styles.card} accessibilityViewIsModal accessibilityLiveRegion="polite">
            <View style={styles.iconWrap}>
              <FlagLineIcon width={24} height={24} color={colors.success} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {arrival.vehicleId} - 목적지에 도착했어요
            </Text>

            <View style={styles.info}>
              <InfoRow label="목적지" value={arrival.targetName} />
              <InfoRow label="도착 시각" value={formatClock(arrival.arrivedAt)} />
              <InfoRow
                label="걸린 시간"
                value={arrival.startedAt ? formatDuration(arrival.arrivedAt - arrival.startedAt) : '-'}
              />
            </View>

            <View style={styles.buttons}>
              {!onVehicleScreen && (
                <Pressable
                  accessibilityRole="button"
                  onPress={onClose}
                  style={({ pressed }) => [styles.button, styles.close, pressed && styles.pressed]}
                >
                  <Text style={[styles.buttonLabel, { color: colors.ink }]}>닫기</Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={onVehicleScreen ? onClose : onOpenVehicle}
                style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
              >
                <Text style={[styles.buttonLabel, { color: colors.onInk }]}>
                  {onVehicleScreen ? '확인' : '차량 보기'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: 'rgba(14, 17, 22, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 311,
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 20,
    alignItems: 'center',
    backgroundColor: colors.sheet,
    boxShadow: '0px 8px 24px rgba(13, 18, 23, 0.15)',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successSubtle,
  },
  title: { ...typography.title17, color: colors.ink, textAlign: 'center' },
  info: {
    alignSelf: 'stretch',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.subtle,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { ...typography.body13, color: colors.textSecondary },
  value: { ...typography.section14, color: colors.ink, flexShrink: 1, textAlign: 'right' },
  buttons: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  button: { flex: 1, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  close: { backgroundColor: colors.subtle },
  primary: { backgroundColor: colors.accent },
  pressed: { opacity: 0.85 },
  buttonLabel: typography.button16,
});
