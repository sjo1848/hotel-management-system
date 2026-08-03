use crate::domain::errors::DomainError;
use crate::domain::models::{BulkRoomStatusUpdateResult, Room, RoomStatus};
use crate::domain::repositories::RoomRepository;
use std::collections::HashSet;
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

    pub async fn get_room(&self, hotel_id: Uuid, id: Uuid) -> Result<Room, DomainError> {
        self.room_repo
            .find_by_id(hotel_id, id)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::RoomNotFound)
    }

    pub async fn update_room(
        &self,
        hotel_id: Uuid,
        id: Uuid,
        room_number: String,
        room_type: String,
        price_cents: i64,
    ) -> Result<Room, DomainError> {
        let mut room = self
            .room_repo
            .find_by_id(hotel_id, id)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::RoomNotFound)?;

        if room.room_number != room_number
            && self
                .room_repo
                .find_by_room_number(hotel_id, &room_number)
                .await
                .map_err(DomainError::InfrastructureError)?
                .is_some()
        {
            return Err(DomainError::RoomAlreadyExists);
        }

        room.room_number = room_number;
        room.room_type = room_type;
        room.price_cents = price_cents;

        self.room_repo
            .update(room)
            .await
            .map_err(map_room_repo_error)
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

        if room.status == RoomStatus::Maintenance || status == RoomStatus::Maintenance {
            return Err(DomainError::InvalidInput(
                "Los cambios de mantenimiento requieren el workflow de housekeeping".to_string(),
            ));
        }

        if !room.status.can_transition_to(&status) {
            return Err(DomainError::InvalidRoomStatusTransition);
        }

        self.room_repo
            .update_status(hotel_id, id, status)
            .await
            .map_err(map_room_repo_error)
    }

    pub async fn update_room_status_bulk(
        &self,
        hotel_id: Uuid,
        ids: Vec<Uuid>,
        status: RoomStatus,
    ) -> Result<BulkRoomStatusUpdateResult, DomainError> {
        let unique_ids = dedupe_ids(ids);
        if unique_ids.is_empty() {
            return Err(DomainError::InvalidInput(
                "Debes seleccionar al menos una habitacion".to_string(),
            ));
        }

        for id in &unique_ids {
            let room = self
                .room_repo
                .find_by_id(hotel_id, *id)
                .await
                .map_err(DomainError::InfrastructureError)?
                .ok_or(DomainError::RoomNotFound)?;

            if room.status == RoomStatus::Maintenance || status == RoomStatus::Maintenance {
                return Err(DomainError::InvalidInput(
                    "Los cambios de mantenimiento requieren el workflow de housekeeping"
                        .to_string(),
                ));
            }

            if !room.status.can_transition_to(&status) {
                return Err(DomainError::InvalidRoomStatusTransition);
            }
        }

        let updated_count = self
            .room_repo
            .update_status_bulk(hotel_id, &unique_ids, status.clone())
            .await
            .map_err(map_room_repo_error)?;

        Ok(BulkRoomStatusUpdateResult {
            room_ids: unique_ids,
            updated_count,
            status,
        })
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
    match message.as_str() {
        "ROOM_ALREADY_EXISTS" => DomainError::RoomAlreadyExists,
        "ROOM_NOT_FOUND" => DomainError::RoomNotFound,
        "ROOM_HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
        _ => DomainError::InfrastructureError(message),
    }
}

fn dedupe_ids(ids: Vec<Uuid>) -> Vec<Uuid> {
    let mut seen = HashSet::new();
    ids.into_iter().filter(|id| seen.insert(*id)).collect()
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
