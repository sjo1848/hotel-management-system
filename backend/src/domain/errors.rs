use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum DomainError {
    RoomNotFound,
    HotelNotFound,
    RoomNotAvailable,
    RoomAlreadyExists,
    GuestAlreadyExists,
    UserAlreadyExists,
    InvalidRoomStatusTransition,
    BookingNotFound,
    InvoiceNotFound,
    InvalidBookingDates,
    InvalidInput(String),
    Unauthorized,
    Forbidden,
    InfrastructureError(String),
}
