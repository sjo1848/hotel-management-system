use crate::domain::models::{AuditEvent, Booking, Guest, Hotel, Invoice, RefreshToken, Room, User, ExtraCharge, CashClosure};
use async_trait::async_trait;
use chrono::NaiveDate;
use uuid::Uuid;

#[async_trait]
pub trait HotelRepository: Send + Sync {
    async fn create(&self, hotel: Hotel) -> Result<Hotel, String>;
    async fn find_all(&self) -> Result<Vec<Hotel>, String>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Hotel>, String>;
    async fn find_by_name_ci(&self, name: &str) -> Result<Option<Hotel>, String>;
    async fn update(&self, hotel: Hotel) -> Result<Hotel, String>;
}

#[async_trait]
pub trait RoomRepository: Send + Sync {
    async fn create(&self, room: Room) -> Result<Room, String>;
    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<Room>, String>;
    async fn find_by_id(&self, hotel_id: Uuid, id: Uuid) -> Result<Option<Room>, String>;
    async fn find_by_room_number(&self, hotel_id: Uuid, room_number: &str) -> Result<Option<Room>, String>;
    async fn update_status(&self, hotel_id: Uuid, id: Uuid, status: crate::domain::models::RoomStatus) -> Result<(), String>;
    async fn find_available(&self, hotel_id: Uuid, start: NaiveDate, end: NaiveDate) -> Result<Vec<Room>, String>;
}

#[async_trait]
pub trait BookingRepository: Send + Sync {
    async fn save(&self, booking: Booking) -> Result<Booking, String>;
    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<Booking>, String>;
    async fn find_by_range(&self, hotel_id: Uuid, start: NaiveDate, end: NaiveDate) -> Result<Vec<Booking>, String>;
    async fn find_by_id(&self, hotel_id: Uuid, id: Uuid) -> Result<Option<Booking>, String>;
    async fn update(&self, booking: Booking) -> Result<Booking, String>;
    async fn find_by_room(&self, hotel_id: Uuid, room_id: Uuid) -> Result<Vec<Booking>, String>;
    async fn check_availability(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String>;
    async fn check_availability_excluding(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String>;
    async fn get_dashboard_stats(&self, hotel_id: Uuid) -> Result<crate::domain::models::DashboardKpis, String>;
    async fn get_revenue_report(&self, hotel_id: Uuid, start: NaiveDate, end: NaiveDate) -> Result<Vec<crate::domain::models::RevenueReport>, String>;
    async fn get_occupancy_report(&self, hotel_id: Uuid, start: NaiveDate, end: NaiveDate) -> Result<Vec<crate::domain::models::OccupancyReport>, String>;
}

#[async_trait]
pub trait GuestRepository: Send + Sync {
    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<Guest>, String>;
    async fn create(&self, guest: Guest) -> Result<Guest, String>;
}

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn find_by_username(&self, hotel_id: Uuid, username: &str) -> Result<Option<User>, String>;
    async fn create(&self, user: User) -> Result<User, String>;
    async fn find_by_id(&self, hotel_id: Uuid, id: Uuid) -> Result<Option<User>, String>;
    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<User>, String>;
    async fn delete(&self, hotel_id: Uuid, id: Uuid) -> Result<(), String>;
}

#[async_trait]
pub trait RefreshTokenRepository: Send + Sync {
    async fn create(&self, token: RefreshToken) -> Result<RefreshToken, String>;
    async fn find_valid(&self, token_hash: &str) -> Result<Option<RefreshToken>, String>;
    async fn revoke(&self, token_id: Uuid) -> Result<(), String>;
    async fn revoke_all_for_user(&self, hotel_id: Uuid, user_id: Uuid) -> Result<(), String>;
}

#[async_trait]
pub trait AuditRepository: Send + Sync {
    async fn record(&self, event: AuditEvent) -> Result<(), String>;
}

#[async_trait]
pub trait ExtraChargeRepository: Send + Sync {
    async fn add(&self, charge: ExtraCharge) -> Result<ExtraCharge, String>;
    async fn find_by_booking(&self, hotel_id: Uuid, booking_id: Uuid) -> Result<Vec<ExtraCharge>, String>;
    async fn delete(&self, hotel_id: Uuid, id: Uuid) -> Result<(), String>;
}

#[async_trait]
pub trait InvoiceRepository: Send + Sync {
    async fn save(&self, invoice: Invoice) -> Result<Invoice, String>;
    async fn find_by_booking(&self, hotel_id: Uuid, booking_id: Uuid) -> Result<Option<Invoice>, String>;
    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<Invoice>, String>;
    async fn get_unclosed_total(&self, hotel_id: Uuid) -> Result<(i64, i64, i64), String>; // Total, Cash, Card
}

#[async_trait]
pub trait CashClosureRepository: Send + Sync {
    async fn create(&self, closure: CashClosure) -> Result<CashClosure, String>;
    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<CashClosure>, String>;
}
