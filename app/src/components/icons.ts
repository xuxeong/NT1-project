/**
 * Figma(NT1) 컴포넌트 페이지에서 내려받은 아이콘 모음.
 * SVG 파일은 assets/icons/ 에 두고, metro 설정으로 컴포넌트처럼 불러옵니다.
 * 크기는 width/height props로 맞춥니다. 예) <MapIcon width={20} height={20} />
 *
 * [색을 바꿔 쓰는 아이콘] 표시가 있는 것은 SVG 안의 색이 currentColor라서
 * color prop으로 색을 정해야 합니다. 예) <PowerIcon width={24} height={24} color={colors.danger} />
 */
export { default as BatteryIcon } from '../../assets/icons/battery.svg';
export { default as DistanceIcon } from '../../assets/icons/distance.svg';
export { default as FilterIcon } from '../../assets/icons/filter.svg';
export { default as MapIcon } from '../../assets/icons/map.svg';
export { default as PinIcon } from '../../assets/icons/pin.svg';
export { default as SearchIcon } from '../../assets/icons/search.svg';
export { default as SignalIcon } from '../../assets/icons/signal.svg';
export { default as ClearIcon } from '../../assets/icons/clear.svg';

// 차량 상세 화면
export { default as SensorIcon } from '../../assets/icons/sensor.svg';
export { default as WarningIcon } from '../../assets/icons/warning.svg'; // [색을 바꿔 쓰는 아이콘]
export { default as InfoIcon } from '../../assets/icons/info.svg'; // [색을 바꿔 쓰는 아이콘] 단순 안내 토스트
export { default as CheckCircleIcon } from '../../assets/icons/check-circle.svg'; // 초록 원 + 흰 체크 (센서 정상)
export { default as Pin20Icon } from '../../assets/icons/pin-20.svg';
export { default as NavigationIcon } from '../../assets/icons/navigation.svg';
export { default as ListIcon } from '../../assets/icons/list.svg';
export { default as DiamondIcon } from '../../assets/icons/diamond.svg'; // 흰색 (파란 버튼 안)
export { default as PlayOnAccentIcon } from '../../assets/icons/play-on-accent.svg'; // 흰색 (파란 버튼 안)
export { default as PauseIcon } from '../../assets/icons/pause.svg';
export { default as VehicleMarkerIcon } from '../../assets/icons/vehicle-marker.svg';

// 차량 필터 · 운영 구역 선택
export { default as Close24Icon } from '../../assets/icons/close-24.svg';
export { default as BackIcon } from '../../assets/icons/back.svg';
export { default as RadioOnIcon } from '../../assets/icons/radio-on.svg';
export { default as RadioOffIcon } from '../../assets/icons/radio-off.svg';

// 주행 유형 선택 · 작업 경로 설정
export { default as ChevronRightIcon } from '../../assets/icons/chevron-right.svg'; // 회색
export { default as RouteIcon } from '../../assets/icons/route.svg'; // 파랑
export { default as FlagIcon } from '../../assets/icons/flag.svg'; // 파랑
export { default as PersonIcon } from '../../assets/icons/person.svg'; // 회색
export { default as EditIcon } from '../../assets/icons/edit.svg'; // 회색
export { default as PlusIcon } from '../../assets/icons/plus.svg'; // 파랑

// 차량 제어 칸
export { default as SpeakerIcon } from '../../assets/icons/speaker.svg';
export { default as MonitoringIcon } from '../../assets/icons/monitoring.svg';
export { default as LogIcon } from '../../assets/icons/log.svg';
export { default as CalibrateIcon } from '../../assets/icons/calibrate.svg';
export { default as DoorIcon } from '../../assets/icons/door.svg';
export { default as GamepadIcon } from '../../assets/icons/gamepad.svg';
export { default as BulbIcon } from '../../assets/icons/bulb.svg';

// ── 색을 바꿔 쓰는 아이콘 (color prop 필수) ──
export { default as CloseIcon } from '../../assets/icons/close.svg'; // 18px X (지도 위 닫기: ink, 지점 삭제: 회색)
export { default as ChevronSmallIcon } from '../../assets/icons/chevron-small.svg'; // 12px > (상태 칩 색)
export { default as PowerIcon } from '../../assets/icons/power.svg'; // 전원 (끄기: 빨강, 켜기: 파랑)
export { default as TabVehicleIcon } from '../../assets/icons/tab-vehicle.svg'; // 탭 (선택: 파랑, 기본: ink)
export { default as TabMessageIcon } from '../../assets/icons/tab-message.svg';
export { default as TabAccountIcon } from '../../assets/icons/tab-account.svg';

// 로그인
export { default as EyeIcon } from '../../assets/icons/eye.svg'; // [색을 바꿔 쓰는 아이콘] 비밀번호 보기
export { default as CheckIcon } from '../../assets/icons/check.svg'; // [색을 바꿔 쓰는 아이콘] 체크박스
