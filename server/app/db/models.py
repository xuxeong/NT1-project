"""SQLAlchemy ORM Models for Vehicle States, Dispatch Missions, and Event Logs."""
from datetime import datetime, timezone
from sqlalchemy import BigInteger, Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class VehicleRecord(Base):
    """차량 최신 상태 스냅샷 테이블 (vehicles)"""
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, index=True, comment="차량 식별자 (VIN)")
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="차량 명칭")
    aoi: Mapped[str] = mapped_column(String(64), default="C-Track 오창")
    power: Mapped[bool] = mapped_column(Boolean, default=True)
    online: Mapped[bool] = mapped_column(Boolean, default=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    heading: Mapped[float] = mapped_column(Float, default=0.0)
    speed_kmh: Mapped[float] = mapped_column(Float, default=0.0)
    gear: Mapped[str] = mapped_column(String(4), default="P")
    battery: Mapped[float] = mapped_column(Float, default=100.0)
    fault_status: Mapped[int] = mapped_column(Integer, default=0, comment="0: 정상, 1: 고장/이상")
    fault_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fault_reported_at_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True, comment="고장 신고 시각(ms)")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class MissionRecord(Base):
    """배차 작업(Mission) 생명주기 이력 테이블 (mission_logs)"""
    __tablename__ = "mission_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    vehicle_id: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(24), default="point", comment="point / loop")
    start_lat: Mapped[float] = mapped_column(Float, nullable=False)
    start_lng: Mapped[float] = mapped_column(Float, nullable=False)
    target_lat: Mapped[float] = mapped_column(Float, nullable=False)
    target_lng: Mapped[float] = mapped_column(Float, nullable=False)
    target_name: Mapped[str] = mapped_column(String(120), default="지도에서 선택한 목적지")
    total_distance_m: Mapped[float] = mapped_column(Float, default=0.0)
    mission_status: Mapped[int] = mapped_column(
        Integer, default=1, comment="1: 주행 중, 2: 일시정지, 3: 도착 완료, 4: 작업 취소"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class VehicleEventRecord(Base):
    """차량 제어·배차·고장 신고 감사 이벤트 이력 테이블 (vehicle_event_logs)"""
    __tablename__ = "vehicle_event_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    task_id: Mapped[str | None] = mapped_column(
        String(64), index=True, nullable=True, comment="연결된 배차 작업 ID. 작업 없는 이벤트/기존 이력은 NULL"
    )
    event_type: Mapped[str] = mapped_column(
        String(40), index=True, nullable=False,
        comment="DISPATCH_START, PAUSE, RESUME, ARRIVED, CANCEL, POWER_CHANGE, FAULT_REPORT, FAULT_CLEAR"
    )
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    battery: Mapped[float] = mapped_column(Float, default=100.0)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
