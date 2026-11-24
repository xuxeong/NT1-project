import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Close24Icon, DiamondIcon, PlusIcon } from '@/components/icons';
import { StopRow } from '@/components/StopRow';
import { findStation, MOCK_STATIONS } from '@/mocks/stations';
import { findMockVehicle } from '@/mocks/vehicles';
import { useRouteDraft } from '@/state/routeDraft';
import { colors, typography } from '@/theme';
import { PrimaryButton } from '@/ui';
import { haversineMeters } from '@/utils/geo';

/**
 * 작업 수행 · 경로 설정
 * 주행 유형 선택에서 '작업 수행'을 고르면 열립니다. 출발 → 경유(여러 개) → 도착 순서로 지점을 고릅니다.
 *
 * TODO: '출발 확인' 시 vehicleStart/v1 호출. 서버는 지금 출발지→도착지만 받으므로 경유지는 서버팀과 협의 필요.
 */
export default function RouteSetupScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const insets = useSafeAreaInsets();
  const { draft, reset, addStop, removeStop } = useRouteDraft();

  // 화면을 열 때마다 새로 시작: 출발지 = 차량 현재 위치에서 가장 가까운 지점
  useEffect(() => {
    const vehicle = findMockVehicle(vin);
    const nearest = vehicle
      ? [...MOCK_STATIONS].sort(
          (a, b) => haversineMeters(vehicle.position, a.position) - haversineMeters(vehicle.position, b.position),
        )[0]
      : null;
    reset(vin, nearest?.id ?? null);
  }, [vin, reset]);

  const stops = draft.vin === vin ? draft.stops : [];
  const stopCount = stops.filter((s) => s.kind === 'stop').length;
  const ready = stops.length > 0 && stops.every((s) => s.stationId !== null);

  const openSelect = (key: string) => router.push({ pathname: '/stop-select', params: { key } });

  const confirm = () => {
    const names = stops.map((s) => findStation(s.stationId)?.name ?? '').join(' → ');
    Alert.alert('출발 요청', `서버 연동 후 출발 요청이 전송돼요.\n\n${names}`, [{ text: '확인', onPress: () => router.back() }]);
  };

  return (
    <View style={styles.screen}>
      <Pressable style={{ height: insets.top + 6 }} onPress={() => router.back()} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: 8 + insets.bottom }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.side} />
          <Text style={styles.title}>작업 경로 설정</Text>
          <Pressable style={styles.side} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
            <Close24Icon width={24} height={24} />
          </Pressable>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {stops.map((s) => (
            <View key={s.key} style={styles.list}>
              {/* 경유지 추가 버튼은 도착지 바로 위 */}
              {s.kind === 'end' && (
                <View style={styles.addWrap}>
                  <Pressable
                    style={({ pressed }) => [styles.add, pressed && { opacity: 0.8 }]}
                    onPress={addStop}
                    accessibilityRole="button"
                    accessibilityLabel={`경유지 추가 (지금 ${stopCount}곳)`}
                  >
                    <PlusIcon width={18} height={18} />
                    <Text style={styles.addLabel}>경유지 추가</Text>
                  </Pressable>
                </View>
              )}
              <StopRow
                kind={s.kind}
                name={s.kind === 'start' ? startName(s.stationId) : findStation(s.stationId)?.name ?? null}
                showContact={s.kind !== 'start'}
                contact={s.contact}
                removable={s.kind !== 'start'}
                selectable={s.kind !== 'start'} // 출발지는 현재 위치로 고정
                onPress={() => openSelect(s.key)}
                onContactPress={() => Alert.alert('담당자', '담당자 입력은 준비 중이에요.')}
                onRemove={() => removeStop(s.key)}
              />
            </View>
          ))}
        </ScrollView>

        <Text style={styles.hint}>담당자를 등록하면 차량이 출발·도착할 때 알림을 받을 수 있어요</Text>
        <PrimaryButton
          label="출발 확인"
          icon={<DiamondIcon width={20} height={20} />}
          disabled={!ready}
          onPress={confirm}
        />
      </View>
    </View>
  );
}

function startName(stationId: string | null): string | null {
  const s = findStation(stationId);
  return s ? `현재 위치 · ${s.name}` : null;
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
  body: { flex: 1 },
  list: { gap: 12 },
  addWrap: { paddingLeft: 54, paddingRight: 28 },
  add: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: colors.sheet,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addLabel: { ...typography.section14, color: colors.accent },
  hint: { ...typography.caption11, color: colors.textTertiary, textAlign: 'center', marginTop: 12, marginBottom: 12 },
});
