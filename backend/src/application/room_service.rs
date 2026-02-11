use crate::domain::errors::DomainError;
use crate::domain::models::RoomStatus;
use crate::domain::repositories::RoomRepository;
use std::sync::Arc;
use uuid::Uuid;

pub struct RoomService {
    room_repo: Arc<dyn RoomRepository>,
}

impl RoomService {
    pub fn new(room_repo: Arc<dyn RoomRepository>) -> Self {
        Self { room_repo }
    }

    pub async fn update_room_status(&self, id: Uuid, status: RoomStatus) -> Result<(), DomainError> {
        self.room_repo
            .update_status(id, status)
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn mark_as_dirty(&self, id: Uuid) -> Result<(), DomainError> {
        self.update_room_status(id, RoomStatus::Dirty).await
    }

    pub async fn mark_as_occupied(&self, id: Uuid) -> Result<(), DomainError> {
        self.update_room_status(id, RoomStatus::Occupied).await
    }

    pub async fn mark_as_available(&self, id: Uuid) -> Result<(), DomainError> {
        self.update_room_status(id, RoomStatus::Available).await
    }
}
