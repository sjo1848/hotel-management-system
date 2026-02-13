use crate::domain::errors::DomainError;
use crate::domain::models::BookingStatus;
use chrono::NaiveDate;

pub fn validate_non_empty_trimmed(field: &str, value: &str) -> Result<(), DomainError> {
    if value.trim().is_empty() {
        return Err(DomainError::InvalidInput(format!(
            "El campo '{}' es obligatorio",
            field
        )));
    }
    Ok(())
}

pub fn validate_len_range(
    field: &str,
    value: &str,
    min: usize,
    max: usize,
) -> Result<(), DomainError> {
    let len = value.trim().chars().count();
    if len < min || len > max {
        return Err(DomainError::InvalidInput(format!(
            "El campo '{}' debe tener entre {} y {} caracteres",
            field, min, max
        )));
    }
    Ok(())
}

pub fn validate_positive_amount(field: &str, value: i64) -> Result<(), DomainError> {
    if value <= 0 {
        return Err(DomainError::InvalidInput(format!(
            "El campo '{}' debe ser mayor a 0",
            field
        )));
    }
    Ok(())
}

pub fn validate_email(email: &str) -> Result<(), DomainError> {
    let trimmed = email.trim();
    if trimmed.is_empty() || !trimmed.contains('@') || !trimmed.contains('.') {
        return Err(DomainError::InvalidInput("Email inválido".to_string()));
    }
    Ok(())
}

pub fn validate_booking_dates(
    check_in: NaiveDate,
    check_out: NaiveDate,
) -> Result<(), DomainError> {
    if check_out <= check_in {
        return Err(DomainError::InvalidBookingDates);
    }
    Ok(())
}

pub fn parse_booking_status_input(
    status: Option<&str>,
) -> Result<Option<BookingStatus>, DomainError> {
    match status {
        Some("Confirmed") | Some("CONFIRMED") => Ok(Some(BookingStatus::Confirmed)),
        Some("CheckedIn") | Some("CHECKED_IN") => Ok(Some(BookingStatus::CheckedIn)),
        Some("CheckedOut") | Some("CHECKED_OUT") => Ok(Some(BookingStatus::CheckedOut)),
        Some("Cancelled") | Some("CANCELLED") => Ok(Some(BookingStatus::Cancelled)),
        Some(other) => Err(DomainError::InvalidInput(format!(
            "Estado de reserva inválido: {}",
            other
        ))),
        None => Ok(None),
    }
}

pub fn validate_role(role: &str) -> Result<(), DomainError> {
    let normalized = role.trim().to_lowercase();
    match normalized.as_str() {
        "admin" | "ops" | "receptionist" | "housekeeping" => Ok(()),
        _ => Err(DomainError::InvalidInput(
            "Rol inválido. Valores permitidos: admin, ops, receptionist, housekeeping".to_string(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_booking_status_rejects_unknown_values() {
        let result = parse_booking_status_input(Some("UNKNOWN"));
        assert!(matches!(result, Err(DomainError::InvalidInput(_))));
    }

    #[test]
    fn validate_len_range_rejects_short_values() {
        let result = validate_len_range("username", "ab", 3, 50);
        assert!(matches!(result, Err(DomainError::InvalidInput(_))));
    }
}
