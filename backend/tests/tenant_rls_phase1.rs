use chrono::{Duration, Utc};
use sqlx::Executor;
use uuid::Uuid;

const RLS_TEST_ROLE: &str = "hms_rls_tester";

#[sqlx::test]
async fn rls_phase1_policies_exist_for_critical_tables(pool: sqlx::PgPool) {
    let checks = [
        ("users", "users_tenant_isolation"),
        ("bookings", "bookings_tenant_isolation"),
        ("refresh_tokens", "refresh_tokens_tenant_isolation"),
        ("invoices", "invoices_tenant_isolation"),
        ("maintenance_cases", "maintenance_cases_tenant_isolation"),
    ];

    for (table, policy) in checks {
        let policy_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = $1
                  AND policyname = $2
            )",
        )
        .bind(table)
        .bind(policy)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(policy_exists, "missing policy {policy} on {table}");

        let force_enabled = sqlx::query_scalar::<_, bool>(
            "SELECT relforcerowsecurity
             FROM pg_class
             WHERE oid = $1::regclass",
        )
        .bind(table)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(force_enabled, "RLS FORCE is not enabled on {table}");
    }
}

#[sqlx::test]
async fn rls_bypass_defaults_to_fail_closed_when_unset(pool: sqlx::PgPool) {
    let mut conn = pool.acquire().await.unwrap();
    sqlx::query("SELECT set_config('app.rls_bypass', '', false)")
        .execute(&mut *conn)
        .await
        .unwrap();

    let bypass_enabled = sqlx::query_scalar::<_, bool>("SELECT public.hms_rls_bypass_enabled()")
        .fetch_one(&mut *conn)
        .await
        .unwrap();

    assert!(
        !bypass_enabled,
        "rls bypass must be false when config is not explicitly set"
    );
}

#[sqlx::test]
async fn rls_phase1_blocks_cross_tenant_reads_and_writes_when_bypass_disabled(pool: sqlx::PgPool) {
    setup_rls_test_role(&pool).await;
    let fixture = seed_fixture(&pool).await;

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
        .bind(fixture.hotel_a.to_string())
        .execute(&mut *conn)
        .await
        .unwrap();

    let visible_users = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(&mut *conn)
        .await
        .unwrap();
    let visible_bookings = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM bookings")
        .fetch_one(&mut *conn)
        .await
        .unwrap();
    let visible_tokens = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM refresh_tokens")
        .fetch_one(&mut *conn)
        .await
        .unwrap();
    let visible_invoices = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM invoices")
        .fetch_one(&mut *conn)
        .await
        .unwrap();

    assert_eq!(visible_users, 1, "users should be tenant-scoped");
    assert_eq!(visible_bookings, 1, "bookings should be tenant-scoped");
    assert_eq!(visible_tokens, 1, "refresh_tokens should be tenant-scoped");
    assert_eq!(visible_invoices, 1, "invoices should be tenant-scoped");

    let user_update_same_tenant = sqlx::query("UPDATE users SET role = $1 WHERE id = $2")
        .bind("ops")
        .bind(fixture.user_a)
        .execute(&mut *conn)
        .await
        .unwrap()
        .rows_affected();
    assert_eq!(user_update_same_tenant, 1);

    let user_update_cross_tenant = sqlx::query("UPDATE users SET role = $1 WHERE id = $2")
        .bind("ops")
        .bind(fixture.user_b)
        .execute(&mut *conn)
        .await
        .unwrap()
        .rows_affected();
    assert_eq!(user_update_cross_tenant, 0);

    let booking_update_cross_tenant =
        sqlx::query("UPDATE bookings SET guest_name = $1 WHERE id = $2")
            .bind("Blocked by RLS")
            .bind(fixture.booking_b)
            .execute(&mut *conn)
            .await
            .unwrap()
            .rows_affected();
    assert_eq!(booking_update_cross_tenant, 0);

    let token_update_cross_tenant =
        sqlx::query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1")
            .bind(fixture.refresh_token_b)
            .execute(&mut *conn)
            .await
            .unwrap()
            .rows_affected();
    assert_eq!(token_update_cross_tenant, 0);

    let invoice_update_cross_tenant =
        sqlx::query("UPDATE invoices SET status = 'PAID' WHERE id = $1")
            .bind(fixture.invoice_b)
            .execute(&mut *conn)
            .await
            .unwrap()
            .rows_affected();
    assert_eq!(invoice_update_cross_tenant, 0);

    let cross_tenant_insert = sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(fixture.hotel_b)
    .bind(format!("blocked_{}", Uuid::new_v4().simple()))
    .bind("hash")
    .bind("ops")
    .execute(&mut *conn)
    .await;

    assert!(
        cross_tenant_insert.is_err(),
        "cross-tenant INSERT must be rejected by WITH CHECK policy"
    );

    sqlx::query("RESET ROLE").execute(&mut *conn).await.unwrap();
}

async fn setup_rls_test_role(pool: &sqlx::PgPool) {
    pool.execute(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_rls_tester') THEN
                CREATE ROLE hms_rls_tester NOINHERIT;
            END IF;
        END $$;
        "#,
    )
    .await
    .unwrap();

    pool.execute("GRANT hms_rls_tester TO CURRENT_USER")
        .await
        .unwrap();
    pool.execute("GRANT USAGE ON SCHEMA public TO hms_rls_tester")
        .await
        .unwrap();
    pool.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users, bookings, refresh_tokens, invoices TO hms_rls_tester",
    )
    .await
    .unwrap();
}

struct Fixture {
    hotel_a: Uuid,
    hotel_b: Uuid,
    user_a: Uuid,
    user_b: Uuid,
    booking_b: Uuid,
    refresh_token_b: Uuid,
    invoice_b: Uuid,
}

async fn seed_fixture(pool: &sqlx::PgPool) -> Fixture {
    let hotel_a = Uuid::new_v4();
    let hotel_b = Uuid::new_v4();
    let user_a = Uuid::new_v4();
    let user_b = Uuid::new_v4();
    let room_a = Uuid::new_v4();
    let room_b = Uuid::new_v4();
    let guest_a = Uuid::new_v4();
    let guest_b = Uuid::new_v4();
    let booking_a = Uuid::new_v4();
    let booking_b = Uuid::new_v4();
    let refresh_token_a = Uuid::new_v4();
    let refresh_token_b = Uuid::new_v4();
    let invoice_a = Uuid::new_v4();
    let invoice_b = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_a)
        .bind("RLS Hotel A")
        .bind("N/A")
        .execute(pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_b)
        .bind("RLS Hotel B")
        .bind("N/A")
        .execute(pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(user_a)
    .bind(hotel_a)
    .bind(format!("user_a_{}", Uuid::new_v4().simple()))
    .bind("hash")
    .bind("ops")
    .execute(pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(user_b)
    .bind(hotel_b)
    .bind(format!("user_b_{}", Uuid::new_v4().simple()))
    .bind("hash")
    .bind("ops")
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(room_a)
    .bind(hotel_a)
    .bind("A100")
    .bind("SINGLE")
    .bind("AVAILABLE")
    .bind(10000_i64)
    .execute(pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(room_b)
    .bind(hotel_b)
    .bind("B200")
    .bind("SINGLE")
    .bind("AVAILABLE")
    .bind(12000_i64)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO guests (id, hotel_id, full_name, email, phone) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(guest_a)
    .bind(hotel_a)
    .bind("Guest A")
    .bind(format!("guest-a-{}@example.com", Uuid::new_v4().simple()))
    .bind("111")
    .execute(pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO guests (id, hotel_id, full_name, email, phone) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(guest_b)
    .bind(hotel_b)
    .bind("Guest B")
    .bind(format!("guest-b-{}@example.com", Uuid::new_v4().simple()))
    .bind("222")
    .execute(pool)
    .await
    .unwrap();

    let today = Utc::now().date_naive();
    sqlx::query(
        "INSERT INTO bookings (id, hotel_id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(booking_a)
    .bind(hotel_a)
    .bind(room_a)
    .bind(guest_a)
    .bind("Guest A")
    .bind(today)
    .bind(today + Duration::days(1))
    .bind(10000_i64)
    .bind("CONFIRMED")
    .execute(pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO bookings (id, hotel_id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(booking_b)
    .bind(hotel_b)
    .bind(room_b)
    .bind(guest_b)
    .bind("Guest B")
    .bind(today + Duration::days(2))
    .bind(today + Duration::days(3))
    .bind(12000_i64)
    .bind("CONFIRMED")
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO refresh_tokens (id, hotel_id, user_id, token_hash, expires_at, session_id, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(refresh_token_a)
    .bind(hotel_a)
    .bind(user_a)
    .bind(format!("hash-a-{}", Uuid::new_v4().simple()))
    .bind((Utc::now() + Duration::days(7)).naive_utc())
    .bind(Uuid::new_v4())
    .bind("device-a")
    .execute(pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO refresh_tokens (id, hotel_id, user_id, token_hash, expires_at, session_id, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(refresh_token_b)
    .bind(hotel_b)
    .bind(user_b)
    .bind(format!("hash-b-{}", Uuid::new_v4().simple()))
    .bind((Utc::now() + Duration::days(7)).naive_utc())
    .bind(Uuid::new_v4())
    .bind("device-b")
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO invoices (id, hotel_id, booking_id, amount_cents, status, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(invoice_a)
    .bind(hotel_a)
    .bind(booking_a)
    .bind(10000_i64)
    .bind("PENDING")
    .bind("CASH")
    .execute(pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO invoices (id, hotel_id, booking_id, amount_cents, status, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(invoice_b)
    .bind(hotel_b)
    .bind(booking_b)
    .bind(12000_i64)
    .bind("PENDING")
    .bind("CARD")
    .execute(pool)
    .await
    .unwrap();

    Fixture {
        hotel_a,
        hotel_b,
        user_a,
        user_b,
        booking_b,
        refresh_token_b,
        invoice_b,
    }
}
