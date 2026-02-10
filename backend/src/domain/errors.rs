use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum DomainError {
    RoomNotFound,
    RoomNotAvailable,
    InvalidBookingDates,
    InfrastructureError(String),
}
