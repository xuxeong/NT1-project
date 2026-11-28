import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusChip } from '@/components/StatusChip';
import { colors, radius, typography } from '@/theme';
import type { Vehicle } from '@/types/vehicle';
import { StatCell, StatDivider } from '@/ui';
import { minutesToDrive } from '@/constants/vehicle';
import { formatClock, splitDistance } from '@/utils/format';

type Props = {
  visible: boolean;
  vehicle: Vehicle;
  onClose: () => void;
  onCancelPress: () => void;
};

/** 작업 더보기 바텀 시트 */
export function TaskInfoSheet({ visible, vehicle, onClose, onCancelPress }: Props) {
  const insets = useSafeAreaInsets();
  const m = vehicle.mission;
  const paused = vehicle.missionStatus === 2;
  const remainingMin = m ? minutesToDrive(m.remainingDistanceM) : 0;
  const [remainValue, remainUnit] = splitDistance(m?.remainingDistanceM ?? 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: 8 + insets.bottom }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>작업 정보</Text>
          <StatusChip label={paused ? '일시 정지' : '작업 중'} tone={paused ? 'danger' : 'accent'} />
        </View>

        <View>
          <StopRow kind="출발" name={m?.startStationName ?? '-'} dotColor={colors.textTertiary} />
          <StopRow kind="도착" name={m?.endStationName ?? '-'} dotColor={colors.accent} last />
        </View>

        <View style={styles.stats}>
          <StatCell label="남은 거리" value={remainValue} unit={remainUnit} />
          <StatDivider />
          <StatCell label="남은 시간" value={`${remainingMin}`} unit="분" />
          <StatDivider />
          <StatCell label="진행률" value={`${Math.round(m?.progressPercent ?? 0)}`} unit="%" />
        </View>

        <View style={styles.list}>
          <InfoRow label="작업 ID" value={m ? `${m.missionSubId}` : '-'} />
          <InfoRow label="시작 시각" value={m ? formatClock(m.startedAt) : '-'} />
          <InfoRow label="전체 경로 거리" value={m ? splitDistance(m.routeDistanceM).join(' ') : '-'} />
          {m?.notifyManager && <InfoRow label="알림 받을 담당자" value={m.notifyManager.name} />}
        </View>

        <View style={styles.divider} />

        <View style={styles.cancelWrap}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancelPress}
            style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.cancelLabel}>작업 취소</Text>
          </Pressable>
          <Text style={styles.cancelHint}>주행 중이면 차량을 먼저 멈춘 뒤 취소해요</Text>
        </View>
      </View>
    </Modal>
  );
}

function StopRow({ kind, name, dotColor, last }: { kind: string; name: string; dotColor: string; last?: boolean }) {
  return (
    <View style={styles.stopRow}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        {!last && <View style={styles.line} />}
      </View>
      <View style={styles.stopText}>
        <Text style={styles.stopKind}>{kind}</Text>
        <Text style={styles.stopName} numberOfLines={1}>
          {name}
        </Text>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.title17, color: colors.ink },
  stopRow: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', gap: 4, paddingTop: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 2, height: 30, backgroundColor: colors.hairline },
  stopText: { flex: 1, gap: 2 },
  stopKind: { ...typography.caption11, color: colors.textTertiary },
  stopName: { ...typography.section14, color: colors.ink },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.subtle,
  },
  list: { gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { ...typography.body13, color: colors.textSecondary },
  infoValue: { ...typography.num13, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.hairline },
  cancelWrap: { gap: 8, alignItems: 'center' },
  cancelButton: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSubtle,
  },
  cancelLabel: { ...typography.button16, color: colors.danger },
  cancelHint: { ...typography.caption11, color: colors.textTertiary },
});
