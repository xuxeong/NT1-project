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
    stop_ids: List[str] = Field(..., description="경유 정류장 ID 목록 (순서대로)")
    closed_loop: bool = True
