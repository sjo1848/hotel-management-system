use crate::application::audit_service::AuditService;
use crate::application::maintenance_service::MaintenanceService;
use crate::application::room_service::RoomService;
use crate::domain::errors::DomainError;
use crate::domain::models::{
    BookingStatus, HousekeepingBoard, HousekeepingBoardRoom, HousekeepingDeparture,
    MaintenanceCase, MaintenancePriority, Room, RoomStatus,
};
use crate::domain::repositories::{BookingRepository, RoomRepository};
use chrono::NaiveDate;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

pub struct HousekeepingService {
    room_repo: Arc<dyn RoomRepository>,
    booking_repo: Arc<dyn BookingRepository>,
    room_service: Arc<RoomService>,
    audit_service: Arc<AuditService>,
    maintenance_service: Arc<MaintenanceService>,
}

impl HousekeepingService {
    pub fn new(
        room_repo: Arc<dyn RoomRepository>,
        booking_repo: Arc<dyn BookingRepository>,
        room_service: Arc<RoomService>,
        audit_service: Arc<AuditService>,
        maintenance_service: Arc<MaintenanceService>,
    ) -> Self {
        Self {
            room_repo,
            booking_repo,
            room_service,
            audit_service,
            maintenance_service,
        }
    }

    pub async fn list_dirty_rooms(&self, hotel_id: Uuid) -> Result<Vec<Room>, DomainError> {
        let rooms = self
            .room_repo
            .find_all(hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)?;

        Ok(rooms
            .into_iter()
            .filter(|r| matches!(r.status, RoomStatus::Dirty | RoomStatus::Cleaning))
            .collect())
    }

    pub async fn get_board(
        &self,
        hotel_id: Uuid,
        date: NaiveDate,
    ) -> Result<HousekeepingBoard, DomainError> {
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
        let maintenance_cases = self.maintenance_service.list_open(hotel_id).await?;
        let rooms_by_id: HashMap<Uuid, &Room> = rooms.iter().map(|room| (room.id, room)).collect();

        let departures_today: Vec<HousekeepingDeparture> = bookings
            .iter()
            .filter(|booking| {
                booking.check_out == date
                    && !matches!(
                        booking.status,
                        BookingStatus::Cancelled | BookingStatus::NoShow
                    )
            })
            .filter_map(|booking| {
                rooms_by_id
                    .get(&booking.room_id)
                    .map(|room| HousekeepingDeparture {
                        booking_id: booking.id,
                        room_id: room.id,
                        room_number: room.room_number.clone(),
                        room_type: room.room_type.clone(),
                        room_status: room.status.clone(),
                        guest_name: booking.guest_name.clone(),
                        booking_status: booking.status.clone(),
                    })
            })
            .collect();
        let departures_by_room: HashMap<Uuid, &HousekeepingDeparture> = departures_today
            .iter()
            .map(|departure| (departure.room_id, departure))
            .collect();
        let maintenance_by_room: HashMap<Uuid, &MaintenanceCase> = maintenance_cases
            .iter()
            .map(|case| (case.room_id, case))
            .collect();

        let board_rooms = rooms
            .iter()
            .filter(|room| {
                matches!(
                    room.status,
                    RoomStatus::Dirty
                        | RoomStatus::Cleaning
                        | RoomStatus::Available
                        | RoomStatus::Maintenance
                )
            })
            .map(|room| {
                let departure = departures_by_room.get(&room.id);
                HousekeepingBoardRoom {
                    room_id: room.id,
                    room_number: room.room_number.clone(),
                    room_type: room.room_type.clone(),
                    room_status: room.status.clone(),
                    turnover_today: departure.is_some(),
                    departure_guest_name: departure.map(|item| item.guest_name.clone()),
                    departure_booking_status: departure.map(|item| item.booking_status.clone()),
                    maintenance_case: maintenance_by_room
                        .get(&room.id)
                        .map(|case| (*case).clone()),
                }
            })
            .collect();

        Ok(HousekeepingBoard {
            date,
            rooms: board_rooms,
            departures_today,
        })
    }

    pub async fn start_cleaning(&self, hotel_id: Uuid, room_id: Uuid) -> Result<(), DomainError> {
        self.room_service
            .update_room_status(hotel_id, room_id, RoomStatus::Cleaning)
            .await?;

        self.audit_service
            .record(
                Some(hotel_id),
                None,
                &format!("Cleaning started for room {}", room_id),
                None,
            )
            .await;
        Ok(())
    }

    pub async fn finish_cleaning(&self, hotel_id: Uuid, room_id: Uuid) -> Result<(), DomainError> {
        self.room_service
            .update_room_status(hotel_id, room_id, RoomStatus::Available)
            .await?;

        self.audit_service
            .record(
                Some(hotel_id),
                None,
                &format!("Cleaning finished for room {}", room_id),
                None,
            )
            .await;
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn mark_maintenance(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        actor_user_id: Uuid,
        priority: MaintenancePriority,
        reason: String,
        assigned_to: String,
    ) -> Result<MaintenanceCase, DomainError> {
        self.maintenance_service
            .open(
                hotel_id,
                room_id,
                actor_user_id,
                priority,
                reason,
                assigned_to,
            )
            .await
    }

    pub async fn return_to_dirty(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        actor_user_id: Uuid,
        resolution_note: String,
    ) -> Result<MaintenanceCase, DomainError> {
        self.maintenance_service
            .resolve(hotel_id, room_id, actor_user_id, resolution_note)
            .await
    }
}
