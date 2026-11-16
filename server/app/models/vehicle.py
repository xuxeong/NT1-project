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
    kind: str = Field(..., description="point(지점), delivery(배송), loop(순환)")
    target_stop_id: str
    target_stop_name: str
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
    speed_kmh: float = 0.0
    gear: Gear = Gear.P
    battery: float = Field(100.0, ge=0.0, le=100.0, description="배터리 잔량 (%)")
    
    # 하드웨어 상태
    door_open: bool = False
    lights: VehicleLights = Field(default_factory=VehicleLights)
    
    # 작업 상태
    task: Optional[VehicleTask] = None
    location_name: str = "출발 대기소"
