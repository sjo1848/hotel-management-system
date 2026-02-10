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
pub struct Booking {
    pub id: Uuid,
    pub room_id: Uuid,
    pub guest_name: String,
    pub check_in: NaiveDate,
    pub check_out: NaiveDate,
}

impl Booking {
    /// Lógica pura de dominio: ¿Se solapa esta reserva con un rango de fechas dado?
    /// La regla matemática de colisión de intervalos es:
    /// (InicioA < FinB) AND (FinA > InicioB)
    pub fn overlaps_with(&self, start: NaiveDate, end: NaiveDate) -> bool {
        self.check_in < end && self.check_out > start
    }

    /// Valida si la reserva es consistente (el check-out no puede ser antes o igual al check-in)
    pub fn is_valid(&self) -> bool {
        self.check_out > self.check_in
    }
}
