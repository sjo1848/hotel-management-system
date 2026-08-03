use crate::domain::errors::DomainError;
use crate::domain::models::{MaintenanceCase, MaintenancePriority};
use crate::domain::repositories::MaintenanceCaseRepository;
use std::sync::Arc;
use uuid::Uuid;

pub struct MaintenanceService {
    repository: Arc<dyn MaintenanceCaseRepository>,
}

impl MaintenanceService {
    pub fn new(repository: Arc<dyn MaintenanceCaseRepository>) -> Self {
        Self { repository }
    }

    pub async fn list_open(&self, hotel_id: Uuid) -> Result<Vec<MaintenanceCase>, DomainError> {
        self.repository
            .find_open_by_hotel(hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn open(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        actor_user_id: Uuid,
        priority: MaintenancePriority,
        reason: String,
        assigned_to: String,
    ) -> Result<MaintenanceCase, DomainError> {
        validate_text("motivo", &reason, 6, 250)?;
        validate_text("responsable", &assigned_to, 2, 100)?;
        self.repository
            .open_case(
                hotel_id,
                room_id,
                actor_user_id,
                priority,
                reason,
                assigned_to,
            )
            .await
    }

    pub async fn resolve(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        actor_user_id: Uuid,
        resolution_note: String,
    ) -> Result<MaintenanceCase, DomainError> {
        validate_text("resolucion", &resolution_note, 6, 250)?;
        self.repository
            .resolve_open_case(hotel_id, room_id, actor_user_id, resolution_note)
            .await
    }
}

fn validate_text(field: &str, value: &str, min: usize, max: usize) -> Result<(), DomainError> {
    let length = value.trim().chars().count();
    if !(min..=max).contains(&length) {
        return Err(DomainError::InvalidInput(format!(
            "El {field} debe tener entre {min} y {max} caracteres"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maintenance_evidence_requires_meaningful_text() {
        assert!(validate_text("motivo", "corto", 6, 250).is_err());
        assert!(validate_text("motivo", "Fuga de agua", 6, 250).is_ok());
        assert!(validate_text("responsable", "ops", 2, 100).is_ok());
    }
}
