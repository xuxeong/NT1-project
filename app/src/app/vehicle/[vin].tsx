import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CancelTaskDialog } from '@/components/CancelTaskDialog';
import {
  BulbIcon,
  CalibrateIcon,
  ChevronRightIcon,
  CloseIcon,
  DiamondIcon,
  DoorIcon,
  GamepadIcon,
  ListIcon,
  LogIcon,
  MonitoringIcon,
  NavigationIcon,
  PauseIcon,
  Pin20Icon,
  PlayOnAccentIcon,
  PowerIcon,
  SensorIcon,
  SpeakerIcon,
  VehicleMarkerIcon,
  WarningIcon,
} from '@/components/icons';
import { OsmMap } from '@/components/OsmMap';
import { StatusChip, type ChipTone } from '@/components/StatusChip';
import { DriveTypeSheet } from '@/components/DriveTypeSheet';
import { TaskInfoSheet } from '@/components/TaskInfoSheet';
import { useUserLocation } from '@/hooks/useUserLocation';
import { applyMockAction, type VehicleAction } from '@/mocks/vehicleActions';
import { findMockVehicle } from '@/mocks/vehicles';
import { colors, radius, typography } from '@/theme';
import type { OperationStatus, Vehicle } from '@/types/vehicle';
import {
  ControlItem,
  FloatingButton,
  PrimaryButton,
  SecondaryButton,
  StatCell,
  StatDivider,
} from '@/ui';
import { distanceReference, formatDistance, haversineMeters } from '@/utils/geo';
import { getVehicleStatus } from '@/utils/vehicleStatus';

const vehicleImage = require('../../../assets/images/vehicle-n3-card.png');

const OPERATION: Record<OperationStatus, { label: string; tone: ChipTone }> = {
  active: { label: '운행 중', tone: 'success' },
  trial: { label: '시범 운영', tone: 'accent' },
  suspended: { label: '운행 중지', tone: 'danger' },
};

/** 구현 범위에서 제외된 제어 기능 (NT1 11/16 확정). 화면에는 두고 누르면 안내만 합니다. */
const comingSoon = (name: string) => () => Alert.alert(name, '추후 지원 예정인 기능이에요.');

/**
 * 차량 상세 (Figma: 차량 상세 화면 · 대기 / 작업 중 / 일시 정지 / 전원 꺼짐).
 * 차량 상태에 따라 가운데 영역과 버튼이 바뀝니다.
 *
 * 지금은 서버 연동 전이라 버튼을 누르면 화면 안에서만 상태가 바뀝니다 (mocks/vehicleActions.ts).
 * TODO(한정혁): 서버 API 응답으로 vehicle 상태를 갱신하도록 바꿔 주세요.
 */
export default function VehicleDetailScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const insets = useSafeAreaInsets();
  const userLocation = useUserLocation();
  const [vehicle, setVehicle] = useState<Vehicle | undefined>(() => findMockVehicle(vin));
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [driveTypeOpen, setDriveTypeOpen] = useState(false);

  if (!vehicle) {
    return (
      <View style={[styles.notFound, { paddingTop: insets.top }]}>
        <Text style={styles.notFoundText}>차량을 찾을 수 없어요.</Text>
        <SecondaryButton label="목록으로" onPress={() => router.back()} />
      </View>
    );
  }

  const act = (...actions: VehicleAction[]) =>
    setVehicle((v) => (v ? actions.reduce((acc, a) => applyMockAction(acc, a), v) : v));

  const poweredOff = vehicle.driveMode === 0;
  const inMission = !poweredOff && (vehicle.missionStatus === 1 || vehicle.missionStatus === 2);
  const paused = vehicle.missionStatus === 2;
  const operation = OPERATION[vehicle.operationStatus];
  const status = getVehicleStatus(vehicle);
  const distance = formatDistance(haversineMeters(distanceReference(userLocation), vehicle.position));
  const { lat, lng } = vehicle.position;

  const onPowerPress = () => {
    if (poweredOff) {
      act('powerOn');
      return;
    }
    if (vehicle.speed > 0) {
      Alert.alert('전원 끄기', '주행 중에는 전원을 끌 수 없어요. 먼저 일시정지해 주세요.');
      return;
    }
    Alert.alert('전원을 끌까요?', paused ? '일시정지 중인 작업은 취소돼요.' : '전원을 다시 켜기 전까지 배차할 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '끄기', style: 'destructive', onPress: () => act('powerOff') },
    ]);
  };

  const showSensors = () => {
    const s = vehicle.sensors;
    const ok = (v: boolean) => (v ? '정상' : '이상');
    Alert.alert(
      '센서 상태',
      `LiDAR ${ok(s.lidar_ok)} · 레이더 ${ok(s.radar_ok)}\n카메라 ${ok(s.camera_ok)} · IMU ${ok(s.imu_ok)}\nGNSS ${s.gnss_fix} · 온도 ${s.temperature_c}℃`,
    );
  };

  return (
    <View style={styles.screen}>
      {/* ── 지도 ── */}
      <View style={styles.mapArea}>
        <OsmMap
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
          // 위쪽 버튼 줄과 아래 시트에 가려지지 않는 영역의 가운데에 차량이 오도록 여백을 줍니다.
          mapPadding={{ top: insets.top + 48, right: 0, bottom: 24, left: 0 }}
        >
          <Marker coordinate={{ latitude: lat, longitude: lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <VehicleMarkerIcon width={48} height={48} />
          </Marker>
        </OsmMap>
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
          <FloatingButton label="닫기" onPress={() => router.back()}>
            <CloseIcon width={18} height={18} color={colors.ink} />
          </FloatingButton>
          <View style={styles.topActions}>
            <FloatingButton label="센서 상태" onPress={showSensors}>
              <SensorIcon width={18} height={18} />
            </FloatingButton>
            <FloatingButton
              label="고장 신고"
              style={styles.faultButton}
              onPress={() => Alert.alert('고장 신고', '고장 신고 화면은 준비 중이에요.')}
            >
              <WarningIcon width={16} height={16} />
              <Text style={styles.faultLabel}>고장 신고</Text>
            </FloatingButton>
          </View>
        </View>
      </View>

      {/* ── 바텀 시트 ── */}
      <View style={styles.sheet}>
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: 8 + insets.bottom }]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.handle} />

          {/* 01 차량 ID · 02 운행 상태 · 03 AOI */}
          <View style={styles.infoRow}>
            <Image source={vehicleImage} style={styles.vehicleImage} resizeMode="cover" />
            <View style={styles.infoText}>
              <Text style={styles.aoi} numberOfLines={1}>
                {vehicle.parkName}
              </Text>
              <Text style={styles.vehicleId} numberOfLines={1} adjustsFontSizeToFit>
                {vehicle.vin}
              </Text>
              {/* 운행 상태는 표시만 합니다 (누를 수 없음) */}
              <View style={styles.operationChip}>
                <StatusChip label={operation.label} tone={operation.tone} />
              </View>
            </View>
          </View>

          {/* 04 주행 가능 · 15 배터리 · 16 통신 지연 · 07/08 기어(속도)·주행 모드 */}
          <View style={styles.stats}>
            <StatCell label="주행 가능" value={`${Math.round(vehicle.mile)}`} unit="km" />
            <StatDivider />
            <StatCell label="배터리" value={`${Math.round(vehicle.realBattery)}`} unit="%" />
            <StatDivider />
            {poweredOff ? (
              <StatCell label="통신 지연" value="–" muted />
            ) : (
              <StatCell label="통신 지연" value={`${vehicle.latencyMs}`} unit="ms" />
            )}
            <StatDivider />
            {poweredOff ? (
              <StatCell label="기어 · 전원 꺼짐" value={vehicle.gear} />
            ) : (
              <StatCell
                label={
                  <>
                    {inMission ? '속도 · ' : '기어 · '}
                    <Text style={{ color: colors.accent }}>AUTO</Text>
                  </>
                }
                value={inMission ? `${Math.round(vehicle.speed)}` : vehicle.gear}
                unit={inMission ? 'km/h' : undefined}
              />
            )}
          </View>

          {inMission ? (
            /* 이동 정보 카드(누르면 작업 정보) + 일시정지/주행 재개. 카드와 버튼 사이 20px */
            <View style={styles.taskArea}>
              <Pressable
                style={({ pressed }) => [styles.placeRow, styles.taskCard, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={`${paused ? '정차 중' : '이동 중'}, ${vehicle.mission?.endStationName ?? '목적지'}, 작업 정보 보기`}
                onPress={() => setTaskSheetOpen(true)}
              >
                <View style={styles.placeIcon}>
                  <NavigationIcon width={20} height={20} />
                </View>
                <View style={styles.placeText}>
                  <View style={styles.moveState}>
                    <Text style={styles.caption}>{paused ? '정차 중' : '이동 중'}</Text>
                    <ListIcon width={12} height={12} />
                  </View>
                  <Text style={styles.placeName} numberOfLines={1}>
                    {vehicle.mission?.endStationName ?? '목적지'}
                  </Text>
                </View>
                <StatusChip label={paused ? '일시 정지' : '작업 중'} tone={paused ? 'danger' : 'accent'} />
                <ChevronRightIcon width={20} height={20} />
              </Pressable>
              {paused ? (
                <PrimaryButton
                  label="주행 재개"
                  icon={<PlayOnAccentIcon width={20} height={20} />}
                  disabled={vehicle.faultStatus === 1}
                  onPress={() => act('resume')}
                />
              ) : (
                <SecondaryButton
                  label="일시정지"
                  icon={<PauseIcon width={20} height={20} />}
                  onPress={() => act('pause')}
                />
              )}
            </View>
          ) : (
            /* 현재 위치 + 주행 시작 */
            <View style={styles.middle}>
              <View style={styles.placeRow}>
                <View style={styles.placeIcon}>
                  <Pin20Icon width={20} height={20} />
                </View>
                <View style={styles.placeText}>
                  <Text style={styles.caption}>현재 위치</Text>
                  <Text style={styles.placeName} numberOfLines={1}>
                    {vehicle.parkName}
                  </Text>
                  <View style={styles.distanceRow}>
                    <Text style={styles.distanceLabel}>거리</Text>
                    <Text style={styles.distanceValue}>{distance}</Text>
                  </View>
                </View>
                {!poweredOff && <StatusChip label={status.label} tone={status.tone} />}
              </View>
              {!poweredOff && (
                <PrimaryButton
                  label="주행 시작"
                  icon={<DiamondIcon width={20} height={20} />}
                  disabled={vehicle.vehicleAvailable !== 0}
                  onPress={() => setDriveTypeOpen(true)}
                />
              )}
            </View>
          )}

          <View style={styles.divider} />

          {/* 차량 제어: 17 전원만 동작, 나머지는 추후 지원 */}
          <View style={styles.controls}>
            <Text style={styles.sectionTitle}>차량 제어</Text>
            <View style={styles.controlGrid}>
              <View style={styles.controlRow}>
                <ControlItem icon={<SpeakerIcon width={24} height={24} />} label="상호작용" onPress={comingSoon('상호작용')} />
                <ControlItem icon={<MonitoringIcon width={24} height={24} />} label="모니터링" onPress={comingSoon('모니터링')} />
                <ControlItem icon={<LogIcon width={24} height={24} />} label="작업 로그" onPress={comingSoon('작업 로그')} />
                <ControlItem icon={<CalibrateIcon width={24} height={24} />} label="보정" onPress={comingSoon('보정')} />
              </View>
              <View style={styles.controlRow}>
                <ControlItem icon={<DoorIcon width={24} height={24} />} label="문 열기" onPress={comingSoon('문 열기')} />
                <ControlItem icon={<GamepadIcon width={24} height={24} />} label="원격 제어" onPress={comingSoon('원격 제어')} />
                <ControlItem icon={<BulbIcon width={24} height={24} />} label="조명" onPress={comingSoon('조명')} />
                {poweredOff ? (
                  <ControlItem icon={<PowerIcon width={24} height={24} color={colors.accent} />} label="전원 ON" tone="accent" onPress={onPowerPress} />
                ) : (
                  <ControlItem icon={<PowerIcon width={24} height={24} color={colors.danger} />} label="전원 OFF" tone="danger" onPress={onPowerPress} />
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      <DriveTypeSheet
        visible={driveTypeOpen}
        onClose={() => setDriveTypeOpen(false)}
        onSelectTask={() => {
          setDriveTypeOpen(false);
          router.push({ pathname: '/route-setup/[vin]', params: { vin: vehicle.vin } });
        }}
        onSelectTrial={() => Alert.alert('시범 운행', '시범 운행은 준비 중이에요.')}
      />
      <TaskInfoSheet
        visible={taskSheetOpen}
        vehicle={vehicle}
        onClose={() => setTaskSheetOpen(false)}
        onCancelPress={() => {
          setTaskSheetOpen(false);
          setCancelDialogOpen(true);
        }}
      />
      <CancelTaskDialog
        visible={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={() => {
          setCancelDialogOpen(false);
          // 서버는 정차 상태에서만 취소를 받으므로, 주행 중이면 먼저 일시정지합니다.
          if (vehicle.missionStatus === 1) act('pause', 'cancel');
          else act('cancel');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sheet },
  notFound: { flex: 1, padding: 24, gap: 16, justifyContent: 'center', backgroundColor: colors.subtle },
  notFoundText: { ...typography.body15, color: colors.textSecondary, textAlign: 'center' },

  // 작은 화면에서도 지도가 최소 200 높이는 보이도록 (시트가 대신 줄어들고 스크롤됨)
  mapArea: { flex: 1, minHeight: 200, marginBottom: -24, backgroundColor: '#E8ECF1' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  topActions: { flexDirection: 'row', gap: 8 },
  faultButton: { paddingLeft: 12, paddingRight: 14 },
  faultLabel: { ...typography.label12, color: colors.ink },

  sheet: {
    maxHeight: '82%',
    flexShrink: 1,
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    boxShadow: '0px -4px 20px rgba(13, 18, 23, 0.07)',
  },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.hairline },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleImage: { width: 120, height: 105 },
  infoText: { flex: 1, alignItems: 'flex-end', gap: 4 },
  aoi: { ...typography.body13, color: colors.textSecondary },
  vehicleId: { ...typography.id28, color: colors.ink },
  operationChip: { paddingTop: 6 },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.subtle,
  },

  middle: { gap: 14 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.subtle,
  },
  placeText: { flex: 1, minWidth: 0, gap: 2 },
  caption: { ...typography.caption11, color: colors.textTertiary },
  moveState: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeName: { ...typography.title17, color: colors.ink },
  distanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  distanceLabel: { ...typography.body13, color: colors.textTertiary },
  distanceValue: { ...typography.num13, color: colors.textSecondary },
  taskArea: { gap: 20 },
  // Figma: 흰 바탕 + 회색 테두리 카드 (누르면 작업 정보)
  taskCard: {
    gap: 10,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.sheet,
  },

  divider: { height: 1, backgroundColor: colors.hairline },
  controls: { gap: 12 },
  sectionTitle: { ...typography.section14, color: colors.ink },
  controlGrid: { gap: 12 },
  controlRow: { flexDirection: 'row' },
});
