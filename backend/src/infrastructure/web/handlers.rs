use crate::domain::errors::DomainError;
use crate::infrastructure::web::validation::{
    parse_booking_status_input, parse_plan_tier_input, validate_booking_dates, validate_date_range,
    validate_email, validate_len_range, validate_non_empty_trimmed, validate_positive_amount,
    validate_role,
};
use crate::AppState;
use axum::{
    extract::{ConnectInfo, Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{AppendHeaders, IntoResponse, Response},
    Extension, Json,
};
use base64::Engine;
use chrono::{NaiveDate, NaiveDateTime};
use metrics::counter;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::task_local;
use tracing::Span;
use utoipa::ToSchema;
use uuid::Uuid;

task_local! {
    pub static REQUEST_ID: String;
}

#[path = "handlers/auth.rs"]
mod auth;
pub use auth::{login_handler, logout_handler, me_handler, refresh_handler};
#[path = "handlers/ops.rs"]
mod ops;
pub use ops::{
    add_extra_charge_handler, close_cash_handler, create_booking_handler, create_guest_handler,
    create_hotel_handler, create_room_handler, create_user_handler, delete_user_handler,
    finish_cleaning_handler, get_current_balance_handler, get_invoice_by_booking_handler,
    get_room_by_id_handler, get_rooms_handler, list_bookings_handler, list_bookings_page_handler,
    list_dirty_rooms_handler, list_extra_charges_handler, list_guests_handler,
    list_guests_page_handler, list_hotels_handler, list_invoices_handler,
    list_invoices_page_handler, list_users_handler, search_rooms_handler, start_cleaning_handler,
    update_booking_handler, update_hotel_plan_tier_handler, update_room_status_handler,
};
#[path = "handlers/reporting.rs"]
mod reporting;
pub use reporting::{
    get_audit_events_handler, get_audit_events_page_handler, get_automation_insights_handler,
    get_dashboard_kpis_handler, get_hotel_network_summary_handler, get_occupancy_report_handler,
    get_revenue_report_handler, health_check, readiness_check, root_handler,
    track_ui_telemetry_handler,
};

impl IntoResponse for DomainError {
    fn into_response(self) -> Response {
        let contract = self.to_error_contract();
        let status =
            StatusCode::from_u16(contract.http_status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

        let request_id = REQUEST_ID
            .try_with(|value: &String| value.clone())
            .unwrap_or_else(|_| "unknown".to_string());
        Span::current().record("error_code", contract.error_code);
        let body = Json(json!({
            "error_code": contract.error_code,
            "message": contract.message,
            "request_id": request_id,
            "details": contract.details
        }));
        (status, body).into_response()
    }
}

#[derive(Deserialize, ToSchema)]
pub struct CreateBookingRequest {
    pub room_id: Uuid,
    pub guest_id: Option<Uuid>,
    pub guest_name: String,
    #[serde(alias = "start_date")]
    pub check_in: NaiveDate,
    #[serde(alias = "end_date")]
    pub check_out: NaiveDate,
}

#[derive(Deserialize)]
pub struct SearchParams {
    pub start: NaiveDate,
    pub end: NaiveDate,
}

#[derive(Deserialize)]
pub struct BookingFilterParams {
    pub start: Option<NaiveDate>,
    pub end: Option<NaiveDate>,
}

#[derive(Deserialize)]
pub struct BookingPageParams {
    pub start: Option<NaiveDate>,
    pub end: Option<NaiveDate>,
    pub limit: Option<usize>,
    pub cursor: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct BookingPageResponse {
    pub items: Vec<crate::domain::models::Booking>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
}

#[derive(Deserialize)]
pub struct CursorPageParams {
    pub limit: Option<usize>,
    pub cursor: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct GuestPageResponse {
    pub items: Vec<crate::domain::models::Guest>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
}

#[derive(Serialize, ToSchema)]
pub struct InvoicePageResponse {
    pub items: Vec<crate::domain::models::Invoice>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
}

#[derive(Serialize, ToSchema)]
pub struct AuditEventPageResponse {
    pub items: Vec<crate::domain::models::AuditEvent>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateBookingRequest {
    pub guest_id: Option<Uuid>,
    pub guest_name: Option<String>,
    pub check_in: Option<NaiveDate>,
    pub check_out: Option<NaiveDate>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
pub struct DateRangeParams {
    pub start: Option<chrono::NaiveDate>,
    pub end: Option<chrono::NaiveDate>,
}

#[derive(Deserialize)]
pub struct HotelNetworkSummaryParams {
    pub start: Option<chrono::NaiveDate>,
    pub end: Option<chrono::NaiveDate>,
    pub hotel_id: Option<Uuid>,
}

#[derive(Serialize, ToSchema)]
pub struct HotelNetworkTotals {
    pub hotels_count: i64,
    pub revenue_cents: i64,
    pub bookings_count: i64,
    pub active_bookings_count: i64,
    pub today_check_ins: i64,
    pub avg_occupancy_rate: f64,
    pub avg_adr_cents: i64,
    pub avg_rev_par_cents: i64,
}

#[derive(Serialize, ToSchema)]
pub struct HotelNetworkHotelSummary {
    pub hotel_id: Uuid,
    pub hotel_name: String,
    pub hotel_address: Option<String>,
    pub plan_tier: crate::domain::models::PlanTier,
    pub revenue_cents: i64,
    pub bookings_count: i64,
    pub active_bookings_count: i64,
    pub today_check_ins: i64,
    pub occupancy_rate: f64,
    pub adr_cents: i64,
    pub rev_par_cents: i64,
}

#[derive(Serialize, ToSchema)]
pub struct HotelNetworkBenchmarks {
    pub top_revenue_hotel_id: Option<Uuid>,
    pub top_occupancy_hotel_id: Option<Uuid>,
    pub top_rev_par_hotel_id: Option<Uuid>,
}

#[derive(Serialize, ToSchema)]
pub struct HotelNetworkSummaryResponse {
    pub start: chrono::NaiveDate,
    pub end: chrono::NaiveDate,
    pub selected_hotel_id: Option<Uuid>,
    pub totals: HotelNetworkTotals,
    pub benchmarks: HotelNetworkBenchmarks,
    pub hotels: Vec<HotelNetworkHotelSummary>,
}

#[derive(Deserialize)]
pub struct AuditQueryParams {
    pub limit: Option<usize>,
}

#[derive(Deserialize, ToSchema)]
pub struct UiTelemetryEventRequest {
    pub event: String,
    pub payload: Option<Value>,
    pub timestamp: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct CreateGuestRequest {
    pub full_name: String,
    pub email: String,
    pub phone: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct LoginRequest {
    pub hotel_id: String,
    pub username: String,
    pub password: String,
    pub device_id: Option<String>,
}

#[derive(Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: Option<String>,
    pub all_devices: Option<bool>,
}

#[derive(serde::Serialize, ToSchema)]
pub struct LoginResponse {
    pub access_token: String,
    pub expires_in: usize,
    pub hotel_id: Uuid,
    pub role: String,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateRoomStatusRequest {
    pub status: String,
}

#[derive(Deserialize, ToSchema)]
pub struct CreateRoomRequest {
    pub room_number: String,
    pub room_type: String,
    pub price_cents: i64,
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub role: String,
}

fn extract_refresh_cookie(headers: &HeaderMap) -> Option<String> {
    let cookies_header = headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok());
    cookies_header.and_then(|cookies| {
        cookies
            .split(';')
            .map(|cookie| cookie.trim())
            .find(|cookie| cookie.starts_with("refresh_token="))
            .map(|cookie| cookie.trim_start_matches("refresh_token=").to_string())
    })
}

fn resolve_device_id(payload_device_id: Option<&str>, headers: &HeaderMap) -> String {
    let explicit = payload_device_id.unwrap_or_default().trim();
    if !explicit.is_empty() {
        return explicit.to_string();
    }
    headers
        .get("x-device-id")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| "web-browser".to_string())
}

pub fn build_refresh_cookie(token: &str, config: &crate::config::AppConfig) -> String {
    let mut cookie_parts = vec![
        format!("refresh_token={}", token),
        format!("Path=/"),
        format!("SameSite={}", config.cookie_samesite),
        format!("Max-Age={}", config.refresh_ttl_days * 24 * 60 * 60),
        String::from("HttpOnly"),
    ];

    if config.cookie_secure {
        cookie_parts.push(String::from("Secure"));
    }
    if let Some(domain) = config.cookie_domain.as_deref() {
        cookie_parts.push(format!("Domain={domain}"));
    }

    cookie_parts.join("; ")
}

pub fn clear_refresh_cookie(config: &crate::config::AppConfig) -> String {
    let mut cookie_parts = vec![
        format!("refresh_token=;"),
        format!("Path=/"),
        format!("SameSite={}", config.cookie_samesite),
        format!("Max-Age=0"),
        String::from("HttpOnly"),
    ];
    if config.cookie_secure {
        cookie_parts.push(String::from("Secure"));
    }
    if let Some(domain) = config.cookie_domain.as_deref() {
        cookie_parts.push(format!("Domain={domain}"));
    }
    cookie_parts.join("; ")
}

pub fn build_access_cookie(token: &str, config: &crate::config::AppConfig) -> String {
    let mut cookie_parts = vec![
        format!("access_token={}", token),
        format!("Path=/"),
        format!("SameSite={}", config.cookie_samesite),
        format!("Max-Age={}", config.access_ttl_minutes * 60),
        String::from("HttpOnly"),
    ];

    if config.cookie_secure {
        cookie_parts.push(String::from("Secure"));
    }
    if let Some(domain) = config.cookie_domain.as_deref() {
        cookie_parts.push(format!("Domain={domain}"));
    }

    cookie_parts.join("; ")
}

pub fn clear_access_cookie(config: &crate::config::AppConfig) -> String {
    let mut cookie_parts = vec![
        format!("access_token=;"),
        format!("Path=/"),
        format!("SameSite={}", config.cookie_samesite),
        format!("Max-Age=0"),
        String::from("HttpOnly"),
    ];
    if config.cookie_secure {
        cookie_parts.push(String::from("Secure"));
    }
    if let Some(domain) = config.cookie_domain.as_deref() {
        cookie_parts.push(format!("Domain={domain}"));
    }
    cookie_parts.join("; ")
}

fn generate_csrf_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

pub(crate) fn encode_page_cursor(cursor: &crate::domain::models::BookingPageCursor) -> String {
    let raw = format!(
        "{}|{}",
        cursor.created_at.format("%Y-%m-%dT%H:%M:%S%.f"),
        cursor.id
    );
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(raw.as_bytes())
}

pub(crate) fn decode_page_cursor(
    encoded: &str,
) -> Result<crate::domain::models::BookingPageCursor, DomainError> {
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|_| DomainError::InvalidInput("Cursor inválido".to_string()))?;
    let raw = String::from_utf8(bytes)
        .map_err(|_| DomainError::InvalidInput("Cursor inválido".to_string()))?;
    let (created_at_raw, id_raw) = raw
        .split_once('|')
        .ok_or_else(|| DomainError::InvalidInput("Cursor inválido".to_string()))?;
    let created_at = NaiveDateTime::parse_from_str(created_at_raw, "%Y-%m-%dT%H:%M:%S%.f")
        .map_err(|_| DomainError::InvalidInput("Cursor inválido".to_string()))?;
    let id = Uuid::parse_str(id_raw)
        .map_err(|_| DomainError::InvalidInput("Cursor inválido".to_string()))?;

    Ok(crate::domain::models::BookingPageCursor { created_at, id })
}

fn build_csrf_cookie(token: &str, config: &crate::config::AppConfig) -> String {
    let mut cookie = format!(
        "csrf_token={}; Path=/; SameSite={}; Max-Age={}",
        token,
        config.cookie_samesite,
        config.refresh_ttl_days * 24 * 60 * 60
    );
    if config.cookie_secure {
        cookie.push_str("; Secure");
    }
    if let Some(domain) = config.cookie_domain.as_deref() {
        cookie.push_str(&format!("; Domain={domain}"));
    }
    cookie
}

fn clear_csrf_cookie(config: &crate::config::AppConfig) -> String {
    let mut cookie = format!(
        "csrf_token=; Path=/; SameSite={}; Max-Age=0",
        config.cookie_samesite
    );
    if config.cookie_secure {
        cookie.push_str("; Secure");
    }
    if let Some(domain) = config.cookie_domain.as_deref() {
        cookie.push_str(&format!("; Domain={domain}"));
    }
    cookie
}

#[derive(Deserialize, ToSchema)]
pub struct CreateHotelRequest {
    pub name: String,
    pub address: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateHotelPlanTierRequest {
    pub plan_tier: String,
}

#[derive(Serialize, Clone, ToSchema)]
pub struct PlanFeatureFlags {
    pub revenue_cockpit: bool,
    pub housekeeping_sla_alerts: bool,
    pub pricing_assistant: bool,
    pub exception_notifications: bool,
    pub hq_multi_property: bool,
    pub benchmarking_exports: bool,
    pub pricing_rules_automation: bool,
}

#[derive(Serialize, ToSchema)]
pub struct UpdateHotelPlanTierResponse {
    pub hotel: crate::domain::models::Hotel,
    pub feature_flags: PlanFeatureFlags,
}

#[derive(Serialize, ToSchema)]
pub struct HousekeepingSlaInsight {
    pub enabled: bool,
    pub dirty_rooms_count: usize,
    pub cleaning_rooms_count: usize,
    pub overdue_rooms_count: usize,
    pub recommendation: String,
}

#[derive(Serialize, ToSchema)]
pub struct PricingAssistantInsight {
    pub enabled: bool,
    pub occupancy_rate: f64,
    pub adr_cents: i64,
    pub rev_par_cents: i64,
    pub urgency: String,
    pub recommendation: String,
}

#[derive(Serialize, ToSchema)]
pub struct AutomationNotification {
    pub code: String,
    pub severity: String,
    pub message: String,
    pub action_route: String,
}

#[derive(Serialize, ToSchema)]
pub struct AutomationInsightsResponse {
    pub plan_tier: crate::domain::models::PlanTier,
    pub feature_flags: PlanFeatureFlags,
    pub housekeeping_sla: HousekeepingSlaInsight,
    pub pricing_assistant: PricingAssistantInsight,
    pub exception_notifications: Vec<AutomationNotification>,
}

pub fn resolve_plan_feature_flags(plan_tier: crate::domain::models::PlanTier) -> PlanFeatureFlags {
    match plan_tier {
        crate::domain::models::PlanTier::Basic => PlanFeatureFlags {
            revenue_cockpit: true,
            housekeeping_sla_alerts: true,
            pricing_assistant: false,
            exception_notifications: false,
            hq_multi_property: false,
            benchmarking_exports: false,
            pricing_rules_automation: false,
        },
        crate::domain::models::PlanTier::Pro => PlanFeatureFlags {
            revenue_cockpit: true,
            housekeeping_sla_alerts: true,
            pricing_assistant: true,
            exception_notifications: true,
            hq_multi_property: true,
            benchmarking_exports: false,
            pricing_rules_automation: false,
        },
        crate::domain::models::PlanTier::Enterprise => PlanFeatureFlags {
            revenue_cockpit: true,
            housekeeping_sla_alerts: true,
            pricing_assistant: true,
            exception_notifications: true,
            hq_multi_property: true,
            benchmarking_exports: true,
            pricing_rules_automation: true,
        },
    }
}

#[derive(Deserialize, ToSchema)]
pub struct AddExtraChargeRequest {
    pub description: String,
    pub amount_cents: i64,
    pub category: String,
}

#[derive(Deserialize)]
pub struct CashClosureRequest {
    pub notes: Option<String>,
}
