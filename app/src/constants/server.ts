import Constants from 'expo-constants';

/** Mock 서버 포트 (server/README.md) */
const MOCK_SERVER_PORT = 8000;

/**
 * Mock 서버 주소.
 * 1) 환경 변수 EXPO_PUBLIC_MOCK_BASE_URL이 있으면 그 값을 씁니다. (예: app/.env.local에 적기)
 * 2) 없으면 Expo 개발 서버를 띄운 PC와 같은 주소의 8000번 포트를 씁니다.
 *    폰(같은 Wi-Fi)·에뮬레이터 모두 Expo Go로 접속한 주소를 그대로 따라가므로 따로 설정하지 않아도 됩니다.
 *
 * TODO(한정혁): 통신 계층(src/api/)에서도 이 주소를 사용해 주세요.
 */
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];

export const MOCK_BASE_URL: string =
  process.env.EXPO_PUBLIC_MOCK_BASE_URL ??
  (devHost ? `http://${devHost}:${MOCK_SERVER_PORT}` : `http://10.0.2.2:${MOCK_SERVER_PORT}`);
