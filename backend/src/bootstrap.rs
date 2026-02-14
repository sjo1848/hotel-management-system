use crate::app_state::AppState;
use crate::application::{
    analytics_service::AnalyticsService, audit_service::AuditService, auth_service::AuthService,
    billing_service::BillingService, booking_service::BookingService,
    booking_transaction_service::BookingTransactionService,
    cash_closure_service::CashClosureService, guest_service::GuestService,
    hotel_service::HotelService, housekeeping_service::HousekeepingService,
    invoice_service::InvoiceService, reporting_service::ReportingService,
    room_service::RoomService, user_service::UserService,
};
use crate::config::AppConfig;
use crate::domain::repositories::{
    AuditRepository, BookingRepository, BookingTransactionRepository, CashClosureRepository,
    ExtraChargeRepository, GuestRepository, HotelRepository, InvoiceRepository,
    RefreshTokenRepository, RoomRepository, UserRepository,
};
use crate::domain::security::{PasswordHasher, TokenSigner};
use crate::infrastructure::{
    repository::{
        postgres::PostgresRoomRepository, postgres_audit::PostgresAuditRepository,
        postgres_booking::PostgresBookingRepository,
        postgres_booking_transaction::PostgresBookingTransactionRepository,
        postgres_cash_closure::PostgresCashClosureRepository,
        postgres_extra_charge::PostgresExtraChargeRepository,
        postgres_guest::PostgresGuestRepository, postgres_hotel::PostgresHotelRepository,
        postgres_invoice::PostgresInvoiceRepository,
        postgres_refresh_token::PostgresRefreshTokenRepository,
        postgres_user::PostgresUserRepository,
    },
    seeder,
    web::{jwt::JwtTokenSigner, passwords::ArgonPasswordHasher},
};
use sqlx::PgPool;
use std::sync::Arc;

pub async fn build_app_state(pool: PgPool, config: AppConfig) -> Arc<AppState> {
    let room_repo = Arc::new(PostgresRoomRepository::new(pool.clone())) as Arc<dyn RoomRepository>;
    let booking_repo =
        Arc::new(PostgresBookingRepository::new(pool.clone())) as Arc<dyn BookingRepository>;
    let booking_transaction_repo = Arc::new(PostgresBookingTransactionRepository::new(pool.clone()))
        as Arc<dyn BookingTransactionRepository>;
    let guest_repo =
        Arc::new(PostgresGuestRepository::new(pool.clone())) as Arc<dyn GuestRepository>;
    let user_repo = Arc::new(PostgresUserRepository::new(pool.clone())) as Arc<dyn UserRepository>;
    let refresh_repo = Arc::new(PostgresRefreshTokenRepository::new(pool.clone()))
        as Arc<dyn RefreshTokenRepository>;
    let audit_repo =
        Arc::new(PostgresAuditRepository::new(pool.clone())) as Arc<dyn AuditRepository>;
    let extra_charge_repo = Arc::new(PostgresExtraChargeRepository::new(pool.clone()))
        as Arc<dyn ExtraChargeRepository>;
    let cash_closure_repo = Arc::new(PostgresCashClosureRepository::new(pool.clone()))
        as Arc<dyn CashClosureRepository>;
    let invoice_repo =
        Arc::new(PostgresInvoiceRepository::new(pool.clone())) as Arc<dyn InvoiceRepository>;
    let hotel_repo =
        Arc::new(PostgresHotelRepository::new(pool.clone())) as Arc<dyn HotelRepository>;
    let password_hasher = Arc::new(ArgonPasswordHasher) as Arc<dyn PasswordHasher>;
    let token_signer = Arc::new(JwtTokenSigner::new(
        config.jwt_secret.clone(),
        config.jwt_previous_secret.clone(),
        config.jwt_kid.clone(),
    )) as Arc<dyn TokenSigner>;

    let audit_service = Arc::new(AuditService::new(audit_repo.clone()));
    let hotel_service = Arc::new(HotelService::new(hotel_repo.clone()));
    let billing_service = Arc::new(BillingService::new(
        extra_charge_repo.clone(),
        booking_repo.clone(),
    ));
    let cash_closure_service = Arc::new(CashClosureService::new(
        cash_closure_repo.clone(),
        invoice_repo.clone(),
    ));
    let room_service = Arc::new(RoomService::new(room_repo.clone()));
    let booking_service = Arc::new(BookingService::new(
        booking_repo.clone(),
        room_repo.clone(),
        guest_repo.clone(),
        room_service.clone(),
        audit_service.clone(),
        invoice_repo.clone(),
    ));
    let booking_transaction_service =
        Arc::new(BookingTransactionService::new(booking_transaction_repo));
    let analytics_service = Arc::new(AnalyticsService::new(booking_repo.clone()));
    let reporting_service = Arc::new(ReportingService::new(booking_repo.clone()));
    let guest_service = Arc::new(GuestService::new(guest_repo.clone()));
    let housekeeping_service = Arc::new(HousekeepingService::new(
        room_repo.clone(),
        room_service.clone(),
        audit_service.clone(),
    ));
    let invoice_service = Arc::new(InvoiceService::new(invoice_repo.clone()));
    let user_service = Arc::new(UserService::new(user_repo.clone(), password_hasher.clone()));
    let auth_service = Arc::new(AuthService::new(
        user_repo.clone(),
        refresh_repo.clone(),
        password_hasher.clone(),
        token_signer,
        config.access_ttl_minutes,
        config.refresh_ttl_days,
    ));

    // Seed Initial Data
    seeder::bootstrap_admin_user(&config, user_repo.clone()).await;
    seeder::seed_rooms_if_empty(room_repo.clone()).await;

    Arc::new(AppState {
        booking_service,
        booking_transaction_service,
        analytics_service,
        reporting_service,
        guest_service,
        room_service,
        hotel_service,
        billing_service,
        cash_closure_service,
        housekeeping_service,
        invoice_service,
        user_service,
        audit_service,
        auth_service,
        config,
    })
}
