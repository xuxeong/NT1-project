from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ServiceType(str, Enum):
    RETAIL = "retail"        # 소매
    TRANSPORT = "transport"  # 운송/물류
    PATROL = "patrol"        # 순찰


class OperationStatus(str, Enum):
    ACTIVE = "active"        # 정상 운행
    TRIAL = "trial"          # 시범 운행
    SUSPENDED = "suspended"  # 운행 정지


class Gear(str, Enum):
    P = "P"
    R = "R"
    N = "N"
    D = "D"


class TaskPhase(str, Enum):
    IDLE = "idle"            # 대기
    DRIVING = "driving"      # 주행 중
    ARRIVED = "arrived"      # 도착 (상하차/정차)
    PAUSED = "paused"        # 일시정지


class VehicleTask(BaseModel):
    task_id: str
    route_id: Optional[str] = None
    kind: str = Field(..., description="point(지점), delivery(배송), loop(순환)")
    target_stop_id: Optional[str] = None
    target_stop_name: str
    target_lat: Optional[float] = None
    target_lng: Optional[float] = None
    phase: TaskPhase = TaskPhase.IDLE
    remaining_distance_m: float = 0.0
    progress_percent: float = 0.0
    paused: bool = False
    loops_done: int = 0
    loops_total: Optional[int] = None


class VehicleLights(BaseModel):
    low: bool = False       # 하향등
    high: bool = False      # 상향등
    beacon: bool = False    # 경광등
    fog: bool = False       # 안개등


class VehicleSensors(BaseModel):
    # 실제 센서 연동 전 관제 화면용 시험 데이터. 주행 판단에는 사용하지 않습니다.
    lidar_ok: bool = True
    radar_ok: bool = True
    camera_ok: bool = True
    imu_ok: bool = True
    gnss_fix: str = "RTK FIX"
    satellites: int = Field(24, ge=0)
    accuracy_m: float = Field(0.03, ge=0)
    lidar_hz: float = Field(10.0, ge=0)
    camera_fps: float = Field(30.0, ge=0)
    temperature_c: float = 42.5


class VehicleSpecifications(BaseModel):
    # 사용자 제공 차량 소개 이미지 기준 사양입니다.
    model: str = "N3 (X3)"
    model_year: int = 2025
    manufacturer: str = "Neolix Technologies"
    platform: str = "후륜 구동 (RR) 전기 플랫폼"
    cargo_volume_m3: float = 3.0
    max_payload_kg: float = 520.0
    full_charge_range_km: float = 100.0
    battery_capacity_kwh: float = 9.6
    battery_voltage_v: float = 72.0
    battery_current_type: str = "DC"
    design_speed_upper_bound_kmh: float = 40.0  # 이미지 표기는 40km/h 미만
    charging_time_min_hours: float = 2.0
    charging_time_max_hours: float = 3.0
    charging_method: str = "OBC"
    water_resistance: str = "IPX5"
    autonomy_level: str = "SAE L4"


class VehicleState(BaseModel):
    id: str = Field(..., description="차량 고유 ID (예: X3S1181)")
    name: str = Field(..., description="차량 명칭")
    service_type: ServiceType = ServiceType.TRANSPORT
    aoi: str = Field("C-Track", description="운행 구역 (Area of Interest)")
    
    # 전원 및 네트워크
    power: bool = True
    online: bool = True
    latency_ms: int = Field(45, description="네트워크 지연 시간 (ms)")
    
    # 주행 상태
    operation_status: OperationStatus = OperationStatus.ACTIVE
    lat: float = Field(..., description="현재 위도")
    lng: float = Field(..., description="현재 경도")
    heading: float = Field(0.0, ge=0.0, lt=360.0, description="차량 방위각 (0~360도, 북쪽 0도 시계방향)")
    speed_kmh: float = 0.0
    gear: Gear = Gear.P
    battery: float = Field(100.0, ge=0.0, le=100.0, description="배터리 잔량 (%)")
    
    # 고장/이상 상태 (고장 신고 또는 센서 이상 시)
    fault_status: int = Field(0, ge=0, le=1, description="차량 전체 고장 상태 (0: 정상, 1: 이상)")
    fault_reason: Optional[str] = Field(None, description="고장 신고 또는 이상 발생 사유")
    
    # 하드웨어 상태
    door_open: bool = False
    lights: VehicleLights = Field(default_factory=VehicleLights)
    
    sensors: VehicleSensors = Field(default_factory=VehicleSensors)
    specifications: VehicleSpecifications = Field(default_factory=VehicleSpecifications)

    # 작업 상태
    task: Optional[VehicleTask] = None
    location_name: str = "출발 대기소"
