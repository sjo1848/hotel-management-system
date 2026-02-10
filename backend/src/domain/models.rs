use chrono::NaiveDate;
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub enum RoomStatus {
    Available,
    Occupied,
    Dirty,
    Maintenance,
}

#[derive(Debug, Clone, Serialize)]
pub struct Room {
    pub id: Uuid,
    pub room_number: String,
    pub room_type: String,
    pub status: RoomStatus,
    pub price_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
pub enum BookingStatus {
    Confirmed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
pub struct Booking {
    pub id: Uuid,
    pub room_id: Uuid,
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
            room_id: Uuid::new_v4(),
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
            room_id: Uuid::new_v4(),
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
            room_id: Uuid::new_v4(),
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

#[derive(Debug, Clone, Serialize)]
pub struct Guest {
    pub id: Uuid,
    pub full_name: String,
    pub email: String,
    pub phone: Option<String>,
}
