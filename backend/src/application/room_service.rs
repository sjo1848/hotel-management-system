use crate::domain::errors::DomainError;
use crate::domain::models::{Room, RoomStatus};
use crate::domain::repositories::RoomRepository;
use std::sync::Arc;
use uuid::Uuid;

pub struct RoomService {
    pub room_repo: Arc<dyn RoomRepository>,
}

impl RoomService {
    pub fn new(room_repo: Arc<dyn RoomRepository>) -> Self {
        Self { room_repo }
    }

    pub async fn create_room(
        &self,
        room_number: String,
        room_type: String,
        price_cents: i64,
    ) -> Result<Room, DomainError> {
        // Validación de unicidad
        if self
            .room_repo
            .find_by_room_number(&room_number)
            .await
            .map_err(DomainError::InfrastructureError)?
            .is_some()
        {
            return Err(DomainError::RoomAlreadyExists);
        }

        let room = Room {
            id: Uuid::new_v4(),
            room_number,
            room_type,
            status: RoomStatus::Available,
            price_cents,
        };

        self.room_repo
            .create(room)
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn update_room_status(&self, id: Uuid, status: RoomStatus) -> Result<(), DomainError> {
        let room = self
            .room_repo
            .find_by_id(id)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::RoomNotFound)?;

        if !room.status.can_transition_to(&status) {
            return Err(DomainError::InvalidRoomStatusTransition);
        }

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

    pub async fn mark_as_maintenance(&self, id: Uuid) -> Result<(), DomainError> {
        self.update_room_status(id, RoomStatus::Maintenance).await
    }
}
