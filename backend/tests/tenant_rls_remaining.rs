use sqlx::Executor;
use uuid::Uuid;

const RLS_TEST_ROLE: &str = "hms_rls_tester";

#[sqlx::test]
async fn remaining_tenant_tables_have_force_rls_policies(pool: sqlx::PgPool) {
    for table in [
        "rooms",
        "guests",
        "audit_events",
        "extra_charges",
        "cash_closures",
        "room_holds",
    ] {
        let policy_name = format!("{table}_tenant_isolation");
        let (policy_exists, force_enabled) = sqlx::query_as::<_, (bool, bool)>(
            "SELECT EXISTS (
                 SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = $1 AND policyname = $2
             ),
             (SELECT relforcerowsecurity FROM pg_class WHERE oid = $1::regclass)",
        )
        .bind(table)
        .bind(policy_name)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(policy_exists, "missing policy on {table}");
        assert!(force_enabled, "FORCE RLS is not enabled on {table}");
    }
}

#[sqlx::test]
async fn rooms_and_guests_block_cross_tenant_reads_writes_and_inserts(pool: sqlx::PgPool) {
    setup_rls_test_role(&pool).await;
    let hotel_a = Uuid::new_v4();
    let hotel_b = Uuid::new_v4();
    let room_b = Uuid::new_v4();
    let guest_b = Uuid::new_v4();

    for (id, name) in [(hotel_a, "RLS remaining A"), (hotel_b, "RLS remaining B")] {
        sqlx::query("INSERT INTO hotels (id, name) VALUES ($1, $2)")
            .bind(id)
            .bind(name)
            .execute(&pool)
            .await
            .unwrap();
    }
    seed_room_and_guest(
        &pool,
        hotel_a,
        Uuid::new_v4(),
        Uuid::new_v4(),
        "A100",
        "a@example.com",
    )
    .await;
    seed_room_and_guest(&pool, hotel_b, room_b, guest_b, "B200", "b@example.com").await;

    let mut conn = pool.acquire().await.unwrap();
    sqlx::query(&format!("SET ROLE {RLS_TEST_ROLE}"))
        .execute(&mut *conn)
        .await
        .unwrap();
    sqlx::query("SELECT set_config('app.rls_bypass', 'false', false)")
        .execute(&mut *conn)
        .await
        .unwrap();
    sqlx::query("SELECT set_config('app.current_hotel_id', $1, false)")
        .bind(hotel_a.to_string())
        .execute(&mut *conn)
        .await
        .unwrap();

    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM rooms")
            .fetch_one(&mut *conn)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM guests")
            .fetch_one(&mut *conn)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        sqlx::query("UPDATE rooms SET status = 'OCCUPIED' WHERE id = $1")
            .bind(room_b)
            .execute(&mut *conn)
            .await
            .unwrap()
            .rows_affected(),
        0
    );
    assert_eq!(
        sqlx::query("UPDATE guests SET full_name = 'blocked' WHERE id = $1")
            .bind(guest_b)
            .execute(&mut *conn)
            .await
            .unwrap()
            .rows_affected(),
        0
    );

    let room_insert = sqlx::query("INSERT INTO rooms (id, hotel_id, room_number, room_type, price_cents) VALUES ($1, $2, 'B201', 'SINGLE', 1)")
        .bind(Uuid::new_v4()).bind(hotel_b).execute(&mut *conn).await;
    assert!(
        room_insert.is_err(),
        "cross-tenant room INSERT must be rejected"
    );
    let guest_insert = sqlx::query(
        "INSERT INTO guests (id, hotel_id, full_name, email) VALUES ($1, $2, 'blocked', $3)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_b)
    .bind(format!("blocked-{}@example.com", Uuid::new_v4()))
    .execute(&mut *conn)
    .await;
    assert!(
        guest_insert.is_err(),
        "cross-tenant guest INSERT must be rejected"
    );
}

async fn setup_rls_test_role(pool: &sqlx::PgPool) {
    pool.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_rls_tester') THEN CREATE ROLE hms_rls_tester NOINHERIT; END IF; END $$;").await.unwrap();
    pool.execute("GRANT hms_rls_tester TO CURRENT_USER")
        .await
        .unwrap();
    pool.execute("GRANT USAGE ON SCHEMA public TO hms_rls_tester")
        .await
        .unwrap();
    pool.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE rooms, guests TO hms_rls_tester")
        .await
        .unwrap();
}

async fn seed_room_and_guest(
    pool: &sqlx::PgPool,
    hotel_id: Uuid,
    room_id: Uuid,
    guest_id: Uuid,
    room_number: &str,
    email: &str,
) {
    sqlx::query("INSERT INTO rooms (id, hotel_id, room_number, room_type, price_cents) VALUES ($1, $2, $3, 'SINGLE', 1)").bind(room_id).bind(hotel_id).bind(room_number).execute(pool).await.unwrap();
    sqlx::query("INSERT INTO guests (id, hotel_id, full_name, email) VALUES ($1, $2, 'Guest', $3)")
        .bind(guest_id)
        .bind(hotel_id)
        .bind(email)
        .execute(pool)
        .await
        .unwrap();
}
