use crate::domain::models::DashboardKpis;
use crate::domain::repositories::BookingRepository;
use std::sync::Arc;

pub struct AnalyticsService {
    booking_repo: Arc<dyn BookingRepository>,
}

impl AnalyticsService {
    pub fn new(booking_repo: Arc<dyn BookingRepository>) -> Self {
        Self { booking_repo }
    }

    pub async fn get_dashboard_kpis(&self) -> Result<DashboardKpis, String> {
        self.booking_repo.get_dashboard_stats().await
    }
}
