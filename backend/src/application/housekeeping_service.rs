use crate::domain::errors::DomainError;
use crate::domain::models::{Room, RoomStatus};
use crate::domain::repositories::RoomRepository;
use crate::application::room_service::RoomService;
use crate::application::audit_service::AuditService;
use std::sync::Arc;
use uuid::Uuid;

pub struct HousekeepingService {
    room_repo: Arc<dyn RoomRepository>,
    room_service: Arc<RoomService>,
    audit_service: Arc<AuditService>,
}

impl HousekeepingService {
    pub fn new(
        room_repo: Arc<dyn RoomRepository>,
        room_service: Arc<RoomService>,
        audit_service: Arc<AuditService>,
    ) -> Self {
        Self {
            room_repo,
            room_service,
            audit_service,
        }
    }

    pub async fn list_dirty_rooms(&self, hotel_id: Uuid) -> Result<Vec<Room>, DomainError> {
        let rooms = self.room_repo.find_all(hotel_id).await
            .map_err(DomainError::InfrastructureError)?;
        
        Ok(rooms.into_iter()
            .filter(|r| matches!(r.status, RoomStatus::Dirty | RoomStatus::Cleaning))
            .collect())
    }

    pub async fn start_cleaning(&self, hotel_id: Uuid, room_id: Uuid) -> Result<(), DomainError> {
        self.room_service.update_room_status(hotel_id, room_id, RoomStatus::Cleaning).await?;
        
        self.audit_service.record(Some(hotel_id), None, &format!("Cleaning started for room {}", room_id), None).await;
        Ok(())
    }

    pub async fn finish_cleaning(&self, hotel_id: Uuid, room_id: Uuid) -> Result<(), DomainError> {
        self.room_service.update_room_status(hotel_id, room_id, RoomStatus::Available).await?;
        
        self.audit_service.record(Some(hotel_id), None, &format!("Cleaning finished for room {}", room_id), None).await;
        Ok(())
    }
}
