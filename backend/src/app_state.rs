use crate::application::analytics_service::AnalyticsService;
use crate::application::audit_service::AuditService;
use crate::application::auth_service::AuthService;
use crate::application::billing_service::BillingService;
use crate::application::booking_service::BookingService;
use crate::application::booking_transaction_service::BookingTransactionService;
use crate::application::cash_closure_service::CashClosureService;
use crate::application::guest_service::GuestService;
use crate::application::hotel_service::HotelService;
use crate::application::housekeeping_service::HousekeepingService;
use crate::application::reporting_service::ReportingService;
use crate::application::room_service::RoomService;
use crate::config::AppConfig;
use crate::domain::repositories::{
    AuditRepository, CashClosureRepository, ExtraChargeRepository, GuestRepository,
    HotelRepository, InvoiceRepository, RefreshTokenRepository, RoomRepository, UserRepository,
};
use std::sync::Arc;

pub struct BookingContext<'a> {
    pub booking_service: &'a Arc<BookingService>,
    pub booking_transaction_service: &'a Arc<BookingTransactionService>,
    pub billing_service: &'a Arc<BillingService>,
    pub invoice_repo: &'a Arc<dyn InvoiceRepository>,
}

pub struct AuthContext<'a> {
    pub auth_service: &'a Arc<AuthService>,
    pub user_repo: &'a Arc<dyn UserRepository>,
    pub refresh_repo: &'a Arc<dyn RefreshTokenRepository>,
}

pub struct OperationsContext<'a> {
    pub room_service: &'a Arc<RoomService>,
    pub guest_service: &'a Arc<GuestService>,
    pub housekeeping_service: &'a Arc<HousekeepingService>,
    pub cash_closure_service: &'a Arc<CashClosureService>,
}

pub struct AppState {
    pub room_repo: Arc<dyn RoomRepository>,
    pub hotel_repo: Arc<dyn HotelRepository>,
    pub booking_service: Arc<BookingService>,
    pub booking_transaction_service: Arc<BookingTransactionService>,
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

impl AppState {
    pub fn booking_context(&self) -> BookingContext<'_> {
        BookingContext {
            booking_service: &self.booking_service,
            booking_transaction_service: &self.booking_transaction_service,
            billing_service: &self.billing_service,
            invoice_repo: &self.invoice_repo,
        }
    }

    pub fn auth_context(&self) -> AuthContext<'_> {
        AuthContext {
            auth_service: &self.auth_service,
            user_repo: &self.user_repo,
            refresh_repo: &self.refresh_repo,
        }
    }

    pub fn operations_context(&self) -> OperationsContext<'_> {
        OperationsContext {
            room_service: &self.room_service,
            guest_service: &self.guest_service,
            housekeeping_service: &self.housekeeping_service,
            cash_closure_service: &self.cash_closure_service,
        }
    }
}
