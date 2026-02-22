use crate::domain::errors::DomainError;
use crate::domain::models::{Hotel, PlanTier};
use crate::domain::repositories::HotelRepository;
use std::sync::Arc;
use uuid::Uuid;

pub struct HotelService {
    hotel_repo: Arc<dyn HotelRepository>,
}

impl HotelService {
    pub fn new(hotel_repo: Arc<dyn HotelRepository>) -> Self {
        Self { hotel_repo }
    }

    pub async fn create_hotel(
        &self,
        name: String,
        address: Option<String>,
    ) -> Result<Hotel, DomainError> {
        let hotel = Hotel {
            id: Uuid::new_v4(),
            name,
            address,
            plan_tier: PlanTier::Basic,
        };

        let result: Result<Hotel, String> = self.hotel_repo.create(hotel).await;
        result.map_err(map_hotel_repo_error)
    }

    pub async fn list_hotels(&self) -> Result<Vec<Hotel>, DomainError> {
        let result: Result<Vec<Hotel>, String> = self.hotel_repo.find_all().await;
        result.map_err(DomainError::InfrastructureError)
    }

    pub async fn get_hotel(&self, id: Uuid) -> Result<Hotel, DomainError> {
        let result: Result<Option<Hotel>, String> = self.hotel_repo.find_by_id(id).await;
        result
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::HotelNotFound)
    }

    pub async fn find_hotel_id_by_name_ci(&self, name: &str) -> Result<Option<Uuid>, DomainError> {
        self.hotel_repo
            .find_by_name_ci(name)
            .await
            .map_err(DomainError::InfrastructureError)
            .map(|hotel| hotel.map(|value| value.id))
    }

    pub async fn update_hotel_plan_tier(
        &self,
        id: Uuid,
        plan_tier: PlanTier,
    ) -> Result<Hotel, DomainError> {
        self.hotel_repo
            .update_plan_tier(id, plan_tier)
            .await
            .map_err(map_hotel_repo_error)
    }
}

fn map_hotel_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "HOTEL_ALREADY_EXISTS" => DomainError::HotelAlreadyExists,
        "HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
        "INVALID_PLAN_TIER" => DomainError::InvalidInput("Plan de hotel inválido".to_string()),
        _ => DomainError::InfrastructureError(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_hotel_repo_error_maps_hotel_duplicate_marker() {
        assert!(matches!(
            map_hotel_repo_error("HOTEL_ALREADY_EXISTS".to_string()),
            DomainError::HotelAlreadyExists
        ));
    }

    #[test]
    fn map_hotel_repo_error_maps_hotel_not_found_marker() {
        assert!(matches!(
            map_hotel_repo_error("HOTEL_NOT_FOUND".to_string()),
            DomainError::HotelNotFound
        ));
    }
}
