from typing import List, Optional
from pydantic import BaseModel, Field, StrictBool, model_validator
from app.models.vehicle import VehicleLights


class DispatchRequest(BaseModel):
    vehicle_id: str = Field(..., description="배차할 차량 ID (예: X3S1181)")
    kind: str = Field("point", description="배차 종류: point(지도 좌표 또는 기존 지점)")
    target_stop_id: Optional[str] = Field(None, description="목표 정류장 ID (kind=point 일 때)")
    target_lat: Optional[float] = Field(None, ge=-90, le=90, allow_inf_nan=False)
    target_lng: Optional[float] = Field(None, ge=-180, le=180, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_destination(self):
        if self.kind != "point":
            return self  # 기존 지원하지 않는 종류의 400 응답 유지
        has_coordinate = self.target_lat is not None or self.target_lng is not None
        if has_coordinate:
            if self.target_lat is None or self.target_lng is None or self.target_stop_id is not None:
                raise ValueError("목적지 위도·경도를 함께 보내고 정류장 ID와 혼용하지 마세요.")
        elif not self.target_stop_id:
            raise ValueError("목적지 좌표 또는 기존 정류장 ID를 지정해 주세요.")
        return self


class ControlRequest(BaseModel):
    power: Optional[StrictBool] = Field(None, description="전원 On/Off. JSON true 또는 false")
    door_open: Optional[bool] = Field(None, description="도어 열림/닫힘")
    lights: Optional[VehicleLights] = Field(None, description="조명 상태 설정")

    @model_validator(mode="after")
    def require_command(self):
        if self.power is None and self.door_open is None and self.lights is None:
            raise ValueError("하나 이상의 제어 값을 지정해 주세요.")
        return self


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
