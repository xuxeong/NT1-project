from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.vehicle import VehicleLights


class DispatchRequest(BaseModel):
    vehicle_id: str = Field(..., description="배차할 차량 ID (예: X3S1181)")
    kind: str = Field("point", description="배차 종류: point(단일 지점), loop(순환 코스), delivery(배송)")
    target_stop_id: Optional[str] = Field(None, description="목표 정류장 ID (kind=point 일 때)")
    route_id: Optional[str] = Field(None, description="순환 경로 ID (kind=loop 일 때)")
    loops: Optional[int] = Field(1, description="순환 횟수 (None 또는 0이면 무한 순환)")


class ControlRequest(BaseModel):
    power: Optional[bool] = Field(None, description="전원 On/Off")
    door_open: Optional[bool] = Field(None, description="도어 열림/닫힘")
    lights: Optional[VehicleLights] = Field(None, description="조명 상태 설정")


class CommandResponse(BaseModel):
    ok: bool = True
    message: str
    vehicle_id: str
