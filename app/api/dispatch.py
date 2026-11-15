from fastapi import APIRouter, HTTPException
from app.models.dispatch import DispatchRequest, CommandResponse
from app.simulator.vehicle_sim import simulator

router = APIRouter(prefix="/dispatch", tags=["Dispatch (배차 및 주행 제어)"])


@router.post("", response_model=CommandResponse, summary="차량 배차 요청 (지점 또는 순환 코스)")
async def dispatch_vehicle(req: DispatchRequest):
    """
    가상 차량에 배차 명령을 내립니다.
    - kind="point": 지정한 target_stop_id 로 단일 이동
    - kind="loop": 지정한 route_id 코스를 순환 주행
    """
    v = simulator.get_vehicle(req.vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail=f"차량 {req.vehicle_id}을 찾을 수 없습니다.")

    if not v.power:
        raise HTTPException(status_code=400, detail="차량 전원이 꺼져 있어 배차할 수 없습니다.")

    if req.kind == "point":
        if not req.target_stop_id:
            raise HTTPException(status_code=400, detail="지점 배차는 target_stop_id 가 필수입니다.")
        ok = simulator.start_dispatch_point(req.vehicle_id, req.target_stop_id)
        if not ok:
            raise HTTPException(status_code=400, detail="목표 지점을 찾을 수 없습니다.")
        return CommandResponse(ok=True, message=f"차량 {req.vehicle_id}의 {req.target_stop_id} 지점 배차가 시작되었습니다.", vehicle_id=req.vehicle_id)

    elif req.kind == "loop":
        if not req.route_id:
            raise HTTPException(status_code=400, detail="순환 배차는 route_id 가 필수입니다.")
        ok = simulator.start_dispatch_loop(req.vehicle_id, req.route_id, req.loops)
        if not ok:
            raise HTTPException(status_code=400, detail="순환 경로를 찾을 수 없습니다.")
        return CommandResponse(ok=True, message=f"차량 {req.vehicle_id}의 {req.route_id} 순환 배차가 시작되었습니다.", vehicle_id=req.vehicle_id)

    else:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 배차 종류입니다: {req.kind}")


@router.post("/{vehicle_id}/pause", response_model=CommandResponse, summary="주행 일시정지")
async def pause_vehicle(vehicle_id: str):
    ok = simulator.pause(vehicle_id)
    if not ok:
        raise HTTPException(status_code=400, detail=f"차량 {vehicle_id} 일시정지 실패 (작업 중이 아님)")
    return CommandResponse(ok=True, message="주행이 일시정지되었습니다.", vehicle_id=vehicle_id)


@router.post("/{vehicle_id}/resume", response_model=CommandResponse, summary="주행 재개")
async def resume_vehicle(vehicle_id: str):
    ok = simulator.resume(vehicle_id)
    if not ok:
        raise HTTPException(status_code=400, detail=f"차량 {vehicle_id} 주행 재개 실패")
    return CommandResponse(ok=True, message="주행이 재개되었습니다.", vehicle_id=vehicle_id)


@router.post("/{vehicle_id}/stop", response_model=CommandResponse, summary="비상 정지 및 배차 취소")
async def stop_vehicle(vehicle_id: str):
    ok = simulator.stop(vehicle_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"차량 {vehicle_id}을 찾을 수 없습니다.")
    return CommandResponse(ok=True, message="차량이 비상 정차하고 배차가 취소되었습니다.", vehicle_id=vehicle_id)
