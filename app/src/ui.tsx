/**
 * 여러 화면에서 쓰는 공통 UI 부품 (Figma 컴포넌트 페이지 기준).
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, typography } from '@/theme';

type ButtonProps = {
  label: string;
  icon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** 서버 응답을 기다리는 중. 글자 대신 로딩 원을 보여 주고 누를 수 없게 합니다 (Figma: Button / Loading) */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** 파란 주요 버튼 (Figma: Primary Button 2). 아이콘은 흰색 SVG를 넣습니다. */
export function PrimaryButton({ label, icon, onPress, disabled, loading, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        styles.primary,
        disabled && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.onInk} />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonLabel, { color: colors.onInk }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** 회색 보조 버튼 (Figma: 일시정지 버튼) */
export function SecondaryButton({ label, icon, onPress, disabled, loading, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.ink} />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonLabel, { color: colors.ink }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** 흰 바탕 + 파란 테두리 버튼 (Figma: Outline Button). 초기화 등에 사용 */
export function OutlineButton({ label, onPress, disabled, style }: Omit<ButtonProps, 'icon'>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles.outline,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

/** 지도 위에 떠 있는 흰색 둥근 버튼 (닫기·센서·고장 신고) */
export function FloatingButton({
  children,
  onPress,
  label,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.floating, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

/** 라벨 + 값 + 단위 (Figma: Stat Cell). label에 Text 조각을 넣으면 'AUTO' 같은 색 강조도 됩니다. */
export function StatCell({
  label,
  value,
  unit,
  muted,
}: {
  label: ReactNode;
  value: string;
  unit?: string;
  /** 값을 흐리게 (예: 전원 꺼짐일 때 통신 지연 '–') */
  muted?: boolean;
}) {
  return (
    <View style={styles.statCell}>
      {/* 큰 글자 설정에서도 잘리지 않도록 칸에 맞춰 글자를 줄입니다 */}
      <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {label}
      </Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, muted && { color: colors.textTertiary }]}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

/** 수치 칸 사이의 세로 구분선 */
export function StatDivider() {
  return <View style={styles.statDivider} />;
}

export type ControlTone = 'neutral' | 'danger' | 'accent';

/** 아이콘 상자 + 라벨 (Figma: Control Item) */
export function ControlItem({
  icon,
  label,
  tone = 'neutral',
  onPress,
  loading = false,
}: {
  icon: ReactNode;
  label: string;
  tone?: ControlTone;
  onPress?: () => void;
  /** 서버 응답을 기다리는 중. 아이콘 대신 로딩 원 */
  loading?: boolean;
}) {
  const bg = tone === 'danger' ? colors.dangerSubtle : tone === 'accent' ? colors.accentSubtle : colors.subtle;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading }}
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.control, pressed && !loading && styles.pressed]}
    >
      <View style={[styles.controlBox, { backgroundColor: bg }]}>
        {loading ? <ActivityIndicator size="small" color={colors.ink} /> : icon}
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: radius.lg,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.hairline },
  outline: { backgroundColor: colors.sheet, borderWidth: 1.5, borderColor: colors.accent },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  buttonLabel: typography.button16,
  floating: {
    height: 36,
    minWidth: 36,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.sheet,
    boxShadow: '0px 2px 10px rgba(13, 18, 23, 0.1)',
  },
  statCell: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  statLabel: { ...typography.caption11, color: colors.textTertiary },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: { ...typography.value18, color: colors.ink },
  statUnit: { ...typography.unit12, color: colors.textSecondary },
  statDivider: { width: 1, height: 28, backgroundColor: colors.hairline },
  control: { flex: 1, alignItems: 'center', gap: 8 },
  controlBox: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  controlLabel: { ...typography.label12, color: colors.ink },
});
