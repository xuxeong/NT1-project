from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.db import repository as repo_module

router = APIRouter(prefix="/managers", tags=["Managers (담당자 가상 계정 로그인 및 알림)"])


class ManagerLoginRequest(BaseModel):
    user_id: str = Field(..., min_length=1, description="가상 담당자 계정 ID (예: manager1, manager2, admin)")
    password: str = Field(..., min_length=1, description="비밀번호 (기본값: 1234)")


class ManagerContactUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, description="담당자 이름")
    phone: Optional[str] = Field(None, description="도착·고장 알림 수신 연락처 (예: 010-1234-5678)")
    assigned_aoi: Optional[str] = Field(None, description="담당 AOI 구역 명칭")
    assigned_vehicle_ids: Optional[List[str]] = Field(None, description="할당된 관리 차량 VIN 목록")


@router.get("", summary="전체 가상 담당자 계정 및 할당 차량·연락처 목록 조회")
async def list_manager_accounts():
    """DB에 사전 적재된 가상 담당자 계정들과 계정별 관리 차량·AOI·연락처 정보를 조회합니다."""
    return {"ok": True, "managers": repo_module.db_logger.list_managers()}


@router.post("/login", summary="담당자 가상 계정 로그인 (회원가입 없이 사전 적재된 DB 계정 사용)")
async def login_manager(req: ManagerLoginRequest):
    """DB에 사전 적재된 가상 담당자 계정(manager1, manager2, admin)으로 로그인하고 할당 차량·AOI·연락처 정보를 반환합니다."""
    manager = repo_module.db_logger.authenticate_manager(req.user_id.strip(), req.password)
    if manager is None:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 일치하지 않습니다.")
    return {"ok": True, "message": f"{manager['name']}님 로그인되었습니다.", "manager": manager}


@router.get("/notifications", summary="도착·차량 이상 발생 시 담당자 연락처 알림 발송 내역 조회")
async def list_manager_notifications(
    user_id: Optional[str] = Query(None, description="담당자 계정 ID 필터 (생략 시 전체)"),
    vehicle_id: Optional[str] = Query(None, description="차량 ID 필터 (생략 시 전체)"),
    limit: int = Query(50, ge=1, le=200),
):
    """차량 목적지 도착(ARRIVED) 또는 고장/문제(FAULT_REPORT) 발생 시 담당자 연락처로 발송된 알림 이력을 조회합니다."""
    notifications = repo_module.db_logger.get_manager_notifications(
        user_id=user_id, vehicle_id=vehicle_id, limit=limit
    )
    return {"ok": True, "notifications": notifications}


@router.get("/{user_id}", summary="특정 담당자 계정 프로필 및 할당 차량 조회")
async def get_manager_account(user_id: str):
    manager = repo_module.db_logger.get_manager(user_id)
    if manager is None:
        raise HTTPException(status_code=404, detail="담당자 계정을 찾을 수 없습니다.")
    return {"ok": True, "manager": manager}


@router.patch("/{user_id}/contact", summary="담당자 연락처 및 할당 차량·AOI 정보 수정")
async def update_manager_contact(user_id: str, req: ManagerContactUpdateRequest):
    """도착이나 차량 이상 발생 시 알림을 받을 담당자 연락처(phone, name) 및 할당 차량을 변경합니다."""
    updated = repo_module.db_logger.update_manager_contact(
        user_id=user_id,
        name=req.name,
        phone=req.phone,
        assigned_aoi=req.assigned_aoi,
        assigned_vehicle_ids=req.assigned_vehicle_ids,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="담당자 계정을 찾을 수 없습니다.")
    return {"ok": True, "message": "담당자 연락처 및 할당 정보가 갱신되었습니다.", "manager": updated}
