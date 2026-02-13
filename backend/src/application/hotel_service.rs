use crate::domain::errors::DomainError;
use crate::domain::models::Hotel;
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
}

fn map_hotel_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "HOTEL_ALREADY_EXISTS" => DomainError::HotelAlreadyExists,
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
}
