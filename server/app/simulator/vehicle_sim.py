"""가상 차량 물리 시뮬레이션 엔진.

asyncio 기반으로 초당 1회(1Hz) 차량 위치 보간 및 배터리, 속도, 상태를 갱신합니다.
PDF 문서의 요구사항: "가상 차량은 Mock 서버 내부의 데이터·동작 모델"을 구현합니다.
"""
import asyncio
import math
import random
import time
from typing import Dict, List, Optional
from app.models.vehicle import VehicleState, VehicleTask, TaskPhase, Gear, VehicleLights
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


class VehicleSimulator:
    def __init__(self):
        # 메모리 상태 캐시
        self.stops: Dict[str, Stop] = {s.id: s for s in INITIAL_STOPS}
        self.routes: Dict[str, Route] = {r.id: r for r in INITIAL_ROUTES}
        self.vehicles: Dict[str, VehicleState] = {v.id: v for v in INITIAL_VEHICLES}
        
        # 내부 주행 경로 큐 (vehicle_id -> [stop_id, stop_id, ...])
        self._target_queues: Dict[str, List[str]] = {}
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
        if not vehicle or not target:
            return False

        dist = haversine_distance_m(vehicle.lat, vehicle.lng, target.lat, target.lng)
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
        self._target_queues[vehicle_id] = [target.id]
        print(f"[Sim] 차량 {vehicle_id} 지점 배차 시작: {target.name} (거리: {dist:.1f}m)")
        return True

    def start_dispatch_loop(self, vehicle_id: str, route_id: str, loops_total: Optional[int] = 1) -> bool:
        """순환 코스 배차 명령"""
        vehicle = self.vehicles.get(vehicle_id)
        route = self.routes.get(route_id)
        if not vehicle or not route or not route.stop_ids:
            return False

        first_stop = self.stops.get(route.stop_ids[0])
        if not first_stop:
            return False

        dist = haversine_distance_m(vehicle.lat, vehicle.lng, first_stop.lat, first_stop.lng)
        vehicle.task = VehicleTask(
            task_id=f"loop_{int(time.time())}",
            kind="loop",
            target_stop_id=first_stop.id,
            target_stop_name=first_stop.name,
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
        # 전체 경로 큐 저장
        self._target_queues[vehicle_id] = list(route.stop_ids)
        print(f"[Sim] 차량 {vehicle_id} 순환 배차 시작: {route.name} (목표 정류장 수: {len(route.stop_ids)})")
        return True

    def pause(self, vehicle_id: str) -> bool:
        vehicle = self.vehicles.get(vehicle_id)
        if not vehicle or not vehicle.task:
            return False
        vehicle.task.paused = True
        vehicle.task.phase = TaskPhase.PAUSED
        vehicle.speed_kmh = 0.0
        vehicle.gear = Gear.P
        print(f"[Sim] 차량 {vehicle_id} 주행 일시정지")
        return True

    def resume(self, vehicle_id: str) -> bool:
        vehicle = self.vehicles.get(vehicle_id)
        if not vehicle or not vehicle.task:
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
        vehicle.task = None
        vehicle.speed_kmh = 0.0
        vehicle.gear = Gear.P
        self._target_queues.pop(vehicle_id, None)
        print(f"[Sim] 차량 {vehicle_id} 작업 취소 / 정차")
        return True

    def control(self, vehicle_id: str, power: Optional[bool], door_open: Optional[bool], lights: Optional[VehicleLights]) -> bool:
        vehicle = self.vehicles.get(vehicle_id)
        if not vehicle:
            return False
        if power is not None:
            vehicle.power = power
            if not power:
                vehicle.speed_kmh = 0.0
                vehicle.gear = Gear.P
                vehicle.task = None
        if door_open is not None:
            vehicle.door_open = door_open
        if lights is not None:
            vehicle.lights = lights
        return True

    def tick_one_second(self):
        """1초마다 실행되는 차량 상태 연산 (물리 시뮬레이션)"""
        step_m = (15.0 * 1000.0) / 3600.0  # 15km/h = 초당 약 4.16m 이동

        for v_id, v in self.vehicles.items():
            if not v.power or not v.task or v.task.paused or v.task.phase != TaskPhase.DRIVING:
                continue

            target_id = v.task.target_stop_id
            target_stop = self.stops.get(target_id)
            if not target_stop:
                continue

            dist = haversine_distance_m(v.lat, v.lng, target_stop.lat, target_stop.lng)

            # 지연시간 변동 시뮬레이션
            v.latency_ms = max(20, min(120, v.latency_ms + random.randint(-5, 5)))

            if dist > step_m:
                # 목표 지점으로 선형 보간 이동
                ratio = step_m / dist
                v.lat += (target_stop.lat - v.lat) * ratio
                v.lng += (target_stop.lng - v.lng) * ratio
                v.speed_kmh = 15.0
                v.gear = Gear.D
                v.battery = max(0.0, round(v.battery - 0.015, 3))  # 배터리 점진적 소모
                v.task.remaining_distance_m = dist - step_m
            else:
                # 지점 도착 처리
                v.lat = target_stop.lat
                v.lng = target_stop.lng
                v.speed_kmh = 0.0
                v.gear = Gear.P
                v.location_name = target_stop.name
                v.task.remaining_distance_m = 0.0

                queue = self._target_queues.get(v_id, [])
                if queue and queue[0] == target_id:
                    queue.pop(0)

                if queue:
                    # 다음 경유지가 있는 경우
                    next_stop_id = queue[0]
                    next_stop = self.stops.get(next_stop_id)
                    if next_stop:
                        v.task.target_stop_id = next_stop.id
                        v.task.target_stop_name = next_stop.name
                        print(f"[Sim] 차량 {v_id} {target_stop.name} 통과 -> 다음 목표: {next_stop.name}")
                else:
                    # 모든 경유지 도착 완료
                    v.task.phase = TaskPhase.ARRIVED
                    print(f"[Sim] 차량 {v_id} 최종 목표 지점 도착 완료: {target_stop.name}")
                    # 단일 지점 배차의 경우 작업 종료
                    if v.task.kind == "point":
                        v.task = None

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
