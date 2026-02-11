use hms_backend::application::booking_service::BookingService;
use hms_backend::domain::repositories::{BookingRepository, RoomRepository};
use hms_backend::infrastructure::repository::postgres::PostgresRoomRepository;
use hms_backend::infrastructure::repository::postgres_booking::PostgresBookingRepository;
use chrono::NaiveDate;
use uuid::Uuid;

#[sqlx::test]
async fn booking_flow_creates_total_price(pool: sqlx::PgPool) {
    let room_repo = PostgresRoomRepository::new(pool.clone());
    let booking_repo = PostgresBookingRepository::new(pool.clone());
    let service = BookingService::new(
        std::sync::Arc::new(booking_repo) as std::sync::Arc<dyn BookingRepository>,
        std::sync::Arc::new(room_repo) as std::sync::Arc<dyn RoomRepository>,
    );

    let room_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO rooms (id, room_number, room_type, status, price_cents)
         VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(room_id)
    .bind("A101")
    .bind("Suite")
    .bind("AVAILABLE")
    .bind(12000_i64)
    .execute(&pool)
    .await
    .unwrap();

    let booking = service
        .execute(
            room_id,
            "QA Guest".to_string(),
            NaiveDate::from_ymd_opt(2025, 2, 10).unwrap(),
            NaiveDate::from_ymd_opt(2025, 2, 12).unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(booking.total_price_cents, 24000);
}
