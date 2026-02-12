use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum DomainError {
    RoomNotFound,
    RoomNotAvailable,
    RoomAlreadyExists,
    InvalidRoomStatusTransition,
    BookingNotFound,
    InvalidBookingDates,
    InvalidInput(String),
    Unauthorized,
    InfrastructureError(String),
}
