from typing import List
from fastapi import APIRouter
from app.models.route import Stop, Route
from app.simulator.vehicle_sim import simulator

router = APIRouter(prefix="", tags=["Routes & Stops (C-Track 경로 및 정류장)"])


@router.get("/stops", response_model=List[Stop], summary="C-Track 정류장(지점) 목록 조회")
async def get_stops():
    """C-Track 테스트베드 내에 등록된 정류장 및 정차 지점 목록을 반환합니다."""
    return simulator.get_all_stops()


@router.get("/routes", response_model=List[Route], summary="C-Track 주행 경로 목록 조회")
async def get_routes():
    """C-Track 테스트베드 내에 생성된 주행 코스 및 순환 경로 목록을 반환합니다."""
    return simulator.get_all_routes()
