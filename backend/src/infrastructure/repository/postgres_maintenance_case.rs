use crate::domain::errors::DomainError;
use crate::domain::models::{
    MaintenanceCase, MaintenanceCaseStatus, MaintenancePriority, RoomStatus,
};
use crate::domain::repositories::MaintenanceCaseRepository;
use crate::infrastructure::repository::tenant_context::begin_tenant_tx;
use async_trait::async_trait;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct PostgresMaintenanceCaseRepository {
    pool: PgPool,
}

impl PostgresMaintenanceCaseRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl MaintenanceCaseRepository for PostgresMaintenanceCaseRepository {
    async fn find_open_by_hotel(&self, hotel_id: Uuid) -> Result<Vec<MaintenanceCase>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let rows = sqlx::query(
            "SELECT id, hotel_id, room_id, status, priority, reason, assigned_to,
                    reported_by_user_id, reported_at, resolution_note,
                    resolved_by_user_id, resolved_at, return_status
             FROM maintenance_cases
             WHERE hotel_id = $1 AND status = 'OPEN'
             ORDER BY reported_at ASC",
        )
        .bind(hotel_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
        tx.commit().await.map_err(|error| error.to_string())?;
        rows.into_iter().map(map_case_row).collect()
    }

    async fn open_case(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        actor_user_id: Uuid,
        priority: MaintenancePriority,
        reason: String,
        assigned_to: String,
    ) -> Result<MaintenanceCase, DomainError> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)?;
        let room_status = sqlx::query_scalar::<_, String>(
            "SELECT status FROM rooms WHERE hotel_id = $1 AND id = $2 FOR UPDATE",
        )
        .bind(hotel_id)
        .bind(room_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(map_sql_error)?
        .ok_or(DomainError::RoomNotFound)?;

        if !matches!(room_status.as_str(), "AVAILABLE" | "DIRTY" | "CLEANING") {
            return Err(DomainError::InvalidRoomStatusTransition);
        }

        let case = MaintenanceCase {
            id: Uuid::new_v4(),
            hotel_id,
            room_id,
            status: MaintenanceCaseStatus::Open,
            priority,
            reason: reason.trim().to_string(),
            assigned_to: assigned_to.trim().to_string(),
            reported_by_user_id: Some(actor_user_id),
            reported_at: chrono::Utc::now().naive_utc(),
            resolution_note: None,
            resolved_by_user_id: None,
            resolved_at: None,
            return_status: None,
        };

        sqlx::query(
            "INSERT INTO maintenance_cases
                (id, hotel_id, room_id, status, priority, reason, assigned_to,
                 reported_by_user_id, reported_at)
             VALUES ($1, $2, $3, 'OPEN', $4, $5, $6, $7, $8)",
        )
        .bind(case.id)
        .bind(case.hotel_id)
        .bind(case.room_id)
        .bind(priority_to_db(&case.priority))
        .bind(&case.reason)
        .bind(&case.assigned_to)
        .bind(case.reported_by_user_id)
        .bind(case.reported_at)
        .execute(&mut *tx)
        .await
        .map_err(map_sql_error)?;

        sqlx::query("UPDATE rooms SET status = 'MAINTENANCE' WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(room_id)
            .execute(&mut *tx)
            .await
            .map_err(map_sql_error)?;
        insert_audit(
            &mut tx,
            hotel_id,
            actor_user_id,
            truncate(format!(
                "MAINT_OPEN case={} room={} priority={} owner={} reason={}",
                case.id,
                room_id,
                priority_to_db(&case.priority),
                case.assigned_to,
                case.reason
            )),
        )
        .await?;
        tx.commit().await.map_err(map_sql_error)?;
        Ok(case)
    }

    async fn resolve_open_case(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        actor_user_id: Uuid,
        resolution_note: String,
    ) -> Result<MaintenanceCase, DomainError> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)?;
        let room_status = sqlx::query_scalar::<_, String>(
            "SELECT status FROM rooms WHERE hotel_id = $1 AND id = $2 FOR UPDATE",
        )
        .bind(hotel_id)
        .bind(room_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(map_sql_error)?
        .ok_or(DomainError::RoomNotFound)?;
        if room_status != "MAINTENANCE" {
            return Err(DomainError::InvalidRoomStatusTransition);
        }

        let row = sqlx::query(
            "SELECT id, hotel_id, room_id, status, priority, reason, assigned_to,
                    reported_by_user_id, reported_at, resolution_note,
                    resolved_by_user_id, resolved_at, return_status
             FROM maintenance_cases
             WHERE hotel_id = $1 AND room_id = $2 AND status = 'OPEN'
             FOR UPDATE",
        )
        .bind(hotel_id)
        .bind(room_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(map_sql_error)?;
        let mut case = if let Some(row) = row {
            map_case_row(row).map_err(DomainError::InfrastructureError)?
        } else {
            let legacy_case = MaintenanceCase {
                id: Uuid::new_v4(),
                hotel_id,
                room_id,
                status: MaintenanceCaseStatus::Open,
                priority: MaintenancePriority::Medium,
                reason: "Incidencia legacy sin caso de apertura".to_string(),
                assigned_to: "ops".to_string(),
                reported_by_user_id: Some(actor_user_id),
                reported_at: chrono::Utc::now().naive_utc(),
                resolution_note: None,
                resolved_by_user_id: None,
                resolved_at: None,
                return_status: None,
            };
            sqlx::query(
                "INSERT INTO maintenance_cases
                    (id, hotel_id, room_id, status, priority, reason, assigned_to,
                     reported_by_user_id, reported_at)
                 VALUES ($1, $2, $3, 'OPEN', 'MEDIUM', $4, 'ops', $5, $6)",
            )
            .bind(legacy_case.id)
            .bind(hotel_id)
            .bind(room_id)
            .bind(&legacy_case.reason)
            .bind(actor_user_id)
            .bind(legacy_case.reported_at)
            .execute(&mut *tx)
            .await
            .map_err(map_sql_error)?;
            insert_audit(
                &mut tx,
                hotel_id,
                actor_user_id,
                truncate(format!(
                    "MAINT_OPEN case={} room={} priority=MEDIUM owner=ops reason=legacy recovery",
                    legacy_case.id, room_id
                )),
            )
            .await?;
            legacy_case
        };
        let resolved_at = chrono::Utc::now().naive_utc();
        case.status = MaintenanceCaseStatus::Resolved;
        case.resolution_note = Some(resolution_note.trim().to_string());
        case.resolved_by_user_id = Some(actor_user_id);
        case.resolved_at = Some(resolved_at);
        case.return_status = Some(RoomStatus::Dirty);

        sqlx::query(
            "UPDATE maintenance_cases
             SET status = 'RESOLVED', resolution_note = $1, resolved_by_user_id = $2,
                 resolved_at = $3, return_status = 'DIRTY'
             WHERE hotel_id = $4 AND id = $5",
        )
        .bind(case.resolution_note.as_deref())
        .bind(actor_user_id)
        .bind(resolved_at)
        .bind(hotel_id)
        .bind(case.id)
        .execute(&mut *tx)
        .await
        .map_err(map_sql_error)?;
        sqlx::query("UPDATE rooms SET status = 'DIRTY' WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(room_id)
            .execute(&mut *tx)
            .await
            .map_err(map_sql_error)?;
        insert_audit(
            &mut tx,
            hotel_id,
            actor_user_id,
            truncate(format!(
                "MAINT_RESOLVE case={} room={} return=DIRTY note={}",
                case.id,
                room_id,
                case.resolution_note.as_deref().unwrap_or_default()
            )),
        )
        .await?;
        tx.commit().await.map_err(map_sql_error)?;
        Ok(case)
    }
}

fn map_case_row(row: sqlx::postgres::PgRow) -> Result<MaintenanceCase, String> {
    Ok(MaintenanceCase {
        id: row.try_get("id").map_err(|error| error.to_string())?,
        hotel_id: row.try_get("hotel_id").map_err(|error| error.to_string())?,
        room_id: row.try_get("room_id").map_err(|error| error.to_string())?,
        status: match row
            .try_get::<String, _>("status")
            .map_err(|error| error.to_string())?
            .as_str()
        {
            "RESOLVED" => MaintenanceCaseStatus::Resolved,
            _ => MaintenanceCaseStatus::Open,
        },
        priority: match row
            .try_get::<String, _>("priority")
            .map_err(|error| error.to_string())?
            .as_str()
        {
            "LOW" => MaintenancePriority::Low,
            "HIGH" => MaintenancePriority::High,
            "URGENT" => MaintenancePriority::Urgent,
            _ => MaintenancePriority::Medium,
        },
        reason: row.try_get("reason").map_err(|error| error.to_string())?,
        assigned_to: row
            .try_get("assigned_to")
            .map_err(|error| error.to_string())?,
        reported_by_user_id: row
            .try_get("reported_by_user_id")
            .map_err(|error| error.to_string())?,
        reported_at: row
            .try_get("reported_at")
            .map_err(|error| error.to_string())?,
        resolution_note: row
            .try_get("resolution_note")
            .map_err(|error| error.to_string())?,
        resolved_by_user_id: row
            .try_get("resolved_by_user_id")
            .map_err(|error| error.to_string())?,
        resolved_at: row
            .try_get("resolved_at")
            .map_err(|error| error.to_string())?,
        return_status: row
            .try_get::<Option<String>, _>("return_status")
            .map_err(|error| error.to_string())?
            .map(|_| RoomStatus::Dirty),
    })
}

fn priority_to_db(priority: &MaintenancePriority) -> &'static str {
    match priority {
        MaintenancePriority::Low => "LOW",
        MaintenancePriority::Medium => "MEDIUM",
        MaintenancePriority::High => "HIGH",
        MaintenancePriority::Urgent => "URGENT",
    }
}

async fn insert_audit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    hotel_id: Uuid,
    actor_user_id: Uuid,
    action: String,
) -> Result<(), DomainError> {
    sqlx::query(
        "INSERT INTO audit_events (id, hotel_id, user_id, action, ip_address, created_at)
         VALUES ($1, $2, $3, $4, NULL, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_id)
    .bind(actor_user_id)
    .bind(action)
    .bind(chrono::Utc::now().naive_utc())
    .execute(&mut **tx)
    .await
    .map_err(map_sql_error)?;
    Ok(())
}

fn truncate(value: String) -> String {
    value.chars().take(120).collect()
}

fn map_sql_error(error: sqlx::Error) -> DomainError {
    if let sqlx::Error::Database(database_error) = &error {
        if database_error.code().as_deref() == Some("23505") {
            return DomainError::InvalidInput(
                "La habitacion ya tiene un caso de mantenimiento abierto".to_string(),
            );
        }
    }
    DomainError::InfrastructureError(error.to_string())
}
