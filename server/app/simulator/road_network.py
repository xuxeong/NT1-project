"""C-Track OSM road geometry, © OpenStreetMap contributors (ODbL)."""
import heapq
import json
import math
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('c_track_roads.json').read_text())
NODES = DATA['nodes']


def distance(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h)))


GRAPH = {node: {} for node in NODES}
for way in DATA['ways']:
    for a, b in zip(way['nodes'], way['nodes'][1:]):
        GRAPH[a][b] = distance(NODES[a], NODES[b])
        if not way['oneway']:
            GRAPH[b][a] = GRAPH[a][b]


def nearest(point):
    return min(NODES, key=lambda node: distance(point, NODES[node]))


def snap_to_road(point, max_distance_m=40):
    """Project onto a road segment, preserving a position between OSM nodes."""
    scale = math.cos(math.radians(point[0]))
    best = None
    seen = set()
    for a, neighbors in GRAPH.items():
        for b in neighbors:
            key = tuple(sorted((a, b)))
            if key in seen:
                continue
            seen.add(key)
            lat1, lng1 = NODES[a]
            lat2, lng2 = NODES[b]
            dx, dy = (lng2 - lng1) * scale, lat2 - lat1
            length_squared = dx * dx + dy * dy
            if not length_squared:
                continue
            t = max(0.0, min(1.0, (
                (point[1] - lng1) * scale * dx + (point[0] - lat1) * dy
            ) / length_squared))
            if t < 1e-10:
                t = 0.0
            elif t > 1 - 1e-10:
                t = 1.0
            projected = (NODES[a][:] if t == 0 else NODES[b][:] if t == 1 else
                         [lat1 + t * (lat2 - lat1), lng1 + t * (lng2 - lng1)])
            offset = distance(point, projected)
            prefer_vertex = (best is not None and offset < 1e-6
                             and best['offset_m'] < 1e-6 and t in (0.0, 1.0)
                             and best['t'] not in (0.0, 1.0))
            if best is None or offset < best['offset_m'] or prefer_vertex:
                best = {'a': a, 'b': b, 't': t, 'point': projected, 'offset_m': offset}
    if best is None or (max_distance_m is not None and best['offset_m'] > max_distance_m):
        raise ValueError('C-Track 도로에서 40m 이내의 위치를 선택해 주세요.')
    return best


def road_path(start, end):
    """Directed shortest path between projected positions, including mid-segment pins."""
    origin, destination = snap_to_road(start), snap_to_road(end)
    source, target = '__start__', '__end__'
    extra = {source: {}, target: {}}
    a, b, t = origin['a'], origin['b'], origin['t']
    if t == 0 or a in GRAPH[b]:
        extra[source][a] = distance(origin['point'], NODES[a])
    if t == 1 or b in GRAPH[a]:
        extra[source][b] = distance(origin['point'], NODES[b])
    a, b, t = destination['a'], destination['b'], destination['t']
    if t == 0 or b in GRAPH[a]:
        extra.setdefault(a, {})[target] = distance(NODES[a], destination['point'])
    if t == 1 or a in GRAPH[b]:
        extra.setdefault(b, {})[target] = distance(NODES[b], destination['point'])
    if (origin['a'], origin['b']) == (a, b):
        delta = destination['t'] - origin['t']
        if delta == 0 or (delta > 0 and b in GRAPH[a]) or (delta < 0 and a in GRAPH[b]):
            extra[source][target] = distance(origin['point'], destination['point'])
    pending = [(0, source)]
    costs, previous = {source: 0}, {}
    while pending:
        cost, node = heapq.heappop(pending)
        if node == target:
            break
        if cost != costs[node]:
            continue
        for neighbor, length in {**GRAPH.get(node, {}), **extra.get(node, {})}.items():
            candidate = cost + length
            if candidate < costs.get(neighbor, float('inf')):
                costs[neighbor], previous[neighbor] = candidate, node
                heapq.heappush(pending, (candidate, neighbor))
    if target not in costs:
        raise ValueError('C-Track 도로로 연결되지 않은 지점입니다.')
    ids = [target]
    while ids[-1] != source:
        ids.append(previous[ids[-1]])
    points = [origin['point']] + [NODES[node] for node in reversed(ids)
                                  if node not in (source, target)] + [destination['point']]
    return [p for i, p in enumerate(points) if i == 0 or p != points[i-1]]


def path_length(points):
    return sum(distance(a, b) for a, b in zip(points, points[1:]))


def fixed_course_path(start, segments):
    """Keep every mandatory segment vertex; shortest paths only join segments.

    The returned path starts and ends at the course start coordinate. Invalid node IDs,
    disconnected connectors or reversed one-way segments fail at startup.
    """
    points = [list(start)]
    for segment in segments:
        ids = segment['node_ids']
        if len(ids) < 2:
            raise ValueError('고정 경로 구간에는 두 개 이상의 노드가 필요합니다.')
        for a, b in zip(ids, ids[1:]):
            if b not in GRAPH[a]:
                raise ValueError(f'연결 또는 주행 방향이 잘못된 고정 구간: {a} → {b}')
        connector = road_path(points[-1], NODES[ids[0]])
        points.extend(connector[1:])
        points.extend(NODES[node][:] for node in ids[1:])
    points.extend(road_path(points[-1], start)[1:])
    if path_length(points) <= 0:
        raise ValueError('주행 코스의 길이는 0보다 커야 합니다.')
    return points
