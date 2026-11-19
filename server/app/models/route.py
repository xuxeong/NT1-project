from typing import List, Optional
from pydantic import BaseModel, Field


class Stop(BaseModel):
    id: str = Field(..., description="정류장 ID (예: s1)")
    name: str = Field(..., description="정류장 명칭 (예: C-Track 제1관문)")
    lat: float = Field(..., description="정류장 위도")
    lng: float = Field(..., description="정류장 경도")
    high_precision: bool = True
    has_docking: bool = False


class Route(BaseModel):
    id: str = Field(..., description="경로 ID (예: r1)")
    name: str = Field(..., description="경로 명칭 (예: C-Track 순환 코스 A)")
    total_distance_m: float = Field(..., description="총 거리 (미터)")
    stop_ids: List[str] = Field(default_factory=list, description="기존 지점 API 호환 필드 (기본값: 빈 목록)")
    closed_loop: bool = True

    path: List[dict[str, float]] = Field(default_factory=list, description="도로 경유 좌표 (lat, lng)")
    description: str = ""
    color: str = "#0ea5e9"
