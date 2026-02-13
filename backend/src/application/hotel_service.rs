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
        result.map_err(DomainError::InfrastructureError)
    }

    pub async fn list_hotels(&self) -> Result<Vec<Hotel>, DomainError> {
        let result: Result<Vec<Hotel>, String> = self.hotel_repo.find_all().await;
        result.map_err(DomainError::InfrastructureError)
    }

    pub async fn get_hotel(&self, id: Uuid) -> Result<Hotel, DomainError> {
        let result: Result<Option<Hotel>, String> = self.hotel_repo.find_by_id(id).await;
        result
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::RoomNotFound)
    }
}
