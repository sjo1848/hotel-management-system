use crate::domain::models::{RoomHold, RoomHoldBoardEntry, RoomHoldType};
use crate::domain::repositories::RoomHoldRepository;
use crate::infrastructure::repository::tenant_context::begin_tenant_tx;
use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct PostgresRoomHoldRepository {
    pool: PgPool,
}

impl PostgresRoomHoldRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl RoomHoldRepository for PostgresRoomHoldRepository {
    async fn create(&self, hold: RoomHold) -> Result<RoomHold, String> {
        let mut tx = begin_tenant_tx(&self.pool, hold.hotel_id).await?;
        sqlx::query(
            "INSERT INTO room_holds (id, hotel_id, room_id, start_date, end_date, hold_type, reason, created_by_user_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_TIMESTAMP))",
        )
        .bind(hold.id)
        .bind(hold.hotel_id)
        .bind(hold.room_id)
        .bind(hold.start_date)
        .bind(hold.end_date)
        .bind(room_hold_type_to_db(&hold.hold_type))
        .bind(&hold.reason)
        .bind(hold.created_by_user_id)
        .bind(hold.created_at)
        .execute(&mut *tx)
        .await
        .map_err(map_db_error)?;
        tx.commit().await.map_err(|error| error.to_string())?;
        Ok(hold)
    }

    async fn find_by_room(&self, hotel_id: Uuid, room_id: Uuid) -> Result<Vec<RoomHold>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let rows = sqlx::query(
            "SELECT id, hotel_id, room_id, start_date, end_date, hold_type, reason, created_by_user_id, created_at
             FROM room_holds
             WHERE hotel_id = $1 AND room_id = $2
             ORDER BY start_date ASC, created_at DESC",
        )
        .bind(hotel_id)
        .bind(room_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
        tx.commit().await.map_err(|error| error.to_string())?;

        Ok(rows.into_iter().map(map_hold_row).collect())
    }

    async fn find_in_range(
        &self,
        hotel_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<Vec<RoomHoldBoardEntry>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let rows = sqlx::query(
            "SELECT h.id AS hold_id,
                    h.room_id,
                    r.room_number,
                    r.room_type,
                    h.start_date,
                    h.end_date,
                    h.hold_type,
                    h.reason,
                    h.created_at
             FROM room_holds h
             INNER JOIN rooms r
               ON r.hotel_id = h.hotel_id
              AND r.id = h.room_id
             WHERE h.hotel_id = $1
               AND h.start_date <= $3
               AND h.end_date >= $2
             ORDER BY h.start_date ASC, r.room_number ASC, h.created_at DESC",
        )
        .bind(hotel_id)
        .bind(start)
        .bind(end)
        .fetch_all(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
        tx.commit().await.map_err(|error| error.to_string())?;

        Ok(rows.into_iter().map(map_hold_board_row).collect())
    }

    async fn update(&self, hold: RoomHold) -> Result<RoomHold, String> {
        let mut tx = begin_tenant_tx(&self.pool, hold.hotel_id).await?;
        let result = sqlx::query(
            "UPDATE room_holds
             SET start_date = $1, end_date = $2, hold_type = $3, reason = $4, created_by_user_id = $5
             WHERE hotel_id = $6 AND room_id = $7 AND id = $8",
        )
        .bind(hold.start_date)
        .bind(hold.end_date)
        .bind(room_hold_type_to_db(&hold.hold_type))
        .bind(&hold.reason)
        .bind(hold.created_by_user_id)
        .bind(hold.hotel_id)
        .bind(hold.room_id)
        .bind(hold.id)
        .execute(&mut *tx)
        .await
        .map_err(map_db_error)?;
        if result.rows_affected() == 0 {
            return Err("ROOM_HOLD_NOT_FOUND".to_string());
        }
        tx.commit().await.map_err(|error| error.to_string())?;
        Ok(hold)
    }

    async fn delete(&self, hotel_id: Uuid, room_id: Uuid, hold_id: Uuid) -> Result<(), String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let result =
            sqlx::query("DELETE FROM room_holds WHERE hotel_id = $1 AND room_id = $2 AND id = $3")
                .bind(hotel_id)
                .bind(room_id)
                .bind(hold_id)
                .execute(&mut *tx)
                .await
                .map_err(|error| error.to_string())?;
        if result.rows_affected() == 0 {
            return Err("ROOM_HOLD_NOT_FOUND".to_string());
        }
        tx.commit().await.map_err(|error| error.to_string())?;
        Ok(())
    }

    async fn overlaps(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let exists = sqlx::query_scalar::<_, bool>(
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
        .bind(room_id)
        .bind(start)
        .bind(end)
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
        tx.commit().await.map_err(|error| error.to_string())?;
        Ok(exists)
    }
}

fn map_hold_row(row: sqlx::postgres::PgRow) -> RoomHold {
    RoomHold {
        id: row.try_get("id").unwrap(),
        hotel_id: row.try_get("hotel_id").unwrap(),
        room_id: row.try_get("room_id").unwrap(),
        start_date: row.try_get("start_date").unwrap(),
        end_date: row.try_get("end_date").unwrap(),
        hold_type: parse_room_hold_type(row.try_get::<String, _>("hold_type").unwrap().as_str()),
        reason: row.try_get("reason").unwrap(),
        created_by_user_id: row.try_get("created_by_user_id").ok(),
        created_at: row
            .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .ok()
            .map(|value| value.naive_utc()),
    }
}

fn map_hold_board_row(row: sqlx::postgres::PgRow) -> RoomHoldBoardEntry {
    RoomHoldBoardEntry {
        hold_id: row.try_get("hold_id").unwrap(),
        room_id: row.try_get("room_id").unwrap(),
        room_number: row.try_get("room_number").unwrap(),
        room_type: row.try_get("room_type").unwrap(),
        start_date: row.try_get("start_date").unwrap(),
        end_date: row.try_get("end_date").unwrap(),
        hold_type: parse_room_hold_type(row.try_get::<String, _>("hold_type").unwrap().as_str()),
        reason: row.try_get("reason").unwrap(),
        created_at: row
            .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .ok()
            .map(|value| value.naive_utc()),
    }
}

fn room_hold_type_to_db(value: &RoomHoldType) -> &'static str {
    match value {
        RoomHoldType::Vip => "VIP",
        RoomHoldType::Maintenance => "MAINTENANCE",
        RoomHoldType::Owner => "OWNER",
        RoomHoldType::Compliance => "COMPLIANCE",
        RoomHoldType::Commercial => "COMMERCIAL",
        RoomHoldType::Other => "OTHER",
    }
}

fn parse_room_hold_type(value: &str) -> RoomHoldType {
    match value {
        "VIP" => RoomHoldType::Vip,
        "MAINTENANCE" => RoomHoldType::Maintenance,
        "OWNER" => RoomHoldType::Owner,
        "COMPLIANCE" => RoomHoldType::Compliance,
        "OTHER" => RoomHoldType::Other,
        _ => RoomHoldType::Commercial,
    }
}

fn map_db_error(error: sqlx::Error) -> String {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(constraint_name) = db_error.constraint() {
            return match constraint_name {
                "room_hold_valid_dates" => "ROOM_HOLD_INVALID_DATES".to_string(),
                "room_hold_valid_type" => "ROOM_HOLD_INVALID_TYPE".to_string(),
                _ => error.to_string(),
            };
        }
    }
    error.to_string()
}
