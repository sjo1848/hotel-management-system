use crate::application::auth_service::AuthService;
use crate::application::booking_service::BookingService;
use crate::application::analytics_service::AnalyticsService;
use crate::application::room_service::RoomService;
use crate::application::reporting_service::ReportingService;
use crate::application::guest_service::GuestService;
use crate::application::housekeeping_service::HousekeepingService;
use crate::application::audit_service::AuditService;
use crate::application::hotel_service::HotelService;
use crate::application::billing_service::BillingService;
use crate::application::cash_closure_service::CashClosureService;
use crate::config::AppConfig;
use crate::domain::repositories::{
    AuditRepository, CashClosureRepository, ExtraChargeRepository, GuestRepository, HotelRepository, InvoiceRepository, RefreshTokenRepository, RoomRepository, UserRepository,
};
use std::sync::Arc;

pub struct AppState {
    pub room_repo: Arc<dyn RoomRepository>,
    pub hotel_repo: Arc<dyn HotelRepository>,
    pub booking_service: Arc<BookingService>,
    pub analytics_service: Arc<AnalyticsService>,
    pub reporting_service: Arc<ReportingService>,
    pub guest_service: Arc<GuestService>,
    pub room_service: Arc<RoomService>,
    pub hotel_service: Arc<HotelService>,
    pub billing_service: Arc<BillingService>,
    pub cash_closure_service: Arc<CashClosureService>,
    pub housekeeping_service: Arc<HousekeepingService>,
    pub audit_service: Arc<AuditService>,
    pub guest_repo: Arc<dyn GuestRepository>,
    pub user_repo: Arc<dyn UserRepository>,
    pub refresh_repo: Arc<dyn RefreshTokenRepository>,
    pub audit_repo: Arc<dyn AuditRepository>,
    pub extra_charge_repo: Arc<dyn ExtraChargeRepository>,
    pub cash_closure_repo: Arc<dyn CashClosureRepository>,
    pub invoice_repo: Arc<dyn InvoiceRepository>,
    pub auth_service: Arc<AuthService>,
    pub config: AppConfig,
}
