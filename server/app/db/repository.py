"""Repository helper that safely persists vehicle states, missions, and events to PostgreSQL/SQLite."""
from typing import List, Optional
from sqlalchemy.orm import sessionmaker

from app.db.database import SessionLocal, init_db
from app.db.models import MissionRecord, VehicleEventRecord, VehicleRecord, utc_now
from app.models.vehicle import Gear, TaskPhase, TaskStatus, VehicleState, VehicleTask
from app.simulator.road_network import path_length, road_path


class DatabaseLogger:
    """시뮬레이터 상태 변화와 배차 작업·이벤트 이력을 DB에 영구 적재하는 리포지토리."""

    def __init__(self, session_factory: sessionmaker = SessionLocal):
        self.session_factory = session_factory
        self._initialized = False

    def ensure_initialized(self) -> None:
        if not self._initialized:
            init_db(target_engine=self.session_factory.kw.get("bind"))
            self._initialized = True

    def sync_vehicle(self, v: VehicleState) -> None:
        """차량 최신 상태를 vehicles 테이블에 Upsert합니다."""
        self.ensure_initialized()
        try:
            with self.session_factory() as db:
                record = db.query(VehicleRecord).filter(VehicleRecord.id == v.id).first()
                if record is None:
                    record = VehicleRecord(
                        id=v.id,
                        name=v.name,
                        aoi=v.aoi,
                        power=v.power,
                        online=v.online,
                        lat=v.lat,
                        lng=v.lng,
                        heading=v.heading,
                        speed_kmh=v.speed_kmh,
                        gear=v.gear.value if hasattr(v.gear, "value") else str(v.gear),
                        battery=v.battery,
                        fault_status=v.fault_status,
                        fault_reason=v.fault_reason,
                        fault_reported_at_ms=v.fault_reported_at_ms,
                    )
                    db.add(record)
                else:
                    record.name = v.name
                    record.aoi = v.aoi
                    record.power = v.power
                    record.online = v.online
                    record.lat = v.lat
                    record.lng = v.lng
                    record.heading = v.heading
                    record.speed_kmh = v.speed_kmh
                    record.gear = v.gear.value if hasattr(v.gear, "value") else str(v.gear)
                    record.battery = v.battery
                    record.fault_status = v.fault_status
                    record.fault_reason = v.fault_reason
                    record.fault_reported_at_ms = v.fault_reported_at_ms
                    record.updated_at = utc_now()
                db.commit()
        except Exception as exc:
            print(f"[DB Warning] sync_vehicle 실패: {exc}")

    def log_mission_start(
        self,
        v: VehicleState,
        task_id: str,
        kind: str,
        target_lat: float,
        target_lng: float,
        target_name: str,
        distance_m: float,
    ) -> None:
        """새 배차 작업 시작 시 mission_logs 및 vehicle_event_logs에 기록합니다."""
        self.ensure_initialized()
        try:
            with self.session_factory() as db:
                mission = MissionRecord(
                    task_id=task_id,
                    vehicle_id=v.id,
                    kind=kind,
                    start_lat=v.lat,
                    start_lng=v.lng,
                    target_lat=target_lat,
                    target_lng=target_lng,
                    target_name=target_name,
                    total_distance_m=round(distance_m, 1),
                    mission_status=1,
                )
                db.add(mission)
                db.add(
                    VehicleEventRecord(
                        vehicle_id=v.id,
                        event_type="DISPATCH_START",
                        task_id=task_id,
                        lat=v.lat,
                        lng=v.lng,
                        battery=v.battery,
                        detail=f"배차 시작: {target_name} ({target_lat:.6f}, {target_lng:.6f}), 거리 {distance_m:.1f}m",
                    )
                )
                db.commit()
            self.sync_vehicle(v)
        except Exception as exc:
            print(f"[DB Warning] log_mission_start 실패: {exc}")

    def update_mission_status(
        self,
        v: VehicleState,
        task_id: Optional[str],
        mission_status: int,
        event_type: str,
        detail: str,
    ) -> None:
        """배차 작업 상태(1: 주행, 2: 일시정지, 3: 완료, 4: 취소)를 갱신하고 이벤트 로그를 남깁니다."""
        # 현재 작업이 없는 요청으로 과거의 마지막 작업을 갱신하지 않습니다.
        if not task_id:
            return
        self.ensure_initialized()
        try:
            with self.session_factory() as db:
                query = db.query(MissionRecord).filter(MissionRecord.vehicle_id == v.id)
                record = query.filter(MissionRecord.task_id == task_id).first()
                if record is not None:
                    record.mission_status = mission_status
                    record.updated_at = utc_now()
                db.add(
                    VehicleEventRecord(
                        vehicle_id=v.id,
                        event_type=event_type,
                        task_id=task_id,
                        lat=v.lat,
                        lng=v.lng,
                        battery=v.battery,
                        detail=detail,
                    )
                )
                db.commit()
            self.sync_vehicle(v)
        except Exception as exc:
            print(f"[DB Warning] update_mission_status 실패: {exc}")

    def log_event(self, v: VehicleState, event_type: str, detail: str, task_id: str | None = None) -> None:
        """전원 제어, 고장 신고/해제 등 일반 차량 이벤트를 기록합니다."""
        self.ensure_initialized()
        try:
            with self.session_factory() as db:
                db.add(
                    VehicleEventRecord(
                        vehicle_id=v.id,
                        event_type=event_type,
                        task_id=task_id,
                        lat=v.lat,
                        lng=v.lng,
                        battery=v.battery,
                        detail=detail,
                    )
                )
                db.commit()
            self.sync_vehicle(v)
        except Exception as exc:
            print(f"[DB Warning] log_event 실패: {exc}")

    def get_mission_history(self, vehicle_id: Optional[str] = None, limit: int = 50) -> List[dict]:
        """저장된 배차 작업 이력을 최신순으로 조회합니다."""
        self.ensure_initialized()
        with self.session_factory() as db:
            q = db.query(MissionRecord)
            if vehicle_id:
                q = q.filter(MissionRecord.vehicle_id == vehicle_id)
            rows = q.order_by(MissionRecord.id.desc()).limit(limit).all()
            return [
                {
                    "id": r.id,
                    "task_id": r.task_id,
                    "vehicle_id": r.vehicle_id,
                    "kind": r.kind,
                    "start": {"lat": r.start_lat, "lng": r.start_lng},
                    "target": {"lat": r.target_lat, "lng": r.target_lng, "name": r.target_name},
                    "total_distance_m": r.total_distance_m,
                    "mission_status": r.mission_status,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                }
                for r in rows
            ]

    def get_event_history(self, vehicle_id: Optional[str] = None, limit: int = 50) -> List[dict]:
        """저장된 차량 이벤트 감사 로그를 최신순으로 조회합니다."""
        self.ensure_initialized()
        with self.session_factory() as db:
            q = db.query(VehicleEventRecord)
            if vehicle_id:
                q = q.filter(VehicleEventRecord.vehicle_id == vehicle_id)
            rows = q.order_by(VehicleEventRecord.id.desc()).limit(limit).all()
            return [
                {
                    "id": r.id,
                    "vehicle_id": r.vehicle_id,
                    "event_type": r.event_type,
                    "task_id": r.task_id,
                    "lat": r.lat,
                    "lng": r.lng,
                    "battery": r.battery,
                    "detail": r.detail,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ]

    def restore_or_seed_simulator(self, sim) -> dict[str, str]:
        """서버 시작 시 DB에 저장된 마지막 차량 상태와 배차 작업을 시뮬레이터로 이어받거나 초기값을 적재합니다."""
        from app.simulator.vehicle_sim import calculate_bearing_deg

        self.ensure_initialized()
        actions: dict[str, str] = {}
        try:
            with self.session_factory() as db:
                for v_id, v in sim.vehicles.items():
                    record = db.query(VehicleRecord).filter(VehicleRecord.id == v_id).first()
                    if record is None:
                        self.sync_vehicle(v)
                        actions[v_id] = "seeded"
                        continue

                    v.name = record.name
                    v.aoi = record.aoi
                    v.power = bool(record.power)
                    v.online = bool(record.online)
                    v.lat = float(record.lat)
                    v.lng = float(record.lng)
                    v.heading = float(record.heading)
                    v.battery = float(record.battery)
                    v.fault_status = int(record.fault_status)
                    v.fault_reason = record.fault_reason
                    v.fault_reported_at_ms = getattr(record, "fault_reported_at_ms", None)
                    v.location_name = f"{v.lat:.6f}, {v.lng:.6f}"

                    last_mission = (
                        db.query(MissionRecord)
                        .filter(MissionRecord.vehicle_id == v_id)
                        .order_by(MissionRecord.id.desc())
                        .first()
                    )

                    if last_mission is None:
                        v.task = None
                        v.speed_kmh = 0.0
                        v.gear = Gear.P
                        v._last_task_status = TaskStatus.IDLE
                        actions[v_id] = "restored_idle"
                        continue

                    full_points = road_path(
                        (last_mission.start_lat, last_mission.start_lng),
                        (last_mission.target_lat, last_mission.target_lng),
                    )
                    full_path_dicts = [{"lat": p[0], "lng": p[1]} for p in full_points]

                    if last_mission.mission_status in (1, 2):
                        remaining_points = road_path(
                            (v.lat, v.lng),
                            (last_mission.target_lat, last_mission.target_lng),
                        )
                        rem_dist = round(path_length(remaining_points), 1)
                        total_dist = max(last_mission.total_distance_m, rem_dist, 0.1)
                        progress = max(0.0, min(100.0, round((1.0 - rem_dist / total_dist) * 100.0, 1)))

                        can_drive = (last_mission.mission_status == 1) and v.motion_allowed
                        phase = TaskPhase.DRIVING if can_drive else TaskPhase.PAUSED
                        paused = not can_drive

                        restored_task = VehicleTask(
                            task_id=last_mission.task_id,
                            kind=last_mission.kind or "point",
                            target_stop_name=last_mission.target_name,
                            target_lat=last_mission.target_lat,
                            target_lng=last_mission.target_lng,
                            phase=phase,
                            total_distance_m=round(total_dist, 1),
                            remaining_distance_m=rem_dist,
                            progress_percent=progress,
                            started_at_ms=int(last_mission.created_at.timestamp() * 1000)
                            if last_mission.created_at
                            else (int(utc_now().timestamp() * 1000)),
                            paused=paused,
                        )
                        v.task = restored_task
                        sim._waypoints[v_id] = [list(p) for p in remaining_points[1:]]
                        sim._target_queues[v_id] = []
                        sim.coordinate_missions[v_id] = {
                            "task": restored_task,
                            "path": full_path_dicts,
                        }
                        if can_drive:
                            v.speed_kmh = 15.0
                            v.gear = Gear.D
                            if sim._waypoints[v_id]:
                                nxt = sim._waypoints[v_id][0]
                                v.heading = calculate_bearing_deg(v.lat, v.lng, nxt[0], nxt[1])
                            actions[v_id] = "resumed_driving"
                        else:
                            v.speed_kmh = 0.0
                            v.gear = Gear.P
                            if last_mission.mission_status == 1 and not can_drive:
                                last_mission.mission_status = 2
                                last_mission.updated_at = utc_now()
                                db.commit()
                            actions[v_id] = "restored_paused"
                    elif last_mission.mission_status == 3:
                        done_task = VehicleTask(
                            task_id=last_mission.task_id,
                            kind=last_mission.kind or "point",
                            target_stop_name=last_mission.target_name,
                            target_lat=last_mission.target_lat,
                            target_lng=last_mission.target_lng,
                            phase=TaskPhase.ARRIVED,
                            remaining_distance_m=0.0,
                            progress_percent=100.0,
                            paused=False,
                        )
                        v.task = None
                        v.speed_kmh = 0.0
                        v.gear = Gear.P
                        v._last_task_status = TaskStatus.COMPLETED
                        sim.coordinate_missions[v_id] = {
                            "task": done_task,
                            "path": full_path_dicts,
                        }
                        actions[v_id] = "restored_completed"
                    else:
                        cancelled_task = VehicleTask(
                            task_id=last_mission.task_id,
                            kind=last_mission.kind or "point",
                            target_stop_name=last_mission.target_name,
                            target_lat=last_mission.target_lat,
                            target_lng=last_mission.target_lng,
                            phase=TaskPhase.PAUSED,
                            remaining_distance_m=0.0,
                            progress_percent=0.0,
                            paused=True,
                        )
                        v.task = None
                        v.speed_kmh = 0.0
                        v.gear = Gear.P
                        v._last_task_status = TaskStatus.CANCELLED
                        sim.coordinate_missions[v_id] = {
                            "task": cancelled_task,
                            "path": full_path_dicts,
                        }
                        actions[v_id] = "restored_cancelled"
        except Exception as exc:
            print(f"[DB Warning] restore_or_seed_simulator 실패: {exc}")
        return actions

    def reset_all_state(self, sim) -> None:
        """시뮬레이터 메모리 상태와 DB 테이블을 초기 출발 상태로 초기화합니다."""
        from copy import deepcopy
        from app.simulator.c_track_data import INITIAL_VEHICLES
        from app.api import neolix as neolix_api

        self.ensure_initialized()
        sim.vehicles = {v.id: deepcopy(v) for v in INITIAL_VEHICLES}
        sim._target_queues.clear()
        sim._waypoints.clear()
        sim._loop_routes.clear()
        sim._loop_started.clear()
        sim.coordinate_missions.clear()
        neolix_api.missions.clear()

        try:
            with self.session_factory() as db:
                db.query(VehicleEventRecord).delete()
                db.query(MissionRecord).delete()
                db.query(VehicleRecord).delete()
                db.commit()
            for v in sim.get_all_vehicles():
                self.sync_vehicle(v)
        except Exception as exc:
            print(f"[DB Warning] reset_all_state 실패: {exc}")

    def get_unified_history(self, vehicle_id: str | None = None, limit: int = 50) -> dict:
        """DB의 차량 최신 상태 아래에 차량별 배차와 이벤트를 묶습니다."""
        self.ensure_initialized()
        with self.session_factory() as db:
            vehicle_ids = db.query(VehicleRecord.id.label('vehicle_id')).union(
                db.query(MissionRecord.vehicle_id), db.query(VehicleEventRecord.vehicle_id),
            ).subquery()
            query = db.query(vehicle_ids.c.vehicle_id)
            if vehicle_id:
                query = query.filter(vehicle_ids.c.vehicle_id == vehicle_id)
            result = []
            for (vin,) in query.order_by(vehicle_ids.c.vehicle_id).all():
                snapshot = db.get(VehicleRecord, vin)
                missions = (db.query(MissionRecord).filter_by(vehicle_id=vin)
                            .order_by(MissionRecord.id.desc()).limit(limit).all())
                task_ids = [mission.task_id for mission in missions]
                events = (db.query(VehicleEventRecord).filter(
                    VehicleEventRecord.vehicle_id == vin,
                    VehicleEventRecord.task_id.in_(task_ids),
                ).order_by(VehicleEventRecord.created_at, VehicleEventRecord.id).all()) if task_ids else []
                grouped = {}
                for event in events:
                    grouped.setdefault(event.task_id, []).append(self._event_data(event))
                result.append({
                    'vehicle_id': vin,
                    'latest_state': self._vehicle_data(snapshot) if snapshot else None,
                    'missions': [
                        {
                            'id': m.id, 'task_id': m.task_id, 'vehicle_id': m.vehicle_id,
                            'kind': m.kind, 'start': {'lat': m.start_lat, 'lng': m.start_lng},
                            'target': {'lat': m.target_lat, 'lng': m.target_lng, 'name': m.target_name},
                            'total_distance_m': m.total_distance_m, 'mission_status': m.mission_status,
                            'created_at': m.created_at.isoformat() if m.created_at else None,
                            'updated_at': m.updated_at.isoformat() if m.updated_at else None,
                            'events': grouped.get(m.task_id, []),
                        } for m in missions
                    ],
                    'unassigned_events': [self._event_data(event) for event in (
                        db.query(VehicleEventRecord).filter(
                            VehicleEventRecord.vehicle_id == vin,
                            VehicleEventRecord.task_id.is_(None),
                        ).order_by(VehicleEventRecord.id.desc()).limit(limit).all()
                    )],
                })
            return {'vehicles': result}

    @staticmethod
    def _vehicle_data(vehicle: VehicleRecord) -> dict:
        return {
            key: (value.isoformat() if key == 'updated_at' and value else value)
            for key in ('id', 'name', 'aoi', 'power', 'online', 'lat', 'lng', 'heading',
                        'speed_kmh', 'gear', 'battery', 'fault_status', 'fault_reason',
                        'fault_reported_at_ms', 'updated_at')
            for value in [getattr(vehicle, key)]
        }

    @staticmethod
    def _event_data(event: VehicleEventRecord) -> dict:
        return {
            "id": event.id, "vehicle_id": event.vehicle_id, "task_id": event.task_id,
            "event_type": event.event_type, "lat": event.lat, "lng": event.lng,
            "battery": event.battery, "detail": event.detail,
            "created_at": event.created_at.isoformat() if event.created_at else None,
        }


db_logger = DatabaseLogger()


def attach_simulator_hooks(sim_cls) -> None:
    """VehicleSimulator 클래스를 직접 수정하지 않고 DB 영구 적재 후크(Hook)를 연결합니다."""
    if getattr(sim_cls, "_db_hooks_attached", False):
        return
    sim_cls._db_hooks_attached = True

    orig_start_point = sim_cls.start_dispatch_point
    orig_start_coord = sim_cls.start_dispatch_coordinate
    orig_pause = sim_cls.pause
    orig_resume = sim_cls.resume
    orig_stop = sim_cls.stop
    orig_control = sim_cls.control
    orig_report_fault = sim_cls.report_fault
    orig_tick = sim_cls.tick_one_second

    def start_dispatch_point(self, vehicle_id: str, target_stop_id: str) -> bool:
        ok = orig_start_point(self, vehicle_id, target_stop_id)
        if ok:
            v = self.vehicles.get(vehicle_id)
            target = self.stops.get(target_stop_id)
            if v and v.task and target:
                db_logger.log_mission_start(
                    v, v.task.task_id, "point", target.lat, target.lng, target.name, v.task.remaining_distance_m
                )
        return ok

    def start_dispatch_coordinate(self, vehicle_id, lat, lng):
        plan = orig_start_coord(self, vehicle_id, lat, lng)
        v = self.vehicles.get(vehicle_id)
        if v and v.task:
            db_logger.log_mission_start(
                v,
                v.task.task_id,
                "point",
                plan["target"]["lat"],
                plan["target"]["lng"],
                v.task.target_stop_name,
                plan["distance_m"],
            )
        return plan

    def pause(self, vehicle_id: str) -> bool:
        ok = orig_pause(self, vehicle_id)
        if ok:
            v = self.vehicles.get(vehicle_id)
            if v and v.task:
                db_logger.update_mission_status(
                    v, v.task.task_id, 2, "PAUSE", f"주행 일시정지 ({v.lat:.6f}, {v.lng:.6f})"
                )
        return ok

    def resume(self, vehicle_id: str) -> bool:
        ok = orig_resume(self, vehicle_id)
        if ok:
            v = self.vehicles.get(vehicle_id)
            if v and v.task:
                db_logger.update_mission_status(
                    v, v.task.task_id, 1, "RESUME", f"주행 재개 ({v.lat:.6f}, {v.lng:.6f})"
                )
        return ok

    def stop(self, vehicle_id: str) -> bool:
        v = self.vehicles.get(vehicle_id)
        prev_task_id = (
            v.task.task_id if v and v.task and v.task.phase != TaskPhase.ARRIVED else None
        )
        ok = orig_stop(self, vehicle_id)
        if ok and v and prev_task_id:
            db_logger.update_mission_status(
                v, prev_task_id, 4, "CANCEL", f"작업 취소 및 정차 ({v.lat:.6f}, {v.lng:.6f})"
            )
        elif ok and v:
            db_logger.sync_vehicle(v)
        return ok

    def control(self, vehicle_id: str, power=None, *args, **kwargs) -> bool:
        v = self.vehicles.get(vehicle_id)
        task_id = v.task.task_id if v and v.task and v.task.phase != TaskPhase.ARRIVED else None
        ok = orig_control(self, vehicle_id, power, *args, **kwargs)
        if ok and power is not None:
            v = self.vehicles.get(vehicle_id)
            if v:
                db_logger.log_event(v, "POWER_CHANGE", f"전원 상태 변경: {'ON' if power else 'OFF'}", task_id=task_id)
        return ok

    def report_fault(self, vehicle_id: str, fault_status: int, reason=None) -> bool:
        v = self.vehicles.get(vehicle_id)
        was_driving = bool(v and v.task and v.task.phase == TaskPhase.DRIVING)
        task_id = v.task.task_id if v and v.task and v.task.phase != TaskPhase.ARRIVED else None
        ok = orig_report_fault(self, vehicle_id, fault_status, reason)
        if ok:
            v = self.vehicles.get(vehicle_id)
            if v:
                if was_driving and v.task and v.task.phase == TaskPhase.PAUSED:
                    db_logger.update_mission_status(
                        v, v.task.task_id, 2, "PAUSE", "고장 신고로 주행 일시정지"
                    )
                event_type = "FAULT_REPORT" if v.fault_status == 1 else "FAULT_CLEAR"
                detail = (
                    f"고장 신고 접수: {reason or '사유 미기재'}"
                    if v.fault_status == 1
                    else "고장 상태 해제 (정상 복귀)"
                )
                db_logger.log_event(v, event_type, detail, task_id=task_id)
        return ok

    def tick_one_second(self):
        active_tasks = {
            v_id: v.task.task_id
            for v_id, v in self.vehicles.items()
            if v.task is not None and v.task.phase.value == "driving"
        }
        orig_tick(self)
        for v_id, prev_task_id in active_tasks.items():
            v = self.vehicles.get(v_id)
            if v and (v.task is None or v.task.phase.value == "arrived"):
                db_logger.update_mission_status(
                    v, prev_task_id, 3, "ARRIVED", f"목적지 도착 완료 ({v.lat:.6f}, {v.lng:.6f})"
                )
            elif v and v.task and v.task.task_id == prev_task_id and v.task.phase == TaskPhase.PAUSED:
                db_logger.update_mission_status(
                    v, prev_task_id, 2, "PAUSE", "차량 운행 불가 상태로 자동 일시정지"
                )
        # 주행 틱으로 실제 이동했거나 상태가 변한 활성 차량만 최신 스냅샷을 DB에 갱신합니다 (정차 차량의 매초 불필요한 DB 쓰기 방지).
        for v_id in active_tasks:
            v = self.vehicles.get(v_id)
            if v is not None:
                db_logger.sync_vehicle(v)

    sim_cls.start_dispatch_point = start_dispatch_point
    sim_cls.start_dispatch_coordinate = start_dispatch_coordinate
    sim_cls.pause = pause
    sim_cls.resume = resume
    sim_cls.stop = stop
    sim_cls.control = control
    sim_cls.report_fault = report_fault
    sim_cls.tick_one_second = tick_one_second


from app.simulator.vehicle_sim import VehicleSimulator  # noqa: E402

attach_simulator_hooks(VehicleSimulator)

