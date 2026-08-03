use crate::application::room_hold_service::RoomHoldService;
use crate::domain::errors::DomainError;
use crate::domain::models::{
    Booking, BookingStatus, FrontDeskActionKind, FrontDeskBlocker, FrontDeskBoard,
    FrontDeskBoardEntry, FrontDeskQueueItem, Room, RoomHoldBoardEntry, RoomStatus,
};
use crate::domain::repositories::{BookingRepository, RoomRepository};
use chrono::{Duration, NaiveDate};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

pub struct FrontDeskService {
    booking_repo: Arc<dyn BookingRepository>,
    room_repo: Arc<dyn RoomRepository>,
    room_hold_service: Arc<RoomHoldService>,
}

impl FrontDeskService {
    pub fn new(
        booking_repo: Arc<dyn BookingRepository>,
        room_repo: Arc<dyn RoomRepository>,
        room_hold_service: Arc<RoomHoldService>,
    ) -> Self {
        Self {
            booking_repo,
            room_repo,
            room_hold_service,
        }
    }

    pub async fn get_board(
        &self,
        hotel_id: Uuid,
        date: NaiveDate,
    ) -> Result<FrontDeskBoard, DomainError> {
        let next_day = date + Duration::days(1);
        let rooms = self
            .room_repo
            .find_all(hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)?;
        let bookings = self
            .booking_repo
            .find_all(hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)?;
        let holds_today = self
            .room_hold_service
            .list_hold_board(hotel_id, date, next_day)
            .await?;

        let room_map: HashMap<Uuid, Room> = rooms.into_iter().map(|room| (room.id, room)).collect();
        let mut holds_by_room: HashMap<Uuid, Vec<RoomHoldBoardEntry>> = HashMap::new();
        for hold in &holds_today {
            holds_by_room
                .entry(hold.room_id)
                .or_default()
                .push(hold.clone());
        }

        let mut arrivals_ready = Vec::new();
        let mut arrivals_blocked = Vec::new();
        let mut departures_today = Vec::new();
        let mut in_house = Vec::new();

        for booking in bookings {
            let Some(room) = room_map.get(&booking.room_id) else {
                continue;
            };
            if booking.status == BookingStatus::Confirmed && booking.check_in == date {
                let blocker = match holds_by_room
                    .get(&room.id)
                    .and_then(|entries| entries.first())
                    .cloned()
                {
                    Some(hold) => Some(FrontDeskBlocker {
                        kind: "hold".to_string(),
                        title: format!("Bloqueo {}", stringify_hold_type(&hold.hold_type)),
                        detail: hold.reason,
                    }),
                    None => room_status_blocker(&room.status),
                };
                let entry = to_front_desk_entry(&booking, room, blocker.clone());
                if blocker.is_some() {
                    arrivals_blocked.push(entry);
                } else {
                    arrivals_ready.push(entry);
                }
                continue;
            }

            if booking.status == BookingStatus::CheckedIn && booking.check_out == date {
                departures_today.push(to_front_desk_entry(&booking, room, None));
                continue;
            }

            if booking.status == BookingStatus::CheckedIn
                && booking.check_in <= date
                && booking.check_out > date
            {
                in_house.push(to_front_desk_entry(&booking, room, None));
            }
        }

        arrivals_ready.sort_by(|left, right| left.room_number.cmp(&right.room_number));
        arrivals_blocked.sort_by(|left, right| left.room_number.cmp(&right.room_number));
        departures_today.sort_by(|left, right| left.room_number.cmp(&right.room_number));
        in_house.sort_by(|left, right| left.room_number.cmp(&right.room_number));
        let action_queue = build_action_queue(
            &arrivals_blocked,
            &departures_today,
            &arrivals_ready,
            &in_house,
        );

        Ok(FrontDeskBoard {
            date,
            arrivals_ready,
            arrivals_blocked,
            departures_today,
            in_house,
            holds_today,
            action_queue,
        })
    }
}

fn build_action_queue(
    arrivals_blocked: &[FrontDeskBoardEntry],
    departures_today: &[FrontDeskBoardEntry],
    arrivals_ready: &[FrontDeskBoardEntry],
    in_house: &[FrontDeskBoardEntry],
) -> Vec<FrontDeskQueueItem> {
    let mut action_queue = Vec::new();

    action_queue.extend(arrivals_blocked.iter().cloned().map(|entry| {
        FrontDeskQueueItem {
            title: "Caso bloqueado".to_string(),
            detail: entry
                .blocker
                .as_ref()
                .map(|blocker| blocker.detail.clone())
                .unwrap_or_else(|| {
                    "Hay una incidencia operativa que impide iniciar el check-in.".to_string()
                }),
            lane: "Bloqueada".to_string(),
            primary_label: "Resolver caso".to_string(),
            action_kind: FrontDeskActionKind::OpenBooking,
            entry,
        }
    }));

    action_queue.extend(
        departures_today
            .iter()
            .cloned()
            .map(|entry| FrontDeskQueueItem {
                title: "Salida a cerrar".to_string(),
                detail: "Necesita checkout formal, cuenta revisada y liberacion de habitacion."
                    .to_string(),
                lane: "Salida".to_string(),
                primary_label: "Abrir checkout".to_string(),
                action_kind: FrontDeskActionKind::OpenBooking,
                entry,
            }),
    );

    action_queue.extend(
        arrivals_ready
            .iter()
            .cloned()
            .map(|entry| FrontDeskQueueItem {
                title: "Check-in listo".to_string(),
                detail: "La habitacion ya esta en condiciones para iniciar el ingreso formal."
                    .to_string(),
                lane: "Check-in listo".to_string(),
                primary_label: "Preparar check-in".to_string(),
                action_kind: FrontDeskActionKind::PrepareCheckIn,
                entry,
            }),
    );

    action_queue.extend(
        in_house.iter().cloned().map(|entry| FrontDeskQueueItem {
            title: "Seguimiento en casa".to_string(),
            detail: "Mantene a mano la reserva para excepciones, cobros o cambio de habitacion."
                .to_string(),
            lane: "En casa".to_string(),
            primary_label: "Gestionar reserva".to_string(),
            action_kind: FrontDeskActionKind::OpenBooking,
            entry,
        }),
    );

    action_queue
}

fn to_front_desk_entry(
    booking: &Booking,
    room: &Room,
    blocker: Option<FrontDeskBlocker>,
) -> FrontDeskBoardEntry {
    FrontDeskBoardEntry {
        booking_id: booking.id,
        room_id: room.id,
        room_number: room.room_number.clone(),
        room_type: room.room_type.clone(),
        guest_name: booking.guest_name.clone(),
        check_in: booking.check_in,
        check_out: booking.check_out,
        booking_status: booking.status.clone(),
        room_status: room.status.clone(),
        total_price_cents: booking.total_price_cents,
        operational_data: booking.operational_data.clone(),
        blocker,
    }
}

fn room_status_blocker(status: &RoomStatus) -> Option<FrontDeskBlocker> {
    match status {
        RoomStatus::Available => None,
        RoomStatus::Dirty => Some(FrontDeskBlocker {
            kind: "room-status".to_string(),
            title: "Habitacion sucia".to_string(),
            detail: "Housekeeping aun no libero la habitacion.".to_string(),
        }),
        RoomStatus::Cleaning => Some(FrontDeskBlocker {
            kind: "room-status".to_string(),
            title: "En limpieza".to_string(),
            detail: "La habitacion sigue en proceso de limpieza.".to_string(),
        }),
        RoomStatus::Maintenance => Some(FrontDeskBlocker {
            kind: "room-status".to_string(),
            title: "Mantenimiento".to_string(),
            detail: "La habitacion esta fuera de servicio.".to_string(),
        }),
        RoomStatus::Occupied => Some(FrontDeskBlocker {
            kind: "room-status".to_string(),
            title: "Ocupada".to_string(),
            detail: "La habitacion sigue ocupada por otra estadia.".to_string(),
        }),
    }
}

fn stringify_hold_type(hold_type: &crate::domain::models::RoomHoldType) -> &'static str {
    match hold_type {
        crate::domain::models::RoomHoldType::Vip => "VIP",
        crate::domain::models::RoomHoldType::Maintenance => "Mantenimiento",
        crate::domain::models::RoomHoldType::Owner => "Owner",
        crate::domain::models::RoomHoldType::Compliance => "Compliance",
        crate::domain::models::RoomHoldType::Commercial => "Comercial",
        crate::domain::models::RoomHoldType::Other => "Otro",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::models::BookingOperationalData;
    use chrono::NaiveDate;
    use uuid::Uuid;

    fn front_desk_entry(
        booking_id: Uuid,
        room_number: &str,
        guest_name: &str,
        blocker: Option<FrontDeskBlocker>,
    ) -> FrontDeskBoardEntry {
        FrontDeskBoardEntry {
            booking_id,
            room_id: Uuid::new_v4(),
            room_number: room_number.to_string(),
            room_type: "Suite".to_string(),
            guest_name: guest_name.to_string(),
            check_in: NaiveDate::from_ymd_opt(2026, 3, 9).unwrap(),
            check_out: NaiveDate::from_ymd_opt(2026, 3, 10).unwrap(),
            booking_status: BookingStatus::Confirmed,
            room_status: RoomStatus::Available,
            total_price_cents: 25_000,
            operational_data: BookingOperationalData::default(),
            blocker,
        }
    }

    #[test]
    fn build_action_queue_prioritizes_blocked_then_departures_then_ready_then_in_house() {
        let blocked = vec![front_desk_entry(
            Uuid::new_v4(),
            "103",
            "Bloqueado",
            Some(FrontDeskBlocker {
                kind: "hold".to_string(),
                title: "Bloqueo".to_string(),
                detail: "Hold activo".to_string(),
            }),
        )];
        let departures = vec![front_desk_entry(Uuid::new_v4(), "201", "Salida", None)];
        let ready = vec![front_desk_entry(Uuid::new_v4(), "102", "Checkin", None)];
        let in_house = vec![front_desk_entry(Uuid::new_v4(), "301", "En Casa", None)];

        let action_queue = build_action_queue(&blocked, &departures, &ready, &in_house);

        assert_eq!(action_queue.len(), 4);
        assert_eq!(action_queue[0].lane, "Bloqueada");
        assert_eq!(action_queue[1].lane, "Salida");
        assert_eq!(action_queue[2].lane, "Check-in listo");
        assert_eq!(action_queue[3].lane, "En casa");
        assert!(matches!(
            action_queue[2].action_kind,
            FrontDeskActionKind::PrepareCheckIn
        ));
    }
}
