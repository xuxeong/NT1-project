import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Manager } from '@/types/manager';

/** 자동 로그인 정보를 폰에 저장하는 키. 비밀번호는 저장하지 않고 계정 정보만 저장합니다. */
const SESSION_KEY = 'nt1.session';

type AuthContextValue = {
  /** 로그인한 담당자. 로그인 전이면 null */
  manager: Manager | null;
  /** 저장된 자동 로그인 정보를 읽는 중 (앱 시작 직후) */
  restoring: boolean;
  /** 로그인 성공 후 호출. remember가 true면 다음에 앱을 켤 때 자동 로그인 */
  signIn: (manager: Manager, remember: boolean) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 로그인 상태 (담당자 계정).
 * 로그인 전에는 로그인 화면만 보이고, 로그인 후에는 담당 차량만 보입니다 (src/app/_layout.tsx).
 *
 * TODO(한정혁): 연동 후 세션 만료·토큰이 생기면 여기서 함께 관리해 주세요.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [manager, setManager] = useState<Manager | null>(null);
  const [restoring, setRestoring] = useState(true);

  // 앱을 켤 때 자동 로그인 정보 읽기
  useEffect(() => {
    SecureStore.getItemAsync(SESSION_KEY)
      .then((saved) => {
        if (saved) setManager(JSON.parse(saved) as Manager);
      })
      .catch(() => {
        // 읽지 못하면 로그인 화면부터 시작합니다.
      })
      .finally(() => setRestoring(false));
  }, []);

  const signIn = useCallback(async (next: Manager, remember: boolean) => {
    setManager(next);
    try {
      if (remember) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
      else await SecureStore.deleteItemAsync(SESSION_KEY);
    } catch {
      // 저장에 실패해도 이번 실행에서는 로그인 상태를 유지합니다.
    }
  }, []);

  const signOut = useCallback(async () => {
    setManager(null);
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    } catch {
      // 지우지 못해도 화면은 로그아웃 상태로 바뀝니다.
    }
  }, []);

  const value = useMemo(() => ({ manager, restoring, signIn, signOut }), [manager, restoring, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있어요.');
  return ctx;
}
