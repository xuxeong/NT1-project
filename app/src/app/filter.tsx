import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChipGrid, FilterChip } from '@/components/FilterChip';
import { Close24Icon } from '@/components/icons';
import {
  BATTERY_HIGH_MIN,
  BATTERY_LOW_MAX,
  DEFAULT_FILTER,
  useVehicleFilter,
  type BatteryFilter,
  type ServiceFilter,
  type StatusFilter,
} from '@/state/vehicleFilter';
import { colors, typography } from '@/theme';
import { OutlineButton, PrimaryButton } from '@/ui';

const STATUS_OPTIONS: [StatusFilter, string][] = [
  ['available', '이용 가능'],
  ['inTask', '작업 중'],
  ['paused', '일시 정지'],
  ['powerOff', '전원 꺼짐'],
  ['fault', '고장'],
];
const SERVICE_OPTIONS: [ServiceFilter, string][] = [
  ['transport', '운송'],
  ['patrol', '순찰'],
];
const BATTERY_OPTIONS: [BatteryFilter, string][] = [
  ['high', `${BATTERY_HIGH_MIN}% 이상`],
  ['low', '배터리 부족'],
];

/** 여러 개 선택: 누르면 넣고/빼기. 빈 배열 = 전체 */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/**
 * 차량 필터 화면
 * 차량 목록 위에 바텀 시트로 뜹니다.
 * 항목마다 칩을 여러 개 고를 수 있고, '전체'를 누르면 그 항목의 선택이 모두 풀립니다.
 */
export default function VehicleFilterScreen() {
  const insets = useSafeAreaInsets();
  const { applied, setApplied, draft, setDraft } = useVehicleFilter();

  // 화면을 열 때 지금 적용된 필터에서 시작합니다.
  useEffect(() => {
    setDraft(applied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const section = <K extends 'statuses' | 'services' | 'batteries'>(
    key: K,
    options: [VehicleFilterValue<K>, string][],
  ) => {
    const selected = draft[key] as VehicleFilterValue<K>[];
    return (
      <ChipGrid>
        {[
          <FilterChip
            key="all"
            label="전체"
            selected={selected.length === 0}
            onPress={() => setDraft((d) => ({ ...d, [key]: [] }))}
          />,
          ...options.map(([value, label]) => (
            <FilterChip
              key={String(value)}
              label={label}
              selected={selected.includes(value)}
              onPress={() => setDraft((d) => ({ ...d, [key]: toggle(d[key] as VehicleFilterValue<K>[], value) }))}
            />
          )),
        ]}
      </ChipGrid>
    );
  };

  return (
    <View style={styles.screen}>
      <Pressable style={[styles.backdropTop, { height: insets.top + 22 }]} onPress={() => router.back()} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: 8 + insets.bottom }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerSide} />
          <Text style={styles.title}>필터</Text>
          <Pressable
            style={styles.headerSide}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            hitSlop={8}
          >
            <Close24Icon width={24} height={24} />
          </Pressable>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>운영 구역</Text>
            <Pressable
              style={({ pressed }) => [styles.regionRow, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/region')}
              accessibilityRole="button"
              accessibilityLabel={`운영 구역 ${draft.aoi ?? '전체'}, 변경`}
            >
              <Text style={styles.regionValue} numberOfLines={1}>
                {draft.aoi ?? '전체'}
              </Text>
              <Text style={styles.regionChange}>변경</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>작업 상태</Text>
            {section('statuses', STATUS_OPTIONS)}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>서비스 유형</Text>
            {section('services', SERVICE_OPTIONS)}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>배터리</Text>
            {section('batteries', BATTERY_OPTIONS)}
            <Text style={styles.hint}>배터리 부족: 잔량 {BATTERY_LOW_MAX}% 이하</Text>
          </View>
        </ScrollView>

        <View style={styles.buttons}>
          <OutlineButton label="초기화" style={styles.reset} onPress={() => setDraft(DEFAULT_FILTER)} />
          <PrimaryButton
            label="필터 적용"
            style={styles.apply}
            onPress={() => {
              setApplied(draft);
              router.back();
            }}
          />
        </View>
      </View>
    </View>
  );
}

type VehicleFilterValue<K> = K extends 'statuses'
  ? StatusFilter
  : K extends 'services'
    ? ServiceFilter
    : BatteryFilter;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'rgba(14, 17, 22, 0.45)' },
  backdropTop: {},
  sheet: {
    flex: 1,
    backgroundColor: colors.subtle,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.hairline },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 20 },
  headerSide: { width: 24, height: 24 },
  title: { ...typography.title17, color: colors.ink, flex: 1, textAlign: 'center' },
  body: { flex: 1 },
  bodyContent: { gap: 24, paddingBottom: 16 },
  section: { gap: 12 },
  sectionTitle: { ...typography.section14, color: colors.ink },
  regionRow: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sheet,
  },
  regionValue: { ...typography.body15, color: colors.ink, flex: 1 },
  regionChange: { ...typography.section14, color: colors.accent },
  hint: { ...typography.caption11, color: colors.textTertiary, marginTop: -4 },
  buttons: { flexDirection: 'row', gap: 12, paddingTop: 8 },
  reset: { width: 116 },
  apply: { flex: 1 },
});
