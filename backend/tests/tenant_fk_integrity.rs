use chrono::{Duration, Utc};
use uuid::Uuid;

#[sqlx::test]
async fn tenant_scoped_foreign_keys_reject_cross_hotel_relations(pool: sqlx::PgPool) {
    let hotel_a = Uuid::new_v4();
    let hotel_b = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_a)
        .bind("Hotel A")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_b)
        .bind("Hotel B")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    let room_a = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(room_a)
    .bind(hotel_a)
    .bind("A100")
    .bind("SINGLE")
    .bind("AVAILABLE")
    .bind(10000_i64)
    .execute(&pool)
    .await
    .unwrap();

    let guest_a = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO guests (id, hotel_id, full_name, email, phone) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(guest_a)
    .bind(hotel_a)
    .bind("Guest A")
    .bind(format!("guest-a-{}@example.com", Uuid::new_v4().simple()))
    .bind("123")
    .execute(&pool)
    .await
    .unwrap();

    let user_a = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(user_a)
    .bind(hotel_a)
    .bind(format!("user_a_{}", Uuid::new_v4().simple()))
    .bind("hash")
    .bind("admin")
    .execute(&pool)
    .await
    .unwrap();

    let booking_a = Uuid::new_v4();
    let today = Utc::now().date_naive();
    sqlx::query(
        "INSERT INTO bookings (id, hotel_id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(booking_a)
    .bind(hotel_a)
    .bind(room_a)
    .bind(guest_a)
    .bind("Guest A")
    .bind(today)
    .bind(today + Duration::days(1))
    .bind(10000_i64)
    .bind("CONFIRMED")
    .execute(&pool)
    .await
    .unwrap();

    let cross_booking = sqlx::query(
        "INSERT INTO bookings (id, hotel_id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_b)
    .bind(room_a)
    .bind(guest_a)
    .bind("Cross Booking")
    .bind(today + Duration::days(2))
    .bind(today + Duration::days(3))
    .bind(10000_i64)
    .bind("CONFIRMED")
    .execute(&pool)
    .await;
    assert!(cross_booking.is_err());

    let cross_refresh = sqlx::query(
        "INSERT INTO refresh_tokens (id, hotel_id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_b)
    .bind(user_a)
    .bind(format!("hash-{}", Uuid::new_v4().simple()))
    .bind((Utc::now() + Duration::days(7)).naive_utc())
    .execute(&pool)
    .await;
    assert!(cross_refresh.is_err());

    let cross_invoice = sqlx::query(
        "INSERT INTO invoices (id, hotel_id, booking_id, amount_cents, status, payment_method) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_b)
    .bind(booking_a)
    .bind(10000_i64)
    .bind("PENDING")
    .bind("CASH")
    .execute(&pool)
    .await;
    assert!(cross_invoice.is_err());

    let cross_extra_charge = sqlx::query(
        "INSERT INTO extra_charges (id, hotel_id, booking_id, description, amount_cents, category)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_b)
    .bind(booking_a)
    .bind("Minibar")
    .bind(1500_i64)
    .bind("MINIBAR")
    .execute(&pool)
    .await;
    assert!(cross_extra_charge.is_err());

    let cross_cash_closure = sqlx::query(
        "INSERT INTO cash_closures (
            id, hotel_id, user_id, total_amount_cents, cash_amount_cents, card_amount_cents, opening_time, closing_time, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_b)
    .bind(user_a)
    .bind(0_i64)
    .bind(0_i64)
    .bind(0_i64)
    .bind(Utc::now() - Duration::hours(1))
    .bind(Utc::now())
    .bind("cross-tenant should fail")
    .execute(&pool)
    .await;
    assert!(cross_cash_closure.is_err());
}
