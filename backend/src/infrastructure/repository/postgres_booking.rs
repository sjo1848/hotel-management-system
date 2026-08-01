use crate::domain::models::{Booking, BookingOperationalData, BookingStatus};
use crate::domain::repositories::BookingRepository;
use crate::infrastructure::repository::tenant_context::begin_tenant_tx;
use async_trait::async_trait;
use chrono::{Datelike, NaiveDate};
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct PostgresBookingRepository {
    pool: PgPool,
}

impl PostgresBookingRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BookingRepository for PostgresBookingRepository {
    async fn save(&self, booking: Booking) -> Result<Booking, String> {
        let mut tx = begin_tenant_tx(&self.pool, booking.hotel_id).await?;
        let status = match booking.status {
            BookingStatus::Confirmed => "CONFIRMED",
            BookingStatus::CheckedIn => "CHECKED_IN",
            BookingStatus::CheckedOut => "CHECKED_OUT",
            BookingStatus::Cancelled => "CANCELLED",
            BookingStatus::NoShow => "NO_SHOW",
        };

        sqlx::query(
            "INSERT INTO bookings (
                id, hotel_id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status,
                check_in_guests_count, check_in_reference, check_in_document_verified, check_in_contact_confirmed,
                check_in_stay_confirmed, checked_in_at, checked_in_by_user_id,
                check_out_payment_policy, check_out_reference, check_out_charges_reviewed,
                check_out_room_release_confirmed, check_out_housekeeping_handoff, checked_out_at, checked_out_by_user_id
             )
             VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9,
                $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23
             )",
        )
        .bind(booking.id)
        .bind(booking.hotel_id)
        .bind(booking.room_id)
        .bind(booking.guest_id)
        .bind(&booking.guest_name)
        .bind(booking.check_in)
        .bind(booking.check_out)
        .bind(booking.total_price_cents)
        .bind(status)
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
        .execute(&mut *tx)
        .await
        .map_err(map_db_error)?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(booking)
    }

    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<Booking>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let records =
            sqlx::query("SELECT * FROM bookings WHERE hotel_id = $1 ORDER BY created_at DESC")
                .bind(hotel_id)
                .fetch_all(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        let bookings = records.into_iter().map(map_booking_row).collect();

        Ok(bookings)
    }

    async fn find_by_range(
        &self,
        hotel_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<Vec<Booking>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let records = sqlx::query(
            "SELECT * FROM bookings
             WHERE hotel_id = $1 AND (check_in < $3 AND check_out > $2)
             ORDER BY check_in ASC",
        )
        .bind(hotel_id)
        .bind(start)
        .bind(end)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        let bookings = records.into_iter().map(map_booking_row).collect();

        Ok(bookings)
    }

    async fn find_by_id(&self, hotel_id: Uuid, id: Uuid) -> Result<Option<Booking>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let record = sqlx::query("SELECT * FROM bookings WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(record.map(map_booking_row))
    }

    async fn update(&self, booking: Booking) -> Result<Booking, String> {
        let mut tx = begin_tenant_tx(&self.pool, booking.hotel_id).await?;
        let status = match booking.status {
            BookingStatus::Confirmed => "CONFIRMED",
            BookingStatus::CheckedIn => "CHECKED_IN",
            BookingStatus::CheckedOut => "CHECKED_OUT",
            BookingStatus::Cancelled => "CANCELLED",
            BookingStatus::NoShow => "NO_SHOW",
        };

        let result = sqlx::query(
            "UPDATE bookings
             SET guest_id = $1, guest_name = $2, check_in = $3, check_out = $4, total_price_cents = $5, status = $6,
                 check_in_guests_count = $7, check_in_reference = $8, check_in_document_verified = $9,
                 check_in_contact_confirmed = $10, check_in_stay_confirmed = $11, checked_in_at = $12, checked_in_by_user_id = $13,
                 check_out_payment_policy = $14, check_out_reference = $15, check_out_charges_reviewed = $16,
                 check_out_room_release_confirmed = $17, check_out_housekeeping_handoff = $18, checked_out_at = $19, checked_out_by_user_id = $20,
                 terminal_reason = $21, terminal_recorded_at = $22, terminal_recorded_by_user_id = $23,
                 late_arrival_eta = $24, late_arrival_note = $25, late_arrival_recorded_at = $26, late_arrival_recorded_by_user_id = $27
             WHERE hotel_id = $28 AND id = $29",
        )
        .bind(booking.guest_id)
        .bind(&booking.guest_name)
        .bind(booking.check_in)
        .bind(booking.check_out)
        .bind(booking.total_price_cents)
        .bind(status)
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
        .map_err(map_db_error)?;

        if result.rows_affected() == 0 {
            return Err("BOOKING_NOT_FOUND".to_string());
        }
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(booking)
    }

    async fn find_by_room(&self, hotel_id: Uuid, room_id: Uuid) -> Result<Vec<Booking>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let records = sqlx::query("SELECT * FROM bookings WHERE hotel_id = $1 AND room_id = $2")
            .bind(hotel_id)
            .bind(room_id)
            .fetch_all(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        let bookings = records.into_iter().map(map_booking_row).collect();

        Ok(bookings)
    }

    async fn check_availability(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let overlap = sqlx::query(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM bookings
                WHERE hotel_id = $1 AND room_id = $2
                AND status NOT IN ('CANCELLED', 'NO_SHOW')
                AND check_in < $4
                AND check_out > $3
            ) as has_overlap
            "#,
        )
        .bind(hotel_id)
        .bind(room_id)
        .bind(start)
        .bind(end)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        let has_overlap: Option<bool> = overlap.try_get("has_overlap").ok();
        Ok(!has_overlap.unwrap_or(false))
    }

    async fn check_availability_excluding(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let overlap = sqlx::query(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM bookings
                WHERE hotel_id = $1 AND room_id = $2
                AND id != $3
                AND status NOT IN ('CANCELLED', 'NO_SHOW')
                AND check_in < $5
                AND check_out > $4
            ) as has_overlap
            "#,
        )
        .bind(hotel_id)
        .bind(room_id)
        .bind(booking_id)
        .bind(start)
        .bind(end)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        let has_overlap: Option<bool> = overlap.try_get("has_overlap").ok();
        Ok(!has_overlap.unwrap_or(false))
    }

    async fn get_dashboard_stats(
        &self,
        hotel_id: Uuid,
    ) -> Result<crate::domain::models::DashboardKpis, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let now = chrono::Utc::now().naive_utc().date();
        let start_of_month = NaiveDate::from_ymd_opt(now.year(), now.month(), 1).unwrap();

        // 1. Revenue this month
        let revenue: (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(total_price_cents), 0)::BIGINT FROM bookings 
             WHERE hotel_id = $1 AND status NOT IN ('CANCELLED', 'NO_SHOW') AND check_in >= $2",
        )
        .bind(hotel_id)
        .bind(start_of_month)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        // 2. Today's check-ins
        let check_ins: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM bookings WHERE hotel_id = $1 AND status = 'CONFIRMED' AND check_in = $2"
        )
        .bind(hotel_id)
        .bind(now)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        // 3. Active bookings
        let active: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM bookings WHERE hotel_id = $1 AND status IN ('CONFIRMED', 'CHECKED_IN')"
        )
        .bind(hotel_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        // 4. Occupancy Rate
        let total_rooms: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM rooms WHERE hotel_id = $1")
            .bind(hotel_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        let occupied_today: (i64,) = sqlx::query_as(
            "SELECT COUNT(DISTINCT room_id) FROM bookings 
             WHERE hotel_id = $1 AND status IN ('CONFIRMED', 'CHECKED_IN') 
             AND check_in <= $2 AND check_out > $2",
        )
        .bind(hotel_id)
        .bind(now)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        let occupancy_rate = if total_rooms.0 > 0 {
            (occupied_today.0 as f64 / total_rooms.0 as f64) * 100.0
        } else {
            0.0
        };

        // 5. Arrivals Today
        let arrivals_records = sqlx::query(
            "SELECT b.id, b.guest_name, r.room_number, b.status 
             FROM bookings b 
             JOIN rooms r ON b.room_id = r.id 
             WHERE b.hotel_id = $1 AND b.check_in = $2 AND b.status = 'CONFIRMED'",
        )
        .bind(hotel_id)
        .bind(now)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        let arrivals_today = arrivals_records
            .into_iter()
            .map(|row| {
                let status_str: String = row.try_get("status").unwrap();
                crate::domain::models::BookingAlert {
                    booking_id: row.try_get("id").unwrap(),
                    guest_name: row.try_get("guest_name").unwrap(),
                    room_number: row.try_get("room_number").unwrap(),
                    status: match status_str.as_str() {
                        "CHECKED_IN" => BookingStatus::CheckedIn,
                        "CHECKED_OUT" => BookingStatus::CheckedOut,
                        "CANCELLED" => BookingStatus::Cancelled,
                        "NO_SHOW" => BookingStatus::NoShow,
                        _ => BookingStatus::Confirmed,
                    },
                }
            })
            .collect();

        // 6. Departures Today
        let departures_records = sqlx::query(
            "SELECT b.id, b.guest_name, r.room_number, b.status 
             FROM bookings b 
             JOIN rooms r ON b.room_id = r.id 
             WHERE b.hotel_id = $1 AND b.check_out = $2 AND b.status = 'CHECKED_IN'",
        )
        .bind(hotel_id)
        .bind(now)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        let departures_today = departures_records
            .into_iter()
            .map(|row| {
                let status_str: String = row.try_get("status").unwrap();
                crate::domain::models::BookingAlert {
                    booking_id: row.try_get("id").unwrap(),
                    guest_name: row.try_get("guest_name").unwrap(),
                    room_number: row.try_get("room_number").unwrap(),
                    status: match status_str.as_str() {
                        "CHECKED_IN" => BookingStatus::CheckedIn,
                        "CHECKED_OUT" => BookingStatus::CheckedOut,
                        "CANCELLED" => BookingStatus::Cancelled,
                        "NO_SHOW" => BookingStatus::NoShow,
                        _ => BookingStatus::Confirmed,
                    },
                }
            })
            .collect();
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(crate::domain::models::DashboardKpis {
            revenue_month_cents: revenue.0,
            occupancy_rate,
            today_check_ins: check_ins.0,
            active_bookings_count: active.0,
            arrivals_today,
            departures_today,
            rev_par_cents: 0,
            adr_cents: 0,
        })
    }

    async fn get_revenue_report(
        &self,
        hotel_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<Vec<crate::domain::models::RevenueReport>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let records = sqlx::query(
            "SELECT check_in as date, SUM(total_price_cents)::BIGINT as revenue_cents
             FROM bookings
             WHERE hotel_id = $1 AND status NOT IN ('CANCELLED', 'NO_SHOW') AND check_in >= $2 AND check_in <= $3
             GROUP BY check_in
             ORDER BY check_in ASC",
        )
        .bind(hotel_id)
        .bind(start)
        .bind(end)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|row| crate::domain::models::RevenueReport {
                date: row.try_get("date").unwrap(),
                revenue_cents: row.try_get("revenue_cents").unwrap(),
            })
            .collect())
    }

    async fn get_occupancy_report(
        &self,
        hotel_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<Vec<crate::domain::models::OccupancyReport>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let records = sqlx::query(
            r#"
            WITH dates AS (
                SELECT generate_series($2::date, $3::date, '1 day'::interval)::date as day
            ),
            room_counts AS (
                SELECT count(*) as total FROM rooms WHERE hotel_id = $1
            )
            SELECT 
                d.day as date,
                (SELECT count(DISTINCT room_id) FROM bookings 
                 WHERE hotel_id = $1 AND status IN ('CONFIRMED', 'CHECKED_IN') 
                 AND check_in <= d.day AND check_out > d.day) as occupied_rooms,
                rc.total as total_rooms
            FROM dates d, room_counts rc
            ORDER BY d.day ASC
            "#,
        )
        .bind(hotel_id)
        .bind(start)
        .bind(end)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|row| {
                let occupied_rooms: i64 = row.try_get("occupied_rooms").unwrap_or(0);
                let total_rooms: i64 = row.try_get("total_rooms").unwrap_or(0);
                let occupancy_rate = if total_rooms > 0 {
                    (occupied_rooms as f64 / total_rooms as f64) * 100.0
                } else {
                    0.0
                };

                crate::domain::models::OccupancyReport {
                    date: row.try_get("date").unwrap(),
                    occupied_rooms,
                    total_rooms,
                    occupancy_rate,
                }
            })
            .collect())
    }
}

fn map_booking_row(row: sqlx::postgres::PgRow) -> Booking {
    let status: Option<String> = row.try_get("status").ok();
    Booking {
        id: row.try_get("id").unwrap(),
        hotel_id: row.try_get("hotel_id").unwrap(),
        room_id: row.try_get("room_id").unwrap(),
        guest_id: row.try_get("guest_id").ok(),
        guest_name: row.try_get("guest_name").unwrap(),
        check_in: row.try_get("check_in").unwrap(),
        check_out: row.try_get("check_out").unwrap(),
        total_price_cents: row.try_get("total_price_cents").unwrap_or(0),
        status: match status.as_deref() {
            Some("CHECKED_IN") => BookingStatus::CheckedIn,
            Some("CHECKED_OUT") => BookingStatus::CheckedOut,
            Some("CANCELLED") => BookingStatus::Cancelled,
            Some("NO_SHOW") => BookingStatus::NoShow,
            _ => BookingStatus::Confirmed,
        },
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
            check_out_room_release_confirmed: row.try_get("check_out_room_release_confirmed").ok(),
            check_out_housekeeping_handoff: row.try_get("check_out_housekeeping_handoff").ok(),
            checked_out_at: row.try_get("checked_out_at").ok(),
            checked_out_by_user_id: row.try_get("checked_out_by_user_id").ok(),
            terminal_reason: row.try_get("terminal_reason").ok(),
            terminal_recorded_at: row.try_get("terminal_recorded_at").ok(),
            terminal_recorded_by_user_id: row.try_get("terminal_recorded_by_user_id").ok(),
            late_arrival_eta: row.try_get("late_arrival_eta").ok(),
            late_arrival_note: row.try_get("late_arrival_note").ok(),
            late_arrival_recorded_at: row.try_get("late_arrival_recorded_at").ok(),
            late_arrival_recorded_by_user_id: row.try_get("late_arrival_recorded_by_user_id").ok(),
        },
    }
}

fn map_db_error(error: sqlx::Error) -> String {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(code) = db_error.code() {
            if code == "23P01" {
                return "BOOKING_OVERLAP".to_string();
            }
            if code == "23514" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "valid_dates" {
                    return "BOOKING_INVALID_DATES".to_string();
                }
            }
            if code == "23503" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "fk_bookings_hotel_room" {
                    return "BOOKING_ROOM_NOT_FOUND".to_string();
                }
                if constraint_name == "fk_bookings_hotel_guest" {
                    return "BOOKING_GUEST_NOT_FOUND".to_string();
                }
                if constraint_name == "bookings_hotel_id_fkey" {
                    return "BOOKING_HOTEL_NOT_FOUND".to_string();
                }
            }
        }
    }
    error.to_string()
}
