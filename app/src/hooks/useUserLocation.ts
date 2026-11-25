import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { LatLng } from '@/types/vehicle';

/**
 * 사용자의 현재 위치를 한 번 가져옵니다. 차량과의 거리 표시에 씁니다.
 * 위치 권한을 거부했거나 위치를 못 가져오면 null 입니다.
 */
export function useUserLocation(): LatLng | null {
  const [location, setLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        // Android의 '위치 정확도 켜기' 시스템 창은 띄우지 않습니다 (화면을 열 때마다 뜨는 것을 방지).
        const pos = await Location.getCurrentPositionAsync({ mayShowUserSettingsDialog: false });
        if (!cancelled) setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // 위치를 못 가져와도 화면은 거리 없이 동작합니다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return location;
}
