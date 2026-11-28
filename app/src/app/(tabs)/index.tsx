import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ErrorState';
import { ClearIcon, FilterIcon, MapIcon, SearchIcon } from '@/components/icons';
import { OsmMap } from '@/components/OsmMap';
import { SkeletonBlock, SkeletonGroup, VehicleCardSkeleton } from '@/components/Skeleton';
import { VehicleCard } from '@/components/VehicleCard';
import { useAsync } from '@/hooks/useAsync';
import { useUserLocation } from '@/hooks/useUserLocation';
import { fetchMockVehicles } from '@/mocks/mockServer';
import { useAuth } from '@/state/auth';
import { isFilterActive, matchesFilter, useVehicleFilter } from '@/state/vehicleFilter';
import { colors, radius, typography } from '@/theme';
import type { Vehicle } from '@/types/vehicle';
import { waGwa } from '@/utils/korean';

/**
 * 차량 목록
 * 왼쪽 위 지도 버튼으로 지도 보기(매뉴얼 3.2)와 목록 보기를 오갑니다.
 * 서버 연동 전까지는 임시 데이터를 조금 늦게 받아서 로딩·오류 화면도 확인합니다 (mocks/mockServer.ts).
 */
/** 목록을 보는 동안 다시 불러오는 주기 */
const LIST_REFRESH_MS = 3000;

export default function VehicleListScreen() {
  const insets = useSafeAreaInsets();
  const userLocation = useUserLocation();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const trimmed = query.trim();

  const { applied: filter } = useVehicleFilter();
  const filterOn = isFilterActive(filter);

  // 로그인한 담당자의 담당 차량만 보여 줍니다 (서버: GET /api/vehicles?user_id=...)
  const { manager } = useAuth();
  const assignedIds = manager?.assignedVehicleIds;
  const { data, loading, error, reload } = useAsync(() => fetchMockVehicles(assignedIds), [assignedIds]);

  // 목록을 보는 동안 3초마다 다시 불러와서 작업 중 → 이용 가능 같은 상태 변화와 지도 위치를 반영합니다.
  // 다른 화면에서 돌아올 때도 바로 다시 불러옵니다. (처음 열 때는 위 useAsync가 불러옴)
  // TODO(한정혁): 연동 시 실시간 갱신(1초 조회 또는 /ws/telemetry)으로 바꿔 주세요.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) reload();
      focusedOnce.current = true;
      const timer = setInterval(reload, LIST_REFRESH_MS);
      return () => clearInterval(timer);
    }, [reload]),
  );
  const vehicles: Vehicle[] = useMemo(() => data ?? [], [data]);
  // 처음 불러오는 중이거나 실패했을 때 (이미 받은 목록이 있으면 그대로 보여 줌)
  const showLoading = loading && !data;
  const showError = !!error && !data;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles.filter(
      (v) =>
        matchesFilter(v, filter) && (!q || v.vin.toLowerCase().includes(q) || v.vinId.toLowerCase().includes(q)),
    );
  }, [query, vehicles, filter]);

  const openVehicle = (vin: string) => router.push({ pathname: '/vehicle/[vin]', params: { vin } });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <RoundButton
          label={mode === 'list' ? '지도로 보기' : '목록으로 보기'}
          onPress={() => setMode(mode === 'list' ? 'map' : 'list')}
        >
          <MapIcon width={20} height={20} />
        </RoundButton>
        <Text style={styles.title}>차량 목록</Text>
        <RoundButton label={filterOn ? '필터 (적용 중)' : '필터'} onPress={() => router.push('/filter')} showDot={filterOn}>
          <FilterIcon width={20} height={20} />
        </RoundButton>
      </View>

      <View style={styles.searchArea}>
        {/* 검색창 (Figma: 검색 입력 중 / 검색 결과). 입력 중에는 파란 테두리, 글자가 있으면 지우기 버튼 */}
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <SearchIcon width={20} height={20} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="차량 ID를 입력하세요"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            style={styles.searchInput}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="차량 ID 검색"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="검색어 지우기">
              <ClearIcon width={20} height={20} />
            </Pressable>
          )}
        </View>
        {showLoading ? (
          <SkeletonGroup>
            <SkeletonBlock width={52} height={14} style={styles.countSkeleton} />
          </SkeletonGroup>
        ) : (
          <Text style={styles.count}>
            {showError ? ' ' : trimmed || filterOn ? `검색 결과 ${filtered.length}대` : `전체 ${vehicles.length}대`}
          </Text>
        )}
      </View>

      {showError ? (
        <ErrorState surface="page" onRetry={reload} style={styles.errorState} />
      ) : mode === 'list' && showLoading ? (
        <SkeletonGroup style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <VehicleCardSkeleton key={i} />
          ))}
        </SkeletonGroup>
      ) : mode === 'list' ? (
        <FlatList
          data={filtered}
          keyExtractor={(v) => v.vin}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <VehicleCard
              vehicle={item}
              userLocation={userLocation}
              highlight={trimmed}
              onPress={() => openVehicle(item.vin)}
            />
          )}
          ListEmptyComponent={
            trimmed ? (
              <EmptyResult
                title={`'${trimmed}'${waGwa(trimmed)} 일치하는 차량이 없어요`}
                description="차량 ID를 다시 확인해 주세요"
              />
            ) : (
              <EmptyResult title="조건에 맞는 차량이 없어요" description="필터를 바꿔 보세요" />
            )
          }
        />
      ) : (
        <OsmMap style={styles.map}>
          {filtered.map((v) => (
            <Marker
              key={v.vin}
              coordinate={{ latitude: v.position.lat, longitude: v.position.lng }}
              title={v.vin}
              onCalloutPress={() => openVehicle(v.vin)}
            />
          ))}
        </OsmMap>
      )}
    </View>
  );
}

/** 결과 없음 안내 (Figma: 차량 목록 화면 · 검색 결과 없음) */
function EmptyResult({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <SearchIcon width={28} height={28} />
      </View>
      <View style={styles.emptyTexts}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyDesc}>{description}</Text>
      </View>
    </View>
  );
}

function RoundButton({
  label,
  onPress,
  children,
  showDot = false,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  /** 오른쪽 위 파란 점 (Figma: Indicator Dot). 예) 필터 적용 중 */
  showDot?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.roundButton, pressed && { opacity: 0.7 }]}
    >
      {children}
      {showDot && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.subtle },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sheet,
  },
  // Figma: 지름 10px 파란 점 + 바깥쪽 흰 테두리 2px → 전체 14px
  dot: {
    position: 'absolute',
    top: 4,
    left: 24,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.sheet,
    backgroundColor: colors.accent,
  },
  title: { ...typography.title17, color: colors.ink },
  searchArea: { paddingTop: 6, paddingHorizontal: 16, gap: 14 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.sheet,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchBoxFocused: { borderColor: colors.accent },
  // Android에서 Noto Sans KR의 위아래 여백 때문에 글자가 잘리지 않도록 lineHeight를 빼고 가운데 정렬합니다.
  searchInput: {
    fontFamily: typography.body15.fontFamily,
    fontSize: typography.body15.fontSize,
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    color: colors.ink,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  count: { ...typography.label12, color: colors.textSecondary },
  // 글자 줄 높이(16)에 맞춰 위아래 1씩 띄웁니다
  countSkeleton: { marginVertical: 1 },
  errorState: { paddingTop: 96 },
  list: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  emptyWrap: { alignItems: 'center', gap: 12, paddingTop: 96 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sheet,
  },
  emptyTexts: { alignItems: 'center', gap: 4 },
  emptyTitle: { ...typography.title17, color: colors.ink, textAlign: 'center' },
  emptyDesc: { ...typography.body13, color: colors.textSecondary, textAlign: 'center' },
  map: { flex: 1, marginTop: 10, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
});
