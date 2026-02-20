use chrono::NaiveDate;
use hms_backend::domain::repositories::{AuditRepository, GuestRepository, InvoiceRepository};
use hms_backend::infrastructure::repository::postgres_audit::PostgresAuditRepository;
use hms_backend::infrastructure::repository::postgres_guest::PostgresGuestRepository;
use hms_backend::infrastructure::repository::postgres_invoice::PostgresInvoiceRepository;
use uuid::Uuid;

#[sqlx::test]
async fn guest_keyset_pagination_is_deterministic(pool: sqlx::PgPool) {
    let repo = PostgresGuestRepository::new(pool.clone());
    let hotel_id = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel QA Guests Page")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    for idx in 0..3 {
        sqlx::query(
            "INSERT INTO guests (id, hotel_id, full_name, email, phone, created_at)
             VALUES ($1, $2, $3, $4, $5, $6::timestamptz)",
        )
        .bind(Uuid::new_v4())
        .bind(hotel_id)
        .bind(format!("Guest {idx}"))
        .bind(format!("guest{idx}@qa.test"))
        .bind("111")
        .bind(format!("2026-02-0{}T10:00:00Z", 3 - idx))
        .execute(&pool)
        .await
        .unwrap();
    }

    let page_1 = repo.find_page(hotel_id, 2, None).await.unwrap();
    assert_eq!(page_1.items.len(), 2);
    assert!(page_1.has_more);
    assert!(page_1.next_cursor.is_some());

    let page_2 = repo
        .find_page(hotel_id, 2, page_1.next_cursor)
        .await
        .unwrap();
    assert_eq!(page_2.items.len(), 1);
    assert!(!page_2.has_more);
}

#[sqlx::test]
async fn invoice_keyset_pagination_is_deterministic(pool: sqlx::PgPool) {
    let repo = PostgresInvoiceRepository::new(pool.clone());
    let hotel_id = Uuid::new_v4();
    let room_id = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel QA Invoices Page")
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
    .bind("I101")
    .bind("Suite")
    .bind(12000_i64)
    .execute(&pool)
    .await
    .unwrap();

    for idx in 0..3 {
        let booking_id = Uuid::new_v4();
        let check_in = NaiveDate::from_ymd_opt(2026, 2, 1 + (idx * 3) as u32).unwrap();
        let check_out = check_in + chrono::Duration::days(2);

        sqlx::query(
            "INSERT INTO bookings (id, hotel_id, room_id, guest_name, check_in, check_out, total_price_cents, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'CHECKED_OUT', NOW())",
        )
        .bind(booking_id)
        .bind(hotel_id)
        .bind(room_id)
        .bind(format!("Inv Guest {idx}"))
        .bind(check_in)
        .bind(check_out)
        .bind(22000_i64)
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO invoices (id, hotel_id, booking_id, amount_cents, status, payment_method, created_at)
             VALUES ($1, $2, $3, $4, 'PAID', 'CARD', $5::timestamp)",
        )
        .bind(Uuid::new_v4())
        .bind(hotel_id)
        .bind(booking_id)
        .bind(22000_i64)
        .bind(format!("2026-02-0{} 12:00:00", 3 - idx))
        .execute(&pool)
        .await
        .unwrap();
    }

    let page_1 = repo.find_page(hotel_id, 2, None).await.unwrap();
    assert_eq!(page_1.items.len(), 2);
    assert!(page_1.has_more);
    assert!(page_1.next_cursor.is_some());

    let page_2 = repo
        .find_page(hotel_id, 2, page_1.next_cursor)
        .await
        .unwrap();
    assert_eq!(page_2.items.len(), 1);
    assert!(!page_2.has_more);
}

#[sqlx::test]
async fn audit_events_keyset_pagination_is_deterministic(pool: sqlx::PgPool) {
    let repo = PostgresAuditRepository::new(pool.clone());
    let hotel_id = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel QA Audit Page")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    for idx in 0..3 {
        sqlx::query(
            "INSERT INTO audit_events (id, hotel_id, user_id, action, ip_address, created_at)
             VALUES ($1, $2, NULL, $3, '127.0.0.1', $4::timestamptz)",
        )
        .bind(Uuid::new_v4())
        .bind(hotel_id)
        .bind(format!("audit.action.{idx}"))
        .bind(format!("2026-02-0{}T14:00:00Z", 3 - idx))
        .execute(&pool)
        .await
        .unwrap();
    }

    let page_1 = repo
        .find_recent_page_by_hotel(hotel_id, 2, None)
        .await
        .unwrap();
    assert_eq!(page_1.items.len(), 2);
    assert!(page_1.has_more);
    assert!(page_1.next_cursor.is_some());

    let page_2 = repo
        .find_recent_page_by_hotel(hotel_id, 2, page_1.next_cursor)
        .await
        .unwrap();
    assert_eq!(page_2.items.len(), 1);
    assert!(!page_2.has_more);
}
