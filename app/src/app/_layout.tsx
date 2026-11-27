import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { NotoSansKR_400Regular } from '@expo-google-fonts/noto-sans-kr/400Regular';
import { NotoSansKR_500Medium } from '@expo-google-fonts/noto-sans-kr/500Medium';
import { NotoSansKR_700Bold } from '@expo-google-fonts/noto-sans-kr/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/state/auth';
import { RouteDraftProvider } from '@/state/routeDraft';
import { ToastProvider } from '@/state/toast';
import { VehicleFilterProvider } from '@/state/vehicleFilter';
import { colors, fonts } from '@/theme';

/** 아래 화면이 비쳐 보이는 바텀 시트형 화면 */
const SHEET_OPTIONS = {
  headerShown: false,
  presentation: 'transparentModal',
  animation: 'fade',
  contentStyle: { backgroundColor: 'transparent' },
} as const;

// 글꼴과 자동 로그인 정보를 다 불러올 때까지 시작 화면을 유지합니다.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [fonts.krRegular]: NotoSansKR_400Regular,
    [fonts.krMedium]: NotoSansKR_500Medium,
    [fonts.krBold]: NotoSansKR_700Bold,
    [fonts.numMedium]: Inter_500Medium,
    [fonts.numSemiBold]: Inter_600SemiBold,
  });

  // 글꼴을 못 불러와도(error) 기본 글꼴로 앱은 실행합니다.
  if (!loaded && !error) return null;

  return (
    <ToastProvider>
      <AuthProvider>
        <VehicleFilterProvider>
          <RouteDraftProvider>
            <StatusBar style="dark" />
            <AppStack />
          </RouteDraftProvider>
        </VehicleFilterProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

/**
 * 화면 목록. 로그인 전에는 로그인 화면만, 로그인 후에는 나머지 화면만 열 수 있습니다.
 * (로그인 상태가 바뀌면 Expo Router가 알맞은 화면으로 자동 이동)
 */
function AppStack() {
  const { manager, restoring } = useAuth();

  useEffect(() => {
    if (!restoring) SplashScreen.hideAsync().catch(() => {});
  }, [restoring]);

  if (restoring) return null;
  const signedIn = manager !== null;

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.sheet },
        headerTitleStyle: { fontFamily: fonts.krBold },
        contentStyle: { backgroundColor: colors.subtle },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false, contentStyle: { backgroundColor: colors.sheet } }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* 차량 상세는 지도 위에 자체 닫기 버튼이 있어서 기본 헤더를 숨깁니다. */}
        <Stack.Screen name="vehicle/[vin]" options={{ title: '차량 상세', headerShown: false }} />
        <Stack.Screen name="dispatch/[vin]" options={{ title: '목적지 선택' }} />
        {/* 차량 필터: 차량 목록이 비쳐 보이도록 투명 모달로 띄웁니다. */}
        <Stack.Screen name="filter" options={SHEET_OPTIONS} />
        <Stack.Screen name="region" options={{ headerShown: false }} />
        {/* 작업 경로 설정 · 지점 선택: 차량 상세 위에 바텀 시트처럼 띄웁니다. */}
        <Stack.Screen name="route-setup/[vin]" options={SHEET_OPTIONS} />
        <Stack.Screen name="stop-select" options={SHEET_OPTIONS} />
      </Stack.Protected>
    </Stack>
  );
}
