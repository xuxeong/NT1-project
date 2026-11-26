import { forwardRef, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import MapView, { UrlTile, type MapViewProps, type Region } from 'react-native-maps';

import { C_TRACK_REGION, MAP_ATTRIBUTION, MAP_TILE_MAX_ZOOM, MAP_TILE_URL } from '@/constants/map';
import { colors } from '@/theme';

type Props = Omit<MapViewProps, 'mapType' | 'style'> & {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  children?: ReactNode;
  /** 출처 표시 위치 조정. 지도 아래를 바텀 시트가 덮는 화면에서는 bottom을 올려 주세요 (OSM 이용 조건상 가려지면 안 됨) */
  attributionStyle?: StyleProp<TextStyle>;
};

/**
 * OpenStreetMap 타일을 배경으로 쓰는 공통 지도.
 * Android에서는 Google 기본 지도를 끄고(mapType="none") 타일만 그립니다.
 * 단, Expo Go에서는 mapType="none"이 적용되지 않아 Google 기본 지도가 보입니다.
 * 타일 주소(MAP_TILE_URL)를 넣으면 OSM 타일이 그 위를 덮습니다.
 * 차량 마커·경로(Polyline)는 children으로 넣어 사용합니다.
 */
export const OsmMap = forwardRef<MapView, Props>(function OsmMap(
  { style, initialRegion = C_TRACK_REGION, children, attributionStyle, ...rest },
  ref,
) {
  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        rotateEnabled={false}
        toolbarEnabled={false}
        {...rest}
      >
        {MAP_TILE_URL && <UrlTile urlTemplate={MAP_TILE_URL} maximumZ={MAP_TILE_MAX_ZOOM} flipY={false} />}
        {children}
      </MapView>
      {MAP_TILE_URL && <Text style={[styles.attribution, attributionStyle]}>{MAP_ATTRIBUTION}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: colors.hairline },
  attribution: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    fontSize: 10,
    color: colors.textSecondary,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 4,
  },
});
