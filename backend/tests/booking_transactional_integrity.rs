use chrono::{Duration, NaiveDate, Utc};
use hms_backend::application::booking_transaction_service::BookingTransactionService;
use hms_backend::domain::errors::DomainError;
use hms_backend::domain::models::{BookingOperationalUpdate, BookingStatus};
use hms_backend::domain::repositories::BookingTransactionRepository;
use hms_backend::infrastructure::repository::postgres_booking_transaction::PostgresBookingTransactionRepository;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

fn complete_check_in_update() -> BookingOperationalUpdate {
    BookingOperationalUpdate {
        check_in_guests_count: Some(1),
        check_in_reference: Some("ARRIVAL-TX".to_string()),
        check_in_document_verified: Some(true),
        check_in_contact_confirmed: Some(true),
        check_in_stay_confirmed: Some(true),
        ..BookingOperationalUpdate::default()
    }
}

fn complete_check_out_update(policy: &str, reference: Option<&str>) -> BookingOperationalUpdate {
    BookingOperationalUpdate {
        check_out_payment_policy: Some(policy.to_string()),
        check_out_reference: reference.map(str::to_string),
        check_out_charges_reviewed: Some(true),
        check_out_room_release_confirmed: Some(true),
        check_out_housekeeping_handoff: Some(true),
        ..BookingOperationalUpdate::default()
    }
}

#[sqlx::test]
async fn checkout_is_atomic_room_invoice_audit(pool: sqlx::PgPool) {
    let hotel_id = Uuid::new_v4();
    let room_id = Uuid::new_v4();
    let booking_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel Tx QA")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(user_id)
    .bind(hotel_id)
    .bind("tx_user")
    .bind("hash")
    .bind("admin")
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(room_id)
    .bind(hotel_id)
    .bind("TX-101")
    .bind("Suite")
    .bind("OCCUPIED")
    .bind(10_000_i64)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO bookings (
            id, hotel_id, room_id, guest_name, check_in, check_out, total_price_cents, status,
            check_in_guests_count, check_in_document_verified, check_in_contact_confirmed,
            check_in_stay_confirmed
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
    )
    .bind(booking_id)
    .bind(hotel_id)
    .bind(room_id)
    .bind("QA Guest")
    .bind(NaiveDate::from_ymd_opt(2026, 2, 10).unwrap())
    .bind(NaiveDate::from_ymd_opt(2026, 2, 12).unwrap())
    .bind(20_000_i64)
    .bind("CHECKED_IN")
    .bind(1_i32)
    .bind(true)
    .bind(true)
    .bind(true)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO extra_charges (id, hotel_id, booking_id, description, amount_cents, category)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_id)
    .bind(booking_id)
    .bind("Breakfast")
    .bind(1_500_i64)
    .bind("RESTAURANTE")
    .execute(&pool)
    .await
    .unwrap();

    let booking_transaction_repo = Arc::new(PostgresBookingTransactionRepository::new(pool.clone()))
        as Arc<dyn BookingTransactionRepository>;
    let service = BookingTransactionService::new(booking_transaction_repo);
    let updated = service
        .update_booking_transactional(
            hotel_id,
            booking_id,
            Some(user_id),
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::CheckedOut),
            None,
            Some(BookingOperationalUpdate {
                check_out_payment_policy: Some("pending-approved".to_string()),
                check_out_reference: Some("OPS-TX-101".to_string()),
                check_out_charges_reviewed: Some(true),
                check_out_room_release_confirmed: Some(true),
                check_out_housekeeping_handoff: Some(true),
                ..BookingOperationalUpdate::default()
            }),
        )
        .await
        .unwrap();

    assert!(matches!(updated.status, BookingStatus::CheckedOut));
    assert_eq!(updated.total_price_cents, 21_500);

    let room_status: String =
        sqlx::query("SELECT status FROM rooms WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(room_id)
            .fetch_one(&pool)
            .await
            .unwrap()
            .try_get("status")
            .unwrap();
    assert_eq!(room_status, "DIRTY");

    let invoice_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::BIGINT FROM invoices WHERE hotel_id = $1 AND booking_id = $2",
    )
    .bind(hotel_id)
    .bind(booking_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(invoice_count, 1);

    let invoice_amount: i64 = sqlx::query_scalar(
        "SELECT amount_cents FROM invoices WHERE hotel_id = $1 AND booking_id = $2",
    )
    .bind(hotel_id)
    .bind(booking_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(invoice_amount, 21_500);

    let audit_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::BIGINT
         FROM audit_events
         WHERE hotel_id = $1
           AND user_id = $2
           AND action LIKE 'Check-out: Booking %'",
    )
    .bind(hotel_id)
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(audit_count, 1);

    let override_audit: (Uuid, String) = sqlx::query_as(
        "SELECT user_id, action
         FROM audit_events
         WHERE hotel_id = $1
           AND action LIKE 'CO_OVERRIDE booking=%'
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .bind(hotel_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(override_audit.0, user_id);
    assert!(override_audit.1.contains(&booking_id.to_string()));
    assert!(override_audit.1.contains("due=21500"));
    assert!(override_audit.1.contains("ref=OPS-TX-101"));
}

#[sqlx::test]
async fn operational_invariants_block_invalid_check_in_and_checkout(pool: sqlx::PgPool) {
    let hotel_id = Uuid::new_v4();
    let room_id = Uuid::new_v4();
    let booking_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel Tx Invariants QA")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(user_id)
    .bind(hotel_id)
    .bind("tx_invariants")
    .bind("hash")
    .bind("admin")
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(room_id)
    .bind(hotel_id)
    .bind("TX-INV-101")
    .bind("Suite")
    .bind("AVAILABLE")
    .bind(10_000_i64)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO bookings (
            id, hotel_id, room_id, guest_name, check_in, check_out, total_price_cents, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(booking_id)
    .bind(hotel_id)
    .bind(room_id)
    .bind("QA Invariants Guest")
    .bind(NaiveDate::from_ymd_opt(2026, 5, 10).unwrap())
    .bind(NaiveDate::from_ymd_opt(2026, 5, 12).unwrap())
    .bind(20_000_i64)
    .bind("CONFIRMED")
    .execute(&pool)
    .await
    .unwrap();

    let repository = Arc::new(PostgresBookingTransactionRepository::new(pool.clone()))
        as Arc<dyn BookingTransactionRepository>;
    let service = BookingTransactionService::new(repository);

    let incomplete_check_in = service
        .update_booking_transactional(
            hotel_id,
            booking_id,
            Some(user_id),
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::CheckedIn),
            None,
            None,
        )
        .await;
    assert!(matches!(
        incomplete_check_in,
        Err(DomainError::InvalidInput(message)) if message.contains("check-in")
    ));

    let direct_check_out = service
        .update_booking_transactional(
            hotel_id,
            booking_id,
            Some(user_id),
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::CheckedOut),
            None,
            Some(complete_check_out_update(
                "pending-approved",
                Some("OPS-DIRECT"),
            )),
        )
        .await;
    assert!(matches!(
        direct_check_out,
        Err(DomainError::InvalidInput(message)) if message.contains("Transicion")
    ));

    let checked_in = service
        .update_booking_transactional(
            hotel_id,
            booking_id,
            Some(user_id),
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::CheckedIn),
            None,
            Some(complete_check_in_update()),
        )
        .await
        .unwrap();
    assert_eq!(checked_in.status, BookingStatus::CheckedIn);

    let incomplete_check_out = service
        .update_booking_transactional(
            hotel_id,
            booking_id,
            Some(user_id),
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::CheckedOut),
            None,
            None,
        )
        .await;
    assert!(matches!(
        incomplete_check_out,
        Err(DomainError::InvalidInput(message)) if message.contains("checkout")
    ));

    let unpaid_settled_check_out = service
        .update_booking_transactional(
            hotel_id,
            booking_id,
            Some(user_id),
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::CheckedOut),
            None,
            Some(complete_check_out_update("settled", None)),
        )
        .await;
    assert!(matches!(
        unpaid_settled_check_out,
        Err(DomainError::InvalidInput(message)) if message.contains("completamente cobrada")
    ));

    let persisted_status: String =
        sqlx::query_scalar("SELECT status FROM bookings WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(booking_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    let room_status: String =
        sqlx::query_scalar("SELECT status FROM rooms WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(room_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    let invoice_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::BIGINT FROM invoices WHERE hotel_id = $1 AND booking_id = $2",
    )
    .bind(hotel_id)
    .bind(booking_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(persisted_status, "CHECKED_IN");
    assert_eq!(room_status, "OCCUPIED");
    assert_eq!(invoice_count, 0);
}

#[sqlx::test]
async fn invalid_guest_rolls_back_without_side_effects(pool: sqlx::PgPool) {
    let hotel_id = Uuid::new_v4();
    let room_id = Uuid::new_v4();
    let booking_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel Tx Rollback QA")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(user_id)
    .bind(hotel_id)
    .bind("tx_user_rb")
    .bind("hash")
    .bind("admin")
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(room_id)
    .bind(hotel_id)
    .bind("TX-201")
    .bind("Suite")
    .bind("AVAILABLE")
    .bind(12_000_i64)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO bookings (id, hotel_id, room_id, guest_name, check_in, check_out, total_price_cents, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(booking_id)
    .bind(hotel_id)
    .bind(room_id)
    .bind("QA Guest")
    .bind(NaiveDate::from_ymd_opt(2026, 3, 10).unwrap())
    .bind(NaiveDate::from_ymd_opt(2026, 3, 12).unwrap())
    .bind(24_000_i64)
    .bind("CONFIRMED")
    .execute(&pool)
    .await
    .unwrap();

    let booking_transaction_repo = Arc::new(PostgresBookingTransactionRepository::new(pool.clone()))
        as Arc<dyn BookingTransactionRepository>;
    let service = BookingTransactionService::new(booking_transaction_repo);
    let result = service
        .update_booking_transactional(
            hotel_id,
            booking_id,
            Some(user_id),
            Some(Uuid::new_v4()),
            None,
            None,
            None,
            None,
            Some(BookingStatus::CheckedOut),
            None,
            None,
        )
        .await;

    assert!(matches!(result, Err(DomainError::GuestNotFound)));

    let booking_status: String =
        sqlx::query("SELECT status FROM bookings WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(booking_id)
            .fetch_one(&pool)
            .await
            .unwrap()
            .try_get("status")
            .unwrap();
    assert_eq!(booking_status, "CONFIRMED");

    let invoice_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::BIGINT FROM invoices WHERE hotel_id = $1 AND booking_id = $2",
    )
    .bind(hotel_id)
    .bind(booking_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(invoice_count, 0);

    let audit_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::BIGINT
         FROM audit_events
         WHERE hotel_id = $1
           AND action LIKE 'Check-out: Booking %'",
    )
    .bind(hotel_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(audit_count, 0);
}

#[sqlx::test]
async fn checked_in_booking_can_be_reassigned_transactionally(pool: sqlx::PgPool) {
    let hotel_id = Uuid::new_v4();
    let current_room_id = Uuid::new_v4();
    let target_room_id = Uuid::new_v4();
    let booking_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel Tx Move QA")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(user_id)
    .bind(hotel_id)
    .bind("tx_move")
    .bind("hash")
    .bind("admin")
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents)
         VALUES ($1, $2, $3, $4, $5, $6), ($7, $2, $8, $9, $10, $11)",
    )
    .bind(current_room_id)
    .bind(hotel_id)
    .bind("TX-301")
    .bind("Suite")
    .bind("OCCUPIED")
    .bind(15_000_i64)
    .bind(target_room_id)
    .bind("TX-302")
    .bind("Suite Premium")
    .bind("AVAILABLE")
    .bind(18_000_i64)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO bookings (id, hotel_id, room_id, guest_name, check_in, check_out, total_price_cents, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(booking_id)
    .bind(hotel_id)
    .bind(current_room_id)
    .bind("QA Move Guest")
    .bind(NaiveDate::from_ymd_opt(2026, 4, 10).unwrap())
    .bind(NaiveDate::from_ymd_opt(2026, 4, 13).unwrap())
    .bind(45_000_i64)
    .bind("CHECKED_IN")
    .execute(&pool)
    .await
    .unwrap();

    let booking_transaction_repo = Arc::new(PostgresBookingTransactionRepository::new(pool.clone()))
        as Arc<dyn BookingTransactionRepository>;
    let service = BookingTransactionService::new(booking_transaction_repo);

    let updated = service
        .update_booking_transactional(
            hotel_id,
            booking_id,
            Some(user_id),
            None,
            None,
            Some(target_room_id),
            None,
            None,
            None,
            Some("Move by admin after room issue".to_string()),
            None,
        )
        .await
        .unwrap();

    assert_eq!(updated.room_id, target_room_id);
    assert!(matches!(updated.status, BookingStatus::CheckedIn));
    assert_eq!(updated.total_price_cents, 54_000);

    let current_room_status: String =
        sqlx::query("SELECT status FROM rooms WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(current_room_id)
            .fetch_one(&pool)
            .await
            .unwrap()
            .try_get("status")
            .unwrap();
    assert_eq!(current_room_status, "DIRTY");

    let target_room_status: String =
        sqlx::query("SELECT status FROM rooms WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(target_room_id)
            .fetch_one(&pool)
            .await
            .unwrap()
            .try_get("status")
            .unwrap();
    assert_eq!(target_room_status, "OCCUPIED");

    let audit_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::BIGINT
         FROM audit_events
         WHERE hotel_id = $1
           AND user_id = $2
           AND action LIKE 'Room reassignment: Booking %'",
    )
    .bind(hotel_id)
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(audit_count, 1);
}

#[sqlx::test]
async fn reassignment_to_unavailable_room_rolls_back(pool: sqlx::PgPool) {
    let hotel_id = Uuid::new_v4();
    let current_room_id = Uuid::new_v4();
    let target_room_id = Uuid::new_v4();
    let booking_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel Tx Move Rollback QA")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(user_id)
    .bind(hotel_id)
    .bind("tx_move_rb")
    .bind("hash")
    .bind("admin")
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents)
         VALUES ($1, $2, $3, $4, $5, $6), ($7, $2, $8, $9, $10, $11)",
    )
    .bind(current_room_id)
    .bind(hotel_id)
    .bind("TX-401")
    .bind("Suite")
    .bind("OCCUPIED")
    .bind(15_000_i64)
    .bind(target_room_id)
    .bind("TX-402")
    .bind("Suite Premium")
    .bind("DIRTY")
    .bind(18_000_i64)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO bookings (id, hotel_id, room_id, guest_name, check_in, check_out, total_price_cents, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(booking_id)
    .bind(hotel_id)
    .bind(current_room_id)
    .bind("QA Move Guest")
    .bind(NaiveDate::from_ymd_opt(2026, 4, 14).unwrap())
    .bind(NaiveDate::from_ymd_opt(2026, 4, 16).unwrap())
    .bind(30_000_i64)
    .bind("CHECKED_IN")
    .execute(&pool)
    .await
    .unwrap();

    let booking_transaction_repo = Arc::new(PostgresBookingTransactionRepository::new(pool.clone()))
        as Arc<dyn BookingTransactionRepository>;
    let service = BookingTransactionService::new(booking_transaction_repo);

    let result = service
        .update_booking_transactional(
            hotel_id,
            booking_id,
            Some(user_id),
            None,
            None,
            Some(target_room_id),
            None,
            None,
            None,
            Some("Move blocked".to_string()),
            None,
        )
        .await;

    assert!(matches!(result, Err(DomainError::RoomNotAvailable)));

    let persisted_room_id: Uuid =
        sqlx::query_scalar("SELECT room_id FROM bookings WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(booking_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(persisted_room_id, current_room_id);

    let current_room_status: String =
        sqlx::query("SELECT status FROM rooms WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(current_room_id)
            .fetch_one(&pool)
            .await
            .unwrap()
            .try_get("status")
            .unwrap();
    assert_eq!(current_room_status, "OCCUPIED");
}

#[sqlx::test]
async fn arrival_exceptions_are_validated_audited_and_release_inventory(pool: sqlx::PgPool) {
    let hotel_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let late_room_id = Uuid::new_v4();
    let terminal_room_id = Uuid::new_v4();
    let late_booking_id = Uuid::new_v4();
    let terminal_booking_id = Uuid::new_v4();
    let today = Utc::now().date_naive();
    let checkout = today + Duration::days(2);

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel Arrival Exceptions QA")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(user_id)
    .bind(hotel_id)
    .bind("arrival_ops")
    .bind("hash")
    .bind("ops")
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents)
         VALUES ($1, $2, $3, 'Standard', 'AVAILABLE', 10000),
                ($4, $2, $5, 'Standard', 'AVAILABLE', 10000)",
    )
    .bind(late_room_id)
    .bind(hotel_id)
    .bind("ARR-101")
    .bind(terminal_room_id)
    .bind("ARR-102")
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO bookings
            (id, hotel_id, room_id, guest_name, check_in, check_out, total_price_cents, status)
         VALUES ($1, $2, $3, 'Late Guest', $4, $5, 20000, 'CONFIRMED'),
                ($6, $2, $7, 'Terminal Guest', $4, $5, 20000, 'CONFIRMED')",
    )
    .bind(late_booking_id)
    .bind(hotel_id)
    .bind(late_room_id)
    .bind(today)
    .bind(checkout)
    .bind(terminal_booking_id)
    .bind(terminal_room_id)
    .execute(&pool)
    .await
    .unwrap();

    let repository = Arc::new(PostgresBookingTransactionRepository::new(pool.clone()))
        as Arc<dyn BookingTransactionRepository>;
    let service = BookingTransactionService::new(repository);
    let eta = Utc::now().naive_utc() + Duration::hours(2);

    let late = service
        .update_booking_transactional(
            hotel_id,
            late_booking_id,
            Some(user_id),
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::Confirmed),
            None,
            Some(BookingOperationalUpdate {
                late_arrival_eta: Some(eta),
                late_arrival_note: Some("Huesped aviso demora de vuelo".to_string()),
                ..BookingOperationalUpdate::default()
            }),
        )
        .await
        .unwrap();
    assert_eq!(late.status, BookingStatus::Confirmed);
    assert_eq!(late.operational_data.late_arrival_eta, Some(eta));
    assert_eq!(
        late.operational_data.late_arrival_recorded_by_user_id,
        Some(user_id)
    );

    let hold_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO room_holds
            (id, hotel_id, room_id, start_date, end_date, reason, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, 'Bloqueo posterior para prueba de liberacion', $6)",
    )
    .bind(hold_id)
    .bind(hotel_id)
    .bind(late_room_id)
    .bind(today)
    .bind(checkout)
    .bind(user_id)
    .execute(&pool)
    .await
    .unwrap();

    let cancelled = service
        .update_booking_transactional(
            hotel_id,
            late_booking_id,
            Some(user_id),
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::Cancelled),
            None,
            Some(BookingOperationalUpdate {
                terminal_reason: Some("  Huesped solicito cancelar por demora  ".to_string()),
                ..BookingOperationalUpdate::default()
            }),
        )
        .await
        .unwrap();
    assert_eq!(cancelled.status, BookingStatus::Cancelled);
    assert_eq!(
        cancelled.operational_data.terminal_recorded_by_user_id,
        Some(user_id)
    );
    assert_eq!(
        cancelled.operational_data.terminal_reason.as_deref(),
        Some("Huesped solicito cancelar por demora")
    );

    sqlx::query("DELETE FROM room_holds WHERE hotel_id = $1 AND id = $2")
        .bind(hotel_id)
        .bind(hold_id)
        .execute(&pool)
        .await
        .unwrap();

    let future_booking_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO bookings
            (id, hotel_id, room_id, guest_name, check_in, check_out, total_price_cents, status)
         VALUES ($1, $2, $3, 'Future Guest', $4, $5, 20000, 'CONFIRMED')",
    )
    .bind(future_booking_id)
    .bind(hotel_id)
    .bind(late_room_id)
    .bind(today + Duration::days(1))
    .bind(checkout + Duration::days(1))
    .execute(&pool)
    .await
    .expect("cancellation must release the overlap constraint");
    let early_no_show = service
        .update_booking_transactional(
            hotel_id,
            future_booking_id,
            Some(user_id),
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::NoShow),
            None,
            Some(BookingOperationalUpdate {
                terminal_reason: Some("Intento antes de fecha de llegada".to_string()),
                ..BookingOperationalUpdate::default()
            }),
        )
        .await;
    assert!(matches!(early_no_show, Err(DomainError::InvalidInput(_))));

    let missing_reason = service
        .update_booking_transactional(
            hotel_id,
            terminal_booking_id,
            Some(user_id),
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::Cancelled),
            None,
            None,
        )
        .await;
    assert!(matches!(missing_reason, Err(DomainError::InvalidInput(_))));

    let no_show = service
        .update_booking_transactional(
            hotel_id,
            terminal_booking_id,
            Some(user_id),
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::NoShow),
            None,
            Some(BookingOperationalUpdate {
                terminal_reason: Some("Sin contacto luego del horario limite".to_string()),
                ..BookingOperationalUpdate::default()
            }),
        )
        .await
        .unwrap();
    assert_eq!(no_show.status, BookingStatus::NoShow);
    assert_eq!(
        no_show.operational_data.terminal_recorded_by_user_id,
        Some(user_id)
    );

    sqlx::query(
        "INSERT INTO bookings
            (id, hotel_id, room_id, guest_name, check_in, check_out, total_price_cents, status)
         VALUES ($1, $2, $3, 'Replacement Guest', $4, $5, 20000, 'CONFIRMED')",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_id)
    .bind(terminal_room_id)
    .bind(today)
    .bind(checkout)
    .execute(&pool)
    .await
    .expect("no-show must release the overlap constraint");

    let audit_actions: Vec<String> = sqlx::query_scalar(
        "SELECT action FROM audit_events WHERE hotel_id = $1 AND user_id = $2 ORDER BY created_at",
    )
    .bind(hotel_id)
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert!(audit_actions
        .iter()
        .any(|action| action.starts_with("LATE_ARRIVAL booking=")));
    assert!(audit_actions
        .iter()
        .any(|action| action.starts_with("CANCEL booking=")));
    assert!(audit_actions
        .iter()
        .any(|action| action.starts_with("NO_SHOW booking=")));
}
