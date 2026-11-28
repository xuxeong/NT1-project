/**
 * 화면에서 사용하는 차량 데이터 타입.
 *
 * 필드 이름은 NT1 API 명세서(2026.11.18)와 서버팀 연동 가이드
 * (docs/APP_SERVER_INTEGRATION.md)의 응답 필드를 그대로 따릅니다.
 * 통신 계층(src/api/)은 서버 응답을 이 타입으로 변환해 화면에 넘겨 주면 됩니다.
 */

/** 작업 상태 (getCurrentMission.missionStatus) */
export type MissionStatus =
  | null // 작업 없음
  | 1 // 주행 중
  | 2 // 일시정지
  | 3 // 도착 완료
  | 4; // 작업 취소

/** 전원 상태 (getVehicleInfo.driveMode). 1: 전원 켜짐, 0: 전원 꺼짐 */
export type DriveMode = 0 | 1;

export type Gear = 'P' | 'R' | 'N' | 'D';

export interface LatLng {
  lat: number;
  lng: number;
}

/** 센서 상태 (GET /api/vehicles 의 sensors, 시험용 데이터) */
export interface VehicleSensors {
  lidar_ok: boolean;
  radar_ok: boolean;
  camera_ok: boolean;
  imu_ok: boolean;
  gnss_fix: string;
  temperature_c: number;
}

export interface Vehicle {
  /** API 요청에 쓰는 차량 식별자 (예: X3S1181) */
  vin: string;
  /** 화면에 표시하는 차량 이름 */
  vinId: string;
  /** 운행 구역 이름 (AOI) */
  parkName: string;
  position: LatLng;
  /** 주행 방위각 (도, 정북 0 시계방향) */
  gnssHead: number;
  /** 속도 (km/h) */
  speed: number;
  gear: Gear;
  driveMode: DriveMode;
  /** 배터리 잔량 (%) */
  realBattery: number;
  /** 남은 주행 가능 거리 (km) */
  mile: number;
  /** 네트워크 온라인 여부 */
  powerState: boolean;
  /** 0: 배차 가능, 1: 배차 불가 (batchGetVehicleList) */
  vehicleAvailable: 0 | 1;
  /** 0: 정상, 1: 고장 (batchGetVehicleList) */
  faultStatus: 0 | 1;
  /**
   * 사용자가 접수한 고장 신고 (POST /mock/vehicles/{vin}/fault). 신고가 없으면 null.
   * faultStatus는 신고와 센서 이상을 합친 값이라, 신고 내용·해제 버튼은 이 값으로 판단합니다.
   */
  faultReport: FaultReport | null;
  missionStatus: MissionStatus;
  /** 진행 중이거나 마지막 작업 정보. 작업이 없으면 null */
  mission: Mission | null;
  /** 운행 상태 (GET /api/vehicles 의 operation_status) */
  operationStatus: OperationStatus;
  /** 서비스 유형 (GET /api/vehicles 의 service_type) */
  serviceType: ServiceType;
  /** 네트워크 지연 (ms) */
  latencyMs: number;
  sensors: VehicleSensors;
}

/** 서비스 유형: 소매 / 운송 / 순찰 (서버 기준. 앱 필터에서는 소매를 쓰지 않음) */
export type ServiceType = 'retail' | 'transport' | 'patrol';

/** 운영 상태: 정상 운영 / 시범 운영 / 운영 중지 (주행 여부가 아니라 운영 투입 여부) */
export type OperationStatus = 'active' | 'trial' | 'suspended';

/**
 * 작업 정보.
 * getCurrentMission(작업 ID·출발·도착), getPlanningRoute(경로 거리),
 * /ws/telemetry 의 task(남은 거리·진행률)를 합쳐서 채웁니다.
 */
export interface Mission {
  missionSubId: number;
  startStationName: string;
  endStationName: string;
  /** 전체 경로 거리 (m) */
  routeDistanceM: number;
  /** 남은 거리 (m) */
  remainingDistanceM: number;
  /** 진행률 (0~100) */
  progressPercent: number;
  /** 작업 시작 시각 (ms 타임스탬프) */
  startedAt: number;
  /** 도착 시각 (ms 타임스탬프). 도착 전이면 없음 */
  arrivedAt?: number;
  /**
   * 출발·도착 알림을 받을 담당자 (목적지 선택 화면에서 고름).
   * TODO(서버팀 요청): 서버 작업 정보에는 아직 없어서 앱 임시 데이터에만 있어요.
   */
  notifyManager?: { userId: string; name: string; phone: string } | null;
  /**
   * 차량을 운행시킨 사람 (출발·도착 알림의 '보낸 사람').
   * TODO(서버팀 요청): 서버 작업 정보에는 아직 없어서 앱 임시 데이터에만 있어요.
   */
  dispatchedBy?: { userId: string; name: string; phone: string } | null;
}

/**
 * 고장 신고 정보.
 * reason은 서버 응답의 fault_reason, reportedAt은 이벤트 이력(FAULT_REPORT)의 시각에서 가져옵니다.
 */
export interface FaultReport {
  /** 신고 사유. 예) '센서 이상 · 라이다 인식이 불안정해요' */
  reason: string | null;
  /** 신고 시각 (ms 타임스탬프) */
  reportedAt: number;
}
