use crate::domain::models::{Booking, BookingStatus};
use crate::domain::repositories::BookingRepository;
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
        let status = match booking.status {
            BookingStatus::Confirmed => "CONFIRMED",
            BookingStatus::CheckedIn => "CHECKED_IN",
            BookingStatus::CheckedOut => "CHECKED_OUT",
            BookingStatus::Cancelled => "CANCELLED",
        };

        sqlx::query(
            "INSERT INTO bookings (id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(booking.id)
        .bind(booking.room_id)
        .bind(booking.guest_id)
        .bind(&booking.guest_name)
        .bind(booking.check_in)
        .bind(booking.check_out)
        .bind(booking.total_price_cents)
        .bind(status)
        .execute(&self.pool)
        .await
        .map_err(map_db_error)?;

        Ok(booking)
    }

    async fn find_all(&self) -> Result<Vec<Booking>, String> {
        let records = sqlx::query(
            "SELECT id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status FROM bookings ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let bookings = records
            .into_iter()
            .map(|row| {
                let status: Option<String> = row.try_get("status").ok();
                Booking {
                    id: row.try_get("id").unwrap(),
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
                        _ => BookingStatus::Confirmed,
                    },
                }
            })
            .collect();

        Ok(bookings)
    }

    async fn find_by_range(&self, start: NaiveDate, end: NaiveDate) -> Result<Vec<Booking>, String> {
        let records = sqlx::query(
            "SELECT id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status FROM bookings 
             WHERE (check_in < $2 AND check_out > $1)
             ORDER BY check_in ASC",
        )
        .bind(start)
        .bind(end)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let bookings = records
            .into_iter()
            .map(|row| {
                let status: Option<String> = row.try_get("status").ok();
                Booking {
                    id: row.try_get("id").unwrap(),
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
                        _ => BookingStatus::Confirmed,
                    },
                }
            })
            .collect();

        Ok(bookings)
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<Booking>, String> {
        let record = sqlx::query(
            "SELECT id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status FROM bookings WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|row| {
            let status: Option<String> = row.try_get("status").ok();
            Booking {
                id: row.try_get("id").unwrap(),
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
                    _ => BookingStatus::Confirmed,
                },
            }
        }))
    }

    async fn update(&self, booking: Booking) -> Result<Booking, String> {
        let status = match booking.status {
            BookingStatus::Confirmed => "CONFIRMED",
            BookingStatus::CheckedIn => "CHECKED_IN",
            BookingStatus::CheckedOut => "CHECKED_OUT",
            BookingStatus::Cancelled => "CANCELLED",
        };

        sqlx::query(
            "UPDATE bookings
             SET guest_id = $1, guest_name = $2, check_in = $3, check_out = $4, total_price_cents = $5, status = $6
             WHERE id = $7",
        )
        .bind(booking.guest_id)
        .bind(&booking.guest_name)
        .bind(booking.check_in)
        .bind(booking.check_out)
        .bind(booking.total_price_cents)
        .bind(status)
        .bind(booking.id)
        .execute(&self.pool)
        .await
        .map_err(map_db_error)?;

        Ok(booking)
    }

    async fn find_by_room(&self, room_id: Uuid) -> Result<Vec<Booking>, String> {
        let records = sqlx::query(
            "SELECT id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status FROM bookings WHERE room_id = $1",
        )
        .bind(room_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let bookings = records
            .into_iter()
            .map(|row| {
                let status: Option<String> = row.try_get("status").ok();
                Booking {
                    id: row.try_get("id").unwrap(),
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
                        _ => BookingStatus::Confirmed,
                    },
                }
            })
            .collect();

        Ok(bookings)
    }

    async fn check_availability(
        &self,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String> {
        let overlap = sqlx::query(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM bookings
                WHERE room_id = $1
                AND status != 'CANCELLED'
                AND check_in < $3
                AND check_out > $2
            ) as has_overlap
            "#,
        )
        .bind(room_id)
        .bind(start)
        .bind(end)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let has_overlap: Option<bool> = overlap.try_get("has_overlap").ok();
        Ok(!has_overlap.unwrap_or(false))
    }

    async fn check_availability_excluding(
        &self,
        booking_id: Uuid,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String> {
        let overlap = sqlx::query(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM bookings
                WHERE room_id = $1
                AND id != $2
                AND status != 'CANCELLED'
                AND check_in < $4
                AND check_out > $3
            ) as has_overlap
            "#,
        )
        .bind(room_id)
        .bind(booking_id)
        .bind(start)
        .bind(end)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let has_overlap: Option<bool> = overlap.try_get("has_overlap").ok();
        Ok(!has_overlap.unwrap_or(false))
    }

    async fn get_dashboard_stats(&self) -> Result<crate::domain::models::DashboardKpis, String> {
        let now = chrono::Utc::now().naive_utc().date();
        let start_of_month = NaiveDate::from_ymd_opt(now.year(), now.month(), 1).unwrap();
        
        // 1. Revenue this month
        let revenue: (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(total_price_cents), 0) FROM bookings 
             WHERE status != 'CANCELLED' AND check_in >= $1"
        )
        .bind(start_of_month)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // 2. Today's check-ins
        let check_ins: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM bookings WHERE status = 'CONFIRMED' AND check_in = $1"
        )
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // 3. Active bookings
        let active: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM bookings WHERE status IN ('CONFIRMED', 'CHECKED_IN')"
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // 4. Occupancy Rate
        let total_rooms: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM rooms")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        let occupied_today: (i64,) = sqlx::query_as(
            "SELECT COUNT(DISTINCT room_id) FROM bookings 
             WHERE status IN ('CONFIRMED', 'CHECKED_IN') 
             AND check_in <= $1 AND check_out > $1"
        )
        .bind(now)
        .fetch_one(&self.pool)
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
             WHERE b.check_in = $1 AND b.status = 'CONFIRMED'"
        )
        .bind(now)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let arrivals_today = arrivals_records.into_iter().map(|row| {
            let status_str: String = row.try_get("status").unwrap();
            crate::domain::models::BookingAlert {
                booking_id: row.try_get("id").unwrap(),
                guest_name: row.try_get("guest_name").unwrap(),
                room_number: row.try_get("room_number").unwrap(),
                status: match status_str.as_str() {
                    "CHECKED_IN" => BookingStatus::CheckedIn,
                    "CHECKED_OUT" => BookingStatus::CheckedOut,
                    "CANCELLED" => BookingStatus::Cancelled,
                    _ => BookingStatus::Confirmed,
                },
            }
        }).collect();

        // 6. Departures Today
        let departures_records = sqlx::query(
            "SELECT b.id, b.guest_name, r.room_number, b.status 
             FROM bookings b 
             JOIN rooms r ON b.room_id = r.id 
             WHERE b.check_out = $1 AND b.status = 'CHECKED_IN'"
        )
        .bind(now)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let departures_today = departures_records.into_iter().map(|row| {
            let status_str: String = row.try_get("status").unwrap();
            crate::domain::models::BookingAlert {
                booking_id: row.try_get("id").unwrap(),
                guest_name: row.try_get("guest_name").unwrap(),
                room_number: row.try_get("room_number").unwrap(),
                status: match status_str.as_str() {
                    "CHECKED_IN" => BookingStatus::CheckedIn,
                    "CHECKED_OUT" => BookingStatus::CheckedOut,
                    "CANCELLED" => BookingStatus::Cancelled,
                    _ => BookingStatus::Confirmed,
                },
            }
        }).collect();

        Ok(crate::domain::models::DashboardKpis {
            revenue_month_cents: revenue.0,
            occupancy_rate,
            today_check_ins: check_ins.0,
            active_bookings_count: active.0,
            arrivals_today,
            departures_today,
        })
    }
}

fn map_db_error(error: sqlx::Error) -> String {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(code) = db_error.code() {
            if code == "23P01" {
                return "BOOKING_OVERLAP".to_string();
            }
        }
    }
    error.to_string()
}
