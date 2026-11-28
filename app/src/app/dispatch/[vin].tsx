import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ErrorState';
import {
  BackIcon,
  CalibrateIcon,
  ChevronRightIcon,
  DestinationPinIcon,
  DiamondIcon,
  PersonIcon,
  Pin20Icon,
  VehicleMarkerIcon,
  WarningIcon,
} from '@/components/icons';
import { ManagerPickerSheet } from '@/components/ManagerPickerSheet';
import { OsmMap } from '@/components/OsmMap';
import { StatusChip } from '@/components/StatusChip';
import { TextField } from '@/components/TextField';
import { useAsync } from '@/hooks/useAsync';
import {
  fetchMockVehicle,
  fetchMockVehicleManagers,
  MockRejectedError,
  MockRouteNotFoundError,
  previewMockDispatch,
  sendMockDispatch,
} from '@/mocks/mockServer';
import { useAuth } from '@/state/auth';
import { useToast } from '@/state/toast';
import { colors, radius, typography } from '@/theme';
import type { DispatchPreview } from '@/types/dispatch';
import type { LatLng, Vehicle } from '@/types/vehicle';
import { FloatingButton, OutlineButton, PrimaryButton, StatCell, StatDivider } from '@/ui';
import { minutesToDrive, VEHICLE_SPEED_KMH } from '@/constants/vehicle';
import { splitDistance } from '@/utils/format';
import { haversineMeters, regionAround, toMapCoords } from '@/utils/geo';
import { getVehicleStatus } from '@/utils/vehicleStatus';

const vehicleImage = require('../../../assets/images/vehicle-n3-card.png');

const DEFAULT_TARGET_NAME = '지도에서 선택한 목적지';
const MAP_DELTA = 0.004;
/** 차량과 이보다 가까운 곳은 목적지로 고를 수 없습니다 (지도를 움직이지 않고 바로 설정하는 경우 등) */
const MIN_DISPATCH_DISTANCE_M = 10;

/**
 * 목적지 선택 (Figma: 목적지 선택 · 지도 이동 중 / 위치 고정 / 경로 미리보기 / 담당자 선택 / 경로 찾기 실패).
 * 1. 지도를 움직여 가운데 핀으로 목적지를 고르고 '이 위치로 설정'
 * 2. 서버가 도로 위로 맞춘 목적지와 경로를 보여 주면, 이름·알림 받을 담당자를 정하고 '출발'
 *
 * 지금은 서버 연동 전이라 mocks/mockServer.ts의 previewMockDispatch·sendMockDispatch를 씁니다.
 */
export default function DispatchScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const insets = useSafeAreaInsets();
  const { data: vehicle, loading, error, reload } = useAsync(() => fetchMockVehicle(vin), [vin]);

  return (
    <View style={styles.screen}>
      {vehicle ? (
        <DispatchContent vehicle={vehicle} />
      ) : (
        <>
          <OsmMap style={styles.map} attributionStyle={styles.attribution} />
          <View style={[styles.sheet, styles.sheetCenter, { paddingBottom: 24 + insets.bottom }]}>
            {error && !loading ? (
              <ErrorState surface="sheet" onRetry={reload} />
            ) : loading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.sub}>차량을 찾을 수 없어요.</Text>
            )}
          </View>
          <TopBar guide="지도를 움직여 목적지를 선택하세요" />
        </>
      )}
    </View>
  );
}

function DispatchContent({ vehicle }: { vehicle: Vehicle }) {
  const insets = useSafeAreaInsets();
  const { manager } = useAuth();
  const { showToast } = useToast();
  const mapRef = useRef<MapView>(null);

  // ── 1단계: 가운데 핀으로 위치 고르기 ──
  const [center, setCenter] = useState<LatLng>(vehicle.position);
  const [moving, setMoving] = useState(false);
  const [routeNotFound, setRouteNotFound] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // ── 2단계: 경로 미리보기 + 이름·담당자 ──
  const [preview, setPreview] = useState<DispatchPreview | null>(null);
  const [targetName, setTargetName] = useState('');
  /** 사용자가 고른 담당자. 고르기 전이면 null → 기본값(defaultNotifyId) */
  const [pickedNotifyId, setPickedNotifyId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // 알림 받을 담당자 목록: 그 차량 담당자. 처음에는 로그인한 본인 (본인이 담당자가 아니면 첫 번째 사람)
  const { data: managers } = useAsync(() => fetchMockVehicleManagers(vehicle.vin), [vehicle.vin]);
  const defaultNotifyId =
    managers?.find((m) => m.userId === manager?.userId)?.userId ?? managers?.[0]?.userId ?? null;
  const notifyUserId = pickedNotifyId ?? defaultNotifyId;
  const notifyManager = managers?.find((m) => m.userId === notifyUserId);

  const onRegionChange = () => {
    if (preview) return;
    setMoving(true);
    setRouteNotFound(false);
  };
  const onRegionChangeComplete = (region: Region) => {
    if (preview) return;
    setCenter({ lat: region.latitude, lng: region.longitude });
    setMoving(false);
  };

  const moveTo = (p: LatLng) =>
    mapRef.current?.animateToRegion({ latitude: p.lat, longitude: p.lng, latitudeDelta: MAP_DELTA, longitudeDelta: MAP_DELTA });

  /** '이 위치로 설정': 서버에 도로 보정·경로를 물어봅니다 */
  const requestPreview = async () => {
    setPreviewing(true);
    try {
      const result = await previewMockDispatch(vehicle, center);
      setPreview(result);
      mapRef.current?.animateToRegion(regionAround(result.path));
    } catch (e) {
      if (e instanceof MockRouteNotFoundError) setRouteNotFound(true);
      else showToast('요청을 보내지 못했어요. 다시 시도해 주세요');
    } finally {
      setPreviewing(false);
    }
  };

  /** '다시 선택': 1단계로 돌아가 방금 목적지에서 다시 고릅니다 */
  const reselect = () => {
    const target = preview?.target;
    setPreview(null);
    if (target) moveTo(target);
  };

  /** '출발': 배차 요청 후 차량 상세로 돌아갑니다 */
  const depart = async () => {
    if (!preview || !notifyUserId) return;
    setSending(true);
    try {
      await sendMockDispatch(vehicle, { target: preview.target, targetName, notifyUserId }, manager?.userId ?? '');
      showToast('주행을 시작했어요', 'info');
      router.back();
    } catch (e) {
      showToast(
        e instanceof MockRejectedError ? '지금은 이 차량에 배차할 수 없어요' : '요청을 보내지 못했어요. 다시 시도해 주세요',
      );
      setSending(false);
    }
  };

  const status = getVehicleStatus(vehicle);
  const tooClose = haversineMeters(center, vehicle.position) < MIN_DISPATCH_DISTANCE_M;
  const minutes = preview ? minutesToDrive(preview.distanceM) : 0;
  const [distValue, distUnit] = splitDistance(preview?.distanceM ?? 0);

  return (
    <>
      {/* ── 지도 ── */}
      <View style={styles.map}>
        <OsmMap
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          attributionStyle={styles.attribution}
          initialRegion={{
            latitude: vehicle.position.lat,
            longitude: vehicle.position.lng,
            latitudeDelta: MAP_DELTA,
            longitudeDelta: MAP_DELTA,
          }}
          onRegionChange={onRegionChange}
          onRegionChangeComplete={onRegionChangeComplete}
        >
          {preview && (
            <>
              {/* 미리보기 경로: 흰 테두리 + 파란 선 */}
              <Polyline coordinates={toMapCoords(preview.path)} strokeColor={colors.sheet} strokeWidth={9} />
              <Polyline coordinates={toMapCoords(preview.path)} strokeColor={colors.routePreview} strokeWidth={5} />
              <Marker
                coordinate={{ latitude: preview.target.lat, longitude: preview.target.lng }}
                anchor={{ x: 0.5, y: 1 }}
                // 글자·SVG가 그려진 뒤 크기가 정해지므로 다시 그리기를 켜 둡니다 (끄면 핀이 잘려 보임)
                tracksViewChanges
              >
                <View style={styles.markerWrap}>
                  <PinLabel text="목적지" />
                  <DestinationPinIcon width={PIN_W} height={PIN_H} />
                </View>
              </Marker>
            </>
          )}
          <Marker
            coordinate={{ latitude: vehicle.position.lat, longitude: vehicle.position.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <VehicleMarkerIcon width={48} height={48} />
          </Marker>
        </OsmMap>

        {/* 지도 가운데 고정 핀: 지도만 움직이고 핀은 그대로. 핀 끝이 지도 정중앙 */}
        {!preview && (
          <View pointerEvents="none" style={[styles.centerPin, moving && styles.centerPinLifted]}>
            {!moving && !routeNotFound && !tooClose && (
              <View style={styles.centerPinLabel}>
                <PinLabel text="여기로 설정" />
              </View>
            )}
            <DestinationPinIcon width={PIN_W} height={PIN_H} />
          </View>
        )}
        {!preview && <View pointerEvents="none" style={[styles.pinShadow, moving && { opacity: 0.4 }]} />}

        <FloatingButton label="차량 위치로 이동" style={styles.locate} onPress={() => moveTo(vehicle.position)}>
          <CalibrateIcon width={20} height={20} />
        </FloatingButton>
      </View>

      {/* ── 바텀 시트 ── */}
      <View style={styles.sheet}>
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.sheetContent, { paddingBottom: 8 + insets.bottom }]}
        >
          <View style={styles.handle} />
          {!preview ? (
            <>
              <View style={styles.row}>
                <Image source={vehicleImage} style={styles.vehicleImage} resizeMode="contain" />
                <View style={styles.rowText}>
                  <Text style={styles.caption}>배차 차량</Text>
                  <Text style={styles.vehicleId}>{vehicle.vin}</Text>
                </View>
                <StatusChip label={status.label} tone={status.tone} />
              </View>

              {routeNotFound ? (
                <PlaceRow
                  tone="danger"
                  caption="경로를 찾을 수 없어요"
                  title="이 위치까지 갈 수 있는 도로가 없어요"
                  sub="도로와 가까운 곳으로 핀을 옮겨 주세요"
                />
              ) : moving ? (
                <PlaceRow caption="선택한 위치" title="위치를 맞추는 중…" sub="지도를 멈추면 위치가 정해져요" muted />
              ) : tooClose ? (
                <PlaceRow caption="선택한 위치" title="지금 차량이 있는 곳이에요" sub="지도를 움직여 목적지에 핀을 맞춰 주세요" muted />
              ) : (
                <PlaceRow caption="선택한 위치" title="지도에서 선택한 위치" sub={formatCoord(center)} />
              )}

              <PrimaryButton
                label="이 위치로 설정"
                disabled={moving || routeNotFound || tooClose}
                loading={previewing}
                onPress={requestPreview}
              />
            </>
          ) : (
            <>
              <View style={styles.destBlock}>
                <TextField
                  label="목적지 이름 (선택)"
                  value={targetName}
                  onChangeText={setTargetName}
                  placeholder={DEFAULT_TARGET_NAME}
                  maxLength={30}
                  returnKeyType="done"
                />
                <View>
                  <Text style={styles.coord}>{formatCoord(preview.target)}</Text>
                  {preview.snapDistanceM >= 1 && (
                    <Text style={styles.snapNote}>
                      도로 위 가장 가까운 곳({Math.round(preview.snapDistanceM)}m)으로 맞췄어요
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.stats}>
                <StatCell label="경로 거리" value={distValue} unit={distUnit} />
                <StatDivider />
                <StatCell label="예상 소요" value={`${minutes}`} unit="분" />
                <StatDivider />
                <StatCell label="주행 속도" value={`${VEHICLE_SPEED_KMH}`} unit="km/h" />
              </View>

              <Pressable
                style={({ pressed }) => [styles.managerRow, pressed && { opacity: 0.8 }]}
                onPress={() => setPickerOpen(true)}
                disabled={!managers?.length}
                accessibilityRole="button"
                accessibilityLabel={`알림 받을 담당자, ${notifyManager?.name ?? '없음'}, 바꾸기`}
              >
                <View style={styles.personIcon}>
                  <PersonIcon width={20} height={20} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.caption}>알림 받을 담당자</Text>
                  <Text style={styles.managerName} numberOfLines={1}>
                    {notifyManager?.name ?? '담당자를 불러오는 중…'}
                  </Text>
                  {notifyManager && (
                    <Text style={styles.sub} numberOfLines={1}>
                      {notifyManager.phone} · 출발·도착 알림
                    </Text>
                  )}
                </View>
                <ChevronRightIcon width={20} height={20} />
              </Pressable>

              <View style={styles.buttons}>
                <OutlineButton label="다시 선택" onPress={reselect} disabled={sending} style={styles.reselect} />
                <PrimaryButton
                  label="출발"
                  icon={<DiamondIcon width={20} height={20} />}
                  disabled={!notifyUserId}
                  loading={sending}
                  onPress={depart}
                  style={styles.depart}
                />
              </View>
            </>
          )}
        </ScrollView>
      </View>

      <TopBar guide={preview ? '경로를 확인하고 출발해 주세요' : '지도를 움직여 목적지를 선택하세요'} />

      <ManagerPickerSheet
        visible={pickerOpen}
        managers={managers ?? []}
        selectedId={notifyUserId}
        myUserId={manager?.userId}
        onClose={() => setPickerOpen(false)}
        onConfirm={(id) => {
          setPickedNotifyId(id);
          setPickerOpen(false);
        }}
      />
    </>
  );
}

/** 뒤로 버튼 + 안내 문구 */
function TopBar({ guide }: { guide: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { top: insets.top + 6 }]} pointerEvents="box-none">
      <FloatingButton label="뒤로" onPress={() => router.back()}>
        <BackIcon width={20} height={20} />
      </FloatingButton>
      <View style={styles.guide}>
        <Text style={styles.guideText}>{guide}</Text>
      </View>
      <View style={styles.topSpacer} />
    </View>
  );
}

/** 핀 위 검은 말풍선 (여기로 설정 / 목적지) */
function PinLabel({ text }: { text: string }) {
  return (
    <View style={styles.pinLabel}>
      <Text style={styles.pinLabelText}>{text}</Text>
    </View>
  );
}

/** 선택한 위치 (아이콘 + 캡션·제목·보조) */
function PlaceRow({
  caption,
  title,
  sub,
  tone,
  muted,
}: {
  caption: string;
  title: string;
  sub: string;
  tone?: 'danger';
  muted?: boolean;
}) {
  const danger = tone === 'danger';
  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <View style={[styles.placeIcon, { backgroundColor: danger ? colors.dangerSubtle : colors.accentSubtle }]}>
        {danger ? <WarningIcon width={20} height={20} color={colors.danger} /> : <Pin20Icon width={20} height={20} />}
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.caption, danger && { color: colors.danger }]}>{caption}</Text>
        <Text style={[styles.placeTitle, muted && { color: colors.textTertiary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </View>
  );
}


const formatCoord = (p: LatLng) => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;

const PIN_W = 36;
const PIN_H = 48;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sheet },
  // 지도는 시트 위 영역만 차지해서, 지도 가운데 = 보이는 영역 가운데 (가운데 핀 좌표가 정확함)
  map: { flex: 1, marginBottom: -24, backgroundColor: '#E8ECF1' },
  attribution: { bottom: 28 },

  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  topSpacer: { width: 40 },
  guide: {
    flex: 1,
    alignItems: 'center',
  },
  guideText: {
    ...typography.label12,
    color: colors.ink,
    backgroundColor: colors.sheet,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },

  // 핀 끝이 지도 정중앙(= 지도가 알려 주는 가운데 좌표)에 오도록 핀 높이만큼 올립니다. 움직이는 중에는 살짝 더 띄움
  centerPin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: PIN_W,
    height: PIN_H,
    alignItems: 'center',
    transform: [{ translateX: -PIN_W / 2 }, { translateY: -PIN_H }],
  },
  centerPinLifted: { transform: [{ translateX: -PIN_W / 2 }, { translateY: -PIN_H - 10 }] },
  // 말풍선은 핀 위에 따로 띄워서 핀 위치가 바뀌지 않게 합니다
  centerPinLabel: { position: 'absolute', bottom: PIN_H, width: 160, left: (PIN_W - 160) / 2, alignItems: 'center' },
  pinShadow: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 14,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(14, 17, 22, 0.25)',
    transform: [{ translateX: -7 }, { translateY: -2.5 }],
  },
  markerWrap: { alignItems: 'center' },
  pinLabel: {
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  pinLabelText: { ...typography.label12, color: colors.onInk },
  locate: { position: 'absolute', right: 16, bottom: 24 + 16, width: 44, height: 44, borderRadius: 22 },

  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    boxShadow: '0px -4px 20px rgba(13, 18, 23, 0.07)',
  },
  sheetCenter: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  sheetContent: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.hairline },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  vehicleImage: { width: 66, height: 58 },
  caption: { ...typography.caption11, color: colors.textTertiary },
  vehicleId: { ...typography.title17, color: colors.ink },
  placeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  placeTitle: { ...typography.section14, color: colors.ink },
  sub: { ...typography.body13, color: colors.textSecondary },

  destBlock: { gap: 8 },
  coord: { ...typography.body13, color: colors.textTertiary },
  snapNote: { ...typography.body13, color: colors.textSecondary },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.subtle,
  },
  managerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 14,
    backgroundColor: colors.subtle,
  },
  personIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sheet,
  },
  managerName: { ...typography.section14, color: colors.ink },
  buttons: { flexDirection: 'row', gap: 10 },
  reselect: { width: 120 },
  depart: { flex: 1 },
});
