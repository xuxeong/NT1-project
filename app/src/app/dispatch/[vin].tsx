import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker, type Region } from 'react-native-maps';

import { OsmMap } from '@/components/OsmMap';
import { C_TRACK_REGION } from '@/constants/map';
import { findMockVehicle } from '@/mocks/vehicles';
import { colors, radius, spacing, typography } from '@/theme';
import { PrimaryButton } from '@/ui';

/**
 * 목적지 선택: 지도 가운데 고정 핀 + 지도 드래그 (NT1 11/16 요청 방식).
 * 지도를 멈출 때마다 가운데 좌표가 바뀝니다. 경로 미리보기(/api/dispatch/preview)와
 * 호출(/api/dispatch)은 통신 계층(src/api/)이 준비되면 연결합니다.
 */
export default function DispatchScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const vehicle = findMockVehicle(vin);
  const [center, setCenter] = useState({ lat: C_TRACK_REGION.latitude, lng: C_TRACK_REGION.longitude });

  const onRegionChangeComplete = (region: Region) => {
    setCenter({ lat: region.latitude, lng: region.longitude });
  };

  return (
    <View style={styles.container}>
      <OsmMap style={StyleSheet.absoluteFill} onRegionChangeComplete={onRegionChangeComplete}>
        {vehicle && (
          <Marker
            coordinate={{ latitude: vehicle.position.lat, longitude: vehicle.position.lng }}
            title={vehicle.vinId}
          />
        )}
      </OsmMap>

      {/* 지도 가운데 고정 핀: 지도만 움직이고 핀은 그대로 있습니다. */}
      <View pointerEvents="none" style={styles.pinWrap}>
        <View style={styles.pinHead} />
        <View style={styles.pinStem} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.coords}>
          선택 위치 {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
        </Text>
        <PrimaryButton label="호출" disabled />
      </View>
    </View>
  );
}

const PIN_HEAD = 22;
const PIN_STEM = 14;

const styles = StyleSheet.create({
  container: { flex: 1 },
  pinWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    alignItems: 'center',
    // 핀 끝(아래쪽)이 지도 정중앙에 오도록 위로 올립니다.
    transform: [{ translateX: -PIN_HEAD / 2 }, { translateY: -(PIN_HEAD + PIN_STEM) }],
  },
  pinHead: {
    width: PIN_HEAD,
    height: PIN_HEAD,
    borderRadius: PIN_HEAD / 2,
    backgroundColor: colors.danger,
    borderWidth: 3,
    borderColor: '#fff',
  },
  pinStem: { width: 3, height: PIN_STEM, backgroundColor: colors.danger },
  panel: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    backgroundColor: colors.sheet,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  coords: { ...typography.label12, color: colors.textSecondary },
});
