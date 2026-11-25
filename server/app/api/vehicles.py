from typing import List
from fastapi import APIRouter, HTTPException, Query
from app.models.vehicle import VehicleState
from app.models.dispatch import ControlRequest, CommandResponse
from app.simulator.vehicle_sim import simulator
from app.db.repository import db_logger

router = APIRouter(prefix="/vehicles", tags=["Vehicles (차량 조회 및 제어)"])


@router.get("", response_model=List[VehicleState], summary="전체 가상 차량 목록 및 실시간 상태 조회")
async def get_vehicles():
    """운행 중인 모든 Neolix 가상 차량의 실시간 위치, 배터리, 속도, 기어, 작업 상태를 조회합니다."""
    return simulator.get_all_vehicles()


@router.get("/history/missions", summary="전체 또는 차량별 배차 작업(Mission) DB 이력 조회")
async def get_mission_history(
    vehicle_id: str | None = Query(None, description="특정 차량 ID 필터 (생략 시 전체 차량)"),
    limit: int = Query(50, ge=1, le=200),
):
    """PostgreSQL/SQLite DB에 영구 적재된 배차 작업(생성·일시정지·완료·취소) 이력을 조회합니다."""
    return {"ok": True, "missions": db_logger.get_mission_history(vehicle_id=vehicle_id, limit=limit)}


@router.get("/history/events", summary="전체 또는 차량별 상태·제어 이벤트 감사 로그 DB 조회")
async def get_event_history(
    vehicle_id: str | None = Query(None, description="특정 차량 ID 필터 (생략 시 전체 차량)"),
    limit: int = Query(50, ge=1, le=200),
):
    """PostgreSQL/SQLite DB에 영구 적재된 차량 이벤트(배차, 일시정지, 재개, 도착, 취소, 전원, 고장신고) 로그를 조회합니다."""
    return {"ok": True, "events": db_logger.get_event_history(vehicle_id=vehicle_id, limit=limit)}


@router.get("/{vehicle_id}", response_model=VehicleState, summary="특정 가상 차량 상세 상태 조회")
async def get_vehicle(vehicle_id: str):
    v = simulator.get_vehicle(vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail=f"차량 {vehicle_id}을 찾을 수 없습니다.")
    return v


@router.post("/{vehicle_id}/control", response_model=CommandResponse, summary="차량 하드웨어 제어 (전원, 도어, 조명)")
async def control_vehicle(vehicle_id: str, req: ControlRequest):
    ok = simulator.control(vehicle_id, power=req.power, door_open=req.door_open, lights=req.lights)
    if not ok:
        raise HTTPException(status_code=404, detail=f"차량 {vehicle_id} 제어 실패")
    return CommandResponse(ok=True, message="차량 하드웨어 제어 명령이 처리되었습니다.", vehicle_id=vehicle_id)
