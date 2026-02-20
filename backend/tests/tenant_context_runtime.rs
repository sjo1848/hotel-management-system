use hms_backend::domain::repositories::UserRepository;
use hms_backend::infrastructure::repository::postgres_user::PostgresUserRepository;
use uuid::Uuid;

#[sqlx::test]
async fn tenant_context_fail_closed_when_hotel_id_missing(pool: sqlx::PgPool) {
    let repo = PostgresUserRepository::new(pool);
    let err = repo
        .find_all(Uuid::nil())
        .await
        .expect_err("tenant-scoped access must fail without tenant context");

    assert!(
        err.contains("TENANT_CONTEXT_REQUIRED"),
        "expected TENANT_CONTEXT_REQUIRED, got: {err}"
    );
}

#[sqlx::test]
async fn tenant_context_scopes_user_queries_to_hotel(pool: sqlx::PgPool) {
    let hotel_a = Uuid::new_v4();
    let hotel_b = Uuid::new_v4();

    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_a)
        .bind("Tenant A")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_b)
        .bind("Tenant B")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_a)
    .bind(format!("tenant_a_{}", Uuid::new_v4().simple()))
    .bind("hash")
    .bind("ops")
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_b)
    .bind(format!("tenant_b_{}", Uuid::new_v4().simple()))
    .bind("hash")
    .bind("ops")
    .execute(&pool)
    .await
    .unwrap();

    let repo = PostgresUserRepository::new(pool);
    let users_a = repo.find_all(hotel_a).await.unwrap();
    let users_b = repo.find_all(hotel_b).await.unwrap();

    assert_eq!(users_a.len(), 1, "tenant A should only see its own users");
    assert_eq!(users_b.len(), 1, "tenant B should only see its own users");
    assert_ne!(users_a[0].hotel_id, users_b[0].hotel_id);
}
