use crate::application::auth_service::AuthService;
use crate::application::booking_service::BookingService;
use crate::application::analytics_service::AnalyticsService;
use crate::application::room_service::RoomService;
use crate::config::AppConfig;
use crate::domain::repositories::{
    AuditRepository, GuestRepository, RefreshTokenRepository, RoomRepository, UserRepository,
};
use std::sync::Arc;

pub struct AppState {
    pub room_repo: Arc<dyn RoomRepository>,
    pub booking_service: Arc<BookingService>,
    pub analytics_service: Arc<AnalyticsService>,
    pub room_service: Arc<RoomService>,
    pub guest_repo: Arc<dyn GuestRepository>,
    pub user_repo: Arc<dyn UserRepository>,
    pub refresh_repo: Arc<dyn RefreshTokenRepository>,
    pub audit_repo: Arc<dyn AuditRepository>,
    pub auth_service: Arc<AuthService>,
    pub config: AppConfig,
}
