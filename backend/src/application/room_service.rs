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
        hotel_id: Uuid,
        room_number: String,
        room_type: String,
        price_cents: i64,
    ) -> Result<Room, DomainError> {
        // Validación de unicidad por hotel
        if self
            .room_repo
            .find_by_room_number(hotel_id, &room_number)
            .await
            .map_err(DomainError::InfrastructureError)?
            .is_some()
        {
            return Err(DomainError::RoomAlreadyExists);
        }

        let room = Room {
            id: Uuid::new_v4(),
            hotel_id,
            room_number,
            room_type,
            status: RoomStatus::Available,
            price_cents,
        };

        self.room_repo
            .create(room)
            .await
            .map_err(map_room_repo_error)
    }

    pub async fn list_rooms(&self, hotel_id: Uuid) -> Result<Vec<Room>, DomainError> {
        self.room_repo
            .find_all(hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn find_available_rooms(
        &self,
        hotel_id: Uuid,
        start: chrono::NaiveDate,
        end: chrono::NaiveDate,
    ) -> Result<Vec<Room>, DomainError> {
        self.room_repo
            .find_available(hotel_id, start, end)
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn update_room_status(
        &self,
        hotel_id: Uuid,
        id: Uuid,
        status: RoomStatus,
    ) -> Result<(), DomainError> {
        let room = self
            .room_repo
            .find_by_id(hotel_id, id)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::RoomNotFound)?;

        if !room.status.can_transition_to(&status) {
            return Err(DomainError::InvalidRoomStatusTransition);
        }

        self.room_repo
            .update_status(hotel_id, id, status)
            .await
            .map_err(map_room_repo_error)
    }

    pub async fn mark_as_dirty(&self, hotel_id: Uuid, id: Uuid) -> Result<(), DomainError> {
        self.update_room_status(hotel_id, id, RoomStatus::Dirty)
            .await
    }

    pub async fn mark_as_occupied(&self, hotel_id: Uuid, id: Uuid) -> Result<(), DomainError> {
        self.update_room_status(hotel_id, id, RoomStatus::Occupied)
            .await
    }

    pub async fn mark_as_available(&self, hotel_id: Uuid, id: Uuid) -> Result<(), DomainError> {
        self.update_room_status(hotel_id, id, RoomStatus::Available)
            .await
    }

    pub async fn mark_as_maintenance(&self, hotel_id: Uuid, id: Uuid) -> Result<(), DomainError> {
        self.update_room_status(hotel_id, id, RoomStatus::Maintenance)
            .await
    }
}

fn map_room_repo_error(message: String) -> DomainError {
    if message == "ROOM_ALREADY_EXISTS" {
        return DomainError::RoomAlreadyExists;
    }
    if message == "ROOM_HOTEL_NOT_FOUND" {
        return DomainError::HotelNotFound;
    }

    let normalized = message.to_lowercase();
    if normalized.contains("duplicate key value")
        || normalized.contains("ux_rooms_hotel_room_number")
        || normalized.contains("rooms_room_number_key")
    {
        DomainError::RoomAlreadyExists
    } else if message == "ROOM_NOT_FOUND" {
        DomainError::RoomNotFound
    } else if normalized.contains("23503")
        && (normalized.contains("rooms_hotel_id_fkey")
            || normalized.contains("foreign key constraint"))
    {
        DomainError::HotelNotFound
    } else {
        DomainError::InfrastructureError(message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_room_repo_error_maps_hotel_fk_violation() {
        let error = "ROOM_HOTEL_NOT_FOUND";
        assert!(matches!(
            map_room_repo_error(error.to_string()),
            DomainError::HotelNotFound
        ));
    }

    #[test]
    fn map_room_repo_error_maps_room_not_found_marker() {
        assert!(matches!(
            map_room_repo_error("ROOM_NOT_FOUND".to_string()),
            DomainError::RoomNotFound
        ));
    }
}
