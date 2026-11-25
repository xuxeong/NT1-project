from fastapi import APIRouter, HTTPException
from app.models.dispatch import DispatchRequest, CommandResponse, CoordinatePreviewRequest
from app.simulator.vehicle_sim import simulator

router = APIRouter(prefix="/dispatch", tags=["Dispatch (배차 및 주행 제어)"])


@router.post("", response_model=CommandResponse, summary="차량 배차 요청 (지도 좌표)")
async def dispatch_vehicle(req: DispatchRequest):
    """
    가상 차량에 배차 명령을 내립니다.
    - kind="point": target_lat, target_lng를 도로에 보정하여 이동
    """
    v = simulator.get_vehicle(req.vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail=f"차량 {req.vehicle_id}을 찾을 수 없습니다.")

    if not v.power:
        raise HTTPException(status_code=409, detail="차량 전원이 꺼져 있어 배차할 수 없습니다.")
    if not v.online:
        raise HTTPException(status_code=409, detail="오프라인 차량에는 배차할 수 없습니다.")
    if v.has_fault:
        raise HTTPException(status_code=409, detail="고장 상태의 차량에는 배차할 수 없습니다.")
    if not v.dispatch_available:
        raise HTTPException(status_code=409, detail="현재 작업을 정지한 후 새 배차를 시작해 주세요.")

    if req.kind == "point":
        if req.target_lat is not None or req.target_lng is not None:
            if req.target_lat is None or req.target_lng is None or req.target_stop_id:
                raise HTTPException(status_code=422, detail="목적지 위도·경도를 함께 보내 주세요.")
            try:
                plan = simulator.start_dispatch_coordinate(req.vehicle_id, req.target_lat, req.target_lng)
            except ValueError as error:
                raise HTTPException(status_code=422, detail=str(error)) from error
            return CommandResponse(
                ok=True, message="지도에서 선택한 목적지로 주행을 시작했습니다.",
                vehicle_id=req.vehicle_id, target=plan['target'], path=plan['path'],
            )
        if not req.target_stop_id:
            raise HTTPException(status_code=422, detail="지도에서 목적지 좌표를 지정해 주세요.")
        try:
            ok = simulator.start_dispatch_point(req.vehicle_id, req.target_stop_id)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        if not ok:
            raise HTTPException(status_code=400, detail="목표 지점을 찾을 수 없습니다.")
        return CommandResponse(ok=True, message=f"차량 {req.vehicle_id}의 {req.target_stop_id} 지점 배차가 시작되었습니다.", vehicle_id=req.vehicle_id)

    else:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 배차 종류입니다: {req.kind}")


@router.post("/preview", summary="지도 목적지의 도로 보정 및 주행 경로 미리보기")
async def preview_dispatch(req: CoordinatePreviewRequest):
    if simulator.get_vehicle(req.vehicle_id) is None:
        raise HTTPException(status_code=404, detail="차량을 찾을 수 없습니다.")
    try:
        return simulator.preview_coordinate(req.vehicle_id, req.target_lat, req.target_lng)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/{vehicle_id}/pause", response_model=CommandResponse, summary="주행 일시정지")
async def pause_vehicle(vehicle_id: str):
    if simulator.get_vehicle(vehicle_id) is None:
        raise HTTPException(status_code=404, detail="차량을 찾을 수 없습니다.")
    ok = simulator.pause(vehicle_id)
    if not ok:
        raise HTTPException(status_code=409, detail="일시정지할 수 있는 작업이 없습니다.")
    return CommandResponse(ok=True, message="주행이 일시정지되었습니다.", vehicle_id=vehicle_id)


@router.post("/{vehicle_id}/resume", response_model=CommandResponse, summary="주행 재개")
async def resume_vehicle(vehicle_id: str):
    if simulator.get_vehicle(vehicle_id) is None:
        raise HTTPException(status_code=404, detail="차량을 찾을 수 없습니다.")
    ok = simulator.resume(vehicle_id)
    if not ok:
        raise HTTPException(status_code=409, detail="현재 차량 상태에서 주행을 재개할 수 없습니다.")
    return CommandResponse(ok=True, message="주행이 재개되었습니다.", vehicle_id=vehicle_id)


@router.post("/{vehicle_id}/stop", response_model=CommandResponse, summary="비상 정지 및 배차 취소")
async def stop_vehicle(vehicle_id: str):
    ok = simulator.stop(vehicle_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"차량 {vehicle_id}을 찾을 수 없습니다.")
    return CommandResponse(ok=True, message="차량이 비상 정차하고 배차가 취소되었습니다.", vehicle_id=vehicle_id)
