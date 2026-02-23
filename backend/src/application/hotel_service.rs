use crate::domain::errors::DomainError;
use crate::domain::models::{Hotel, TenantFeatureFlags};
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

    pub async fn get_feature_flags(
        &self,
        hotel_id: Uuid,
    ) -> Result<TenantFeatureFlags, DomainError> {
        let plan_tier = self
            .hotel_repo
            .find_plan_tier(hotel_id)
            .await
            .map_err(map_hotel_repo_error)?;
        Ok(build_feature_flags(hotel_id, &plan_tier))
    }

    pub async fn update_plan_tier(
        &self,
        hotel_id: Uuid,
        plan_tier: String,
    ) -> Result<TenantFeatureFlags, DomainError> {
        let normalized = normalize_plan_tier(&plan_tier).ok_or_else(|| {
            DomainError::InvalidInput(
                "Plan inválido. Valores permitidos: BASIC, PRO, ENTERPRISE".to_string(),
            )
        })?;

        self.hotel_repo
            .update_plan_tier(hotel_id, &normalized)
            .await
            .map_err(map_hotel_repo_error)?;

        self.get_feature_flags(hotel_id).await
    }
}

fn map_hotel_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "HOTEL_ALREADY_EXISTS" => DomainError::HotelAlreadyExists,
        "HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
        "PLAN_TIER_INVALID" => DomainError::InvalidInput(
            "Plan inválido. Valores permitidos: BASIC, PRO, ENTERPRISE".to_string(),
        ),
        _ => DomainError::InfrastructureError(message),
    }
}

fn normalize_plan_tier(value: &str) -> Option<String> {
    let normalized = value.trim().to_uppercase();
    match normalized.as_str() {
        "BASIC" | "PRO" | "ENTERPRISE" => Some(normalized),
        _ => None,
    }
}

fn build_feature_flags(hotel_id: Uuid, plan_tier: &str) -> TenantFeatureFlags {
    match plan_tier {
        "BASIC" => TenantFeatureFlags {
            hotel_id,
            plan_tier: "BASIC".to_string(),
            automation_alerts_enabled: true,
            pricing_assistant_enabled: false,
            hq_benchmark_enabled: false,
            advanced_analytics_enabled: false,
        },
        "ENTERPRISE" => TenantFeatureFlags {
            hotel_id,
            plan_tier: "ENTERPRISE".to_string(),
            automation_alerts_enabled: true,
            pricing_assistant_enabled: true,
            hq_benchmark_enabled: true,
            advanced_analytics_enabled: true,
        },
        _ => TenantFeatureFlags {
            hotel_id,
            plan_tier: "PRO".to_string(),
            automation_alerts_enabled: true,
            pricing_assistant_enabled: true,
            hq_benchmark_enabled: true,
            advanced_analytics_enabled: false,
        },
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
