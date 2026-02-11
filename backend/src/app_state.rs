use crate::application::auth_service::AuthService;
use crate::application::booking_service::BookingService;
use crate::application::analytics_service::AnalyticsService;
use crate::application::room_service::RoomService;
use crate::application::reporting_service::ReportingService;
use crate::application::guest_service::GuestService;
use crate::application::housekeeping_service::HousekeepingService;
use crate::config::AppConfig;
use crate::domain::repositories::{
    AuditRepository, GuestRepository, InvoiceRepository, RefreshTokenRepository, RoomRepository, UserRepository,
};
use std::sync::Arc;

pub struct AppState {
    pub room_repo: Arc<dyn RoomRepository>,
    pub booking_service: Arc<BookingService>,
    pub analytics_service: Arc<AnalyticsService>,
    pub reporting_service: Arc<ReportingService>,
    pub guest_service: Arc<GuestService>,
    pub room_service: Arc<RoomService>,
    pub housekeeping_service: Arc<HousekeepingService>,
    pub guest_repo: Arc<dyn GuestRepository>,
    pub user_repo: Arc<dyn UserRepository>,
    pub refresh_repo: Arc<dyn RefreshTokenRepository>,
    pub audit_repo: Arc<dyn AuditRepository>,
    pub invoice_repo: Arc<dyn InvoiceRepository>,
    pub auth_service: Arc<AuthService>,
    pub config: AppConfig,
}
