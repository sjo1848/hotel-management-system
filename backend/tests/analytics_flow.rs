use hms_backend::domain::models::{
    Booking, BookingOperationalData, BookingStatus, Room, RoomStatus,
};
use hms_backend::domain::repositories::{BookingRepository, RoomRepository};
use hms_backend::infrastructure::repository::postgres::PostgresRoomRepository;
use hms_backend::infrastructure::repository::postgres_booking::PostgresBookingRepository;
use uuid::Uuid;

#[sqlx::test]
async fn analytics_kpis_calculation_is_accurate(pool: sqlx::PgPool) {
    let hotel_id = Uuid::new_v4();
    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel QA Analytics")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();
    let room_repo = PostgresRoomRepository::new(pool.clone());
    let booking_repo = PostgresBookingRepository::new(pool.clone());

    // 1. Setup: Create 2 rooms
    for i in 1..=2 {
        let room = Room {
            id: Uuid::new_v4(),
            hotel_id,
            room_number: format!("10{}", i),
            room_type: "SINGLE".to_string(),
            status: RoomStatus::Available,
            price_cents: 10000,
        };
        room_repo.create(room).await.unwrap();
    }

    // 2. Setup: Create 1 active booking for today
    let room1 = room_repo.find_all(hotel_id).await.unwrap()[0].clone();
    let today = chrono::Utc::now().naive_utc().date();
    let booking = Booking {
        id: Uuid::new_v4(),
        hotel_id,
        room_id: room1.id,
        guest_id: None,
        guest_name: "John Doe".to_string(),
        check_in: today,
        check_out: today + chrono::Duration::days(1),
        total_price_cents: 10000,
        status: BookingStatus::Confirmed,
        operational_data: BookingOperationalData::default(),
    };
    booking_repo.save(booking).await.unwrap();

    // 3. Act: Get Stats
    let kpis = booking_repo.get_dashboard_stats(hotel_id).await.unwrap();

    // 4. Assert
    assert_eq!(kpis.revenue_month_cents, 10000);
    assert_eq!(kpis.occupancy_rate, 50.0); // 1 occupied / 2 total
    assert_eq!(kpis.today_check_ins, 1);
    assert_eq!(kpis.active_bookings_count, 1);
}
