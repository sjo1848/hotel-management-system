use crate::domain::models::DashboardKpis;
use crate::domain::repositories::BookingRepository;
use std::sync::Arc;
use uuid::Uuid;

pub struct AnalyticsService {
    booking_repo: Arc<dyn BookingRepository>,
}

impl AnalyticsService {
    pub fn new(booking_repo: Arc<dyn BookingRepository>) -> Self {
        Self { booking_repo }
    }

    pub async fn get_dashboard_kpis(&self, hotel_id: Uuid) -> Result<DashboardKpis, String> {
        self.booking_repo.get_dashboard_stats(hotel_id).await
    }
}
