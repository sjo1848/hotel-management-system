use hms_backend::application::room_service::RoomService;
use hms_backend::application::booking_service::BookingService;
use hms_backend::application::housekeeping_service::HousekeepingService;
use hms_backend::application::audit_service::AuditService;
use hms_backend::domain::repositories::{AuditRepository, BookingRepository, GuestRepository, InvoiceRepository, RoomRepository};
use hms_backend::domain::models::{BookingStatus, RoomStatus};
use hms_backend::infrastructure::repository::{
    postgres::PostgresRoomRepository, 
    postgres_booking::PostgresBookingRepository,
    postgres_audit::PostgresAuditRepository,
    postgres_guest::PostgresGuestRepository,
    postgres_invoice::PostgresInvoiceRepository
};
use chrono::NaiveDate;
use std::sync::Arc;
use uuid::Uuid;

#[sqlx::test]
async fn full_operational_cycle(pool: sqlx::PgPool) {
    // 1. Setup Dependencies
    let room_repo = Arc::new(PostgresRoomRepository::new(pool.clone())) as Arc<dyn RoomRepository>;
    let booking_repo = Arc::new(PostgresBookingRepository::new(pool.clone())) as Arc<dyn BookingRepository>;
    let audit_repo = Arc::new(PostgresAuditRepository::new(pool.clone())) as Arc<dyn AuditRepository>;
    let guest_repo = Arc::new(PostgresGuestRepository::new(pool.clone())) as Arc<dyn GuestRepository>;
    let invoice_repo = Arc::new(PostgresInvoiceRepository::new(pool.clone())) as Arc<dyn InvoiceRepository>;

    let audit_service = Arc::new(AuditService::new(audit_repo));
    let room_service = Arc::new(RoomService::new(room_repo.clone()));
    let booking_service = BookingService::new(
        booking_repo,
        room_repo.clone(),
        guest_repo,
        room_service.clone(),
        audit_service.clone(),
        invoice_repo.clone(),
    );
    let housekeeping_service = HousekeepingService::new(
        room_repo.clone(),
        room_service.clone(),
        audit_service,
    );

    let hotel_id = Uuid::new_v4();
    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel QA Ops")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    // 2. Create Room (Catalog)
    let room = room_service.create_room(hotel_id, "505".to_string(), "Penthouse".to_string(), 50000).await.unwrap();
    assert_eq!(room.status, RoomStatus::Available);

    // 3. Create Booking
    let check_in = NaiveDate::from_ymd_opt(2026, 3, 1).unwrap();
    let check_out = NaiveDate::from_ymd_opt(2026, 3, 5).unwrap();
    let booking = booking_service.execute(
        hotel_id,
        room.id,
        None,
        "John Doe".to_string(),
        check_in,
        check_out
    ).await.unwrap();
    assert_eq!(booking.status, BookingStatus::Confirmed);

    // 4. Check-in (Status: Available -> Occupied)
    let booking = booking_service.update_booking(
        hotel_id, booking.id, None, None, None, None, Some(BookingStatus::CheckedIn)
    ).await.unwrap();
    
    let room_after_checkin = room_repo.find_by_id(hotel_id, room.id).await.unwrap().unwrap();
    assert_eq!(room_after_checkin.status, RoomStatus::Occupied);

    // 5. Check-out (Status: Occupied -> Dirty)
    let _ = booking_service.update_booking(
        hotel_id, booking.id, None, None, None, None, Some(BookingStatus::CheckedOut)
    ).await.unwrap();

    let room_after_checkout = room_repo.find_by_id(hotel_id, room.id).await.unwrap().unwrap();
    assert_eq!(room_after_checkout.status, RoomStatus::Dirty);

    // 6. Verify Invoice exists
    let invoice = invoice_repo.find_by_booking(hotel_id, booking.id).await.unwrap();
    assert!(invoice.is_some());
    assert_eq!(invoice.unwrap().amount_cents, 4 * 50000); // 4 nights

    // 7. Housekeeping: Start Cleaning (Dirty -> Cleaning)
    housekeeping_service.start_cleaning(hotel_id, room.id).await.unwrap();
    let room_cleaning = room_repo.find_by_id(hotel_id, room.id).await.unwrap().unwrap();
    assert_eq!(room_cleaning.status, RoomStatus::Cleaning);

    // 8. Housekeeping: Finish Cleaning (Cleaning -> Available)
    housekeeping_service.finish_cleaning(hotel_id, room.id).await.unwrap();
    let room_available = room_repo.find_by_id(hotel_id, room.id).await.unwrap().unwrap();
    assert_eq!(room_available.status, RoomStatus::Available);
}
