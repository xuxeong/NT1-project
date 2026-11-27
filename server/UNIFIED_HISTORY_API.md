# 차량 최신 상태·배차·이벤트 통합 조회

`GET /api/vehicles/history?vehicle_id=X3S1181&limit=50`

한 번의 요청으로 DB의 차량 최신 상태, 차량별 배차 목록과 각 배차의 이벤트를 조회합니다.
기존 `/history/missions`, `/history/events`는 유지합니다.

| 파라미터 | 규칙 |
|---|---|
| `vehicle_id` | 선택. 생략하면 DB에 차량 상태 또는 이력이 있는 전체 차량 |
| `limit` | 기본 50, 1~200. 차량별 배차 수와 작업 없는 이벤트 수에 각각 적용 |

응답 예시(차량 상태와 이력의 일부 필드 생략):

```json
{
  "ok": true,
  "vehicles": [
    {
      "vehicle_id": "X3S1181",
      "latest_state": {
        "id": "X3S1181",
        "name": "1호차",
        "lat": 36.7279642,
        "lng": 127.4419241,
        "battery": 98.5,
        "power": true,
        "online": true,
        "updated_at": "2026-11-26T06:00:00"
      },
      "missions": [
        {
          "task_id": "pin_123",
          "mission_status": 4,
          "events": [
            {"event_type": "DISPATCH_START", "task_id": "pin_123"},
            {"event_type": "CANCEL", "task_id": "pin_123"}
          ]
        }
      ],
      "unassigned_events": []
    }
  ]
}
```

- `latest_state`는 `vehicles` 테이블의 마지막 저장값이며 실시간 메모리 값이 아닙니다.
  id·name·aoi·전원·온라인·위치·방향·속도·기어·배터리·고장 상태/사유·고장 신고 시각(`fault_reported_at_ms`)·저장 시각을 제공합니다.
  DB에 없는 센서·제원은 이 응답에 추가하지 않습니다.
- 차량은 ID 순입니다. 배차가 없는 차량도 포함하며 목록은 빈 배열입니다.
  과거 이력만 있고 차량 최신 상태가 없으면 `latest_state=null`입니다.
  DB에 차량과 이력이 모두 없으면 `vehicles=[]`입니다.
- 차량별 배차는 최신순, 각 배차의 전체 이벤트는 발생 시각·ID 오름차순입니다.
  `limit`으로 개별 배차의 이벤트가 잘리지 않습니다.
- 배차 시작·일시정지·재개·도착·취소 및 배차 중 전원·고장 이벤트에 `task_id`를 기록합니다.
  전원 OFF로 작업이 취소돼도 전원 이벤트는 취소 직전 작업에 연결합니다.
- 작업 없는 이벤트와 작업 ID가 없는 기존 이벤트는 차량의 `unassigned_events`에 최신순으로 표시합니다.
  과거 이벤트를 시간으로 추정해 배차에 연결하지 않습니다.
- 기존 SQLite/PostgreSQL DB는 초기화 시 nullable `task_id` 컬럼과 인덱스를 추가합니다.
  기존 차량 테이블에 `fault_reported_at_ms`가 없으면 nullable BIGINT 컬럼도 추가합니다.
  기존 데이터는 삭제하지 않습니다.
- 작업 상태는 1 주행 / 2 일시정지 / 3 완료 / 4 취소입니다.
- 현재 관제 API와 동일하게 인증은 없습니다. 잘못된 `limit`은 422입니다.
- 이 조회는 서버 재시작 후 작업 복원 기능과 별개입니다.

코드·문서·테스트는 작성했으며 이번 변경의 서버·테스트 실행은 하지 않았습니다.
