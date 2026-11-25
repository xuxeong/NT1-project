"""가상 차량 물리 시뮬레이션 엔진.

asyncio 기반으로 초당 1회(1Hz) 차량 위치 보간 및 배터리, 속도, 상태를 갱신합니다.
PDF 문서의 요구사항: "가상 차량은 Mock 서버 내부의 데이터·동작 모델"을 구현합니다.
"""
import asyncio
import math
import random
import time
from copy import deepcopy
from app.simulator.road_network import road_path, path_length, snap_to_road
from typing import Dict, List, Optional
from app.models.vehicle import VehicleState, VehicleTask, TaskPhase, TaskStatus, Gear, VehicleLights
from app.models.route import Stop, Route
from app.simulator.c_track_data import INITIAL_STOPS, INITIAL_ROUTES, INITIAL_VEHICLES


def haversine_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 위경도 좌표 간의 구면 거리(미터) 계산 (Haversine 공식)"""
    r = 6371000.0  # 지구 반지름 (미터)
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def calculate_bearing_deg(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 위경도 좌표 간의 방위각(0.0 ~ 360.0도, 정북=0도 시계방향) 계산"""
    if abs(lat1 - lat2) < 1e-12 and abs(lng1 - lng2) < 1e-12:
        return 0.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lng2 - lng1)
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    bearing = math.degrees(math.atan2(y, x))
    return round((bearing + 360.0) % 360.0, 1) % 360.0


class VehicleSimulator:
    def __init__(self):
        # 메모리 상태 캐시
        self.stops: Dict[str, Stop] = {s.id: s for s in INITIAL_STOPS}
        self.routes: Dict[str, Route] = {r.id: r for r in INITIAL_ROUTES}
        self.vehicles: Dict[str, VehicleState] = {v.id: deepcopy(v) for v in INITIAL_VEHICLES}
        
        # 내부 주행 경로 큐 (vehicle_id -> [stop_id, stop_id, ...])
        self._target_queues: Dict[str, List[str]] = {}
        self._waypoints = {}
        self._loop_routes = {}
        self._loop_started = set()
        # Coordinate mission snapshots survive arrival/cancellation for app queries.
        self.coordinate_missions = {}
        self._running = False
        self._task: Optional[asyncio.Task] = None

    def get_all_vehicles(self) -> List[VehicleState]:
        return list(self.vehicles.values())

    def get_vehicle(self, vehicle_id: str) -> Optional[VehicleState]:
        return self.vehicles.get(vehicle_id)

    def get_all_stops(self) -> List[Stop]:
        return list(self.stops.values())

    def get_all_routes(self) -> List[Route]:
        return list(self.routes.values())

    def start_dispatch_point(self, vehicle_id: str, target_stop_id: str) -> bool:
        """단일 지점 배차 명령"""
        vehicle = self.vehicles.get(vehicle_id)
        target = self.stops.get(target_stop_id)
        if not vehicle or not target or not vehicle.dispatch_available:
            return False

        points = road_path((vehicle.lat, vehicle.lng), (target.lat, target.lng))
        self.coordinate_missions.pop(vehicle_id, None)
        self._waypoints[vehicle_id] = points[1:]
        self._loop_routes.pop(vehicle_id, None)
        self._loop_started.discard(vehicle_id)
        dist = path_length(points)
        vehicle.task = VehicleTask(
            task_id=f"task_{int(time.time())}",
            kind="point",
            target_stop_id=target.id,
            target_stop_name=target.name,
            phase=TaskPhase.DRIVING,
            remaining_distance_m=dist,
            progress_percent=0.0,
            paused=False,
        )
        vehicle.gear = Gear.D
        vehicle.speed_kmh = 15.0
        vehicle.door_open = False
        if self._waypoints[vehicle_id]:
            nxt = self._waypoints[vehicle_id][0]
            vehicle.heading = calculate_bearing_deg(vehicle.lat, vehicle.lng, nxt[0], nxt[1])
        self._target_queues[vehicle_id] = [target.id]
        print(f"[Sim] 차량 {vehicle_id} 지점 배차 시작: {target.name} (거리: {dist:.1f}m)")
        return True

    def preview_coordinate(self, vehicle_id, lat, lng):
        vehicle = self.vehicles[vehicle_id]
        destination = snap_to_road((lat, lng), max_distance_m=None)
        points = road_path((vehicle.lat, vehicle.lng), destination['point'])
        return {
            'requested': {'lat': lat, 'lng': lng},
            'target': {'lat': points[-1][0], 'lng': points[-1][1]},
            'snap_distance_m': round(destination['offset_m'], 1),
            'distance_m': round(path_length(points), 1),
            'path': [{'lat': p[0], 'lng': p[1]} for p in points],
        }

    def start_dispatch_coordinate(self, vehicle_id, lat, lng):
        vehicle = self.vehicles[vehicle_id]
        if not vehicle.dispatch_available:
            raise ValueError("현재 차량 상태에서 배차할 수 없습니다.")
        plan = self.preview_coordinate(vehicle_id, lat, lng)
        points = [[p['lat'], p['lng']] for p in plan['path']]
        self._waypoints[vehicle_id] = points[1:]
        self._target_queues[vehicle_id] = []
        self._loop_routes.pop(vehicle_id, None)
        self._loop_started.discard(vehicle_id)
        vehicle.task = VehicleTask(
            task_id=f'pin_{time.time_ns()}', kind='point',
            target_stop_name='지도에서 선택한 목적지',
            target_lat=plan['target']['lat'], target_lng=plan['target']['lng'],
            remaining_distance_m=plan['distance_m'], phase=TaskPhase.DRIVING,
        )
        self.coordinate_missions[vehicle_id] = {
            'task': vehicle.task,
            'path': deepcopy(plan['path']),
        }
        vehicle.speed_kmh, vehicle.gear, vehicle.door_open = 15.0, Gear.D, False
        if self._waypoints[vehicle_id]:
            nxt = self._waypoints[vehicle_id][0]
            vehicle.heading = calculate_bearing_deg(vehicle.lat, vehicle.lng, nxt[0], nxt[1])
        return plan

    def start_dispatch_loop(self, vehicle_id: str, route_id: str, loops_total: Optional[int] = 1) -> bool:
        """순환 코스 배차 명령"""
        vehicle = self.vehicles.get(vehicle_id)
        route = self.routes.get(route_id)
        if not vehicle or not route or len(route.path) < 2 or not vehicle.dispatch_available:
            return False
        if loops_total is not None and loops_total < 1:
            return False

        start = route.path[0]
        points = road_path((vehicle.lat, vehicle.lng), (start['lat'], start['lng']))
        self.coordinate_missions.pop(vehicle_id, None)
        self._waypoints[vehicle_id] = points[1:]
        self._loop_routes[vehicle_id] = route_id
        self._loop_started.discard(vehicle_id)
        dist = path_length(points)
        vehicle.task = VehicleTask(
            task_id=f"loop_{int(time.time())}",
            route_id=route_id,
            kind="loop",
            target_stop_name=f'{route.name} 시작점',
            target_lat=start['lat'], target_lng=start['lng'],
            phase=TaskPhase.DRIVING,
            remaining_distance_m=dist,
            progress_percent=0.0,
            paused=False,
            loops_done=0,
            loops_total=loops_total,
        )
        vehicle.gear = Gear.D
        vehicle.speed_kmh = 15.0
        vehicle.door_open = False
        # 시작점까지 접근한 다음 route.path 전체를 순서대로 주행합니다.
        # stop_ids 최단 경로로 다시 계산하면 세부 시험 구간이 생략됩니다.
        self._target_queues[vehicle_id] = []
        print(f"[Sim] 차량 {vehicle_id} 순환 배차 시작: {route.name}")
        return True

    def pause(self, vehicle_id: str) -> bool:
        vehicle = self.vehicles.get(vehicle_id)
        if (not vehicle or not vehicle.task or not vehicle.power or not vehicle.online
                or vehicle.task.phase not in (TaskPhase.DRIVING, TaskPhase.PAUSED)):
            return False
        vehicle.task.paused = True
        vehicle.task.phase = TaskPhase.PAUSED
        vehicle.speed_kmh = 0.0
        vehicle.gear = Gear.P
        print(f"[Sim] 차량 {vehicle_id} 주행 일시정지")
        return True

    def resume(self, vehicle_id: str) -> bool:
        vehicle = self.vehicles.get(vehicle_id)
        if (not vehicle or not vehicle.task or not vehicle.motion_allowed
                or vehicle.task.phase not in (TaskPhase.DRIVING, TaskPhase.PAUSED)):
            return False
        vehicle.task.paused = False
        vehicle.task.phase = TaskPhase.DRIVING
        vehicle.speed_kmh = 15.0
        vehicle.gear = Gear.D
        print(f"[Sim] 차량 {vehicle_id} 주행 재개")
        return True

    def stop(self, vehicle_id: str) -> bool:
        """비상 정지 및 작업 취소"""
        vehicle = self.vehicles.get(vehicle_id)
        if not vehicle:
            return False
        if vehicle.task is not None:
            vehicle._last_task_status = (
                TaskStatus.COMPLETED if vehicle.task.phase == TaskPhase.ARRIVED
                else TaskStatus.CANCELLED
            )
        vehicle.task = None
        vehicle.speed_kmh = 0.0
        vehicle.gear = Gear.P
        self._target_queues.pop(vehicle_id, None)
        self._waypoints.pop(vehicle_id, None)
        self._loop_routes.pop(vehicle_id, None)
        self._loop_started.discard(vehicle_id)
        print(f"[Sim] 차량 {vehicle_id} 작업 취소 / 정차")
        return True

    def control(self, vehicle_id: str, power: Optional[bool], door_open: Optional[bool], lights: Optional[VehicleLights]) -> bool:
        vehicle = self.vehicles.get(vehicle_id)
        if not vehicle:
            return False
        if power is False and vehicle.speed_kmh != 0:
            return False
        if power is not None:
            vehicle.power = power
            if not power:
                self.stop(vehicle_id)
        if door_open is not None:
            vehicle.door_open = door_open
        if lights is not None:
            vehicle.lights = lights
        return True

    def report_fault(self, vehicle_id: str, fault_status: int, reason: Optional[str] = None) -> bool:
        """차량 고장 신고 접수(fault_status=1) 또는 해제(fault_status=0)"""
        if type(fault_status) is not int or fault_status not in (0, 1):
            raise ValueError("fault_status는 정수 0 또는 1이어야 합니다.")
        vehicle = self.vehicles.get(vehicle_id)
        if not vehicle:
            return False
        vehicle.fault_status = 1 if fault_status else 0
        vehicle.fault_reason = reason if vehicle.fault_status == 1 else None
        if vehicle.fault_status == 1 and vehicle.task and vehicle.task.phase == TaskPhase.DRIVING:
            # 신고 정지는 사용자 제어와 달리 오프라인/전원 상태와 무관하게 즉시 적용합니다.
            vehicle.task.paused = True
            vehicle.task.phase = TaskPhase.PAUSED
            vehicle.speed_kmh, vehicle.gear = 0.0, Gear.P
        return True

    def planned_path(self, vehicle_id):
        v = self.vehicles[vehicle_id]
        return [(v.lat, v.lng), *self._waypoints.get(vehicle_id, [])]

    def tick_one_second(self):
        """Advance a fixed distance along OSM road segments, including corners."""
        for v_id, v in self.vehicles.items():
            if v.task and v.task.phase == TaskPhase.DRIVING and not v.motion_allowed:
                v.task.paused = True
                v.task.phase = TaskPhase.PAUSED
                v.speed_kmh, v.gear = 0.0, Gear.P
            if not v.power or not v.task or v.task.paused or v.task.phase != TaskPhase.DRIVING:
                continue
            budget = 15.0 / 3.6
            moved = 0.0
            while v.task and v.task.phase == TaskPhase.DRIVING:
                points = self._waypoints.get(v_id, [])
                if points:
                    lat, lng = points[0]
                    dist = haversine_distance_m(v.lat, v.lng, lat, lng)
                    if dist > 1e-6:
                        v.heading = calculate_bearing_deg(v.lat, v.lng, lat, lng)
                    if dist > budget:
                        ratio = budget / dist
                        v.lat += (lat - v.lat) * ratio
                        v.lng += (lng - v.lng) * ratio
                        moved += budget
                        break
                    v.lat, v.lng = lat, lng
                    points.pop(0)
                    budget -= dist
                    moved += dist
                    continue
                v.location_name = f'{v.lat:.6f}, {v.lng:.6f}'
                if v.task.kind == "loop":
                    route = self.routes[self._loop_routes[v_id]]
                    if v_id in self._loop_started:
                        v.task.loops_done += 1
                    else:
                        self._loop_started.add(v_id)
                    if v.task.loops_total is None or v.task.loops_done < v.task.loops_total:
                        self._waypoints[v_id] = [
                            [point['lat'], point['lng']] for point in route.path[1:]
                        ]
                        v.task.target_stop_name = route.name
                        continue
                    v.task.phase = TaskPhase.ARRIVED
                    v.task.remaining_distance_m = 0.0
                    v.task.progress_percent = 100.0
                    v.speed_kmh, v.gear = 0.0, Gear.P
                    self._loop_started.discard(v_id)
                    break
                queue = self._target_queues.get(v_id, [])
                if queue and queue[0] == v.task.target_stop_id:
                    queue.pop(0)
                if not queue:
                    v.task.phase = TaskPhase.ARRIVED
                    v.task.remaining_distance_m = 0.0
                    v.task.progress_percent = 100.0
                    v.speed_kmh, v.gear = 0.0, Gear.P
                    if v.task.kind == "point":
                        v._last_task_status = TaskStatus.COMPLETED
                        v.task = None
                    break
                target = self.stops[queue[0]]
                v.task.target_stop_id, v.task.target_stop_name = target.id, target.name
                self._waypoints[v_id] = road_path((v.lat, v.lng), (target.lat, target.lng))[1:]
            if moved:
                v.location_name = f'{v.lat:.6f}, {v.lng:.6f}'
                v.battery = max(0.0, round(v.battery - 0.015 * moved / (15 / 3.6), 3))
                v.latency_ms = max(20, min(120, v.latency_ms + random.randint(-5, 5)))
            if v.task and v.task.phase == TaskPhase.DRIVING:
                v.speed_kmh, v.gear = 15.0, Gear.D
                v.task.remaining_distance_m = path_length(self.planned_path(v_id))

    async def run_simulation_loop(self):
        """백그라운드 비동기 루프 (1초 주기)"""
        self._running = True
        print("[Sim] 가상 주행 시뮬레이터 루프가 시작되었습니다. (1Hz)")
        while self._running:
            try:
                self.tick_one_second()
            except Exception as e:
                print(f"[Sim Error] {e}")
            await asyncio.sleep(1.0)

    def start_background_loop(self):
        if not self._task or self._task.done():
            self._task = asyncio.create_task(self.run_simulation_loop())

    def stop_background_loop(self):
        self._running = False
        if self._task:
            self._task.cancel()


# 전역 단일 시뮬레이터 인스턴스
simulator = VehicleSimulator()
