use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum DomainError {
    RoomNotFound,
    RoomNotAvailable,
    BookingNotFound,
    InvalidBookingDates,
    InvalidInput(String),
    Unauthorized,
    InfrastructureError(String),
}
