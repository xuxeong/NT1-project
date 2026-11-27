import { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, EyeIcon } from '@/components/icons';
import { MockAuthError, mockLogin } from '@/mocks/mockServer';
import { useAuth } from '@/state/auth';
import { useToast } from '@/state/toast';
import { colors, typography } from '@/theme';
import { PrimaryButton } from '@/ui';

/** TextInput에 focus()를 부르기 위한 ref 타입 */
type InputRef = React.ComponentRef<typeof TextInput>;

const logo = require('../../assets/images/nt1-logo-horizontal.png');

/**
 * 로그인 (Figma: 로그인 화면).
 * 회원가입 없이 서버에 미리 넣어 둔 담당자 계정으로 로그인합니다. 시험용 계정은 mocks/managers.ts 참고.
 * 로그인하면 _layout.tsx가 차량 목록으로 자동 이동합니다.
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const { showToast } = useToast();
  const passwordRef = useRef<InputRef>(null);

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = userId.trim().length > 0 && password.length > 0;

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const manager = await mockLogin(userId, password);
      await signIn(manager, remember);
    } catch (e) {
      setError(
        e instanceof MockAuthError
          ? '아이디 또는 비밀번호가 맞지 않아요'
          : '서버에 연결할 수 없어요. 네트워크 상태를 확인해 주세요',
      );
      setSubmitting(false);
    }
  };

  // 관리자 문의는 서버 기능이 없어 안내만 합니다.
  const contactAdmin = () => showToast('계정 문제는 관리자에게 문의해 주세요', 'info');

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="NT1" />
          <View style={styles.titleBlock}>
            <Text style={styles.title} accessibilityRole="header">
              로그인
            </Text>
            <Text style={styles.description}>차량 운영 계정으로 로그인해 주세요.</Text>
          </View>
        </View>

        <View style={styles.form}>
          <Field
            label="아이디"
            value={userId}
            onChangeText={(t) => {
              setUserId(t);
              setError(null);
            }}
            placeholder="아이디를 입력하세요"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
          />
          <Field
            ref={passwordRef}
            label="비밀번호"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
            }}
            placeholder="비밀번호를 입력하세요"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            trailing={
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                <EyeIcon width={20} height={20} color={showPassword ? colors.accent : colors.textTertiary} />
              </Pressable>
            }
          />

          <View style={styles.options}>
            <Pressable
              style={styles.checkRow}
              onPress={() => setRemember((v) => !v)}
              hitSlop={6}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              accessibilityLabel="자동 로그인"
            >
              <View style={[styles.checkBox, remember && styles.checkBoxOn]}>
                {remember && <CheckIcon width={14} height={14} color={colors.onInk} />}
              </View>
              <Text style={styles.optionText}>자동 로그인</Text>
            </Pressable>
          </View>

          {error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}

          <PrimaryButton label="로그인" disabled={!ready} loading={submitting} onPress={submit} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.helpText}>로그인에 문제가 있나요?</Text>
        <Pressable onPress={contactAdmin} hitSlop={6} accessibilityRole="button">
          <Text style={styles.helpLink}>관리자 문의</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

type FieldProps = TextInputProps & { label: string; trailing?: React.ReactNode; ref?: React.Ref<InputRef> };

/** 라벨 + 입력칸 (Figma: Text Field). 입력 중에는 흰 바탕 + 파란 테두리 */
function Field({ label, trailing, ref, onFocus, onBlur, ...input }: FieldProps) {
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
  screen: { flex: 1, backgroundColor: colors.sheet },
  content: { paddingHorizontal: 24, paddingBottom: 24, gap: 32 },
  header: { gap: 24 },
  logo: { width: 150, height: 23 },
  titleBlock: { gap: 8 },
  title: { ...typography.heading26, color: colors.ink },
  description: { ...typography.body15, color: colors.textSecondary },
  form: { gap: 16 },
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
  options: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.sheet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  optionText: { ...typography.body13, color: colors.textSecondary },
  error: { ...typography.body13, color: colors.danger },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 12 },
  helpText: { ...typography.body13, color: colors.textTertiary },
  helpLink: { ...typography.body13, color: colors.accent },
});
