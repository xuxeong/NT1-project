import { StyleSheet, Text, View } from 'react-native';

import { ChevronSmallIcon } from '@/components/icons';
import { colors, radius, typography } from '@/theme';

export type ChipTone = 'success' | 'accent' | 'danger';

const TONES = {
  success: { bg: colors.successSubtle, fg: colors.success },
  accent: { bg: colors.accentSubtle, fg: colors.accent },
  danger: { bg: colors.dangerSubtle, fg: colors.danger },
} as const;

/** 점 + 글자 형태의 상태 칩 (Figma: Status Chip). chevron은 오른쪽 화살표 표시 */
export function StatusChip({ label, tone, chevron = false }: { label: string; tone: ChipTone; chevron?: boolean }) {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]} accessibilityLabel={`상태: ${label}`}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
      {chevron && <ChevronSmallIcon width={12} height={12} color={fg} />}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: typography.label12,
});
