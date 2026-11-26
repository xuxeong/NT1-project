from typing import List
from fastapi import APIRouter, HTTPException
from app.models.vehicle import VehicleState
from app.models.dispatch import ControlRequest, CommandResponse
from app.simulator.vehicle_sim import simulator

router = APIRouter(prefix="/vehicles", tags=["Vehicles (차량 조회 및 제어)"])


@router.get("", response_model=List[VehicleState], summary="전체 가상 차량 목록 및 실시간 상태 조회")
async def get_vehicles():
    """전체 차량(정차·전원 OFF·오프라인 포함)의 상태를 조회합니다.

    remaining_range_km은 배터리 기반 예상 거리이며 목적지까지의 거리가 아닙니다.
    sensors_available=false이면 센서 수치는 표시하지 않습니다.
    """
    return simulator.get_all_vehicles()


@router.get("/{vehicle_id}", response_model=VehicleState, summary="특정 가상 차량 상세 상태 조회")
async def get_vehicle(vehicle_id: str):
    """차량 ID·AOI·속도(km/h)·기어·배터리(%)·방위각(도)·예상 거리(km)와
    sensors, specifications 및 작업 상태를 동일한 차량 모델에서 제공합니다.
    """
    v = simulator.get_vehicle(vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail=f"차량 {vehicle_id}을 찾을 수 없습니다.")
    return v


@router.post("/{vehicle_id}/control", response_model=CommandResponse, summary="차량 전원 제어")
async def control_vehicle(vehicle_id: str, req: ControlRequest):
    vehicle = simulator.get_vehicle(vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail=f"차량 {vehicle_id}을 찾을 수 없습니다.")
    if req.power is False and vehicle.speed_kmh != 0:
        raise HTTPException(status_code=409, detail="정차 후 전원을 끌 수 있습니다.")
    ok = simulator.control(vehicle_id, power=req.power)
    if not ok:
        raise HTTPException(status_code=404, detail=f"차량 {vehicle_id} 제어 실패")
    return CommandResponse(ok=True, message="차량 전원 제어 명령이 처리되었습니다.", vehicle_id=vehicle_id)
