use hms_backend::application::room_service::RoomService;
use hms_backend::domain::repositories::RoomRepository;
use hms_backend::infrastructure::repository::postgres::PostgresRoomRepository;
use uuid::Uuid;

#[sqlx::test]
async fn room_service_creates_room(pool: sqlx::PgPool) {
    let room_repo = PostgresRoomRepository::new(pool.clone());
    let service = RoomService::new(
        std::sync::Arc::new(room_repo) as std::sync::Arc<dyn RoomRepository>,
    );

    let room_number = "101".to_string();
    let room_type = "Deluxe".to_string();
    let price_cents = 15000;

    // This should fail to compile because create_room is not implemented
    let room = service
        .create_room(room_number.clone(), room_type.clone(), price_cents)
        .await
        .unwrap();

    assert_eq!(room.room_number, room_number);
    assert_eq!(room.room_type, room_type);
    assert_eq!(room.price_cents, price_cents);
    
    // Verify it exists in DB
    let found = service.room_repo.find_by_id(room.id).await.unwrap().unwrap();
    assert_eq!(found.room_number, room_number);
}

#[sqlx::test]
async fn room_service_enforces_transitions(pool: sqlx::PgPool) {
    let room_repo = PostgresRoomRepository::new(pool.clone());
    let service = RoomService::new(
        std::sync::Arc::new(room_repo) as std::sync::Arc<dyn RoomRepository>,
    );

    let room = service
        .create_room("202".to_string(), "Standard".to_string(), 10000)
        .await
        .unwrap();

    // Available -> Occupied: OK
    service.update_room_status(room.id, hms_backend::domain::models::RoomStatus::Occupied).await.unwrap();

    // Occupied -> Available: FAIL (must be Dirty first)
    let result = service.update_room_status(room.id, hms_backend::domain::models::RoomStatus::Available).await;
    assert!(result.is_err());
    
    // Occupied -> Dirty: OK
    service.update_room_status(room.id, hms_backend::domain::models::RoomStatus::Dirty).await.unwrap();
}
