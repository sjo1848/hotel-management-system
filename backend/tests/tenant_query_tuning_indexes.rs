#[sqlx::test]
async fn tenant_query_tuning_indexes_exist(pool: sqlx::PgPool) {
    let expected_indexes = [
        "idx_bookings_hotel_created_at_desc",
        "idx_users_hotel_created_at_desc",
        "idx_guests_hotel_created_at_desc",
        "idx_audit_events_hotel_created_at_desc",
        "idx_invoices_hotel_created_at_desc",
        "idx_cash_closures_hotel_closing_time_desc",
    ];

    for index_name in expected_indexes {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = $1
            )",
        )
        .bind(index_name)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(exists, "missing expected index: {index_name}");
    }
}
