use crate::domain::errors::DomainError;
use crate::domain::models::{
    Booking, BookingOperationalData, BookingOperationalUpdate, BookingStatus, RoomStatus,
};
use crate::domain::repositories::BookingTransactionRepository;
use crate::infrastructure::repository::tenant_context::begin_tenant_tx;
use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::postgres::PgPool;
use sqlx::Row;
use uuid::Uuid;

pub struct PostgresBookingTransactionRepository {
    pool: PgPool,
}

impl PostgresBookingTransactionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BookingTransactionRepository for PostgresBookingTransactionRepository {
    #[allow(clippy::too_many_arguments)]
    async fn update_booking_transactional(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
        actor_user_id: Option<Uuid>,
        guest_id: Option<Uuid>,
        guest_name: Option<String>,
        room_id: Option<Uuid>,
        check_in: Option<NaiveDate>,
        check_out: Option<NaiveDate>,
        status: Option<BookingStatus>,
        operational_note: Option<String>,
        operational_update: Option<BookingOperationalUpdate>,
    ) -> Result<Booking, DomainError> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)?;

        let existing = sqlx::query(
            "SELECT id, hotel_id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status,
                    check_in_guests_count, check_in_reference, check_in_document_verified,
                    check_in_contact_confirmed, check_in_stay_confirmed, checked_in_at, checked_in_by_user_id,
                    check_out_payment_policy, check_out_reference, check_out_charges_reviewed,
                    check_out_room_release_confirmed, check_out_housekeeping_handoff, checked_out_at, checked_out_by_user_id,
                    terminal_reason, terminal_recorded_at, terminal_recorded_by_user_id,
                    late_arrival_eta, late_arrival_note, late_arrival_recorded_at, late_arrival_recorded_by_user_id
             FROM bookings
             WHERE hotel_id = $1 AND id = $2
             FOR UPDATE",
        )
        .bind(hotel_id)
        .bind(booking_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(map_sql_error)?;

        let Some(row) = existing else {
            return Err(DomainError::BookingNotFound);
        };

        let mut booking = Booking {
            id: row.try_get("id").map_err(map_sql_error)?,
            hotel_id: row.try_get("hotel_id").map_err(map_sql_error)?,
            room_id: row.try_get("room_id").map_err(map_sql_error)?,
            guest_id: row.try_get("guest_id").ok(),
            guest_name: row.try_get("guest_name").map_err(map_sql_error)?,
            check_in: row.try_get("check_in").map_err(map_sql_error)?,
            check_out: row.try_get("check_out").map_err(map_sql_error)?,
            total_price_cents: row.try_get("total_price_cents").unwrap_or(0),
            status: parse_booking_status(
                row.try_get::<Option<String>, _>("status")
                    .ok()
                    .flatten()
                    .as_deref(),
            ),
            operational_data: BookingOperationalData {
                check_in_guests_count: row.try_get("check_in_guests_count").ok(),
                check_in_reference: row.try_get("check_in_reference").ok(),
                check_in_document_verified: row.try_get("check_in_document_verified").ok(),
                check_in_contact_confirmed: row.try_get("check_in_contact_confirmed").ok(),
                check_in_stay_confirmed: row.try_get("check_in_stay_confirmed").ok(),
                checked_in_at: row.try_get("checked_in_at").ok(),
                checked_in_by_user_id: row.try_get("checked_in_by_user_id").ok(),
                check_out_payment_policy: row.try_get("check_out_payment_policy").ok(),
                check_out_reference: row.try_get("check_out_reference").ok(),
                check_out_charges_reviewed: row.try_get("check_out_charges_reviewed").ok(),
                check_out_room_release_confirmed: row
                    .try_get("check_out_room_release_confirmed")
                    .ok(),
                check_out_housekeeping_handoff: row.try_get("check_out_housekeeping_handoff").ok(),
                checked_out_at: row.try_get("checked_out_at").ok(),
                checked_out_by_user_id: row.try_get("checked_out_by_user_id").ok(),
                terminal_reason: row.try_get("terminal_reason").ok(),
                terminal_recorded_at: row.try_get("terminal_recorded_at").ok(),
                terminal_recorded_by_user_id: row.try_get("terminal_recorded_by_user_id").ok(),
                late_arrival_eta: row.try_get("late_arrival_eta").ok(),
                late_arrival_note: row.try_get("late_arrival_note").ok(),
                late_arrival_recorded_at: row.try_get("late_arrival_recorded_at").ok(),
                late_arrival_recorded_by_user_id: row
                    .try_get("late_arrival_recorded_by_user_id")
                    .ok(),
            },
        };
        let original_room_id = booking.room_id;
        let original_status = booking.status.clone();

        if let Some(gid) = guest_id {
            let guest_exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (
                    SELECT 1
                    FROM guests
                    WHERE hotel_id = $1 AND id = $2
                )",
            )
            .bind(hotel_id)
            .bind(gid)
            .fetch_one(&mut *tx)
            .await
            .map_err(map_sql_error)?;

            if !guest_exists {
                return Err(DomainError::GuestNotFound);
            }
            booking.guest_id = Some(gid);
        }

        if let Some(name) = guest_name {
            booking.guest_name = name;
        }

        if let Some(new_room_id) = room_id {
            booking.room_id = new_room_id;
        }

        if let Some(new_check_in) = check_in {
            booking.check_in = new_check_in;
        }

        if let Some(new_check_out) = check_out {
            booking.check_out = new_check_out;
        }

        if let Some(new_status) = status {
            booking.status = new_status;
        }

        let terminal_reason_requested = operational_update
            .as_ref()
            .and_then(|update| update.terminal_reason.as_deref())
            .is_some();
        let late_arrival_requested = operational_update.as_ref().is_some_and(|update| {
            update.late_arrival_eta.is_some() || update.late_arrival_note.is_some()
        });

        if let Some(operational_update) = operational_update {
            merge_operational_update(&mut booking.operational_data, operational_update);
        }

        if !booking.is_valid() {
            return Err(DomainError::InvalidBookingDates);
        }

        let room_changed = booking.room_id != original_room_id;
        let status_changed = booking.status != original_status;

        if status_changed && !original_status.can_transition_to(&booking.status) {
            return Err(DomainError::InvalidInput(format!(
                "Transicion de reserva invalida: {} -> {}",
                booking_status_to_db(&original_status),
                booking_status_to_db(&booking.status)
            )));
        }

        if status_changed
            && matches!(
                booking.status,
                BookingStatus::Cancelled | BookingStatus::NoShow
            )
            && booking
                .operational_data
                .terminal_reason
                .as_deref()
                .is_none_or(|reason| reason.trim().len() < 6)
        {
            return Err(DomainError::InvalidInput(
                "La cancelacion o no-show requiere un motivo de al menos 6 caracteres".to_string(),
            ));
        }

        if terminal_reason_requested
            && !(status_changed
                && matches!(
                    booking.status,
                    BookingStatus::Cancelled | BookingStatus::NoShow
                ))
        {
            return Err(DomainError::InvalidInput(
                "El motivo terminal solo puede registrarse al cancelar o marcar no-show"
                    .to_string(),
            ));
        }

        if status_changed
            && booking.status == BookingStatus::NoShow
            && chrono::Utc::now().date_naive() < booking.check_in
        {
            return Err(DomainError::InvalidInput(
                "No se puede marcar no-show antes de la fecha de llegada".to_string(),
            ));
        }

        if late_arrival_requested {
            let eta = booking.operational_data.late_arrival_eta.ok_or_else(|| {
                DomainError::InvalidInput(
                    "La llegada tardia requiere una hora estimada".to_string(),
                )
            })?;
            let note_is_valid = booking
                .operational_data
                .late_arrival_note
                .as_deref()
                .is_some_and(|note| note.trim().len() >= 6);
            if !note_is_valid {
                return Err(DomainError::InvalidInput(
                    "La llegada tardia requiere una nota de al menos 6 caracteres".to_string(),
                ));
            }
            if original_status != BookingStatus::Confirmed
                || booking.status != BookingStatus::Confirmed
            {
                return Err(DomainError::InvalidInput(
                    "Solo una reserva confirmada puede registrar llegada tardia".to_string(),
                ));
            }
            if eta <= chrono::Utc::now().naive_utc()
                || eta.date() < booking.check_in
                || eta.date() >= booking.check_out
            {
                return Err(DomainError::InvalidInput(
                    "La ETA debe ser futura y estar dentro de las fechas de la reserva".to_string(),
                ));
            }
        }

        if status_changed
            && booking.status == BookingStatus::CheckedIn
            && (!booking.operational_data.is_check_in_complete()
                || booking.guest_name.trim().is_empty())
        {
            return Err(DomainError::InvalidInput(
                "El check-in requiere huesped, cantidad e identidad, contacto y estadia confirmados"
                    .to_string(),
            ));
        }

        if status_changed
            && booking.status == BookingStatus::CheckedOut
            && !booking.operational_data.is_check_out_complete()
        {
            return Err(DomainError::InvalidInput(
                "El checkout requiere politica de saldo, revision de cargos, liberacion de habitacion y handoff a housekeeping"
                    .to_string(),
            ));
        }

        if room_changed
            && matches!(
                booking.status,
                BookingStatus::CheckedOut | BookingStatus::Cancelled | BookingStatus::NoShow
            )
        {
            return Err(DomainError::InvalidInput(
                "No se puede reasignar una reserva finalizada o cancelada".to_string(),
            ));
        }

        let has_overlap = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (
                SELECT 1
                FROM bookings
                WHERE hotel_id = $1
                  AND id <> $2
                  AND room_id = $3
                  AND status NOT IN ('CANCELLED', 'NO_SHOW')
                  AND check_in < $5
                  AND check_out > $4
            )",
        )
        .bind(hotel_id)
        .bind(booking.id)
        .bind(booking.room_id)
        .bind(booking.check_in)
        .bind(booking.check_out)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_sql_error)?;

        if has_overlap {
            return Err(DomainError::RoomNotAvailable);
        }

        let has_hold = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (
                SELECT 1
                FROM room_holds
                WHERE hotel_id = $1
                  AND room_id = $2
                  AND start_date < $4
                  AND end_date > $3
            )",
        )
        .bind(hotel_id)
        .bind(booking.room_id)
        .bind(booking.check_in)
        .bind(booking.check_out)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_sql_error)?;

        if has_hold
            && !matches!(
                booking.status,
                BookingStatus::Cancelled | BookingStatus::NoShow
            )
        {
            return Err(DomainError::RoomNotAvailable);
        }

        let room = sqlx::query(
            "SELECT id, hotel_id, room_number, room_type, status, price_cents
             FROM rooms
             WHERE hotel_id = $1 AND id = $2
             FOR UPDATE",
        )
        .bind(hotel_id)
        .bind(booking.room_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(map_sql_error)?;

        let Some(room_row) = room else {
            return Err(DomainError::RoomNotFound);
        };

        let room_status = parse_room_status(
            room_row
                .try_get::<Option<String>, _>("status")
                .ok()
                .flatten()
                .as_deref(),
        );

        if status_changed
            && booking.status == BookingStatus::CheckedOut
            && room_status != RoomStatus::Occupied
        {
            return Err(DomainError::InvalidInput(
                "La habitacion debe estar ocupada antes del checkout".to_string(),
            ));
        }

        if (room_changed || status_changed && matches!(booking.status, BookingStatus::CheckedIn))
            && room_status != RoomStatus::Available
        {
            return Err(DomainError::RoomNotAvailable);
        }

        let room_price_cents: i64 = room_row.try_get("price_cents").map_err(map_sql_error)?;
        booking.calculate_total_price(room_price_cents);
        let extra_charges_total: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(amount_cents), 0)::BIGINT
             FROM extra_charges
             WHERE hotel_id = $1 AND booking_id = $2",
        )
        .bind(hotel_id)
        .bind(booking.id)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_sql_error)?;
        booking.total_price_cents += extra_charges_total;
        let mut checkout_override_audit: Option<(i64, String)> = None;

        if status_changed
            && booking.status == BookingStatus::CheckedOut
            && booking.operational_data.check_out_payment_policy.as_deref() == Some("settled")
        {
            let invoice = sqlx::query(
                "SELECT paid_amount_cents, status
                 FROM invoices
                 WHERE hotel_id = $1 AND booking_id = $2
                 FOR UPDATE",
            )
            .bind(hotel_id)
            .bind(booking.id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(map_sql_error)?;
            let account_is_settled = invoice.is_some_and(|row| {
                let paid_amount_cents = row.try_get::<i64, _>("paid_amount_cents").unwrap_or(0);
                let invoice_status = row.try_get::<String, _>("status").unwrap_or_default();
                invoice_status == "PAID" && paid_amount_cents >= booking.total_price_cents
            });

            if !account_is_settled {
                return Err(DomainError::InvalidInput(
                    "La cuenta debe estar completamente cobrada antes del checkout contable"
                        .to_string(),
                ));
            }
        }

        if status_changed
            && booking.status == BookingStatus::CheckedOut
            && booking.operational_data.check_out_payment_policy.as_deref()
                == Some("pending-approved")
        {
            let paid_amount_cents = sqlx::query_scalar::<_, i64>(
                "SELECT paid_amount_cents
                 FROM invoices
                 WHERE hotel_id = $1 AND booking_id = $2
                 FOR UPDATE",
            )
            .bind(hotel_id)
            .bind(booking.id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(map_sql_error)?
            .unwrap_or(0);
            let outstanding_amount_cents = booking
                .total_price_cents
                .saturating_sub(paid_amount_cents)
                .max(0);
            if outstanding_amount_cents == 0 {
                return Err(DomainError::InvalidInput(
                    "No existe saldo pendiente para autorizar".to_string(),
                ));
            }
            let reference = booking
                .operational_data
                .check_out_reference
                .clone()
                .ok_or_else(|| {
                    DomainError::InvalidInput(
                        "El override de saldo requiere referencia operativa".to_string(),
                    )
                })?;
            checkout_override_audit = Some((outstanding_amount_cents, reference));
        }

        if status_changed {
            match booking.status {
                BookingStatus::CheckedIn => {
                    booking.operational_data.checked_in_at = Some(chrono::Utc::now().naive_utc());
                    booking.operational_data.checked_in_by_user_id = actor_user_id;
                }
                BookingStatus::CheckedOut => {
                    booking.operational_data.checked_out_at = Some(chrono::Utc::now().naive_utc());
                    booking.operational_data.checked_out_by_user_id = actor_user_id;
                }
                BookingStatus::Cancelled | BookingStatus::NoShow => {
                    booking.operational_data.terminal_recorded_at =
                        Some(chrono::Utc::now().naive_utc());
                    booking.operational_data.terminal_recorded_by_user_id = actor_user_id;
                }
                BookingStatus::Confirmed => {}
            }
        }

        if late_arrival_requested {
            booking.operational_data.late_arrival_recorded_at =
                Some(chrono::Utc::now().naive_utc());
            booking.operational_data.late_arrival_recorded_by_user_id = actor_user_id;
        }

        let result = sqlx::query(
            "UPDATE bookings
             SET guest_id = $1, guest_name = $2, room_id = $3, check_in = $4, check_out = $5, total_price_cents = $6, status = $7,
                 check_in_guests_count = $8, check_in_reference = $9, check_in_document_verified = $10,
                 check_in_contact_confirmed = $11, check_in_stay_confirmed = $12, checked_in_at = $13, checked_in_by_user_id = $14,
                 check_out_payment_policy = $15, check_out_reference = $16, check_out_charges_reviewed = $17,
                 check_out_room_release_confirmed = $18, check_out_housekeeping_handoff = $19, checked_out_at = $20, checked_out_by_user_id = $21,
                 terminal_reason = $22, terminal_recorded_at = $23, terminal_recorded_by_user_id = $24,
                 late_arrival_eta = $25, late_arrival_note = $26, late_arrival_recorded_at = $27, late_arrival_recorded_by_user_id = $28
             WHERE hotel_id = $29 AND id = $30",
        )
        .bind(booking.guest_id)
        .bind(&booking.guest_name)
        .bind(booking.room_id)
        .bind(booking.check_in)
        .bind(booking.check_out)
        .bind(booking.total_price_cents)
        .bind(booking_status_to_db(&booking.status))
        .bind(booking.operational_data.check_in_guests_count)
        .bind(&booking.operational_data.check_in_reference)
        .bind(booking.operational_data.check_in_document_verified)
        .bind(booking.operational_data.check_in_contact_confirmed)
        .bind(booking.operational_data.check_in_stay_confirmed)
        .bind(booking.operational_data.checked_in_at)
        .bind(booking.operational_data.checked_in_by_user_id)
        .bind(&booking.operational_data.check_out_payment_policy)
        .bind(&booking.operational_data.check_out_reference)
        .bind(booking.operational_data.check_out_charges_reviewed)
        .bind(booking.operational_data.check_out_room_release_confirmed)
        .bind(booking.operational_data.check_out_housekeeping_handoff)
        .bind(booking.operational_data.checked_out_at)
        .bind(booking.operational_data.checked_out_by_user_id)
        .bind(&booking.operational_data.terminal_reason)
        .bind(booking.operational_data.terminal_recorded_at)
        .bind(booking.operational_data.terminal_recorded_by_user_id)
        .bind(booking.operational_data.late_arrival_eta)
        .bind(&booking.operational_data.late_arrival_note)
        .bind(booking.operational_data.late_arrival_recorded_at)
        .bind(booking.operational_data.late_arrival_recorded_by_user_id)
        .bind(booking.hotel_id)
        .bind(booking.id)
        .execute(&mut *tx)
        .await
        .map_err(map_sql_error)?;

        if result.rows_affected() == 0 {
            return Err(DomainError::BookingNotFound);
        }

        if room_changed {
            match booking.status {
                BookingStatus::CheckedIn => {
                    if original_status == BookingStatus::CheckedIn {
                        update_room_status_tx(
                            &mut tx,
                            hotel_id,
                            original_room_id,
                            RoomStatus::Dirty,
                        )
                        .await?;
                    }
                    update_room_status_tx(&mut tx, hotel_id, booking.room_id, RoomStatus::Occupied)
                        .await?;
                    insert_audit_tx(
                        &mut tx,
                        hotel_id,
                        actor_user_id,
                        build_room_reassignment_audit(
                            booking.id,
                            original_room_id,
                            booking.room_id,
                            operational_note.as_deref(),
                        ),
                    )
                    .await?;
                }
                BookingStatus::Confirmed => {
                    insert_audit_tx(
                        &mut tx,
                        hotel_id,
                        actor_user_id,
                        build_room_reassignment_audit(
                            booking.id,
                            original_room_id,
                            booking.room_id,
                            operational_note.as_deref(),
                        ),
                    )
                    .await?;
                }
                BookingStatus::CheckedOut | BookingStatus::Cancelled | BookingStatus::NoShow => {}
            }
        }

        if status_changed {
            match booking.status {
                BookingStatus::CheckedIn => {
                    if !room_changed {
                        update_room_status_tx(
                            &mut tx,
                            hotel_id,
                            booking.room_id,
                            RoomStatus::Occupied,
                        )
                        .await?;
                    }
                    insert_audit_tx(
                        &mut tx,
                        hotel_id,
                        actor_user_id,
                        format!("Check-in: Booking {}", booking.id),
                    )
                    .await?;
                }
                BookingStatus::CheckedOut => {
                    update_room_status_tx(&mut tx, hotel_id, booking.room_id, RoomStatus::Dirty)
                        .await?;
                    insert_audit_tx(
                        &mut tx,
                        hotel_id,
                        actor_user_id,
                        format!("Check-out: Booking {}", booking.id),
                    )
                    .await?;
                    if let Some((outstanding_amount_cents, reference)) =
                        checkout_override_audit.as_ref()
                    {
                        insert_audit_tx(
                            &mut tx,
                            hotel_id,
                            actor_user_id,
                            build_checkout_override_audit(
                                booking.id,
                                *outstanding_amount_cents,
                                reference,
                            ),
                        )
                        .await?;
                    }
                    insert_invoice_if_missing_tx(
                        &mut tx,
                        hotel_id,
                        booking.id,
                        booking.total_price_cents,
                    )
                    .await?;
                }
                BookingStatus::Cancelled => {
                    let reason = booking
                        .operational_data
                        .terminal_reason
                        .as_deref()
                        .unwrap_or_default();
                    insert_audit_tx(
                        &mut tx,
                        hotel_id,
                        actor_user_id,
                        truncate_audit_action(format!(
                            "CANCEL booking={} reason={}",
                            booking.id,
                            reason.trim()
                        )),
                    )
                    .await?;
                }
                BookingStatus::NoShow => {
                    let reason = booking
                        .operational_data
                        .terminal_reason
                        .as_deref()
                        .unwrap_or_default();
                    insert_audit_tx(
                        &mut tx,
                        hotel_id,
                        actor_user_id,
                        truncate_audit_action(format!(
                            "NO_SHOW booking={} reason={}",
                            booking.id,
                            reason.trim()
                        )),
                    )
                    .await?;
                }
                BookingStatus::Confirmed => {}
            }
        }

        if late_arrival_requested {
            insert_audit_tx(
                &mut tx,
                hotel_id,
                actor_user_id,
                truncate_audit_action(format!(
                    "LATE_ARRIVAL booking={} eta={} note={}",
                    booking.id,
                    booking
                        .operational_data
                        .late_arrival_eta
                        .map(|eta| eta.to_string())
                        .unwrap_or_else(|| "missing".to_string()),
                    booking
                        .operational_data
                        .late_arrival_note
                        .as_deref()
                        .unwrap_or_default()
                        .trim()
                )),
            )
            .await?;
        }

        tx.commit().await.map_err(map_sql_error)?;
        Ok(booking)
    }
}

fn parse_booking_status(value: Option<&str>) -> BookingStatus {
    match value {
        Some("CHECKED_IN") => BookingStatus::CheckedIn,
        Some("CHECKED_OUT") => BookingStatus::CheckedOut,
        Some("CANCELLED") => BookingStatus::Cancelled,
        Some("NO_SHOW") => BookingStatus::NoShow,
        _ => BookingStatus::Confirmed,
    }
}

fn merge_operational_update(target: &mut BookingOperationalData, update: BookingOperationalUpdate) {
    if let Some(value) = update.check_in_guests_count {
        target.check_in_guests_count = Some(value);
    }
    if let Some(value) = update.check_in_reference {
        target.check_in_reference = Some(value);
    }
    if let Some(value) = update.check_in_document_verified {
        target.check_in_document_verified = Some(value);
    }
    if let Some(value) = update.check_in_contact_confirmed {
        target.check_in_contact_confirmed = Some(value);
    }
    if let Some(value) = update.check_in_stay_confirmed {
        target.check_in_stay_confirmed = Some(value);
    }
    if let Some(value) = update.check_out_payment_policy {
        target.check_out_payment_policy = Some(value);
    }
    if let Some(value) = update.check_out_reference {
        target.check_out_reference = Some(value);
    }
    if let Some(value) = update.check_out_charges_reviewed {
        target.check_out_charges_reviewed = Some(value);
    }
    if let Some(value) = update.check_out_room_release_confirmed {
        target.check_out_room_release_confirmed = Some(value);
    }
    if let Some(value) = update.check_out_housekeeping_handoff {
        target.check_out_housekeeping_handoff = Some(value);
    }
    if let Some(value) = update.terminal_reason {
        target.terminal_reason = Some(value.trim().to_string());
    }
    if let Some(value) = update.late_arrival_eta {
        target.late_arrival_eta = Some(value);
    }
    if let Some(value) = update.late_arrival_note {
        target.late_arrival_note = Some(value.trim().to_string());
    }
}

fn booking_status_to_db(status: &BookingStatus) -> &'static str {
    match status {
        BookingStatus::Confirmed => "CONFIRMED",
        BookingStatus::CheckedIn => "CHECKED_IN",
        BookingStatus::CheckedOut => "CHECKED_OUT",
        BookingStatus::Cancelled => "CANCELLED",
        BookingStatus::NoShow => "NO_SHOW",
    }
}

fn room_status_to_db(status: &RoomStatus) -> &'static str {
    match status {
        RoomStatus::Available => "AVAILABLE",
        RoomStatus::Occupied => "OCCUPIED",
        RoomStatus::Dirty => "DIRTY",
        RoomStatus::Cleaning => "CLEANING",
        RoomStatus::Maintenance => "MAINTENANCE",
    }
}

fn parse_room_status(value: Option<&str>) -> RoomStatus {
    match value {
        Some("AVAILABLE") => RoomStatus::Available,
        Some("OCCUPIED") => RoomStatus::Occupied,
        Some("DIRTY") => RoomStatus::Dirty,
        Some("CLEANING") => RoomStatus::Cleaning,
        _ => RoomStatus::Maintenance,
    }
}

fn build_room_reassignment_audit(
    booking_id: Uuid,
    from_room_id: Uuid,
    to_room_id: Uuid,
    operational_note: Option<&str>,
) -> String {
    let message = match operational_note {
        Some(note) if !note.trim().is_empty() => format!(
            "Room reassignment: Booking {} from {} to {} ({})",
            booking_id,
            from_room_id,
            to_room_id,
            note.trim()
        ),
        _ => format!(
            "Room reassignment: Booking {} from {} to {}",
            booking_id, from_room_id, to_room_id
        ),
    };

    truncate_audit_action(message)
}

fn build_checkout_override_audit(
    booking_id: Uuid,
    outstanding_amount_cents: i64,
    reference: &str,
) -> String {
    truncate_audit_action(format!(
        "CO_OVERRIDE booking={} due={} ref={}",
        booking_id,
        outstanding_amount_cents,
        reference.trim()
    ))
}

fn truncate_audit_action(action: String) -> String {
    const AUDIT_ACTION_MAX_LEN: usize = 120;

    if action.len() <= AUDIT_ACTION_MAX_LEN {
        return action;
    }

    let mut truncated = String::with_capacity(AUDIT_ACTION_MAX_LEN);
    for ch in action.chars() {
        if truncated.len() + ch.len_utf8() > AUDIT_ACTION_MAX_LEN {
            break;
        }
        truncated.push(ch);
    }
    truncated
}

async fn update_room_status_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    hotel_id: Uuid,
    room_id: Uuid,
    status: RoomStatus,
) -> Result<(), DomainError> {
    let result = sqlx::query("UPDATE rooms SET status = $1 WHERE hotel_id = $2 AND id = $3")
        .bind(room_status_to_db(&status))
        .bind(hotel_id)
        .bind(room_id)
        .execute(&mut **tx)
        .await
        .map_err(map_sql_error)?;

    if result.rows_affected() == 0 {
        return Err(DomainError::RoomNotFound);
    }
    Ok(())
}

async fn insert_audit_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    hotel_id: Uuid,
    user_id: Option<Uuid>,
    action: String,
) -> Result<(), DomainError> {
    sqlx::query(
        "INSERT INTO audit_events (id, hotel_id, user_id, action, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(Some(hotel_id))
    .bind(user_id)
    .bind(action)
    .bind(Option::<String>::None)
    .bind(chrono::Utc::now().naive_utc())
    .execute(&mut **tx)
    .await
    .map_err(map_sql_error)?;

    Ok(())
}

async fn insert_invoice_if_missing_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    hotel_id: Uuid,
    booking_id: Uuid,
    amount_cents: i64,
) -> Result<(), DomainError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (
            SELECT 1
            FROM invoices
            WHERE hotel_id = $1 AND booking_id = $2
        )",
    )
    .bind(hotel_id)
    .bind(booking_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(map_sql_error)?;

    if exists {
        return Ok(());
    }

    sqlx::query(
        "INSERT INTO invoices (id, hotel_id, booking_id, amount_cents, status, payment_method, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_id)
    .bind(booking_id)
    .bind(amount_cents)
    .bind("PENDING")
    .bind("CASH")
    .bind(chrono::Utc::now().naive_utc())
    .execute(&mut **tx)
    .await
    .map_err(map_sql_error)?;

    Ok(())
}

fn map_sql_error(error: sqlx::Error) -> DomainError {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(code) = db_error.code() {
            let constraint_name = db_error.constraint().unwrap_or_default();
            if let Some(mapped) = map_db_constraint_error(code.as_ref(), constraint_name) {
                return mapped;
            }
        }
    }
    DomainError::InfrastructureError(error.to_string())
}

fn map_db_constraint_error(code: &str, constraint_name: &str) -> Option<DomainError> {
    match code {
        "23P01" => Some(DomainError::RoomNotAvailable),
        "23514" if constraint_name == "valid_dates" => Some(DomainError::InvalidBookingDates),
        "23503" if constraint_name == "fk_bookings_hotel_room" => Some(DomainError::RoomNotFound),
        "23503" if constraint_name == "fk_bookings_hotel_guest" => Some(DomainError::GuestNotFound),
        "23503" if constraint_name == "bookings_hotel_id_fkey" => Some(DomainError::HotelNotFound),
        "23503" if constraint_name == "fk_invoices_hotel_booking" => {
            Some(DomainError::BookingNotFound)
        }
        "23503" if constraint_name == "fk_audit_events_hotel_user" => {
            Some(DomainError::UserNotFound)
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_booking_status_defaults_to_confirmed() {
        assert!(matches!(
            parse_booking_status(Some("OTHER")),
            BookingStatus::Confirmed
        ));
    }

    #[test]
    fn booking_status_to_db_maps_expected_values() {
        assert_eq!(
            booking_status_to_db(&BookingStatus::CheckedIn),
            "CHECKED_IN"
        );
        assert_eq!(
            booking_status_to_db(&BookingStatus::CheckedOut),
            "CHECKED_OUT"
        );
    }

    #[test]
    fn map_db_constraint_error_maps_audit_fk_to_user_not_found() {
        assert!(matches!(
            map_db_constraint_error("23503", "fk_audit_events_hotel_user"),
            Some(DomainError::UserNotFound)
        ));
    }

    #[test]
    fn truncate_audit_action_caps_long_messages() {
        let long = format!(
            "Room reassignment: Booking {} {}",
            Uuid::new_v4(),
            "x".repeat(200)
        );
        let truncated = truncate_audit_action(long);

        assert!(truncated.len() <= 120);
        assert!(truncated.starts_with("Room reassignment: Booking "));
    }
}
