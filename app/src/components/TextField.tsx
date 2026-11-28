import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, typography } from '@/theme';

/** TextInput에 focus()를 부르기 위한 ref 타입 */
export type TextFieldRef = React.ComponentRef<typeof TextInput>;

type Props = TextInputProps & { label: string; trailing?: React.ReactNode; ref?: React.Ref<TextFieldRef> };

/**
 * 라벨 + 입력칸 (Figma: Text Field). 입력 중에는 흰 바탕 + 파란 테두리.
 * 로그인(아이디·비밀번호), 목적지 선택(목적지 이름)에서 씁니다.
 */
export function TextField({ label, trailing, ref, onFocus, onBlur, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
        <TextInput
          ref={ref}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          style={styles.input}
          accessibilityLabel={label}
        />
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { ...typography.label12, color: colors.textSecondary },
  inputBox: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.subtle,
  },
  inputBoxFocused: { backgroundColor: colors.sheet, borderColor: colors.accent },
  // Android에서 Noto Sans KR 위아래 여백 때문에 글자가 잘리지 않도록 lineHeight를 빼고 가운데 정렬합니다.
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontFamily: typography.body15.fontFamily,
    fontSize: typography.body15.fontSize,
    color: colors.ink,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
