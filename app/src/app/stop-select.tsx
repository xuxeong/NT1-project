import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon, Close24Icon, RadioOffIcon, RadioOnIcon } from '@/components/icons';
import { MOCK_STATIONS } from '@/mocks/stations';
import { findMockVehicle } from '@/mocks/vehicles';
import { useRouteDraft, type StopKind } from '@/state/routeDraft';
import { colors, radius, typography } from '@/theme';
import { PrimaryButton } from '@/ui';
import { formatDistance, haversineMeters } from '@/utils/geo';

const TITLE: Record<StopKind, string> = { start: '출발지 선택', stop: '경유지 선택', end: '도착지 선택' };

/**
 * 지점 선택 (Figma: 작업 수행 · 지점 선택). 경로 설정에서 지점 줄을 누르면 열립니다.
 * 지점 목록은 임시 데이터(mocks/stations.ts)이고, 거리는 차량 현재 위치에서 잽니다.
 */
export default function StopSelectScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const insets = useSafeAreaInsets();
  const { draft, setStation } = useRouteDraft();
  const stop = draft.stops.find((s) => s.key === key);
  const [selected, setSelected] = useState<string | null>(stop?.stationId ?? null);
  const vehicle = findMockVehicle(draft.vin);

  const done = () => {
    if (stop && selected) setStation(stop.key, selected);
    router.back();
  };

  return (
    <View style={styles.screen}>
      <Pressable style={{ height: insets.top + 6 }} onPress={() => router.back()} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: 8 + insets.bottom }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Pressable style={styles.side} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="뒤로">
            <BackIcon width={24} height={24} />
          </Pressable>
          <Text style={styles.title}>{TITLE[stop?.kind ?? 'stop']}</Text>
          {/* 닫기: 경로 설정까지 닫고 차량 상세로 */}
          <Pressable style={styles.side} onPress={() => router.dismiss(2)} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
            <Close24Icon width={24} height={24} />
          </Pressable>
        </View>

        <Text style={styles.area}>
          {vehicle?.parkName ?? 'C-Track 오창'} · 지점 {MOCK_STATIONS.length}곳
        </Text>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.list}>
            {MOCK_STATIONS.map((st, i) => {
              const on = st.id === selected;
              const meters = vehicle ? haversineMeters(vehicle.position, st.position) : null;
              const sub = meters === null ? '' : meters < 30 ? '현재 위치' : formatDistance(meters);
              return (
                <Fragment key={st.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={[styles.item, on && styles.itemOn]}
                    onPress={() => setSelected(st.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${st.name}, ${sub}`}
                  >
                    <View style={styles.itemTexts}>
                      <Text style={on ? styles.nameOn : styles.name}>{st.name}</Text>
                      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
                    </View>
                    {on ? <RadioOnIcon width={22} height={22} /> : <RadioOffIcon width={22} height={22} />}
                  </Pressable>
                </Fragment>
              );
            })}
          </View>
        </ScrollView>

        <PrimaryButton label="선택 완료" disabled={!selected} onPress={done} style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'rgba(14, 17, 22, 0.45)' },
  sheet: {
    flex: 1,
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.hairline },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 16 },
  side: { width: 24, height: 24 },
  title: { ...typography.title17, color: colors.ink, flex: 1, textAlign: 'center' },
  area: { ...typography.label12, color: colors.textSecondary, marginBottom: 10 },
  body: { flex: 1 },
  list: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.subtle },
  divider: { height: 1, backgroundColor: colors.hairline },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  itemOn: { backgroundColor: colors.accentSubtle },
  itemTexts: { flex: 1, gap: 2 },
  name: { ...typography.body15, color: colors.ink },
  nameOn: { ...typography.section14, color: colors.accent },
  sub: { ...typography.caption11, color: colors.textTertiary },
  button: { marginTop: 12 },
});
