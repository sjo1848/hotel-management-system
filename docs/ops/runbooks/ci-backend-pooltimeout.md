# Runbook — CI: `PoolTimedOut` en gates de integración backend

## Síntoma
En `full-stack-ci.yml`, el job `Backend CI` falla en un step que ejecuta tests con `#[sqlx::test]`
(`ci-backend-integration.sh`, `backend-security-regression.sh`, `qa-core-journeys.sh`,
`observability-smoke.sh`, `backend-coverage-threshold.sh`) con:

```
test ... panicked at sqlx-core-0.7.4/src/testing/mod.rs
failed to connect to setup test database: PoolTimedOut
```

El log del paso ​​revela el runner usado:
```
==> observability runtime contract test (runner=host)
```

## Causa raíz

El job `backend` tenía configurado un `services.postgres` de GitHub Actions (host `localhost:5432`)
**y además** el contenedor `db` de compose (host interno `db:5432`). Dos fuentes de postgres:

1. Los gates que resuelven runner `docker` ejecutan `docker compose exec -T backend cargo test`
   → el contenedor `backend` usa `DATABASE_URL=postgres://admin:password123@db:5432/hms_core`
   (red `hms-net`). No usan `localhost`.
2. Los gates que fuerzan `RUNNER=host` (`observability-smoke.sh` por defecto) ejecutan
   `cargo test` en el runner del host contra `localhost:5432`.

Al eliminar el `services.postgres` y si el `db` de compose no publica puerto al host,
`localhost:5432` queda sin postgres → `PoolTimedOut` para todos los gates `host`.
Y si se publica el puerto del `db` + se agrega `DATABASE_URL` a nivel job, se reintroduce
conflicto de instancias para los gates docker.

## Solución aplicada (PR #8)

- **Eliminar** `services.postgres` del job `backend` de `full-stack-ci.yml`. Fuente única de
  verdad: el contenedor `db` de compose.
- **No** publicar puerto del `db` de compose al host (mantenerlo privado; evita colisión con
  postgres locales del dev en `5432`).
- **No** setear `DATABASE_URL` a nivel job (lo heredan los gates `host`).
- Los gates `sqlx::test` corren por runner **`docker`** contra `db:5432`:
  - `observability-smoke.sh --runner docker` (era el único con `RUNNER=host` por defecto).
  - Los demás (`ci-backend-integration.sh`, `qa-core-journeys.sh`, etc.) ya autodetectan
    runner `docker` porque `docker compose config --services | grep -qx backend`.

Estado final del job:
- `docker compose up -d db backend` → wait `pg_isready` → gates por runner `docker`.

## Validación

- Los 19 tests de `ci-backend-integration.sh` pasan (exit 0).
- `observability-smoke.sh --runner docker` → `observability smoke: PASS`.
- CI complete del PR: Backend CI, Frontend CI, Secret Scanning, E2E, Perf Smoke,
  CI Stability Guard → **success**.

## Qué no hacer
- No publicar el puerto del `db` de compose únicamente para un gate `host`: mejor hacerlo
  correr por docker runner.
- No volver a reintroducir `services.postgres` + `db` de compose en paralelo.
- No dejar gates con `DATABASE_URL` heredando de `localhost` sin que exista instancia ahí.

## Criterio de cierre
1. Todos los gates del job `backend` pasan en CI (no solo abajo).
2. Exactamente una instancia de postgres activa por stage dentro del job.
3. Runbook actualizado si se agrega un nuevo gate que necesite APIs DB.