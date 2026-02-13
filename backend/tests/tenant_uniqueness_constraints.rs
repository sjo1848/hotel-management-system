use uuid::Uuid;

#[sqlx::test]
async fn tenant_uniqueness_allows_same_identity_across_hotels_and_rejects_within_hotel(
    pool: sqlx::PgPool,
) {
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

    // Users: same username across hotels => allowed.
    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_a)
    .bind("same_user")
    .bind("hash")
    .bind("admin")
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_b)
    .bind("same_user")
    .bind("hash")
    .bind("admin")
    .execute(&pool)
    .await
    .unwrap();

    // Users: duplicate in same hotel => rejected.
    let user_dup_same_hotel = sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_a)
    .bind("same_user")
    .bind("hash")
    .bind("admin")
    .execute(&pool)
    .await;
    assert!(user_dup_same_hotel.is_err());

    // Rooms: same room_number across hotels => allowed.
    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_a)
    .bind("101")
    .bind("SINGLE")
    .bind("AVAILABLE")
    .bind(10000_i64)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_b)
    .bind("101")
    .bind("SINGLE")
    .bind("AVAILABLE")
    .bind(10000_i64)
    .execute(&pool)
    .await
    .unwrap();

    // Rooms: duplicate in same hotel => rejected.
    let room_dup_same_hotel = sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_a)
    .bind("101")
    .bind("SINGLE")
    .bind("AVAILABLE")
    .bind(10000_i64)
    .execute(&pool)
    .await;
    assert!(room_dup_same_hotel.is_err());

    // Guests: same email across hotels => allowed.
    sqlx::query(
        "INSERT INTO guests (id, hotel_id, full_name, email, phone) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_a)
    .bind("Guest A")
    .bind("same@example.com")
    .bind("111")
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO guests (id, hotel_id, full_name, email, phone) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_b)
    .bind("Guest B")
    .bind("same@example.com")
    .bind("222")
    .execute(&pool)
    .await
    .unwrap();

    // Guests: duplicate in same hotel => rejected.
    let guest_dup_same_hotel = sqlx::query(
        "INSERT INTO guests (id, hotel_id, full_name, email, phone) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_a)
    .bind("Guest C")
    .bind("same@example.com")
    .bind("333")
    .execute(&pool)
    .await;
    assert!(guest_dup_same_hotel.is_err());
}
