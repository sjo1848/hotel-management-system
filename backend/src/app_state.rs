use crate::application::analytics_service::AnalyticsService;
use crate::application::audit_service::AuditService;
use crate::application::auth_service::AuthService;
use crate::application::billing_service::BillingService;
use crate::application::booking_service::BookingService;
use crate::application::booking_transaction_service::BookingTransactionService;
use crate::application::cash_closure_service::CashClosureService;
use crate::application::front_desk_service::FrontDeskService;
use crate::application::guest_service::GuestService;
use crate::application::hotel_service::HotelService;
use crate::application::housekeeping_service::HousekeepingService;
use crate::application::invoice_service::InvoiceService;
use crate::application::reporting_service::ReportingService;
use crate::application::room_hold_service::RoomHoldService;
use crate::application::room_service::RoomService;
use crate::application::user_service::UserService;
use crate::config::AppConfig;
use std::sync::Arc;

pub struct BookingContext<'a> {
    pub booking_service: &'a Arc<BookingService>,
    pub booking_transaction_service: &'a Arc<BookingTransactionService>,
    pub front_desk_service: &'a Arc<FrontDeskService>,
    pub billing_service: &'a Arc<BillingService>,
    pub invoice_service: &'a Arc<InvoiceService>,
}

pub struct AuthContext<'a> {
    pub auth_service: &'a Arc<AuthService>,
}

pub struct OperationsContext<'a> {
    pub room_service: &'a Arc<RoomService>,
    pub room_hold_service: &'a Arc<RoomHoldService>,
    pub guest_service: &'a Arc<GuestService>,
    pub housekeeping_service: &'a Arc<HousekeepingService>,
    pub cash_closure_service: &'a Arc<CashClosureService>,
}

pub struct AppState {
    pub booking_service: Arc<BookingService>,
    pub booking_transaction_service: Arc<BookingTransactionService>,
    pub front_desk_service: Arc<FrontDeskService>,
    pub analytics_service: Arc<AnalyticsService>,
    pub reporting_service: Arc<ReportingService>,
    pub guest_service: Arc<GuestService>,
    pub room_service: Arc<RoomService>,
    pub room_hold_service: Arc<RoomHoldService>,
    pub hotel_service: Arc<HotelService>,
    pub billing_service: Arc<BillingService>,
    pub cash_closure_service: Arc<CashClosureService>,
    pub housekeeping_service: Arc<HousekeepingService>,
    pub invoice_service: Arc<InvoiceService>,
    pub user_service: Arc<UserService>,
    pub audit_service: Arc<AuditService>,
    pub auth_service: Arc<AuthService>,
    pub config: AppConfig,
}

impl AppState {
    pub fn booking_context(&self) -> BookingContext<'_> {
        BookingContext {
            booking_service: &self.booking_service,
            booking_transaction_service: &self.booking_transaction_service,
            front_desk_service: &self.front_desk_service,
            billing_service: &self.billing_service,
            invoice_service: &self.invoice_service,
        }
    }

    pub fn auth_context(&self) -> AuthContext<'_> {
        AuthContext {
            auth_service: &self.auth_service,
        }
    }

    pub fn operations_context(&self) -> OperationsContext<'_> {
        OperationsContext {
            room_service: &self.room_service,
            room_hold_service: &self.room_hold_service,
            guest_service: &self.guest_service,
            housekeeping_service: &self.housekeeping_service,
            cash_closure_service: &self.cash_closure_service,
        }
    }
}
