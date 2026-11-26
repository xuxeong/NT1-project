import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon, RadioOffIcon, RadioOnIcon, SearchIcon } from '@/components/icons';
import { REGION_CITY, REGION_PROVINCE, REGION_PROVINCE_INITIAL } from '@/constants/region';
import { MOCK_VEHICLES } from '@/mocks/vehicles';
import { useToast } from '@/state/toast';
import { useVehicleFilter } from '@/state/vehicleFilter';
import { colors, radius, typography } from '@/theme';
import { OutlineButton, PrimaryButton } from '@/ui';

const COL = { index: 28, province: 112, city: 62 };

/**
 * 운영 구역 선택
 * 차량 필터의 '변경'에서 들어옵니다.
 * 시·도 / 시·군·구는 고정값이고, 운영 구역 목록은 차량들의 parkName을 모아서 만듭니다.
 * '선택 완료'를 누르면 필터 화면의 선택 중인 값(draft)에 반영됩니다.
 */
export default function RegionSelectScreen() {
  const insets = useSafeAreaInsets();
  const { draft, setDraft } = useVehicleFilter();
  const { showToast } = useToast();
  const [aoi, setAoi] = useState<string | null>(draft.aoi);

  // TODO: 서버 연동 후에는 서버에서 받은 차량 목록으로 바꿔 주세요.
  const aoiList = useMemo(() => [...new Set(MOCK_VEHICLES.map((v) => v.parkName))].sort(), []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="뒤로">
          <BackIcon width={22} height={22} />
        </Pressable>
        <Text style={styles.title}>운영 구역 선택</Text>
        <Pressable
          style={styles.iconButton}
          onPress={() => showToast('구역 검색은 준비 중이에요', 'info')}
          accessibilityRole="button"
          accessibilityLabel="구역 검색"
        >
          <SearchIcon width={22} height={22} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.current}>
          <Text style={styles.currentLabel}>현재 구역</Text>
          <Text style={styles.currentValue}>
            {REGION_PROVINCE} {REGION_CITY} · {draft.aoi ?? '전체'}
          </Text>
        </View>

        <View style={styles.card}>
          {/* 열 제목: 아래 열과 같은 너비 */}
          <View style={styles.headRow}>
            <View style={{ width: COL.index }} />
            <Text style={[styles.headCell, { width: COL.province }]}>시·도</Text>
            <View style={styles.headGap} />
            <Text style={[styles.headCell, { width: COL.city }]}>시·군·구</Text>
            <View style={styles.headGap} />
            <View style={[styles.headAoi]}>
              <Text style={styles.headText}>운영 구역</Text>
              {aoi && <Text style={[styles.headText, { color: colors.accent }]}>1</Text>}
            </View>
          </View>
          <View style={styles.hLine} />

          <View style={styles.body}>
            <View style={[styles.indexCol, { width: COL.index }]}>
              <View style={styles.indexBubble}>
                <Text style={styles.indexText}>{REGION_PROVINCE_INITIAL}</Text>
              </View>
            </View>
            <View style={[styles.col, { width: COL.province }]}>
              <Item label={REGION_PROVINCE} selected />
            </View>
            <View style={styles.vLine} />
            <View style={[styles.col, { width: COL.city }]}>
              <Item label={REGION_CITY} selected />
            </View>
            <View style={styles.vLine} />
            <ScrollView style={styles.colFlex} contentContainerStyle={styles.colContent}>
              <Item label="전체" selected={aoi === null} radio onPress={() => setAoi(null)} />
              {aoiList.map((name) => (
                <Item key={name} label={name} selected={aoi === name} radio onPress={() => setAoi(name)} />
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: 8 + insets.bottom }]}>
        <OutlineButton label="초기화" style={styles.reset} onPress={() => setAoi(null)} />
        <PrimaryButton
          label="선택 완료"
          style={styles.apply}
          onPress={() => {
            setDraft((d) => ({ ...d, aoi }));
            router.back();
          }}
        />
      </View>
    </View>
  );
}

function Item({
  label,
  selected,
  radio,
  onPress,
}: {
  label: string;
  selected: boolean;
  radio?: boolean;
  onPress?: () => void;
}) {
  const highlightRow = selected && !radio; // 시·도 / 시·군·구는 줄 전체를 연한 파랑으로
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={radio ? 'radio' : undefined}
      accessibilityState={radio ? { checked: selected } : undefined}
      style={[styles.item, highlightRow && { backgroundColor: colors.accentSubtle }]}
    >
      <Text style={[selected ? styles.itemOn : styles.itemOff, styles.itemText]}>{label}</Text>
      {radio && (selected ? <RadioOnIcon width={20} height={20} /> : <RadioOffIcon width={20} height={20} />)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.subtle },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title17, color: colors.ink, flex: 1, textAlign: 'center' },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 10, gap: 16 },
  current: { backgroundColor: colors.sheet, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  currentLabel: { ...typography.label12, color: colors.textSecondary },
  currentValue: { ...typography.section14, color: colors.ink },

  card: { flex: 1, backgroundColor: colors.sheet, borderRadius: radius.lg, overflow: 'hidden' },
  headRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  headCell: { ...typography.label12, color: colors.textSecondary, paddingLeft: 10 },
  headGap: { width: 1 },
  headAoi: { flex: 1, flexDirection: 'row', gap: 4, paddingLeft: 10 },
  headText: { ...typography.label12, color: colors.textSecondary },
  hLine: { height: 1, backgroundColor: colors.hairline },

  body: { flex: 1, flexDirection: 'row' },
  indexCol: { alignItems: 'center', paddingTop: 20 },
  indexBubble: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  indexText: { ...typography.caption11, color: colors.onInk },
  col: { paddingVertical: 8 },
  colFlex: { flex: 1 },
  colContent: { paddingVertical: 8 },
  vLine: { width: 1, backgroundColor: colors.hairline },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 12 },
  itemText: { flex: 1 },
  itemOn: { ...typography.section14, color: colors.accent },
  itemOff: { ...typography.body13, color: colors.ink },

  bottom: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  reset: { width: 116 },
  apply: { flex: 1 },
});
