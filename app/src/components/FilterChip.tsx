import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, typography } from '@/theme';

/** 필터 선택 칩 */
export function FilterChip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected ? styles.on : styles.off, style, pressed && { opacity: 0.8 }]}
    >
      {/* 큰 글자 설정에서도 잘리지 않도록 칩 폭에 맞춰 글자를 줄입니다 */}
      <Text
        style={selected ? styles.labelOn : styles.labelOff}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** 칩을 한 줄에 3개씩 같은 너비로 놓습니다 */
export function ChipGrid({ children }: { children: React.ReactNode[] }) {
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < children.length; i += 3) rows.push(children.slice(i, i + 3));
  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.cell}>
              {row[i] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 34,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: colors.accent },
  off: { backgroundColor: colors.sheet, borderWidth: 1, borderColor: colors.hairline },
  labelOn: { ...typography.label12, color: colors.onInk },
  labelOff: { ...typography.body13, color: colors.ink },
  grid: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1 },
});
