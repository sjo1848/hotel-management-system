use chrono::NaiveDate;
use hms_backend::application::booking_transaction_service::BookingTransactionService;
use hms_backend::domain::errors::DomainError;
use hms_backend::domain::models::BookingStatus;
use hms_backend::domain::repositories::BookingTransactionRepository;
use hms_backend::infrastructure::repository::postgres_booking_transaction::PostgresBookingTransactionRepository;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

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
    .bind("AVAILABLE")
    .bind(10_000_i64)
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
    .bind(NaiveDate::from_ymd_opt(2026, 2, 10).unwrap())
    .bind(NaiveDate::from_ymd_opt(2026, 2, 12).unwrap())
    .bind(20_000_i64)
    .bind("CONFIRMED")
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
            Some(BookingStatus::CheckedOut),
        )
        .await
        .unwrap();

    assert!(matches!(updated.status, BookingStatus::CheckedOut));

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
            Some(BookingStatus::CheckedOut),
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
