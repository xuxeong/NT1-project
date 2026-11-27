"""배차와 이벤트를 묶는 읽기 전용 이력 조회 계약."""
from typing import Literal

from pydantic import BaseModel, Field


class HistoryPosition(BaseModel):
    lat: float
    lng: float


class HistoryTarget(HistoryPosition):
    name: str


class HistoryEvent(BaseModel):
    id: int
    vehicle_id: str
    task_id: str | None = Field(description="연결 작업 ID. 기존 이력 또는 작업 없는 이벤트는 null")
    event_type: str
    lat: float
    lng: float
    battery: float
    detail: str | None
    created_at: str | None


class MissionHistory(BaseModel):
    id: int
    task_id: str
    vehicle_id: str
    kind: str
    start: HistoryPosition
    target: HistoryTarget
    total_distance_m: float
    mission_status: Literal[1, 2, 3, 4]
    created_at: str | None
    updated_at: str | None
    events: list[HistoryEvent] = Field(description="이 작업에 연결된 전체 이벤트. 발생 시각·ID 오름차순")


class StoredVehicleState(BaseModel):
    id: str
    name: str
    aoi: str
    power: bool
    online: bool
    lat: float
    lng: float
    heading: float
    speed_kmh: float
    gear: str
    battery: float
    fault_status: int
    fault_reason: str | None
    fault_reported_at_ms: int | None = Field(description="DB에 저장된 고장 신고 시각(ms). 신고 이력이 없으면 null")
    updated_at: str | None


class VehicleHistory(BaseModel):
    vehicle_id: str
    latest_state: StoredVehicleState | None = Field(description="DB에 마지막 저장된 차량 상태. 저장값이 없으면 null")
    missions: list[MissionHistory]
    unassigned_events: list[HistoryEvent] = Field(description="작업 ID가 없는 기존 이력·차량 이벤트. 최신순")


class UnifiedHistoryResponse(BaseModel):
    ok: bool = True
    vehicles: list[VehicleHistory]
