use std::sync::Arc;
use uuid::Uuid;
use crate::config::AppConfig;
use crate::domain::models::{Room, RoomStatus, User};
use crate::domain::repositories::{RoomRepository, UserRepository};
use crate::infrastructure::web::passwords::hash_password;

pub const DEFAULT_HOTEL_ID: &str = "00000000-0000-0000-0000-000000000001";

pub async fn bootstrap_admin_user(config: &AppConfig, user_repo: Arc<dyn UserRepository>) {
    // If admin already exists, skip
    if let Ok(Some(_)) = user_repo.find_by_username(&config.admin_user).await {
        return;
    }

    let hash = match hash_password(&config.admin_password) {
        Ok(value) => value,
        Err(_) => return,
    };

    let hotel_id = Uuid::parse_str(DEFAULT_HOTEL_ID).unwrap();

    let _ = user_repo
        .create(User {
            id: Uuid::new_v4(),
            hotel_id,
            username: config.admin_user.clone(),
            password_hash: hash,
            role: config.admin_role.clone(),
        })
        .await;
    tracing::info!("Admin user bootstrapped");
}

pub async fn seed_rooms_if_empty(room_repo: Arc<dyn RoomRepository>) {
    let hotel_id = Uuid::parse_str(DEFAULT_HOTEL_ID).unwrap();
    if let Ok(rooms) = room_repo.find_all(hotel_id).await {
        if !rooms.is_empty() {
            tracing::info!("Habitaciones ya existen, saltando seed.");
            return;
        }
    }

    tracing::info!("Seeding initial rooms...");
    let rooms = vec![
        ("101", "SINGLE", 5000),
        ("102", "SINGLE", 5000),
        ("103", "DOUBLE", 8000),
        ("104", "DOUBLE", 8000),
        ("201", "SUITE", 15000),
        ("202", "SUITE", 15000),
        ("301", "DELUXE", 25000),
    ];

    for (num, rtype, price) in rooms {
        let room = Room {
            id: Uuid::new_v4(),
            hotel_id,
            room_number: num.to_string(),
            room_type: rtype.to_string(),
            status: RoomStatus::Available,
            price_cents: price,
        };
        if let Err(e) = room_repo.create(room).await {
            tracing::error!("Error creating seed room {}: {}", num, e);
        }
    }
    tracing::info!("Seed complete.");
}
