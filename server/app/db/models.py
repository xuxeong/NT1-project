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


class ManagerAccountRecord(Base):
    """DB에 사전 적재되는 가상 담당자 계정 및 담당 차량·AOI·연락처 테이블 (manager_accounts)"""
    __tablename__ = "manager_accounts"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True, comment="담당자 로그인 계정 ID")
    password: Mapped[str] = mapped_column(String(128), nullable=False, comment="가상 계정 비밀번호")
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="담당자 이름")
    phone: Mapped[str] = mapped_column(String(40), nullable=False, comment="도착·고장 알림 수신 연락처")
    role: Mapped[str] = mapped_column(String(40), default="manager", comment="역할 (manager / admin)")
    assigned_aoi: Mapped[str] = mapped_column(String(100), default="C-Track 오창", comment="담당 AOI 운행 구역")
    assigned_vehicles_csv: Mapped[str] = mapped_column(
        String(255), default="X3S1181", comment="할당된 관리 차량 VIN 목록 (쉼표 구분)"
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class ManagerNotificationRecord(Base):
    """차량 도착(ARRIVED) 및 고장/이상(FAULT_REPORT) 발생 시 담당자 연락처 알림 발송 이력 (manager_notifications)"""
    __tablename__ = "manager_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False, comment="수신 담당자 계정 ID")
    manager_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="수신 담당자 이름")
    contact_phone: Mapped[str] = mapped_column(String(40), nullable=False, comment="알림 발송 연락처")
    vehicle_id: Mapped[str] = mapped_column(String(32), index=True, nullable=False, comment="대상 차량 VIN")
    trigger_type: Mapped[str] = mapped_column(
        String(40), index=True, nullable=False, comment="ARRIVED(도착 알림) 또는 FAULT_REPORT(차량 이상 알림)"
    )
    message: Mapped[str] = mapped_column(Text, nullable=False, comment="발송된 알림 메시지 본문")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class AoiRegionRecord(Base):
    """C-Track AOI(Area of Interest, 운행 구역) 폴리곤 DB 영구 저장 테이블 (aoi_regions)"""
    __tablename__ = "aoi_regions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True, comment="AOI 구역 ID (예: MOCK_AOI_01)")
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="AOI 운행 구역 명칭")
    color: Mapped[str] = mapped_column(String(24), default="#38bdf8", comment="지도 폴리곤 표시 색상")
    polygon_json: Mapped[str] = mapped_column(Text, nullable=False, comment="폴리곤 꼭짓점 좌표 배열(JSON 문자열)")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class PoiStopRecord(Base):
    """C-Track Pin 기반 도로 보정 POI(Point of Interest, 거점 지점) DB 영구 저장 테이블 (poi_stops)"""
    __tablename__ = "poi_stops"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, index=True, comment="POI 정류장 ID (예: s1, s2)")
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="POI 거점 명칭")
    lat: Mapped[float] = mapped_column(Float, nullable=False, comment="도로 보정된 위도")
    lng: Mapped[float] = mapped_column(Float, nullable=False, comment="도로 보정된 경도")
    high_precision: Mapped[bool] = mapped_column(Boolean, default=True)
    has_docking: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
