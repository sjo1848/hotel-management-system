use chrono::NaiveDate;
use hms_backend::application::audit_service::AuditService;
use hms_backend::application::booking_service::BookingService;
use hms_backend::application::room_service::RoomService;
use hms_backend::domain::errors::DomainError;
use hms_backend::domain::repositories::{
    AuditRepository, BookingRepository, GuestRepository, InvoiceRepository, RoomRepository,
};
use hms_backend::infrastructure::repository::postgres::PostgresRoomRepository;
use hms_backend::infrastructure::repository::postgres_audit::PostgresAuditRepository;
use hms_backend::infrastructure::repository::postgres_booking::PostgresBookingRepository;
use hms_backend::infrastructure::repository::postgres_guest::PostgresGuestRepository;
use hms_backend::infrastructure::repository::postgres_invoice::PostgresInvoiceRepository;
use std::sync::Arc;
use uuid::Uuid;

#[sqlx::test]
async fn booking_flow_creates_total_price(pool: sqlx::PgPool) {
    let room_repo = Arc::new(PostgresRoomRepository::new(pool.clone())) as Arc<dyn RoomRepository>;
    let booking_repo =
        Arc::new(PostgresBookingRepository::new(pool.clone())) as Arc<dyn BookingRepository>;
    let audit_repo =
        Arc::new(PostgresAuditRepository::new(pool.clone())) as Arc<dyn AuditRepository>;
    let guest_repo =
        Arc::new(PostgresGuestRepository::new(pool.clone())) as Arc<dyn GuestRepository>;
    let invoice_repo =
        Arc::new(PostgresInvoiceRepository::new(pool.clone())) as Arc<dyn InvoiceRepository>;
    let audit_service = Arc::new(AuditService::new(audit_repo));
    let room_service = Arc::new(RoomService::new(room_repo.clone()));
    let service = BookingService::new(
        booking_repo,
        room_repo,
        guest_repo,
        room_service.clone(),
        audit_service,
        invoice_repo,
    );

    let hotel_id = Uuid::new_v4();
    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel QA Booking")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();
    let room = room_service
        .create_room(hotel_id, "A101".to_string(), "Suite".to_string(), 12000_i64)
        .await
        .unwrap();

    let booking = service
        .execute(
            hotel_id,
            room.id,
            None,
            "QA Guest".to_string(),
            NaiveDate::from_ymd_opt(2025, 2, 10).unwrap(),
            NaiveDate::from_ymd_opt(2025, 2, 12).unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(booking.total_price_cents, 24000);
}

#[sqlx::test]
async fn booking_flow_rejects_unknown_guest_id(pool: sqlx::PgPool) {
    let room_repo = Arc::new(PostgresRoomRepository::new(pool.clone())) as Arc<dyn RoomRepository>;
    let booking_repo =
        Arc::new(PostgresBookingRepository::new(pool.clone())) as Arc<dyn BookingRepository>;
    let audit_repo =
        Arc::new(PostgresAuditRepository::new(pool.clone())) as Arc<dyn AuditRepository>;
    let guest_repo =
        Arc::new(PostgresGuestRepository::new(pool.clone())) as Arc<dyn GuestRepository>;
    let invoice_repo =
        Arc::new(PostgresInvoiceRepository::new(pool.clone())) as Arc<dyn InvoiceRepository>;
    let audit_service = Arc::new(AuditService::new(audit_repo));
    let room_service = Arc::new(RoomService::new(room_repo.clone()));
    let service = BookingService::new(
        booking_repo,
        room_repo,
        guest_repo,
        room_service.clone(),
        audit_service,
        invoice_repo,
    );

    let hotel_id = Uuid::new_v4();
    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel QA Booking Guest")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    let room = room_service
        .create_room(hotel_id, "A102".to_string(), "Suite".to_string(), 12000_i64)
        .await
        .unwrap();

    let result = service
        .execute(
            hotel_id,
            room.id,
            Some(Uuid::new_v4()),
            "QA Guest".to_string(),
            NaiveDate::from_ymd_opt(2025, 2, 10).unwrap(),
            NaiveDate::from_ymd_opt(2025, 2, 12).unwrap(),
        )
        .await;

    assert!(matches!(result, Err(DomainError::GuestNotFound)));
}

#[sqlx::test]
async fn booking_flow_keyset_pagination_is_deterministic(pool: sqlx::PgPool) {
    let booking_repo = PostgresBookingRepository::new(pool.clone());

    let hotel_id = Uuid::new_v4();
    let room_id = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel QA Booking Pagination")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents)
         VALUES ($1, $2, $3, $4, 'AVAILABLE', $5)",
    )
    .bind(room_id)
    .bind(hotel_id)
    .bind("P101")
    .bind("Suite")
    .bind(10000_i64)
    .execute(&pool)
    .await
    .unwrap();

    let base_check_in = NaiveDate::from_ymd_opt(2026, 2, 10).unwrap();
    let booking_ids = [Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4()];
    let created_ats = [
        "2026-02-03T10:00:00Z",
        "2026-02-02T10:00:00Z",
        "2026-02-01T10:00:00Z",
    ];

    for (idx, booking_id) in booking_ids.iter().enumerate() {
        let check_in = base_check_in + chrono::Duration::days((idx as i64) * 3);
        let check_out = check_in + chrono::Duration::days(2);
        sqlx::query(
            "INSERT INTO bookings (id, hotel_id, room_id, guest_name, check_in, check_out, total_price_cents, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED', $8::timestamptz)",
        )
        .bind(booking_id)
        .bind(hotel_id)
        .bind(room_id)
        .bind(format!("Guest {}", idx + 1))
        .bind(check_in)
        .bind(check_out)
        .bind(20000_i64)
        .bind(created_ats[idx])
        .execute(&pool)
        .await
        .unwrap();
    }

    let page_1 = booking_repo
        .find_page(hotel_id, None, None, 2, None)
        .await
        .unwrap();
    assert_eq!(page_1.items.len(), 2);
    assert!(page_1.has_more);
    assert!(page_1.next_cursor.is_some());
    assert_eq!(page_1.items[0].id, booking_ids[0]);
    assert_eq!(page_1.items[1].id, booking_ids[1]);

    let page_2 = booking_repo
        .find_page(hotel_id, None, None, 2, page_1.next_cursor)
        .await
        .unwrap();
    assert_eq!(page_2.items.len(), 1);
    assert!(!page_2.has_more);
    assert!(page_2.next_cursor.is_none());
    assert_eq!(page_2.items[0].id, booking_ids[2]);
}
