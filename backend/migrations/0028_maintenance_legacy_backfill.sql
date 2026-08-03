ALTER TABLE maintenance_cases
ALTER COLUMN reported_by_user_id DROP NOT NULL;

INSERT INTO maintenance_cases (
    id, hotel_id, room_id, status, priority, reason, assigned_to,
    reported_by_user_id, reported_at
)
SELECT
    gen_random_uuid(), r.hotel_id, r.id, 'OPEN', 'MEDIUM',
    'Incidencia migrada desde estado Maintenance', 'ops', NULL,
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
FROM rooms r
WHERE r.status = 'MAINTENANCE'
  AND NOT EXISTS (
      SELECT 1
      FROM maintenance_cases mc
      WHERE mc.hotel_id = r.hotel_id
        AND mc.room_id = r.id
        AND mc.status = 'OPEN'
  );
