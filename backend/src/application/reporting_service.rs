use crate::domain::models::DashboardKpis;
use crate::domain::repositories::BookingRepository;
use std::sync::Arc;
use uuid::Uuid;

pub struct ReportingService {
    booking_repo: Arc<dyn BookingRepository>,
}

impl ReportingService {
    pub fn new(booking_repo: Arc<dyn BookingRepository>) -> Self {
        Self { booking_repo }
    }

    pub async fn get_dashboard_summary(&self, hotel_id: Uuid) -> Result<DashboardKpis, String> {
        let mut kpis = self.booking_repo.get_dashboard_stats(hotel_id).await?;

        // Calculate ADR (Average Daily Rate)
        // Revenue / Occupied Rooms (simplified for this demo as Month Revenue / Active Bookings)
        kpis.adr_cents = if kpis.active_bookings_count > 0 {
            kpis.revenue_month_cents / kpis.active_bookings_count
        } else {
            0
        };

        // Calculate RevPAR (Revenue Per Available Room)
        // (Occupancy Rate * ADR) / 100
        kpis.rev_par_cents = ((kpis.occupancy_rate * kpis.adr_cents as f64) / 100.0) as i64;

        Ok(kpis)
    }

    pub async fn get_revenue_report(
        &self,
        hotel_id: Uuid,
        start: chrono::NaiveDate,
        end: chrono::NaiveDate,
    ) -> Result<Vec<crate::domain::models::RevenueReport>, String> {
        self.booking_repo
            .get_revenue_report(hotel_id, start, end)
            .await
    }

    pub async fn get_occupancy_report(
        &self,
        hotel_id: Uuid,
        start: chrono::NaiveDate,
        end: chrono::NaiveDate,
    ) -> Result<Vec<crate::domain::models::OccupancyReport>, String> {
        self.booking_repo
            .get_occupancy_report(hotel_id, start, end)
            .await
    }
}
