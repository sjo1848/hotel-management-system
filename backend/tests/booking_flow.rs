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
