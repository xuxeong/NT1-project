import { usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InfoIcon, WarningIcon } from '@/components/icons';
import { colors, radius, typography } from '@/theme';

/** 토스트가 떠 있는 시간 */
const TOAST_DURATION_MS = 3000;

/** 하단 탭이 보이는 화면 (토스트를 탭 바 위로 올립니다) */
const TAB_PATHS = ['/', '/messages', '/account'];
/** 하단 탭 바 높이 (안전 영역 제외, components/TabBar.tsx) */
const TAB_BAR_HEIGHT = 57;

/**
 * 토스트 종류 (Figma: Toast)
 * - warning: 요청 거절·실패 (노란 경고 아이콘)
 * - info: 준비 중·추후 지원 같은 단순 안내 (흰 정보 아이콘)
 */
export type ToastTone = 'warning' | 'info';

type ToastContextValue = {
  /**
   * 화면 아래쪽에 짧은 안내를 3초 동안 보여 줍니다.
   * 예) showToast('주행 중에는 전원을 끌 수 없어요'), showToast('추후 지원 예정인 기능이에요', 'info')
   */
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * 요청이 거절되거나 실패했을 때 쓰는 토스트 (Figma: Toast).
 * 앱 전체에서 하나만 띄우며, 새 토스트가 오면 내용을 바꾸고 시간을 다시 잽니다.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<ToastTone>('warning');
  const [seq, setSeq] = useState(0);

  const showToast = useCallback((text: string, nextTone: ToastTone = 'warning') => {
    setMessage(text);
    setTone(nextTone);
    setSeq((n) => n + 1);
    AccessibilityInfo.announceForAccessibility(text);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message !== null && <ToastView key={seq} message={message} tone={tone} onHidden={() => setMessage(null)} />}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast는 ToastProvider 안에서만 쓸 수 있어요.');
  return ctx;
}

function ToastView({ message, tone, onHidden }: { message: string; tone: ToastTone; onHidden: () => void }) {
  const insets = useSafeAreaInsets();
  const onTabScreen = TAB_PATHS.includes(usePathname());
  const bottom = insets.bottom + (onTabScreen ? TAB_BAR_HEIGHT + 16 : 24);
  const opacity = useRef(new Animated.Value(0)).current;
  const hiddenRef = useRef(onHidden);
  hiddenRef.current = onHidden;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(TOAST_DURATION_MS),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => finished && hiddenRef.current());
    return () => anim.stop();
  }, [opacity]);

  const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { bottom, opacity, transform: [{ translateY }] }]}
    >
      {tone === 'info' ? (
        <InfoIcon width={18} height={18} color={colors.onInk} />
      ) : (
        <WarningIcon width={18} height={18} color={colors.warn} />
      )}
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.16)',
  },
  message: { ...typography.body15, color: colors.onInk, flex: 1 },
});
