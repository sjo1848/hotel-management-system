use chrono::NaiveDate;
use hms_backend::application::audit_service::AuditService;
use hms_backend::application::billing_service::BillingService;
use hms_backend::application::booking_service::BookingService;
use hms_backend::application::booking_transaction_service::BookingTransactionService;
use hms_backend::application::cash_closure_service::CashClosureService;
use hms_backend::application::housekeeping_service::HousekeepingService;
use hms_backend::application::maintenance_service::MaintenanceService;
use hms_backend::application::room_hold_service::RoomHoldService;
use hms_backend::application::room_service::RoomService;
use hms_backend::domain::models::{
    BookingOperationalUpdate, BookingStatus, PaymentMethod, RoomStatus,
};
use hms_backend::domain::repositories::{
    AuditRepository, BookingRepository, BookingTransactionRepository, CashClosureRepository,
    ExtraChargeRepository, GuestRepository, InvoiceRepository, MaintenanceCaseRepository,
    PaymentEntryRepository, RoomHoldRepository, RoomRepository,
};
use hms_backend::infrastructure::repository::{
    postgres::PostgresRoomRepository, postgres_audit::PostgresAuditRepository,
    postgres_booking::PostgresBookingRepository,
    postgres_booking_transaction::PostgresBookingTransactionRepository,
    postgres_cash_closure::PostgresCashClosureRepository,
    postgres_extra_charge::PostgresExtraChargeRepository, postgres_guest::PostgresGuestRepository,
    postgres_invoice::PostgresInvoiceRepository,
    postgres_maintenance_case::PostgresMaintenanceCaseRepository,
    postgres_payment_entry::PostgresPaymentEntryRepository,
    postgres_room_hold::PostgresRoomHoldRepository,
};
use std::sync::Arc;
use uuid::Uuid;

#[sqlx::test]
async fn full_operational_cycle(pool: sqlx::PgPool) {
    // 1. Setup Dependencies
    let room_repo = Arc::new(PostgresRoomRepository::new(pool.clone())) as Arc<dyn RoomRepository>;
    let booking_repo =
        Arc::new(PostgresBookingRepository::new(pool.clone())) as Arc<dyn BookingRepository>;
    let audit_repo =
        Arc::new(PostgresAuditRepository::new(pool.clone())) as Arc<dyn AuditRepository>;
    let guest_repo =
        Arc::new(PostgresGuestRepository::new(pool.clone())) as Arc<dyn GuestRepository>;
    let invoice_repo =
        Arc::new(PostgresInvoiceRepository::new(pool.clone())) as Arc<dyn InvoiceRepository>;
    let payment_entry_repo = Arc::new(PostgresPaymentEntryRepository::new(pool.clone()))
        as Arc<dyn PaymentEntryRepository>;
    let extra_charge_repo = Arc::new(PostgresExtraChargeRepository::new(pool.clone()))
        as Arc<dyn ExtraChargeRepository>;
    let cash_closure_repo = Arc::new(PostgresCashClosureRepository::new(pool.clone()))
        as Arc<dyn CashClosureRepository>;
    let room_hold_repo =
        Arc::new(PostgresRoomHoldRepository::new(pool.clone())) as Arc<dyn RoomHoldRepository>;

    let audit_service = Arc::new(AuditService::new(audit_repo));
    let room_service = Arc::new(RoomService::new(room_repo.clone()));
    let room_hold_service = Arc::new(RoomHoldService::new(
        room_hold_repo.clone(),
        room_repo.clone(),
    ));
    let booking_service = BookingService::new(
        booking_repo.clone(),
        room_repo.clone(),
        guest_repo,
        room_service.clone(),
        room_hold_service.clone(),
        audit_service.clone(),
        invoice_repo.clone(),
    );
    let booking_transaction_repo = Arc::new(PostgresBookingTransactionRepository::new(pool.clone()))
        as Arc<dyn BookingTransactionRepository>;
    let booking_transaction_service = BookingTransactionService::new(booking_transaction_repo);
    let billing_service = BillingService::new(
        extra_charge_repo,
        booking_repo.clone(),
        invoice_repo.clone(),
        payment_entry_repo.clone(),
    );
    let cash_closure_service =
        CashClosureService::new(cash_closure_repo, invoice_repo.clone(), payment_entry_repo);
    let housekeeping_service = HousekeepingService::new(
        room_repo.clone(),
        booking_repo.clone(),
        room_service.clone(),
        audit_service,
        Arc::new(MaintenanceService::new(
            Arc::new(PostgresMaintenanceCaseRepository::new(pool.clone()))
                as Arc<dyn MaintenanceCaseRepository>,
        )),
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
    let room = room_service
        .create_room(hotel_id, "505".to_string(), "Penthouse".to_string(), 50000)
        .await
        .unwrap();
    assert_eq!(room.status, RoomStatus::Available);

    // 3. Create Booking
    let check_in = NaiveDate::from_ymd_opt(2026, 3, 1).unwrap();
    let check_out = NaiveDate::from_ymd_opt(2026, 3, 5).unwrap();
    let booking = booking_service
        .execute(
            hotel_id,
            room.id,
            None,
            "John Doe".to_string(),
            check_in,
            check_out,
        )
        .await
        .unwrap();
    assert_eq!(booking.status, BookingStatus::Confirmed);

    // 4. Check-in (Status: Available -> Occupied)
    let booking = booking_transaction_service
        .update_booking_transactional(
            hotel_id,
            booking.id,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::CheckedIn),
            None,
            Some(BookingOperationalUpdate {
                check_in_guests_count: Some(1),
                check_in_document_verified: Some(true),
                check_in_contact_confirmed: Some(true),
                check_in_stay_confirmed: Some(true),
                ..BookingOperationalUpdate::default()
            }),
        )
        .await
        .unwrap();

    let room_after_checkin = room_repo
        .find_by_id(hotel_id, room.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(room_after_checkin.status, RoomStatus::Occupied);

    // 5. Settle payment before checkout.
    let settled_invoice = billing_service
        .settle_booking_payment(
            hotel_id,
            booking.id,
            PaymentMethod::Card,
            Some("pos-qa-001".to_string()),
        )
        .await
        .unwrap();
    assert_eq!(
        settled_invoice.status,
        hms_backend::domain::models::InvoiceStatus::Paid
    );
    assert_eq!(settled_invoice.payment_method, PaymentMethod::Card);
    assert!(settled_invoice.paid_at.is_some());

    // 6. Check-out (Status: Occupied -> Dirty)
    let _ = booking_transaction_service
        .update_booking_transactional(
            hotel_id,
            booking.id,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(BookingStatus::CheckedOut),
            None,
            Some(BookingOperationalUpdate {
                check_out_payment_policy: Some("settled".to_string()),
                check_out_charges_reviewed: Some(true),
                check_out_room_release_confirmed: Some(true),
                check_out_housekeeping_handoff: Some(true),
                ..BookingOperationalUpdate::default()
            }),
        )
        .await
        .unwrap();

    let room_after_checkout = room_repo
        .find_by_id(hotel_id, room.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(room_after_checkout.status, RoomStatus::Dirty);

    // 7. Verify Invoice exists and cash balance reflects the real payment.
    let invoice = invoice_repo
        .find_by_booking(hotel_id, booking.id)
        .await
        .unwrap();
    assert!(invoice.is_some());
    assert_eq!(invoice.unwrap().amount_cents, 4 * 50000); // 4 nights

    let balance = cash_closure_service
        .get_current_balance(hotel_id)
        .await
        .unwrap();
    assert_eq!(balance.total_amount_cents, 4 * 50000);
    assert_eq!(balance.cash_amount_cents, 0);
    assert_eq!(balance.card_amount_cents, 4 * 50000);

    // 8. Housekeeping: Start Cleaning (Dirty -> Cleaning)
    housekeeping_service
        .start_cleaning(hotel_id, room.id)
        .await
        .unwrap();
    let room_cleaning = room_repo
        .find_by_id(hotel_id, room.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(room_cleaning.status, RoomStatus::Cleaning);

    // 9. Housekeeping: Finish Cleaning (Cleaning -> Available)
    housekeeping_service
        .finish_cleaning(hotel_id, room.id)
        .await
        .unwrap();
    let room_available = room_repo
        .find_by_id(hotel_id, room.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(room_available.status, RoomStatus::Available);
}
