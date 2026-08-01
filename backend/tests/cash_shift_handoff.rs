use chrono::{Duration, Utc};
use hms_backend::application::cash_closure_service::CashClosureService;
use hms_backend::domain::models::{CashClosure, PaymentEntry, PaymentMethod};
use hms_backend::domain::repositories::{
    CashClosureRepository, InvoiceRepository, PaymentEntryRepository,
};
use hms_backend::infrastructure::repository::{
    postgres_cash_closure::PostgresCashClosureRepository,
    postgres_invoice::PostgresInvoiceRepository,
    postgres_payment_entry::PostgresPaymentEntryRepository,
};
use std::sync::Arc;
use uuid::Uuid;

#[sqlx::test]
async fn cash_shift_records_reconciliation_handoff_and_serializes_late_payments(
    pool: sqlx::PgPool,
) {
    let hotel_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let room_id = Uuid::new_v4();
    let booking_id = Uuid::new_v4();
    let invoice_id = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name) VALUES ($1, 'Cash Shift QA')")
        .bind(hotel_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role)
         VALUES ($1, $2, 'cash-admin', 'test-only', 'ADMIN')",
    )
    .bind(user_id)
    .bind(hotel_id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, price_cents)
         VALUES ($1, $2, 'CS-01', 'Standard', 15000)",
    )
    .bind(room_id)
    .bind(hotel_id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO bookings (
            id, hotel_id, room_id, guest_name, check_in, check_out,
            total_price_cents, status
         ) VALUES ($1, $2, $3, 'Cash Guest', '2026-08-01', '2026-08-02', 15000, 'CONFIRMED')",
    )
    .bind(booking_id)
    .bind(hotel_id)
    .bind(room_id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO invoices (
            id, hotel_id, booking_id, amount_cents, paid_amount_cents, status,
            payment_method, created_at
         ) VALUES ($1, $2, $3, 15000, 15000, 'PAID', 'CASH', CURRENT_TIMESTAMP)",
    )
    .bind(invoice_id)
    .bind(hotel_id)
    .bind(booking_id)
    .execute(&pool)
    .await
    .unwrap();

    let payment_repo = Arc::new(PostgresPaymentEntryRepository::new(pool.clone()))
        as Arc<dyn PaymentEntryRepository>;
    let closure_repo = Arc::new(PostgresCashClosureRepository::new(pool.clone()))
        as Arc<dyn CashClosureRepository>;
    let invoice_repo =
        Arc::new(PostgresInvoiceRepository::new(pool.clone())) as Arc<dyn InvoiceRepository>;
    let service = CashClosureService::new(closure_repo.clone(), invoice_repo, payment_repo.clone());

    let received_at = Utc::now().naive_utc() - Duration::seconds(2);
    for (amount_cents, payment_method) in
        [(10_000, PaymentMethod::Cash), (5_000, PaymentMethod::Card)]
    {
        payment_repo
            .add(PaymentEntry {
                id: Uuid::new_v4(),
                hotel_id,
                invoice_id,
                booking_id,
                amount_cents,
                payment_method,
                payment_reference: Some("cash-shift-test".to_string()),
                note: None,
                received_by_user_id: Some(user_id),
                received_at,
            })
            .await
            .unwrap();
    }

    let closure = service
        .close_cash(
            hotel_id,
            user_id,
            Some("Se entrega POS y comprobantes completos".to_string()),
            Some(10_000),
            Some(9_800),
            Some("Turno noche · Martina".to_string()),
        )
        .await
        .unwrap();
    assert_eq!(closure.total_amount_cents, 15_000);
    assert_eq!(closure.cash_amount_cents, 10_000);
    assert_eq!(closure.card_amount_cents, 5_000);
    assert_eq!(closure.payment_count, 2);
    assert_eq!(closure.counted_cash_amount_cents, 9_800);
    assert_eq!(closure.cash_difference_cents, -200);
    assert_eq!(closure.handoff_to, "Turno noche · Martina");

    let stale = CashClosure {
        id: Uuid::new_v4(),
        closing_time: Utc::now().naive_utc(),
        ..closure.clone()
    };
    assert_eq!(
        closure_repo.create(stale).await.unwrap_err(),
        "CASH_SHIFT_ALREADY_CLOSED"
    );

    let late_payment = payment_repo
        .add(PaymentEntry {
            id: Uuid::new_v4(),
            hotel_id,
            invoice_id,
            booking_id,
            amount_cents: 700,
            payment_method: PaymentMethod::Cash,
            payment_reference: Some("late-after-close".to_string()),
            note: None,
            received_by_user_id: Some(user_id),
            received_at,
        })
        .await
        .unwrap();
    assert!(late_payment.received_at > closure.closing_time);
    let next_shift = service.get_current_balance(hotel_id).await.unwrap();
    assert_eq!(next_shift.total_amount_cents, 700);
    assert_eq!(next_shift.cash_amount_cents, 700);
    assert_eq!(next_shift.payment_count, 1);

    let stale_balance_error = service
        .close_cash(
            hotel_id,
            user_id,
            Some("Intento con balance stale".to_string()),
            Some(0),
            Some(0),
            Some("Turno manana".to_string()),
        )
        .await
        .unwrap_err();
    assert!(matches!(
        stale_balance_error,
        hms_backend::domain::errors::DomainError::InvalidInput(_)
    ));
}
