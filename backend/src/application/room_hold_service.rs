use crate::domain::errors::DomainError;
use crate::domain::models::{RoomHold, RoomHoldBoardEntry, RoomHoldType};
use crate::domain::repositories::{RoomHoldRepository, RoomRepository};
use chrono::NaiveDate;
use std::sync::Arc;
use uuid::Uuid;

pub struct RoomHoldService {
    room_hold_repo: Arc<dyn RoomHoldRepository>,
    room_repo: Arc<dyn RoomRepository>,
}

impl RoomHoldService {
    pub fn new(
        room_hold_repo: Arc<dyn RoomHoldRepository>,
        room_repo: Arc<dyn RoomRepository>,
    ) -> Self {
        Self {
            room_hold_repo,
            room_repo,
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn create_hold(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        start_date: NaiveDate,
        end_date: NaiveDate,
        hold_type: RoomHoldType,
        reason: String,
        created_by_user_id: Option<Uuid>,
    ) -> Result<RoomHold, DomainError> {
        if end_date <= start_date {
            return Err(DomainError::InvalidInput(
                "El rango del bloqueo no es valido".to_string(),
            ));
        }

        self.room_repo
            .find_by_id(hotel_id, room_id)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::RoomNotFound)?;

        let overlaps = self
            .room_hold_repo
            .overlaps(hotel_id, room_id, start_date, end_date)
            .await
            .map_err(map_hold_repo_error)?;
        if overlaps {
            return Err(DomainError::InvalidInput(
                "La habitacion ya tiene un bloqueo en ese rango".to_string(),
            ));
        }

        let hold = RoomHold {
            id: Uuid::new_v4(),
            hotel_id,
            room_id,
            start_date,
            end_date,
            hold_type,
            reason,
            created_by_user_id,
            created_at: Some(chrono::Utc::now().naive_utc()),
        };

        self.room_hold_repo
            .create(hold)
            .await
            .map_err(map_hold_repo_error)
    }

    pub async fn list_holds(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
    ) -> Result<Vec<RoomHold>, DomainError> {
        self.room_hold_repo
            .find_by_room(hotel_id, room_id)
            .await
            .map_err(map_hold_repo_error)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn update_hold(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        hold_id: Uuid,
        start_date: NaiveDate,
        end_date: NaiveDate,
        hold_type: RoomHoldType,
        reason: String,
        created_by_user_id: Option<Uuid>,
    ) -> Result<RoomHold, DomainError> {
        if end_date <= start_date {
            return Err(DomainError::InvalidInput(
                "El rango del bloqueo no es valido".to_string(),
            ));
        }

        let current_holds = self.list_holds(hotel_id, room_id).await?;
        let existing = current_holds
            .into_iter()
            .find(|hold| hold.id == hold_id)
            .ok_or_else(|| DomainError::InvalidInput("Bloqueo no encontrado".to_string()))?;

        let overlaps = self
            .room_hold_repo
            .find_by_room(hotel_id, room_id)
            .await
            .map_err(map_hold_repo_error)?
            .into_iter()
            .any(|hold| {
                hold.id != hold_id && hold.start_date < end_date && hold.end_date > start_date
            });
        if overlaps {
            return Err(DomainError::InvalidInput(
                "La habitacion ya tiene un bloqueo en ese rango".to_string(),
            ));
        }

        self.room_hold_repo
            .update(RoomHold {
                id: hold_id,
                hotel_id,
                room_id,
                start_date,
                end_date,
                hold_type,
                reason,
                created_by_user_id: created_by_user_id.or(existing.created_by_user_id),
                created_at: existing.created_at,
            })
            .await
            .map_err(map_hold_repo_error)
    }

    pub async fn list_hold_board(
        &self,
        hotel_id: Uuid,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<RoomHoldBoardEntry>, DomainError> {
        if end_date < start_date {
            return Err(DomainError::InvalidInput(
                "El rango del tablero no es valido".to_string(),
            ));
        }

        self.room_hold_repo
            .find_in_range(hotel_id, start_date, end_date)
            .await
            .map_err(map_hold_repo_error)
    }

    pub async fn delete_hold(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        hold_id: Uuid,
    ) -> Result<(), DomainError> {
        self.room_hold_repo
            .delete(hotel_id, room_id, hold_id)
            .await
            .map_err(map_hold_repo_error)
    }

    pub async fn has_hold_overlap(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<bool, DomainError> {
        self.room_hold_repo
            .overlaps(hotel_id, room_id, start_date, end_date)
            .await
            .map_err(map_hold_repo_error)
    }
}

fn map_hold_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "ROOM_NOT_FOUND" => DomainError::RoomNotFound,
        "ROOM_HOLD_NOT_FOUND" => DomainError::InvalidInput("Bloqueo no encontrado".to_string()),
        "ROOM_HOLD_INVALID_DATES" => {
            DomainError::InvalidInput("El rango del bloqueo no es valido".to_string())
        }
        "ROOM_HOLD_INVALID_TYPE" => {
            DomainError::InvalidInput("El tipo de bloqueo no es valido".to_string())
        }
        _ => DomainError::InfrastructureError(message),
    }
}
