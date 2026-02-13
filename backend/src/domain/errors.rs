use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum DomainError {
    RoomNotFound,
    HotelNotFound,
    HotelAlreadyExists,
    RoomNotAvailable,
    RoomAlreadyExists,
    GuestNotFound,
    GuestAlreadyExists,
    UserNotFound,
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
