import { StyleSheet, Text, View } from 'react-native';

import { WarningIcon } from '@/components/icons';
import { colors, radius, typography } from '@/theme';
import type { FaultReport } from '@/types/vehicle';
import { OutlineButton } from '@/ui';

/**
 * 차량 상세의 고장 신고 카드 (Figma: 차량 상세 화면 · 고장 신고됨).
 * 신고 사유·시각과 고장 해제 버튼을 보여 줍니다.
 */
export function FaultCard({
  report,
  clearing,
  onClear,
}: {
  report: FaultReport;
  /** 해제 요청을 기다리는 중 */
  clearing: boolean;
  onClear: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <WarningIcon width={18} height={18} color={colors.danger} />
        <Text style={styles.title}>고장 신고됨</Text>
        <Text style={styles.time}>{formatReportedAt(report.reportedAt)} 신고</Text>
      </View>
      {report.reason ? <Text style={styles.reason}>{report.reason}</Text> : null}
      <OutlineButton
        label="고장 해제"
        loading={clearing}
        onPress={onClear}
        style={styles.clearButton}
      />
      <Text style={styles.hint}>해제해도 작업은 자동으로 다시 시작되지 않아요</Text>
    </View>
  );
}

/** 11/27 16:05 */
function formatReportedAt(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSubtle,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...typography.section14, color: colors.danger, flex: 1 },
  time: { ...typography.label12, color: colors.textTertiary },
  reason: { ...typography.body13, color: colors.ink },
  clearButton: { height: 44 },
  hint: { ...typography.caption11, color: colors.textTertiary, textAlign: 'center' },
});
