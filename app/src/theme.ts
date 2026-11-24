/**
 * 디자인 토큰. 값은 Figma 파일(NT1)의 v2 변수에서 가져왔습니다.
 * 디자인이 바뀌면 이 파일의 값만 고치면 모든 화면에 반영됩니다.
 */
export const colors = {
  // Figma v2 변수
  ink: '#0E1116', // v2/ink
  accent: '#2F5BEA', // v2/accent
  accentSubtle: '#EAF0FF', // v2/accent-subtle
  danger: '#D93A3A', // v2/danger
  dangerSubtle: '#FCEDED', // v2/danger-subtle
  success: '#1E9E57', // v2/success
  successSubtle: '#E8F6EE', // v2/success-subtle
  sheet: '#FFFFFF', // v2/bg/sheet
  subtle: '#F4F5F7', // v2/bg/subtle
  hairline: '#E3E6EB', // v2/border/hairline
  textSecondary: '#5B6270', // v2/text/secondary
  textTertiary: '#9097A3', // v2/text/tertiary
  onInk: '#FFFFFF', // v2/text/on-ink

  // 아직 Figma 변수가 없는 값 (연동 가이드 기준)
  warn: '#F2A900', // 네트워크 지연 '주의' 구간
  routePreview: '#2F80ED', // 지도 경로 미리보기
  routeConfirmed: '#7B3FE4', // 지도 확정 경로
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/**
 * 글꼴 이름. src/app/_layout.tsx 에서 같은 이름으로 불러옵니다.
 * 직접 만든 글꼴은 fontWeight로 굵기가 바뀌지 않으므로, 굵기마다 다른 글꼴 이름을 씁니다.
 */
export const fonts = {
  krRegular: 'NotoSansKR_400Regular',
  krMedium: 'NotoSansKR_500Medium',
  krBold: 'NotoSansKR_700Bold',
  numMedium: 'Inter_500Medium',
  numSemiBold: 'Inter_600SemiBold',
} as const;

/**
 * 글자 스타일 (Figma V2 텍스트 스타일).
 * 한글은 Noto Sans KR, 숫자·영문 ID는 Inter를 씁니다.
 * Figma의 자간 -1, -2는 글자 크기의 -1%, -2% 입니다.
 */
export const typography = {
  id28: { fontFamily: fonts.numSemiBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.56 },
  value18: { fontFamily: fonts.numSemiBold, fontSize: 18, lineHeight: 24, letterSpacing: -0.18 },
  title17: { fontFamily: fonts.krBold, fontSize: 17, lineHeight: 24, letterSpacing: -0.17 },
  button16: { fontFamily: fonts.krBold, fontSize: 16, lineHeight: 24 },
  body15: { fontFamily: fonts.krRegular, fontSize: 15, lineHeight: 22 },
  section14: { fontFamily: fonts.krBold, fontSize: 14, lineHeight: 20 },
  body13: { fontFamily: fonts.krRegular, fontSize: 13, lineHeight: 18 },
  num13: { fontFamily: fonts.numMedium, fontSize: 13, lineHeight: 18 },
  label12: { fontFamily: fonts.krMedium, fontSize: 12, lineHeight: 16 },
  unit12: { fontFamily: fonts.numMedium, fontSize: 12, lineHeight: 16 },
  caption11: { fontFamily: fonts.krRegular, fontSize: 11, lineHeight: 14 },
} as const;
