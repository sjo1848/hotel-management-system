use serde::Serialize;
use serde_json::{json, Value};

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

#[derive(Debug, Clone, PartialEq)]
pub struct ErrorContract {
    pub http_status: u16,
    pub error_code: &'static str,
    pub message: String,
    pub details: Value,
}

pub const CONTRACT_ERROR_CODES_V1: &[&str] = &[
    "ROOM_NOT_FOUND",
    "HOTEL_NOT_FOUND",
    "HOTEL_ALREADY_EXISTS",
    "ROOM_ALREADY_EXISTS",
    "GUEST_ALREADY_EXISTS",
    "GUEST_NOT_FOUND",
    "USER_ALREADY_EXISTS",
    "USER_NOT_FOUND",
    "INVALID_ROOM_STATUS_TRANSITION",
    "ROOM_NOT_AVAILABLE",
    "INVALID_BOOKING_DATES",
    "BOOKING_NOT_FOUND",
    "INVOICE_NOT_FOUND",
    "INVALID_INPUT",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "INFRA_ERROR",
];

impl DomainError {
    pub fn to_error_contract(&self) -> ErrorContract {
        match self {
            DomainError::RoomNotFound => ErrorContract {
                http_status: 404,
                error_code: "ROOM_NOT_FOUND",
                message: "La habitación solicitada no existe".to_string(),
                details: json!({}),
            },
            DomainError::HotelNotFound => ErrorContract {
                http_status: 404,
                error_code: "HOTEL_NOT_FOUND",
                message: "El hotel solicitado no existe".to_string(),
                details: json!({}),
            },
            DomainError::HotelAlreadyExists => ErrorContract {
                http_status: 409,
                error_code: "HOTEL_ALREADY_EXISTS",
                message: "Ya existe un hotel con ese nombre".to_string(),
                details: json!({}),
            },
            DomainError::RoomAlreadyExists => ErrorContract {
                http_status: 409,
                error_code: "ROOM_ALREADY_EXISTS",
                message: "Ya existe una habitación con ese número".to_string(),
                details: json!({}),
            },
            DomainError::GuestAlreadyExists => ErrorContract {
                http_status: 409,
                error_code: "GUEST_ALREADY_EXISTS",
                message: "Ya existe un huésped con ese email en este hotel".to_string(),
                details: json!({}),
            },
            DomainError::GuestNotFound => ErrorContract {
                http_status: 404,
                error_code: "GUEST_NOT_FOUND",
                message: "El huésped solicitado no existe".to_string(),
                details: json!({}),
            },
            DomainError::UserAlreadyExists => ErrorContract {
                http_status: 409,
                error_code: "USER_ALREADY_EXISTS",
                message: "Ya existe un usuario con ese nombre en este hotel".to_string(),
                details: json!({}),
            },
            DomainError::UserNotFound => ErrorContract {
                http_status: 404,
                error_code: "USER_NOT_FOUND",
                message: "El usuario solicitado no existe".to_string(),
                details: json!({}),
            },
            DomainError::InvalidRoomStatusTransition => ErrorContract {
                http_status: 400,
                error_code: "INVALID_ROOM_STATUS_TRANSITION",
                message: "Transición de estado de habitación no permitida".to_string(),
                details: json!({}),
            },
            DomainError::RoomNotAvailable => ErrorContract {
                http_status: 409,
                error_code: "ROOM_NOT_AVAILABLE",
                message: "La habitación ya está ocupada en esas fechas".to_string(),
                details: json!({}),
            },
            DomainError::InvalidBookingDates => ErrorContract {
                http_status: 400,
                error_code: "INVALID_BOOKING_DATES",
                message: "Las fechas de reserva no son válidas".to_string(),
                details: json!({}),
            },
            DomainError::BookingNotFound => ErrorContract {
                http_status: 404,
                error_code: "BOOKING_NOT_FOUND",
                message: "La reserva solicitada no existe".to_string(),
                details: json!({}),
            },
            DomainError::InvoiceNotFound => ErrorContract {
                http_status: 404,
                error_code: "INVOICE_NOT_FOUND",
                message: "La factura solicitada no existe".to_string(),
                details: json!({}),
            },
            DomainError::InvalidInput(message) => ErrorContract {
                http_status: 400,
                error_code: "INVALID_INPUT",
                message: message.clone(),
                details: json!({ "reason": message }),
            },
            DomainError::Unauthorized => ErrorContract {
                http_status: 401,
                error_code: "UNAUTHORIZED",
                message: "No autorizado".to_string(),
                details: json!({}),
            },
            DomainError::Forbidden => ErrorContract {
                http_status: 403,
                error_code: "FORBIDDEN",
                message: "No tiene permisos para realizar esta acción".to_string(),
                details: json!({}),
            },
            DomainError::InfrastructureError(message) => ErrorContract {
                http_status: 500,
                error_code: "INFRA_ERROR",
                message: message.clone(),
                details: json!({}),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_not_found_room_contract() {
        let contract = DomainError::RoomNotFound.to_error_contract();
        assert_eq!(contract.http_status, 404);
        assert_eq!(contract.error_code, "ROOM_NOT_FOUND");
        assert_eq!(contract.message, "La habitación solicitada no existe");
        assert_eq!(contract.details, json!({}));
    }

    #[test]
    fn maps_invalid_input_contract_with_reason_detail() {
        let contract = DomainError::InvalidInput("campo inválido".to_string()).to_error_contract();
        assert_eq!(contract.http_status, 400);
        assert_eq!(contract.error_code, "INVALID_INPUT");
        assert_eq!(contract.message, "campo inválido");
        assert_eq!(contract.details, json!({ "reason": "campo inválido" }));
    }

    #[test]
    fn contract_error_codes_are_unique() {
        let mut sorted = CONTRACT_ERROR_CODES_V1.to_vec();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), CONTRACT_ERROR_CODES_V1.len());
    }
}
