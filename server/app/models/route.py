from typing import List, Optional
from pydantic import BaseModel, Field


class Stop(BaseModel):
    id: str = Field(..., description="정류장 ID (예: s1)")
    name: str = Field(..., description="정류장 명칭 (예: C-Track 제1관문)")
    lat: float = Field(..., description="정류장 위도")
    lng: float = Field(..., description="정류장 경도")
    high_precision: bool = True
    has_docking: bool = False


class CreateStopRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=60, description="등록할 POI(거점 지점) 명칭")
    lat: float = Field(..., ge=-90, le=90, allow_inf_nan=False, description="선택한 위도 (도로 위로 자동 보정)")
    lng: float = Field(..., ge=-180, le=180, allow_inf_nan=False, description="선택한 경도 (도로 위로 자동 보정)")


class AoiRegion(BaseModel):
    id: str = Field(..., description="AOI 구역 코드 (예: MOCK_AOI_01)")
    name: str = Field(..., description="AOI 운행 구역 명칭 (예: C-Track 오창)")
    color: str = Field("#38bdf8", description="지도 표시용 폴리곤 색상")
    polygon: List[dict[str, float]] = Field(..., description="AOI 폴리곤 꼭짓점 좌표 배열 (lat, lng)")


class CreateAoiRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=60, description="생성할 AOI 구역 명칭")
    color: str = Field("#10b981", description="지도 표시용 폴리곤 색상")
    polygon: Optional[List[dict[str, float]]] = Field(None, description="AOI 폴리곤 좌표 (생략 시 center_lat/lng 기준 생성)")
    center_lat: Optional[float] = Field(None, ge=-90, le=90, allow_inf_nan=False)
    center_lng: Optional[float] = Field(None, ge=-180, le=180, allow_inf_nan=False)
    radius_m: float = Field(160.0, ge=30.0, le=1000.0, description="중심 좌표 기준 구역 반경(m)")


class Route(BaseModel):
    id: str = Field(..., description="경로 ID (예: r1)")
    name: str = Field(..., description="경로 명칭 (예: C-Track 순환 코스 A)")
    total_distance_m: float = Field(..., description="총 거리 (미터)")
    stop_ids: List[str] = Field(default_factory=list, description="기존 지점 API 호환 필드 (기본값: 빈 목록)")
    closed_loop: bool = True

    path: List[dict[str, float]] = Field(default_factory=list, description="도로 경유 좌표 (lat, lng)")
    description: str = ""
    color: str = "#0ea5e9"
