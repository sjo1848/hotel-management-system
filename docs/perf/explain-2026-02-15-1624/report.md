# HMS Prod Explain Analyze (EP11)

- generated_at_utc: 2026-02-15T19:26:50Z
- hotel_id: 00000000-0000-0000-0000-000000000001
- room_id: 3f3fa44b-954d-4ab1-b986-17690b09777d
- range: 2026-02-01..2026-02-15
- runner: docker exec hms-perf-db-ep11c psql

| query | planning_time | execution_time | raw_plan |
|---|---:|---:|---|
| availability_rooms | 5.996 ms | 0.164 ms | availability_rooms.plan.txt |
| check_availability_exists | 3.179 ms | 1.015 ms | check_availability_exists.plan.txt |
| revenue_report | 4.458 ms | 0.153 ms | revenue_report.plan.txt |
| occupancy_report | 7.151 ms | 0.819 ms | occupancy_report.plan.txt |
