import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { WarningIcon } from '@/components/icons';
import { colors, typography } from '@/theme';
import { OutlineButton } from '@/ui';

/**
 * 화면을 채울 데이터를 불러오지 못했을 때 보여 주는 안내 (Figma: Error State).
 * - surface="page": 회색 배경 화면(차량 목록)에 놓을 때. 아이콘 원이 흰색
 * - surface="sheet": 흰 시트(차량 상세)에 놓을 때. 아이콘 원이 회색
 */
export function ErrorState({
  surface = 'page',
  title = '서버에 연결할 수 없어요',
  description = '네트워크 상태를 확인하고 다시 시도해 주세요',
  onRetry,
  style,
}: {
  surface?: 'page' | 'sheet';
  title?: string;
  description?: string;
  /** 없으면 다시 시도 버튼을 숨깁니다 */
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wrap, style]} accessibilityRole="alert">
      <View style={[styles.icon, { backgroundColor: surface === 'page' ? colors.sheet : colors.subtle }]}>
        <WarningIcon width={28} height={28} color={colors.ink} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {onRetry && <OutlineButton label="다시 시도" onPress={onRetry} style={styles.retry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  texts: { alignItems: 'center', gap: 4 },
  title: { ...typography.title17, color: colors.ink, textAlign: 'center' },
  description: { ...typography.body13, color: colors.textSecondary, textAlign: 'center' },
  retry: { height: 44, paddingHorizontal: 28, marginTop: 8 },
});
