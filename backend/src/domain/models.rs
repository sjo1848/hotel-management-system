use chrono::NaiveDate;
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, ToSchema, PartialEq)]
pub enum RoomStatus {
    Available,
    Occupied,
    Dirty,
    Cleaning,
    Maintenance,
}

impl RoomStatus {
    pub fn can_transition_to(&self, next: &Self) -> bool {
        match (self, next) {
            (Self::Available, Self::Occupied) => true,
            (Self::Available, Self::Maintenance) => true,
            (Self::Occupied, Self::Dirty) => true,
            (Self::Dirty, Self::Cleaning) => true,
            (Self::Dirty, Self::Maintenance) => true,
            (Self::Cleaning, Self::Available) => true,
            (Self::Cleaning, Self::Maintenance) => true,
            (Self::Maintenance, Self::Dirty) => true,
            // Permitir el mismo estado (no-op)
            (s, n) if s == n => true,
            // Por defecto, cualquier otra transición es inválida
            _ => false,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct Room {
    pub id: Uuid,
    pub hotel_id: Uuid,
    pub room_number: String,
    pub room_type: String,
    pub status: RoomStatus,
    pub price_cents: i64,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BulkRoomStatusUpdateResult {
    pub room_ids: Vec<Uuid>,
    pub updated_count: usize,
    pub status: RoomStatus,
}

#[derive(Debug, Clone, Serialize, ToSchema, PartialEq, Eq)]
pub enum MaintenanceCaseStatus {
    Open,
    Resolved,
}

#[derive(Debug, Clone, Serialize, ToSchema, PartialEq, Eq)]
pub enum MaintenancePriority {
    Low,
    Medium,
    High,
    Urgent,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct MaintenanceCase {
    pub id: Uuid,
    pub hotel_id: Uuid,
    pub room_id: Uuid,
    pub status: MaintenanceCaseStatus,
    pub priority: MaintenancePriority,
    pub reason: String,
    pub assigned_to: String,
    pub reported_by_user_id: Option<Uuid>,
    pub reported_at: chrono::NaiveDateTime,
    pub resolution_note: Option<String>,
    pub resolved_by_user_id: Option<Uuid>,
    pub resolved_at: Option<chrono::NaiveDateTime>,
    pub return_status: Option<RoomStatus>,
}

#[derive(Debug, Clone, Serialize, ToSchema, PartialEq, Eq)]
pub enum RoomHoldType {
    Vip,
    Maintenance,
    Owner,
    Compliance,
    Commercial,
    Other,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct RoomHold {
    pub id: Uuid,
    pub hotel_id: Uuid,
    pub room_id: Uuid,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub hold_type: RoomHoldType,
    pub reason: String,
    pub created_by_user_id: Option<Uuid>,
    pub created_at: Option<chrono::NaiveDateTime>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct RoomHoldBoardEntry {
    pub hold_id: Uuid,
    pub room_id: Uuid,
    pub room_number: String,
    pub room_type: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub hold_type: RoomHoldType,
    pub reason: String,
    pub created_at: Option<chrono::NaiveDateTime>,
}

#[derive(Debug, Clone, Serialize, PartialEq, ToSchema)]
pub enum BookingStatus {
    Confirmed,
    CheckedIn,
    CheckedOut,
    Cancelled,
    NoShow,
}

impl BookingStatus {
    pub fn can_transition_to(&self, next: &Self) -> bool {
        matches!(
            (self, next),
            (
                Self::Confirmed,
                Self::CheckedIn | Self::Cancelled | Self::NoShow
            ) | (Self::CheckedIn, Self::CheckedOut)
        ) || self == next
    }
}

#[derive(Debug, Clone, Serialize, Default, ToSchema)]
pub struct BookingOperationalData {
    pub check_in_guests_count: Option<i32>,
    pub check_in_reference: Option<String>,
    pub check_in_document_verified: Option<bool>,
    pub check_in_contact_confirmed: Option<bool>,
    pub check_in_stay_confirmed: Option<bool>,
    pub checked_in_at: Option<chrono::NaiveDateTime>,
    pub checked_in_by_user_id: Option<Uuid>,
    pub check_out_payment_policy: Option<String>,
    pub check_out_reference: Option<String>,
    pub check_out_charges_reviewed: Option<bool>,
    pub check_out_room_release_confirmed: Option<bool>,
    pub check_out_housekeeping_handoff: Option<bool>,
    pub checked_out_at: Option<chrono::NaiveDateTime>,
    pub checked_out_by_user_id: Option<Uuid>,
    pub terminal_reason: Option<String>,
    pub terminal_recorded_at: Option<chrono::NaiveDateTime>,
    pub terminal_recorded_by_user_id: Option<Uuid>,
    pub late_arrival_eta: Option<chrono::NaiveDateTime>,
    pub late_arrival_note: Option<String>,
    pub late_arrival_recorded_at: Option<chrono::NaiveDateTime>,
    pub late_arrival_recorded_by_user_id: Option<Uuid>,
}

#[derive(Debug, Clone, Default)]
pub struct BookingOperationalUpdate {
    pub check_in_guests_count: Option<i32>,
    pub check_in_reference: Option<String>,
    pub check_in_document_verified: Option<bool>,
    pub check_in_contact_confirmed: Option<bool>,
    pub check_in_stay_confirmed: Option<bool>,
    pub check_out_payment_policy: Option<String>,
    pub check_out_reference: Option<String>,
    pub check_out_charges_reviewed: Option<bool>,
    pub check_out_room_release_confirmed: Option<bool>,
    pub check_out_housekeeping_handoff: Option<bool>,
    pub terminal_reason: Option<String>,
    pub late_arrival_eta: Option<chrono::NaiveDateTime>,
    pub late_arrival_note: Option<String>,
}

impl BookingOperationalData {
    pub fn is_check_in_complete(&self) -> bool {
        self.check_in_guests_count.is_some_and(|count| count > 0)
            && self.check_in_document_verified == Some(true)
            && self.check_in_contact_confirmed == Some(true)
            && self.check_in_stay_confirmed == Some(true)
    }

    pub fn is_check_out_complete(&self) -> bool {
        let valid_payment_policy = matches!(
            self.check_out_payment_policy.as_deref(),
            Some("settled" | "pending-approved")
        );
        let pending_has_reference = self.check_out_payment_policy.as_deref()
            != Some("pending-approved")
            || self
                .check_out_reference
                .as_deref()
                .is_some_and(|reference| reference.trim().len() >= 6);

        valid_payment_policy
            && pending_has_reference
            && self.check_out_charges_reviewed == Some(true)
            && self.check_out_room_release_confirmed == Some(true)
            && self.check_out_housekeeping_handoff == Some(true)
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct Booking {
    pub id: Uuid,
    pub hotel_id: Uuid,
    pub room_id: Uuid,
    pub guest_id: Option<Uuid>,
    pub guest_name: String,
    pub check_in: NaiveDate,
    pub check_out: NaiveDate,
    pub total_price_cents: i64,
    pub status: BookingStatus,
    pub operational_data: BookingOperationalData,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct HousekeepingBoardRoom {
    pub room_id: Uuid,
    pub room_number: String,
    pub room_type: String,
    pub room_status: RoomStatus,
    pub turnover_today: bool,
    pub departure_guest_name: Option<String>,
    pub departure_booking_status: Option<BookingStatus>,
    pub maintenance_case: Option<MaintenanceCase>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct HousekeepingDeparture {
    pub booking_id: Uuid,
    pub room_id: Uuid,
    pub room_number: String,
    pub room_type: String,
    pub room_status: RoomStatus,
    pub guest_name: String,
    pub booking_status: BookingStatus,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct HousekeepingBoard {
    pub date: NaiveDate,
    pub rooms: Vec<HousekeepingBoardRoom>,
    pub departures_today: Vec<HousekeepingDeparture>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct FrontDeskBlocker {
    pub kind: String,
    pub title: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct FrontDeskBoardEntry {
    pub booking_id: Uuid,
    pub room_id: Uuid,
    pub room_number: String,
    pub room_type: String,
    pub guest_name: String,
    pub check_in: NaiveDate,
    pub check_out: NaiveDate,
    pub booking_status: BookingStatus,
    pub room_status: RoomStatus,
    pub total_price_cents: i64,
    pub operational_data: BookingOperationalData,
    pub blocker: Option<FrontDeskBlocker>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum FrontDeskActionKind {
    OpenBooking,
    PrepareCheckIn,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct FrontDeskQueueItem {
    pub entry: FrontDeskBoardEntry,
    pub lane: String,
    pub title: String,
    pub detail: String,
    pub primary_label: String,
    pub action_kind: FrontDeskActionKind,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct FrontDeskBoard {
    pub date: NaiveDate,
    pub arrivals_ready: Vec<FrontDeskBoardEntry>,
    pub arrivals_blocked: Vec<FrontDeskBoardEntry>,
    pub departures_today: Vec<FrontDeskBoardEntry>,
    pub in_house: Vec<FrontDeskBoardEntry>,
    pub holds_today: Vec<RoomHoldBoardEntry>,
    pub action_queue: Vec<FrontDeskQueueItem>,
}

impl Booking {
    pub fn nights(&self) -> i64 {
        let duration = self.check_out - self.check_in;
        let days = duration.num_days();
        if days <= 0 {
            1
        } else {
            days
        } // Política: mínimo 1 noche
    }

    pub fn calculate_total_price(&mut self, room_price_cents: i64) {
        self.total_price_cents = self.nights() * room_price_cents;
    }

    pub fn overlaps_with(&self, start: NaiveDate, end: NaiveDate) -> bool {
        self.check_in < end && self.check_out > start
    }

    pub fn is_valid(&self) -> bool {
        self.check_out > self.check_in
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    #[test]
    fn booking_validates_dates() {
        let booking = Booking {
            id: Uuid::new_v4(),
            hotel_id: Uuid::new_v4(),
            room_id: Uuid::new_v4(),
            guest_id: None,
            guest_name: "Test".to_string(),
            check_in: NaiveDate::from_ymd_opt(2025, 1, 10).unwrap(),
            check_out: NaiveDate::from_ymd_opt(2025, 1, 12).unwrap(),
            total_price_cents: 0,
            status: BookingStatus::Confirmed,
            operational_data: BookingOperationalData::default(),
        };

        assert!(booking.is_valid());
    }

    #[test]
    fn booking_rejects_invalid_dates() {
        let booking = Booking {
            id: Uuid::new_v4(),
            hotel_id: Uuid::new_v4(),
            room_id: Uuid::new_v4(),
            guest_id: None,
            guest_name: "Test".to_string(),
            check_in: NaiveDate::from_ymd_opt(2025, 1, 10).unwrap(),
            check_out: NaiveDate::from_ymd_opt(2025, 1, 10).unwrap(),
            total_price_cents: 0,
            status: BookingStatus::Confirmed,
            operational_data: BookingOperationalData::default(),
        };

        assert!(!booking.is_valid());
    }

    #[test]
    fn booking_overlap_detection() {
        let booking = Booking {
            id: Uuid::new_v4(),
            hotel_id: Uuid::new_v4(),
            room_id: Uuid::new_v4(),
            guest_id: None,
            guest_name: "Test".to_string(),
            check_in: NaiveDate::from_ymd_opt(2025, 1, 10).unwrap(),
            check_out: NaiveDate::from_ymd_opt(2025, 1, 12).unwrap(),
            total_price_cents: 0,
            status: BookingStatus::Confirmed,
            operational_data: BookingOperationalData::default(),
        };

        let start = NaiveDate::from_ymd_opt(2025, 1, 11).unwrap();
        let end = NaiveDate::from_ymd_opt(2025, 1, 13).unwrap();
        assert!(booking.overlaps_with(start, end));
    }

    #[test]
    fn room_status_allows_housekeeping_escalation_to_maintenance() {
        assert!(RoomStatus::Dirty.can_transition_to(&RoomStatus::Maintenance));
        assert!(RoomStatus::Cleaning.can_transition_to(&RoomStatus::Maintenance));
        assert!(RoomStatus::Maintenance.can_transition_to(&RoomStatus::Dirty));
        assert!(!RoomStatus::Maintenance.can_transition_to(&RoomStatus::Available));
    }

    #[test]
    fn booking_status_only_allows_operational_sequence() {
        assert!(BookingStatus::Confirmed.can_transition_to(&BookingStatus::CheckedIn));
        assert!(BookingStatus::Confirmed.can_transition_to(&BookingStatus::Cancelled));
        assert!(BookingStatus::Confirmed.can_transition_to(&BookingStatus::NoShow));
        assert!(BookingStatus::CheckedIn.can_transition_to(&BookingStatus::CheckedOut));
        assert!(BookingStatus::CheckedIn.can_transition_to(&BookingStatus::CheckedIn));

        assert!(!BookingStatus::Confirmed.can_transition_to(&BookingStatus::CheckedOut));
        assert!(!BookingStatus::CheckedIn.can_transition_to(&BookingStatus::Cancelled));
        assert!(!BookingStatus::CheckedOut.can_transition_to(&BookingStatus::CheckedIn));
        assert!(!BookingStatus::Cancelled.can_transition_to(&BookingStatus::Confirmed));
        assert!(!BookingStatus::NoShow.can_transition_to(&BookingStatus::Confirmed));
    }

    #[test]
    fn booking_operational_checklists_require_all_confirmations() {
        let mut data = BookingOperationalData {
            check_in_guests_count: Some(2),
            check_in_document_verified: Some(true),
            check_in_contact_confirmed: Some(true),
            check_in_stay_confirmed: Some(true),
            check_out_payment_policy: Some("pending-approved".to_string()),
            check_out_reference: Some("OPS-123".to_string()),
            check_out_charges_reviewed: Some(true),
            check_out_room_release_confirmed: Some(true),
            check_out_housekeeping_handoff: Some(true),
            ..BookingOperationalData::default()
        };

        assert!(data.is_check_in_complete());
        assert!(data.is_check_out_complete());

        data.check_in_document_verified = Some(false);
        data.check_out_reference = Some("short".to_string());
        assert!(!data.is_check_in_complete());
        assert!(!data.is_check_out_complete());
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct Guest {
    pub id: Uuid,
    pub hotel_id: Uuid,
    pub full_name: String,
    pub email: String,
    pub phone: Option<String>,
    pub created_at: Option<chrono::NaiveDateTime>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct User {
    pub id: Uuid,
    pub hotel_id: Uuid,
    pub username: String,
    pub password_hash: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RefreshToken {
    pub id: Uuid,
    pub hotel_id: Uuid,
    pub user_id: Uuid,
    pub session_id: Uuid,
    pub device_id: String,
    pub token_hash: String,
    pub expires_at: chrono::NaiveDateTime,
    pub revoked_at: Option<chrono::NaiveDateTime>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct AuditEvent {
    pub id: Uuid,
    pub hotel_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub action: String,
    pub ip_address: Option<String>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct DashboardKpis {
    pub revenue_month_cents: i64,
    pub occupancy_rate: f64,
    pub today_check_ins: i64,
    pub active_bookings_count: i64,
    pub arrivals_today: Vec<BookingAlert>,
    pub departures_today: Vec<BookingAlert>,
    pub rev_par_cents: i64,
    pub adr_cents: i64,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct RevenueReport {
    pub date: chrono::NaiveDate,
    pub revenue_cents: i64,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OccupancyReport {
    pub date: chrono::NaiveDate,
    pub occupied_rooms: i64,
    pub total_rooms: i64,
    pub occupancy_rate: f64,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BookingAlert {
    pub booking_id: Uuid,
    pub guest_name: String,
    pub room_number: String,
    pub status: BookingStatus,
}

#[derive(Debug, Clone, Serialize, PartialEq, ToSchema)]
pub enum InvoiceStatus {
    #[serde(rename = "PENDING")]
    Pending,
    #[serde(rename = "PAID")]
    Paid,
    #[serde(rename = "VOIDED")]
    Voided,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct Hotel {
    pub id: Uuid,
    pub name: String,
    pub address: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct HotelNetworkHotelKpi {
    pub hotel_id: Uuid,
    pub hotel_name: String,
    pub plan_tier: String,
    pub occupancy_rate: f64,
    pub active_bookings_count: i64,
    pub revenue_cents: i64,
    pub adr_cents: i64,
    pub rev_par_cents: i64,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct HotelNetworkSummary {
    pub start: chrono::NaiveDate,
    pub end: chrono::NaiveDate,
    pub total_hotels: i64,
    pub total_active_bookings: i64,
    pub total_revenue_cents: i64,
    pub average_occupancy_rate: f64,
    pub hotels: Vec<HotelNetworkHotelKpi>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct TenantFeatureFlags {
    pub hotel_id: Uuid,
    pub plan_tier: String,
    pub automation_alerts_enabled: bool,
    pub pricing_assistant_enabled: bool,
    pub hq_benchmark_enabled: bool,
    pub advanced_analytics_enabled: bool,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExtraCharge {
    pub id: Uuid,
    pub hotel_id: Uuid,
    pub booking_id: Uuid,
    pub description: String,
    pub amount_cents: i64,
    pub category: String,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, PartialEq, ToSchema)]
pub enum PaymentMethod {
    #[serde(rename = "CASH")]
    Cash,
    #[serde(rename = "CARD")]
    Card,
    #[serde(rename = "TRANSFER")]
    Transfer,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct Invoice {
    pub id: Uuid,
    pub hotel_id: Uuid,
    pub booking_id: Uuid,
    pub amount_cents: i64,
    pub paid_amount_cents: i64,
    pub status: InvoiceStatus,
    pub payment_method: PaymentMethod,
    pub payment_reference: Option<String>,
    pub paid_at: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PaymentEntry {
    pub id: Uuid,
    pub hotel_id: Uuid,
    pub invoice_id: Uuid,
    pub booking_id: Uuid,
    pub amount_cents: i64,
    pub payment_method: PaymentMethod,
    pub payment_reference: Option<String>,
    pub note: Option<String>,
    pub received_by_user_id: Option<Uuid>,
    pub received_at: chrono::NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CashClosure {
    pub id: Uuid,
    pub hotel_id: Uuid,
    pub user_id: Uuid,
    pub total_amount_cents: i64,
    pub cash_amount_cents: i64,
    pub card_amount_cents: i64,
    pub payment_count: i64,
    pub counted_cash_amount_cents: i64,
    pub cash_difference_cents: i64,
    pub opening_time: chrono::NaiveDateTime,
    pub closing_time: chrono::NaiveDateTime,
    pub handoff_to: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CashBalanceSnapshot {
    pub total_amount_cents: i64,
    pub cash_amount_cents: i64,
    pub card_amount_cents: i64,
    pub payment_count: i64,
    pub opening_time: chrono::NaiveDateTime,
    pub pending_amount_cents: i64,
    pub pending_bookings_count: i64,
}

impl Invoice {
    pub fn new(hotel_id: Uuid, booking_id: Uuid, amount_cents: i64) -> Self {
        Self {
            id: Uuid::new_v4(),
            hotel_id,
            booking_id,
            amount_cents,
            paid_amount_cents: 0,
            status: InvoiceStatus::Pending,
            payment_method: PaymentMethod::Cash,
            payment_reference: None,
            paid_at: None,
            created_at: chrono::Utc::now().naive_utc(),
        }
    }
}
