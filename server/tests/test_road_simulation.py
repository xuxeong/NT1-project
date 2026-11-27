from app.simulator.vehicle_sim import VehicleSimulator
from app.simulator.road_network import distance


def test_no_predefined_courses_or_fixed_stops():
    sim = VehicleSimulator()
    assert sim.get_all_routes() == []
    assert sim.get_all_stops() == []
    assert sim.start_dispatch_loop("X3S1181", "r2", 1) is False
    assert sim.vehicles["X3S1181"].task is None


def test_point_motion_pause_and_arrival():
    sim = VehicleSimulator()
    plan = sim.start_dispatch_coordinate('X3S1181', 36.7297202, 127.4423425)
    v = sim.vehicles['X3S1181']
    initial_distance = v.task.remaining_distance_m
    before = (v.lat, v.lng)
    sim.tick_one_second()
    assert 4.1 < distance(before, (v.lat, v.lng)) < 4.2
    assert abs(v.task.remaining_distance_m - (initial_distance - 15/3.6)) < 0.05
    assert v.task.total_distance_m == round(initial_distance, 1)
    assert 0.0 < v.task.progress_percent < 100.0
    assert v.task.started_at_ms > 0
    sim.pause(v.id)
    before = (v.lat, v.lng)
    sim.tick_one_second()
    assert before == (v.lat, v.lng)
    sim.resume(v.id)
    for _ in range(1000):
        sim.tick_one_second()
        if v.task is None:
            break
    assert (v.lat, v.lng) == (plan['target']['lat'], plan['target']['lng'])
    assert v.task is None and v.speed_kmh == 0

