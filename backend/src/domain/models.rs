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
            (Self::Cleaning, Self::Available) => true,
            (Self::Maintenance, Self::Available) => true,
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

#[derive(Debug, Clone, Serialize, PartialEq, ToSchema)]
pub enum BookingStatus {
    Confirmed,
    CheckedIn,
    CheckedOut,
    Cancelled,
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
        };

        let start = NaiveDate::from_ymd_opt(2025, 1, 11).unwrap();
        let end = NaiveDate::from_ymd_opt(2025, 1, 13).unwrap();
        assert!(booking.overlaps_with(start, end));
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
    pub status: InvoiceStatus,
    pub payment_method: PaymentMethod,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CashClosure {
    pub id: Uuid,
    pub hotel_id: Uuid,
    pub user_id: Uuid,
    pub total_amount_cents: i64,
    pub cash_amount_cents: i64,
    pub card_amount_cents: i64,
    pub opening_time: chrono::NaiveDateTime,
    pub closing_time: chrono::NaiveDateTime,
    pub notes: Option<String>,
}

impl Invoice {
    pub fn new(hotel_id: Uuid, booking_id: Uuid, amount_cents: i64) -> Self {
        Self {
            id: Uuid::new_v4(),
            hotel_id,
            booking_id,
            amount_cents,
            status: InvoiceStatus::Pending,
            payment_method: PaymentMethod::Cash,
            created_at: chrono::Utc::now().naive_utc(),
        }
    }
}
