use crate::domain::models::{Booking, Guest, RefreshToken, Room, User};
use async_trait::async_trait;
use chrono::NaiveDate;
use uuid::Uuid;

#[async_trait]
pub trait RoomRepository: Send + Sync {
    async fn find_all(&self) -> Result<Vec<Room>, String>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Room>, String>;
    // Nuevo puerto para búsqueda por fechas
    async fn find_available(&self, start: NaiveDate, end: NaiveDate) -> Result<Vec<Room>, String>;
}

#[async_trait]
pub trait BookingRepository: Send + Sync {
    async fn save(&self, booking: Booking) -> Result<Booking, String>;
    async fn find_all(&self) -> Result<Vec<Booking>, String>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Booking>, String>;
    async fn update(&self, booking: Booking) -> Result<Booking, String>;
    async fn find_by_room(&self, room_id: Uuid) -> Result<Vec<Booking>, String>;
    async fn check_availability(
        &self,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String>;
    async fn check_availability_excluding(
        &self,
        booking_id: Uuid,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String>;
}

#[async_trait]
pub trait GuestRepository: Send + Sync {
    async fn find_all(&self) -> Result<Vec<Guest>, String>;
    async fn create(&self, guest: Guest) -> Result<Guest, String>;
}

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn find_by_username(&self, username: &str) -> Result<Option<User>, String>;
    async fn create(&self, user: User) -> Result<User, String>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, String>;
}

#[async_trait]
pub trait RefreshTokenRepository: Send + Sync {
    async fn create(&self, token: RefreshToken) -> Result<RefreshToken, String>;
    async fn find_valid(&self, token_hash: &str) -> Result<Option<RefreshToken>, String>;
    async fn revoke(&self, token_id: Uuid) -> Result<(), String>;
    async fn revoke_all_for_user(&self, user_id: Uuid) -> Result<(), String>;
}
