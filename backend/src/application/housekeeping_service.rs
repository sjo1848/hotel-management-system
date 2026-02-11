use crate::domain::errors::DomainError;
use crate::domain::models::{Room, RoomStatus};
use crate::domain::repositories::{RoomRepository, AuditRepository};
use std::sync::Arc;
use uuid::Uuid;

pub struct HousekeepingService {
    room_repo: Arc<dyn RoomRepository>,
    audit_repo: Arc<dyn AuditRepository>,
}

impl HousekeepingService {
    pub fn new(
        room_repo: Arc<dyn RoomRepository>,
        audit_repo: Arc<dyn AuditRepository>,
    ) -> Self {
        Self {
            room_repo,
            audit_repo,
        }
    }

    pub async fn list_dirty_rooms(&self) -> Result<Vec<Room>, DomainError> {
        let rooms = self.room_repo.find_all().await
            .map_err(DomainError::InfrastructureError)?;
        
        Ok(rooms.into_iter()
            .filter(|r| matches!(r.status, RoomStatus::Dirty | RoomStatus::Cleaning))
            .collect())
    }

    pub async fn start_cleaning(&self, room_id: Uuid) -> Result<(), DomainError> {
        self.room_repo.update_status(room_id, RoomStatus::Cleaning).await
            .map_err(DomainError::InfrastructureError)?;
        
        self.record_audit(None, &format!("Cleaning started for room {}", room_id)).await;
        Ok(())
    }

    pub async fn finish_cleaning(&self, room_id: Uuid) -> Result<(), DomainError> {
        self.room_repo.update_status(room_id, RoomStatus::Available).await
            .map_err(DomainError::InfrastructureError)?;
        
        self.record_audit(None, &format!("Cleaning finished for room {}", room_id)).await;
        Ok(())
    }

    async fn record_audit(&self, user_id: Option<Uuid>, action: &str) {
        let event = crate::domain::models::AuditEvent {
            id: Uuid::new_v4(),
            user_id,
            action: action.to_string(),
            ip_address: None,
            created_at: chrono::Utc::now().naive_utc(),
        };
        let _ = self.audit_repo.record(event).await;
    }
}
