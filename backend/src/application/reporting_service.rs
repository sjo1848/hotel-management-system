use crate::domain::errors::DomainError;
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

    pub async fn get_dashboard_summary(&self, hotel_id: Uuid) -> Result<DashboardKpis, DomainError> {
        let mut kpis = self
            .booking_repo
            .get_dashboard_stats(hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)?;
        apply_derived_kpis(&mut kpis);
        Ok(kpis)
    }

    pub async fn get_revenue_report(
        &self,
        hotel_id: Uuid,
        start: chrono::NaiveDate,
        end: chrono::NaiveDate,
    ) -> Result<Vec<crate::domain::models::RevenueReport>, DomainError> {
        self.booking_repo
            .get_revenue_report(hotel_id, start, end)
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn get_occupancy_report(
        &self,
        hotel_id: Uuid,
        start: chrono::NaiveDate,
        end: chrono::NaiveDate,
    ) -> Result<Vec<crate::domain::models::OccupancyReport>, DomainError> {
        self.booking_repo
            .get_occupancy_report(hotel_id, start, end)
            .await
            .map_err(DomainError::InfrastructureError)
    }
}

fn apply_derived_kpis(kpis: &mut DashboardKpis) {
    // ADR = revenue / active bookings (protect division by zero)
    kpis.adr_cents = if kpis.active_bookings_count > 0 {
        kpis.revenue_month_cents / kpis.active_bookings_count
    } else {
        0
    };
    // RevPAR = occupancy_rate * ADR / 100
    kpis.rev_par_cents = ((kpis.occupancy_rate * kpis.adr_cents as f64) / 100.0) as i64;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_derived_kpis_handles_zero_active_bookings() {
        let mut kpis = DashboardKpis {
            occupancy_rate: 75.0,
            active_bookings_count: 0,
            today_check_ins: 0,
            revenue_month_cents: 1_000_000,
            arrivals_today: vec![],
            departures_today: vec![],
            adr_cents: 999,
            rev_par_cents: 999,
        };
        apply_derived_kpis(&mut kpis);
        assert_eq!(kpis.adr_cents, 0);
        assert_eq!(kpis.rev_par_cents, 0);
    }

    #[test]
    fn apply_derived_kpis_calculates_adr_and_revpar() {
        let mut kpis = DashboardKpis {
            occupancy_rate: 80.0,
            active_bookings_count: 4,
            today_check_ins: 0,
            revenue_month_cents: 400_000,
            arrivals_today: vec![],
            departures_today: vec![],
            adr_cents: 0,
            rev_par_cents: 0,
        };
        apply_derived_kpis(&mut kpis);
        assert_eq!(kpis.adr_cents, 100_000);
        assert_eq!(kpis.rev_par_cents, 80_000);
    }
}
