use hms_backend::application::maintenance_service::MaintenanceService;
use hms_backend::application::room_service::RoomService;
use hms_backend::domain::errors::DomainError;
use hms_backend::domain::models::{MaintenanceCaseStatus, MaintenancePriority, RoomStatus};
use hms_backend::domain::repositories::{MaintenanceCaseRepository, RoomRepository};
use hms_backend::infrastructure::repository::{
    postgres::PostgresRoomRepository, postgres_maintenance_case::PostgresMaintenanceCaseRepository,
};
use std::sync::Arc;
use uuid::Uuid;

#[sqlx::test]
async fn maintenance_case_is_transactional_owned_and_returns_through_dirty(pool: sqlx::PgPool) {
    let hotel_id = Uuid::new_v4();
    let other_hotel_id = Uuid::new_v4();
    let actor_user_id = Uuid::new_v4();
    let room_id = Uuid::new_v4();
    let legacy_room_id = Uuid::new_v4();
    for (id, name) in [
        (hotel_id, "Hotel Maintenance QA"),
        (other_hotel_id, "Other Maintenance QA"),
    ] {
        sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, 'N/A')")
            .bind(id)
            .bind(name)
            .execute(&pool)
            .await
            .unwrap();
    }
    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role)
         VALUES ($1, $2, 'maintenance_ops', 'hash', 'ops')",
    )
    .bind(actor_user_id)
    .bind(hotel_id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents)
         VALUES ($1, $2, 'M-102', 'Standard', 'MAINTENANCE', 10000)",
    )
    .bind(legacy_room_id)
    .bind(hotel_id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents)
         VALUES ($1, $2, 'M-101', 'Standard', 'DIRTY', 10000)",
    )
    .bind(room_id)
    .bind(hotel_id)
    .execute(&pool)
    .await
    .unwrap();

    let repository = Arc::new(PostgresMaintenanceCaseRepository::new(pool.clone()))
        as Arc<dyn MaintenanceCaseRepository>;
    let service = MaintenanceService::new(repository);
    let room_repository =
        Arc::new(PostgresRoomRepository::new(pool.clone())) as Arc<dyn RoomRepository>;
    let room_service = RoomService::new(room_repository);

    let opened = service
        .open(
            hotel_id,
            room_id,
            actor_user_id,
            MaintenancePriority::Urgent,
            "Perdida activa de agua en el baño".to_string(),
            "Equipo tecnico turno tarde".to_string(),
        )
        .await
        .unwrap();
    assert_eq!(opened.status, MaintenanceCaseStatus::Open);
    assert_eq!(opened.priority, MaintenancePriority::Urgent);
    assert_eq!(opened.reported_by_user_id, Some(actor_user_id));
    assert_eq!(opened.assigned_to, "Equipo tecnico turno tarde");
    let room_status: String =
        sqlx::query_scalar("SELECT status FROM rooms WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(room_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(room_status, "MAINTENANCE");

    let duplicate = service
        .open(
            hotel_id,
            room_id,
            actor_user_id,
            MaintenancePriority::High,
            "Segundo reporte sobre la misma habitacion".to_string(),
            "ops".to_string(),
        )
        .await;
    assert!(matches!(
        duplicate,
        Err(DomainError::InvalidRoomStatusTransition)
    ));

    let bypass = room_service
        .update_room_status(hotel_id, room_id, RoomStatus::Available)
        .await;
    assert!(matches!(bypass, Err(DomainError::InvalidInput(_))));

    let cross_tenant = service
        .resolve(
            other_hotel_id,
            room_id,
            actor_user_id,
            "Intento desde otro tenant".to_string(),
        )
        .await;
    assert!(matches!(cross_tenant, Err(DomainError::RoomNotFound)));

    let resolved = service
        .resolve(
            hotel_id,
            room_id,
            actor_user_id,
            "Se reemplazo la conexion y no quedan perdidas".to_string(),
        )
        .await
        .unwrap();
    assert_eq!(resolved.status, MaintenanceCaseStatus::Resolved);
    assert_eq!(resolved.return_status, Some(RoomStatus::Dirty));
    assert_eq!(resolved.resolved_by_user_id, Some(actor_user_id));
    assert!(service.list_open(hotel_id).await.unwrap().is_empty());

    let room_status: String =
        sqlx::query_scalar("SELECT status FROM rooms WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(room_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(room_status, "DIRTY");
    let actions: Vec<String> = sqlx::query_scalar(
        "SELECT action FROM audit_events WHERE hotel_id = $1 AND user_id = $2 ORDER BY created_at",
    )
    .bind(hotel_id)
    .bind(actor_user_id)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert!(actions
        .iter()
        .any(|action| action.starts_with("MAINT_OPEN")));
    assert!(actions
        .iter()
        .any(|action| action.starts_with("MAINT_RESOLVE")));

    let recovered = service
        .resolve(
            hotel_id,
            legacy_room_id,
            actor_user_id,
            "Incidencia heredada revisada y resuelta".to_string(),
        )
        .await
        .unwrap();
    assert_eq!(recovered.status, MaintenanceCaseStatus::Resolved);
    assert_eq!(recovered.reason, "Incidencia legacy sin caso de apertura");
    assert_eq!(recovered.reported_by_user_id, Some(actor_user_id));
    assert_eq!(recovered.return_status, Some(RoomStatus::Dirty));
    let legacy_room_status: String =
        sqlx::query_scalar("SELECT status FROM rooms WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(legacy_room_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(legacy_room_status, "DIRTY");
}
