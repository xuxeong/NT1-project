from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator


class DispatchRequest(BaseModel):
    vehicle_id: str = Field(..., description="배차할 차량 ID (예: X3S1181)")
    kind: str = Field("point", description="배차 종류: point(지도 좌표 또는 기존 지점)")
    target_stop_id: Optional[str] = Field(None, description="목표 정류장 ID (kind=point 일 때)")
    target_name: Optional[str] = Field(None, description="목표 POI(지점) 표시 명칭 (선택)")
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
    model_config = ConfigDict(extra="forbid")
    power: StrictBool = Field(..., description="전원 On/Off. JSON true 또는 false")


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
