#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOTEL_ID="00000000-0000-0000-0000-000000000001"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${POSTGRES_USER:-admin}"
DB_NAME="${POSTGRES_DB:-hms_core}"
HASH_SERVICE="${HASH_SERVICE:-backend}"
DEMO_PASSWORD="${DEMO_PASSWORD:-demo2026pass}"

psql_exec() {
  docker compose exec -T "$DB_SERVICE" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" "$@"
}

DEMO_HASH="$(
  docker compose exec -T "$HASH_SERVICE" cargo run --quiet --bin hash_password -- "$DEMO_PASSWORD" | tr -d '\r'
)"
if [[ -z "$DEMO_HASH" ]]; then
  echo "No se pudo generar hash para DEMO_PASSWORD." >&2
  exit 1
fi

psql_exec <<SQL
BEGIN;

-- Preserve admin and refresh demo operators.
INSERT INTO users (id, hotel_id, username, password_hash, role)
VALUES
  ('10000000-0000-0000-0000-000000000010', '${HOTEL_ID}', 'admin', '${DEMO_HASH}', 'admin'),
  ('10000000-0000-0000-0000-000000000011', '${HOTEL_ID}', 'recepcion_demo', '${DEMO_HASH}', 'receptionist'),
  ('10000000-0000-0000-0000-000000000012', '${HOTEL_ID}', 'ops_demo', '${DEMO_HASH}', 'ops'),
  ('10000000-0000-0000-0000-000000000013', '${HOTEL_ID}', 'housekeeping_demo', '${DEMO_HASH}', 'housekeeping'),
  ('10000000-0000-0000-0000-000000000014', '${HOTEL_ID}', 'saas_admin_demo', '${DEMO_HASH}', 'saas_admin')
ON CONFLICT (hotel_id, username) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role;

-- Reset demo tenant operational data so the UI remains coherent.
DELETE FROM audit_events WHERE hotel_id = '${HOTEL_ID}';
DELETE FROM room_holds WHERE hotel_id = '${HOTEL_ID}';
DELETE FROM extra_charges WHERE hotel_id = '${HOTEL_ID}';
DELETE FROM invoices WHERE hotel_id = '${HOTEL_ID}';
DELETE FROM cash_closures WHERE hotel_id = '${HOTEL_ID}';
DELETE FROM bookings WHERE hotel_id = '${HOTEL_ID}';
DELETE FROM guests WHERE hotel_id = '${HOTEL_ID}';
DELETE FROM rooms WHERE hotel_id = '${HOTEL_ID}';

INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents, version)
VALUES
  ('90000000-0000-0000-0000-000000000101', '${HOTEL_ID}', '101', 'SINGLE', 'AVAILABLE', 2500000, 1),
  ('90000000-0000-0000-0000-000000000102', '${HOTEL_ID}', '102', 'SINGLE', 'AVAILABLE', 2500000, 1),
  ('90000000-0000-0000-0000-000000000103', '${HOTEL_ID}', '103', 'DOUBLE', 'DIRTY', 3800000, 1),
  ('90000000-0000-0000-0000-000000000104', '${HOTEL_ID}', '104', 'DOUBLE', 'MAINTENANCE', 3800000, 1),
  ('90000000-0000-0000-0000-000000000105', '${HOTEL_ID}', '105', 'SINGLE', 'AVAILABLE', 2700000, 1),
  ('90000000-0000-0000-0000-000000000106', '${HOTEL_ID}', '106', 'DOUBLE', 'AVAILABLE', 4000000, 1),
  ('90000000-0000-0000-0000-000000000201', '${HOTEL_ID}', '201', 'SUITE', 'OCCUPIED', 6500000, 1),
  ('90000000-0000-0000-0000-000000000202', '${HOTEL_ID}', '202', 'SUITE', 'CLEANING', 6500000, 1),
  ('90000000-0000-0000-0000-000000000203', '${HOTEL_ID}', '203', 'DOUBLE', 'AVAILABLE', 4200000, 1),
  ('90000000-0000-0000-0000-000000000204', '${HOTEL_ID}', '204', 'SUITE', 'AVAILABLE', 6800000, 1),
  ('90000000-0000-0000-0000-000000000301', '${HOTEL_ID}', '301', 'DELUXE', 'OCCUPIED', 9200000, 1),
  ('90000000-0000-0000-0000-000000000302', '${HOTEL_ID}', '302', 'DELUXE', 'AVAILABLE', 9800000, 1),
  ('90000000-0000-0000-0000-000000000303', '${HOTEL_ID}', '303', 'FAMILY', 'AVAILABLE', 8500000, 1),
  ('90000000-0000-0000-0000-000000000401', '${HOTEL_ID}', '401', 'PRESIDENTIAL', 'AVAILABLE', 14500000, 1);

INSERT INTO guests (id, hotel_id, full_name, email, phone)
VALUES
  ('20000000-0000-0000-0000-000000000001', '${HOTEL_ID}', 'Laura Mendez', 'demo.laura@hmselite.local', '+54 11 5555-1001'),
  ('20000000-0000-0000-0000-000000000002', '${HOTEL_ID}', 'Martin Paz', 'demo.martin@hmselite.local', '+54 11 5555-1002'),
  ('20000000-0000-0000-0000-000000000003', '${HOTEL_ID}', 'Camila Torres', 'demo.camila@hmselite.local', '+54 11 5555-1003'),
  ('20000000-0000-0000-0000-000000000004', '${HOTEL_ID}', 'Valeria Soto', 'demo.valeria@hmselite.local', '+54 11 5555-1004'),
  ('20000000-0000-0000-0000-000000000005', '${HOTEL_ID}', 'Diego Campos', 'demo.diego@hmselite.local', '+54 11 5555-1005'),
  ('20000000-0000-0000-0000-000000000006', '${HOTEL_ID}', 'Alicia Ferrer', 'demo.alicia@hmselite.local', '+54 11 5555-1006'),
  ('20000000-0000-0000-0000-000000000007', '${HOTEL_ID}', 'Sofia Benitez', 'demo.sofia@hmselite.local', '+54 11 5555-1007'),
  ('20000000-0000-0000-0000-000000000008', '${HOTEL_ID}', 'Tomas Ibarra', 'demo.tomas@hmselite.local', '+54 11 5555-1008'),
  ('20000000-0000-0000-0000-000000000009', '${HOTEL_ID}', 'Julieta Rios', 'demo.julieta@hmselite.local', '+54 11 5555-1009'),
  ('20000000-0000-0000-0000-000000000010', '${HOTEL_ID}', 'Bruno Leiva', 'demo.bruno@hmselite.local', '+54 11 5555-1010'),
  ('20000000-0000-0000-0000-000000000011', '${HOTEL_ID}', 'Mariana Costa', 'demo.mariana@hmselite.local', '+54 11 5555-1011'),
  ('20000000-0000-0000-0000-000000000012', '${HOTEL_ID}', 'Esteban Funes', 'demo.esteban@hmselite.local', '+54 11 5555-1012'),
  ('20000000-0000-0000-0000-000000000013', '${HOTEL_ID}', 'Pablo Sosa', 'demo.pablo@hmselite.local', '+54 11 5555-1013'),
  ('20000000-0000-0000-0000-000000000014', '${HOTEL_ID}', 'Lucia Ferreyra', 'demo.lucia@hmselite.local', '+54 11 5555-1014'),
  ('20000000-0000-0000-0000-000000000015', '${HOTEL_ID}', 'Nora Quiroga', 'demo.nora@hmselite.local', '+54 11 5555-1015'),
  ('20000000-0000-0000-0000-000000000016', '${HOTEL_ID}', 'Agustin Vera', 'demo.agustin@hmselite.local', '+54 11 5555-1016'),
  ('20000000-0000-0000-0000-000000000017', '${HOTEL_ID}', 'Paula Gallo', 'demo.paula@hmselite.local', '+54 11 5555-1017'),
  ('20000000-0000-0000-0000-000000000018', '${HOTEL_ID}', 'Ricardo Nunez', 'demo.ricardo@hmselite.local', '+54 11 5555-1018'),
  ('20000000-0000-0000-0000-000000000019', '${HOTEL_ID}', 'Milagros Diaz', 'demo.milagros@hmselite.local', '+54 11 5555-1019'),
  ('20000000-0000-0000-0000-000000000020', '${HOTEL_ID}', 'Federico Arce', 'demo.federico@hmselite.local', '+54 11 5555-1020'),
  ('20000000-0000-0000-0000-000000000021', '${HOTEL_ID}', 'Carla Moyano', 'demo.carla@hmselite.local', '+54 11 5555-1021'),
  ('20000000-0000-0000-0000-000000000022', '${HOTEL_ID}', 'Ramiro Luna', 'demo.ramiro@hmselite.local', '+54 11 5555-1022');

WITH room_refs AS (
  SELECT room_number, id
  FROM rooms
  WHERE hotel_id = '${HOTEL_ID}'
),
booking_rows AS (
  SELECT *
  FROM (
    VALUES
      ('70000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 'Laura Mendez', '102', DATE '2026-03-08', DATE '2026-03-10', 'CONFIRMED', 5000000::bigint, NULL::int, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid),
      ('70000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'Martin Paz', '103', DATE '2026-03-08', DATE '2026-03-11', 'CONFIRMED', 11400000::bigint, NULL::int, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid),
      ('70000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, 'Camila Torres', '104', DATE '2026-03-08', DATE '2026-03-09', 'CONFIRMED', 3800000::bigint, NULL::int, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid),
      ('70000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 'Valeria Soto', '201', DATE '2026-03-06', DATE '2026-03-08', 'CHECKED_IN', 13000000::bigint, 2::int, 'DNI 28499311'::text, true, true, true, TIMESTAMP '2026-03-06 14:12:00', '10000000-0000-0000-0000-000000000011'::uuid, NULL::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid),
      ('70000000-0000-0000-0000-000000000005'::uuid, '20000000-0000-0000-0000-000000000005'::uuid, 'Diego Campos', '301', DATE '2026-03-07', DATE '2026-03-11', 'CHECKED_IN', 36800000::bigint, 3::int, 'PAS 98X2201'::text, true, true, true, TIMESTAMP '2026-03-07 15:45:00', '10000000-0000-0000-0000-000000000011'::uuid, NULL::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid),
      ('70000000-0000-0000-0000-000000000006'::uuid, '20000000-0000-0000-0000-000000000006'::uuid, 'Alicia Ferrer', '101', DATE '2026-03-05', DATE '2026-03-07', 'CHECKED_OUT', 5000000::bigint, 1::int, 'DNI 31222444'::text, true, true, true, TIMESTAMP '2026-03-05 13:03:00', '10000000-0000-0000-0000-000000000011'::uuid, 'settled'::text, 'CC-1037'::text, true, true, true, TIMESTAMP '2026-03-07 10:18:00', '10000000-0000-0000-0000-000000000011'::uuid),
      ('70000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000007'::uuid, 'Sofia Benitez', '105', DATE '2026-03-08', DATE '2026-03-12', 'CONFIRMED', 10800000::bigint, NULL::int, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid),
      ('70000000-0000-0000-0000-000000000008'::uuid, '20000000-0000-0000-0000-000000000008'::uuid, 'Tomas Ibarra', '202', DATE '2026-03-08', DATE '2026-03-10', 'CONFIRMED', 13000000::bigint, NULL::int, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid),
      ('70000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000009'::uuid, 'Julieta Rios', '203', DATE '2026-03-09', DATE '2026-03-12', 'CONFIRMED', 12600000::bigint, NULL::int, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid),
      ('70000000-0000-0000-0000-000000000010'::uuid, '20000000-0000-0000-0000-000000000010'::uuid, 'Bruno Leiva', '204', DATE '2026-03-10', DATE '2026-03-13', 'CONFIRMED', 20400000::bigint, NULL::int, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid),
      ('70000000-0000-0000-0000-000000000011'::uuid, '20000000-0000-0000-0000-000000000011'::uuid, 'Mariana Costa', '302', DATE '2026-03-01', DATE '2026-03-04', 'CHECKED_OUT', 29400000::bigint, 2::int, 'DNI 29844001'::text, true, true, true, TIMESTAMP '2026-03-01 16:10:00', '10000000-0000-0000-0000-000000000011'::uuid, 'settled'::text, 'INV-3029'::text, true, true, true, TIMESTAMP '2026-03-04 11:12:00', '10000000-0000-0000-0000-000000000011'::uuid),
      ('70000000-0000-0000-0000-000000000012'::uuid, '20000000-0000-0000-0000-000000000012'::uuid, 'Esteban Funes', '106', DATE '2026-02-28', DATE '2026-03-03', 'CHECKED_OUT', 12000000::bigint, 1::int, 'PAS AR33491'::text, true, true, true, TIMESTAMP '2026-02-28 18:20:00', '10000000-0000-0000-0000-000000000011'::uuid, 'settled'::text, 'CC-2042'::text, true, true, true, TIMESTAMP '2026-03-03 09:48:00', '10000000-0000-0000-0000-000000000011'::uuid),
      ('70000000-0000-0000-0000-000000000013'::uuid, '20000000-0000-0000-0000-000000000013'::uuid, 'Pablo Sosa', '401', DATE '2026-03-12', DATE '2026-03-15', 'CONFIRMED', 43500000::bigint, NULL::int, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid),
      ('70000000-0000-0000-0000-000000000014'::uuid, '20000000-0000-0000-0000-000000000014'::uuid, 'Lucia Ferreyra', '204', DATE '2026-02-22', DATE '2026-02-24', 'CHECKED_OUT', 13600000::bigint, 2::int, 'DNI 33678112'::text, true, true, true, TIMESTAMP '2026-02-22 13:22:00', '10000000-0000-0000-0000-000000000011'::uuid, 'settled'::text, 'INV-1804'::text, true, true, true, TIMESTAMP '2026-02-24 10:08:00', '10000000-0000-0000-0000-000000000011'::uuid),
      ('70000000-0000-0000-0000-000000000015'::uuid, '20000000-0000-0000-0000-000000000015'::uuid, 'Nora Quiroga', '303', DATE '2026-03-10', DATE '2026-03-12', 'CANCELLED', 17000000::bigint, NULL::int, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean, NULL::timestamp, NULL::uuid),
      ('70000000-0000-0000-0000-000000000016'::uuid, '20000000-0000-0000-0000-000000000016'::uuid, 'Agustin Vera', '102', DATE '2026-02-08', DATE '2026-02-10', 'CHECKED_OUT', 5000000::bigint, 1::int, 'DNI 30115566'::text, true, true, true, TIMESTAMP '2026-02-08 12:20:00', '10000000-0000-0000-0000-000000000011'::uuid, 'settled'::text, 'INV-1602'::text, true, true, true, TIMESTAMP '2026-02-10 09:10:00', '10000000-0000-0000-0000-000000000011'::uuid),
      ('70000000-0000-0000-0000-000000000017'::uuid, '20000000-0000-0000-0000-000000000017'::uuid, 'Paula Gallo', '105', DATE '2026-02-11', DATE '2026-02-13', 'CHECKED_OUT', 5400000::bigint, 1::int, 'DNI 28774112'::text, true, true, true, TIMESTAMP '2026-02-11 14:05:00', '10000000-0000-0000-0000-000000000011'::uuid, 'settled'::text, 'INV-1710'::text, true, true, true, TIMESTAMP '2026-02-13 10:32:00', '10000000-0000-0000-0000-000000000011'::uuid),
      ('70000000-0000-0000-0000-000000000018'::uuid, '20000000-0000-0000-0000-000000000018'::uuid, 'Ricardo Nunez', '203', DATE '2026-02-14', DATE '2026-02-16', 'CHECKED_OUT', 8400000::bigint, 2::int, 'PAS XX12091'::text, true, true, true, TIMESTAMP '2026-02-14 16:40:00', '10000000-0000-0000-0000-000000000011'::uuid, 'settled'::text, 'INV-1833'::text, true, true, true, TIMESTAMP '2026-02-16 11:00:00', '10000000-0000-0000-0000-000000000011'::uuid),
      ('70000000-0000-0000-0000-000000000019'::uuid, '20000000-0000-0000-0000-000000000019'::uuid, 'Milagros Diaz', '204', DATE '2026-02-17', DATE '2026-02-20', 'CHECKED_OUT', 20400000::bigint, 2::int, 'DNI 32987110'::text, true, true, true, TIMESTAMP '2026-02-17 13:00:00', '10000000-0000-0000-0000-000000000011'::uuid, 'settled'::text, 'INV-1902'::text, true, true, true, TIMESTAMP '2026-02-20 10:00:00', '10000000-0000-0000-0000-000000000011'::uuid),
      ('70000000-0000-0000-0000-000000000020'::uuid, '20000000-0000-0000-0000-000000000020'::uuid, 'Federico Arce', '302', DATE '2026-02-18', DATE '2026-02-21', 'CHECKED_OUT', 29400000::bigint, 2::int, 'DNI 27811003'::text, true, true, true, TIMESTAMP '2026-02-18 12:40:00', '10000000-0000-0000-0000-000000000011'::uuid, 'settled'::text, 'INV-1938'::text, true, true, true, TIMESTAMP '2026-02-21 11:30:00', '10000000-0000-0000-0000-000000000011'::uuid),
      ('70000000-0000-0000-0000-000000000021'::uuid, '20000000-0000-0000-0000-000000000021'::uuid, 'Carla Moyano', '401', DATE '2026-02-23', DATE '2026-02-26', 'CHECKED_OUT', 43500000::bigint, 2::int, 'PAS AR88123'::text, true, true, true, TIMESTAMP '2026-02-23 15:15:00', '10000000-0000-0000-0000-000000000011'::uuid, 'settled'::text, 'INV-2011'::text, true, true, true, TIMESTAMP '2026-02-26 09:55:00', '10000000-0000-0000-0000-000000000011'::uuid),
      ('70000000-0000-0000-0000-000000000022'::uuid, '20000000-0000-0000-0000-000000000022'::uuid, 'Ramiro Luna', '303', DATE '2026-03-01', DATE '2026-03-05', 'CHECKED_OUT', 34000000::bigint, 4::int, 'DNI 31450998'::text, true, true, true, TIMESTAMP '2026-03-01 17:10:00', '10000000-0000-0000-0000-000000000011'::uuid, 'settled'::text, 'INV-2216'::text, true, true, true, TIMESTAMP '2026-03-05 10:20:00', '10000000-0000-0000-0000-000000000011'::uuid)
  ) AS payload(
    booking_id, guest_id, guest_name, room_number, check_in, check_out, status, total_price_cents,
    check_in_guests_count, check_in_reference, check_in_document_verified, check_in_contact_confirmed,
    check_in_stay_confirmed, checked_in_at, checked_in_by_user_id,
    check_out_payment_policy, check_out_reference, check_out_charges_reviewed,
    check_out_room_release_confirmed, check_out_housekeeping_handoff, checked_out_at, checked_out_by_user_id
  )
)
INSERT INTO bookings (
  id, hotel_id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status,
  check_in_guests_count, check_in_reference, check_in_document_verified, check_in_contact_confirmed,
  check_in_stay_confirmed, checked_in_at, checked_in_by_user_id,
  check_out_payment_policy, check_out_reference, check_out_charges_reviewed,
  check_out_room_release_confirmed, check_out_housekeeping_handoff, checked_out_at, checked_out_by_user_id
)
SELECT
  booking_rows.booking_id,
  '${HOTEL_ID}'::uuid,
  room_refs.id,
  booking_rows.guest_id,
  booking_rows.guest_name,
  booking_rows.check_in,
  booking_rows.check_out,
  booking_rows.total_price_cents,
  booking_rows.status,
  booking_rows.check_in_guests_count,
  booking_rows.check_in_reference,
  booking_rows.check_in_document_verified,
  booking_rows.check_in_contact_confirmed,
  booking_rows.check_in_stay_confirmed,
  booking_rows.checked_in_at,
  booking_rows.checked_in_by_user_id,
  booking_rows.check_out_payment_policy,
  booking_rows.check_out_reference,
  booking_rows.check_out_charges_reviewed,
  booking_rows.check_out_room_release_confirmed,
  booking_rows.check_out_housekeeping_handoff,
  booking_rows.checked_out_at,
  booking_rows.checked_out_by_user_id
FROM booking_rows
JOIN room_refs ON room_refs.room_number = booking_rows.room_number;

INSERT INTO extra_charges (id, hotel_id, booking_id, description, amount_cents, category, created_at)
VALUES
  ('30000000-0000-0000-0000-000000000001', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000004', 'Minibar premium', 1800000, 'MINIBAR', TIMESTAMP '2026-03-07 23:10:00'),
  ('30000000-0000-0000-0000-000000000002', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000004', 'Transfer aeropuerto', 3200000, 'TRANSPORTE', TIMESTAMP '2026-03-08 08:15:00'),
  ('30000000-0000-0000-0000-000000000003', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000005', 'Room service noche', 2600000, 'ROOM_SERVICE', TIMESTAMP '2026-03-07 22:40:00'),
  ('30000000-0000-0000-0000-000000000004', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000005', 'Lavanderia express', 1400000, 'LAVANDERIA', TIMESTAMP '2026-03-08 09:05:00'),
  ('30000000-0000-0000-0000-000000000005', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000006', 'Snack bar', 900000, 'BAR', TIMESTAMP '2026-03-06 19:35:00'),
  ('30000000-0000-0000-0000-000000000006', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000011', 'Spa premium', 4800000, 'SPA', TIMESTAMP '2026-03-03 19:10:00'),
  ('30000000-0000-0000-0000-000000000007', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000012', 'Upgrade desayuno', 1200000, 'DESAYUNO', TIMESTAMP '2026-03-01 08:10:00'),
  ('30000000-0000-0000-0000-000000000008', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000014', 'Parking cubierto', 1600000, 'ESTACIONAMIENTO', TIMESTAMP '2026-02-23 22:20:00'),
  ('30000000-0000-0000-0000-000000000009', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000004', 'Late checkout preaprobado', 2100000, 'LATE_CHECKOUT', TIMESTAMP '2026-03-08 09:12:00'),
  ('30000000-0000-0000-0000-000000000010', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000005', 'Laundry premium', 1800000, 'LAVANDERIA', TIMESTAMP '2026-03-08 11:05:00'),
  ('30000000-0000-0000-0000-000000000011', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000018', 'Cena maridaje', 3900000, 'RESTAURANTE', TIMESTAMP '2026-02-15 22:10:00'),
  ('30000000-0000-0000-0000-000000000012', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000021', 'Servicio chofer ejecutivo', 5600000, 'TRANSPORTE', TIMESTAMP '2026-02-24 08:00:00'),
  ('30000000-0000-0000-0000-000000000013', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000022', 'Kids club premium', 2200000, 'FAMILY', TIMESTAMP '2026-03-03 16:20:00');

INSERT INTO invoices (id, hotel_id, booking_id, amount_cents, status, payment_method, created_at)
VALUES
  ('40000000-0000-0000-0000-000000000001', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000006', 5000000, 'PAID', 'CARD', TIMESTAMP '2026-03-07 10:20:00'),
  ('40000000-0000-0000-0000-000000000002', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000004', 13000000, 'PENDING', 'CASH', TIMESTAMP '2026-03-08 09:00:00'),
  ('40000000-0000-0000-0000-000000000003', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000011', 29400000, 'PAID', 'TRANSFER', TIMESTAMP '2026-03-04 11:15:00'),
  ('40000000-0000-0000-0000-000000000004', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000012', 12000000, 'PAID', 'CARD', TIMESTAMP '2026-03-03 10:00:00'),
  ('40000000-0000-0000-0000-000000000005', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000005', 36800000, 'PENDING', 'CARD', TIMESTAMP '2026-03-08 12:20:00'),
  ('40000000-0000-0000-0000-000000000006', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000016', 5000000, 'PAID', 'CASH', TIMESTAMP '2026-02-10 09:12:00'),
  ('40000000-0000-0000-0000-000000000007', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000017', 5400000, 'PAID', 'CARD', TIMESTAMP '2026-02-13 10:40:00'),
  ('40000000-0000-0000-0000-000000000008', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000018', 8400000, 'PAID', 'CASH', TIMESTAMP '2026-02-16 11:04:00'),
  ('40000000-0000-0000-0000-000000000009', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000019', 20400000, 'PAID', 'TRANSFER', TIMESTAMP '2026-02-20 10:04:00'),
  ('40000000-0000-0000-0000-000000000010', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000020', 29400000, 'PAID', 'CARD', TIMESTAMP '2026-02-21 11:34:00'),
  ('40000000-0000-0000-0000-000000000011', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000021', 43500000, 'PAID', 'TRANSFER', TIMESTAMP '2026-02-26 10:00:00'),
  ('40000000-0000-0000-0000-000000000012', '${HOTEL_ID}', '70000000-0000-0000-0000-000000000022', 34000000, 'PAID', 'CASH', TIMESTAMP '2026-03-05 10:24:00');

INSERT INTO cash_closures (
  id, hotel_id, user_id, total_amount_cents, cash_amount_cents, card_amount_cents, opening_time, closing_time, notes
)
VALUES
  ('80000000-0000-0000-0000-000000000001', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 39800000, 13400000, 5400000, TIMESTAMP '2026-02-10 00:00:00+00', TIMESTAMP '2026-02-16 23:55:00+00', 'Cierre semanal temporada alta'),
  ('80000000-0000-0000-0000-000000000002', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 49800000, 0, 29400000, TIMESTAMP '2026-02-17 00:00:00+00', TIMESTAMP '2026-02-28 23:45:00+00', 'Cierre corporativo fin de febrero'),
  ('80000000-0000-0000-0000-000000000003', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 77000000, 34000000, 12000000, TIMESTAMP '2026-03-01 00:00:00+00', TIMESTAMP '2026-03-06 23:30:00+00', 'Cierre parcial primera semana marzo');

WITH room_refs AS (
  SELECT room_number, id
  FROM rooms
  WHERE hotel_id = '${HOTEL_ID}'
)
INSERT INTO room_holds (
  id, hotel_id, room_id, start_date, end_date, hold_type, reason, created_by_user_id, created_at
)
SELECT * FROM (
  SELECT '50000000-0000-0000-0000-000000000001'::uuid, '${HOTEL_ID}'::uuid, (SELECT id FROM room_refs WHERE room_number = '104'), DATE '2026-03-08', DATE '2026-03-12', 'MAINTENANCE', 'Aire acondicionado fuera de servicio', '10000000-0000-0000-0000-000000000012'::uuid, TIMESTAMP '2026-03-08 07:50:00'
  UNION ALL SELECT '50000000-0000-0000-0000-000000000002'::uuid, '${HOTEL_ID}'::uuid, (SELECT id FROM room_refs WHERE room_number = '202'), DATE '2026-03-09', DATE '2026-03-11', 'COMPLIANCE', 'Fumigacion preventiva piso 2', '10000000-0000-0000-0000-000000000012'::uuid, TIMESTAMP '2026-03-08 08:20:00'
  UNION ALL SELECT '50000000-0000-0000-0000-000000000003'::uuid, '${HOTEL_ID}'::uuid, (SELECT id FROM room_refs WHERE room_number = '301'), DATE '2026-03-20', DATE '2026-03-22', 'OWNER', 'Owner block para directorio', '10000000-0000-0000-0000-000000000012'::uuid, TIMESTAMP '2026-03-08 08:45:00'
  UNION ALL SELECT '50000000-0000-0000-0000-000000000004'::uuid, '${HOTEL_ID}'::uuid, (SELECT id FROM room_refs WHERE room_number = '101'), DATE '2026-03-15', DATE '2026-03-18', 'COMMERCIAL', 'Bloqueo comercial grupo corporativo', '10000000-0000-0000-0000-000000000012'::uuid, TIMESTAMP '2026-03-08 09:10:00'
  UNION ALL SELECT '50000000-0000-0000-0000-000000000005'::uuid, '${HOTEL_ID}'::uuid, (SELECT id FROM room_refs WHERE room_number = '103'), DATE '2026-03-12', DATE '2026-03-14', 'VIP', 'Preasignada para cuenta VIP', '10000000-0000-0000-0000-000000000012'::uuid, TIMESTAMP '2026-03-08 09:35:00'
  UNION ALL SELECT '50000000-0000-0000-0000-000000000006'::uuid, '${HOTEL_ID}'::uuid, (SELECT id FROM room_refs WHERE room_number = '204'), DATE '2026-03-16', DATE '2026-03-19', 'COMMERCIAL', 'Bloqueo de cupo para roadshow', '10000000-0000-0000-0000-000000000012'::uuid, TIMESTAMP '2026-03-08 10:05:00'
  UNION ALL SELECT '50000000-0000-0000-0000-000000000007'::uuid, '${HOTEL_ID}'::uuid, (SELECT id FROM room_refs WHERE room_number = '302'), DATE '2026-03-22', DATE '2026-03-24', 'OWNER', 'Reserva owner posterior a estadia VIP', '10000000-0000-0000-0000-000000000012'::uuid, TIMESTAMP '2026-03-08 10:40:00'
  UNION ALL SELECT '50000000-0000-0000-0000-000000000008'::uuid, '${HOTEL_ID}'::uuid, (SELECT id FROM room_refs WHERE room_number = '401'), DATE '2026-03-18', DATE '2026-03-20', 'MAINTENANCE', 'Revision integral jacuzzi y domotica', '10000000-0000-0000-0000-000000000012'::uuid, TIMESTAMP '2026-03-08 11:05:00'
) holds;

INSERT INTO audit_events (id, hotel_id, user_id, action, ip_address, created_at)
VALUES
  ('60000000-0000-0000-0000-000000000001', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 'booking.checkin: 201 Valeria Soto', '10.0.0.21', TIMESTAMP '2026-03-06 14:12:00'),
  ('60000000-0000-0000-0000-000000000002', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 'booking.checkin: 301 Diego Campos', '10.0.0.21', TIMESTAMP '2026-03-07 15:45:00'),
  ('60000000-0000-0000-0000-000000000003', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000012', 'room.hold.created: 104 maintenance', '10.0.0.32', TIMESTAMP '2026-03-08 07:50:00'),
  ('60000000-0000-0000-0000-000000000004', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000013', 'housekeeping.cleaned: 101 available', '10.0.0.48', TIMESTAMP '2026-03-07 11:10:00'),
  ('60000000-0000-0000-0000-000000000005', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 'frontdesk.arrival.blocked: 103 dirty', '10.0.0.21', TIMESTAMP '2026-03-08 08:40:00'),
  ('60000000-0000-0000-0000-000000000006', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 'frontdesk.arrival.ready: 102 Laura Mendez', '10.0.0.21', TIMESTAMP '2026-03-08 08:42:00'),
  ('60000000-0000-0000-0000-000000000007', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000012', 'ops.review: 202 cleaning turnover', '10.0.0.32', TIMESTAMP '2026-03-08 09:20:00'),
  ('60000000-0000-0000-0000-000000000008', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 'frontdesk.checkout.pending: 201 Valeria Soto', '10.0.0.21', TIMESTAMP '2026-03-08 09:30:00'),
  ('60000000-0000-0000-0000-000000000009', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000012', 'room.hold.created: 401 maintenance', '10.0.0.32', TIMESTAMP '2026-03-08 11:05:00'),
  ('60000000-0000-0000-0000-000000000010', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 'billing.pending: 301 Diego Campos', '10.0.0.21', TIMESTAMP '2026-03-08 12:22:00'),
  ('60000000-0000-0000-0000-000000000011', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000013', 'housekeeping.escalated: 104 maintenance', '10.0.0.48', TIMESTAMP '2026-03-08 12:45:00'),
  ('60000000-0000-0000-0000-000000000012', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 'booking.checkout: 302 Mariana Costa', '10.0.0.21', TIMESTAMP '2026-03-04 11:12:00'),
  ('60000000-0000-0000-0000-000000000013', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 'cash.close: weekly Feb', '10.0.0.21', TIMESTAMP '2026-02-16 23:55:00'),
  ('60000000-0000-0000-0000-000000000014', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 'cash.close: month end Feb', '10.0.0.21', TIMESTAMP '2026-02-28 23:45:00'),
  ('60000000-0000-0000-0000-000000000015', '${HOTEL_ID}', '10000000-0000-0000-0000-000000000011', 'cash.close: march week one', '10.0.0.21', TIMESTAMP '2026-03-06 23:30:00');

COMMIT;
SQL

echo "Seed demo cargado."
echo "Habitaciones: 14"
echo "Reservas demo: 22"
echo "Usuarios demo: admin / recepcion_demo / ops_demo / housekeeping_demo / saas_admin_demo"
echo "Password demo: ${DEMO_PASSWORD}"
