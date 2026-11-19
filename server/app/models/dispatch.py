from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.vehicle import VehicleLights


class DispatchRequest(BaseModel):
    vehicle_id: str = Field(..., description="배차할 차량 ID (예: X3S1181)")
    kind: str = Field("point", description="배차 종류: point(지도 좌표 또는 기존 지점)")
    target_stop_id: Optional[str] = Field(None, description="목표 정류장 ID (kind=point 일 때)")
    target_lat: Optional[float] = Field(None, ge=-90, le=90, allow_inf_nan=False)
    target_lng: Optional[float] = Field(None, ge=-180, le=180, allow_inf_nan=False)


class ControlRequest(BaseModel):
    power: Optional[bool] = Field(None, description="전원 On/Off")
    door_open: Optional[bool] = Field(None, description="도어 열림/닫힘")
    lights: Optional[VehicleLights] = Field(None, description="조명 상태 설정")


class CommandResponse(BaseModel):
    ok: bool = True
    message: str
    vehicle_id: str
    target: Optional[dict[str, float]] = None
    path: Optional[List[dict[str, float]]] = None


class CoordinatePreviewRequest(BaseModel):
    vehicle_id: str
    target_lat: float = Field(..., ge=-90, le=90, allow_inf_nan=False)
    target_lng: float = Field(..., ge=-180, le=180, allow_inf_nan=False)
