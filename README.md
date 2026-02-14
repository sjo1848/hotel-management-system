# HMS Elite — Hotel Management SaaS (PMS)

Plataforma SaaS multi-hotel para gestión operativa y financiera de hotelería.

HMS Elite integra:
- **Operación hotelera**: habitaciones, reservas, housekeeping.
- **Backoffice**: usuarios, roles, auditoría, telemetría.
- **Finanzas**: cargos extra, facturas, cierre de caja.
- **Insights**: KPIs y reportes de revenue/ocupación.

---

## Tabla de contenidos
- [Visión general](#visión-general)
- [Arquitectura](#arquitectura)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Quickstart local](#quickstart-local)
- [Configuración de entorno](#configuración-de-entorno)
- [API y contrato](#api-y-contrato)
- [Calidad y testing](#calidad-y-testing)
- [CI/CD y operaciones](#cicd-y-operaciones)
- [Observabilidad](#observabilidad)
- [Documentación adicional](#documentación-adicional)

---

## Visión general

**HMS Elite** está diseñado bajo principios de **Clean/Hexagonal Architecture** para mantener la lógica de negocio desacoplada de frameworks e infraestructura.

Objetivo del producto:
- Escalar como SaaS multi-tenant para múltiples hoteles.
- Sostener seguridad operativa (AuthN/AuthZ, auditoría, hardening).
- Permitir evolución rápida con calidad y trazabilidad.

---

## Arquitectura

### Backend (Rust + Axum)
- **Domain**: modelos de negocio y contratos (ports/traits).
- **Application**: casos de uso y orquestación.
- **Infrastructure**:
  - `repository/`: persistencia PostgreSQL con SQLx.
  - `web/`: API REST, middlewares, validación, auth, observabilidad.

### Frontend (React + TypeScript)
- Organización **feature-first** con servicios por módulo de negocio.
- Cliente HTTP centralizado con interceptores de errores/auth.
- Route guards por capability con enfoque deny-by-default (`HMS-SEC-010`).

### Persistencia
- PostgreSQL 16 con migraciones versionadas en `backend/migrations`.
- `database/init.sql` funciona como shim de compatibilidad para flujos legacy.

---

## Stack tecnológico

- **Backend**: Rust, Axum, SQLx, Tokio, Utoipa (OpenAPI)
- **Frontend**: React 18, TypeScript, Vite, Tailwind
- **DB**: PostgreSQL 16
- **Observabilidad**: Prometheus, Grafana, Tempo, OpenTelemetry
- **Contenerización**: Docker + Docker Compose

---

## Estructura del repositorio

```text
.
├── backend/                 # API Rust (hexagonal)
│   ├── src/
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   ├── migrations/
│   └── tests/
├── frontend/                # React + TypeScript
│   └── src/
├── database/                # shim legacy para bootstrap SQL
├── monitoring/              # Prometheus/Grafana/Tempo/Otel collector
├── scripts/                 # CI, seguridad, despliegue, backup/restore, perf
└── docs/                    # OpenAPI, changelog y documentos de arquitectura
```

---

## Quickstart local

Requisitos:
- Docker
- Docker Compose

Pasos:

```bash
git clone https://github.com/sjo1848/hotel-management-system.git
cd hotel-management-system
cp .env.example .env
docker compose up --build
```

Servicios:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`
- Health check: `http://localhost:3001/health`
- Swagger UI: `http://localhost:3001/swagger-ui`

---

## Configuración de entorno

Variables base:
- `.env.example`
- `.env.prod.example`

Hardening de métricas (`HMS-SEC-011`):
- En producción: `METRICS_PUBLIC=false` obligatorio.
- Acceso a `/metrics` por red privada/loopback o header `X-Metrics-Auth`.

Validación de entorno productivo:

```bash
scripts/validate-prod-env.sh --env-file .env.prod.example
```

---

## API y contrato

Prefijo base: `/api/v1`

Dominios principales:
- `auth/*`
- `rooms/*`
- `bookings/*`
- `guests/*`
- `users/*`
- `billing/*`
- `invoices/*`
- `reports/*`
- `analytics/*`

Contrato OpenAPI:
- Fuente canónica: `backend/openapi.yaml`
- Espejo para docs: `docs/openapi.yaml`
- Check de alineación: `./scripts/check-openapi-alignment.sh`

---

## Calidad y testing

Backend gates:

```bash
./scripts/ci-backend.sh
./scripts/ci-backend-integration.sh
./scripts/backend-security-regression.sh
./scripts/qa-core-journeys.sh
```

Frontend gates:

```bash
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run test -- --run
docker compose exec -T frontend npm run build
```

Performance baseline:

```bash
./scripts/perf-baseline.sh --report /tmp/perf_baseline.md
```

---

## CI/CD y operaciones

Workflow principal:
- `.github/workflows/full-stack-ci.yml`

Incluye:
- Secret scanning
- Backend unit/integration/security/core journeys
- Frontend lint/test/build
- Guard de estabilidad CI

Scripts operativos relevantes:
- Deploy con rollback: `scripts/deploy-with-rollback.sh`
- Backups/restore: `scripts/backup.sh`, `scripts/restore.sh`
- Readiness prod: `scripts/prod-deploy-readiness.sh`

---

## Observabilidad

Stack local:
- Prometheus
- Grafana
- Alertmanager
- Tempo
- OTel Collector

Smoke operativo recomendado:

```bash
docker compose exec -T prometheus wget -qO- http://localhost:9090/-/ready
docker compose exec -T prometheus wget -qO- "http://localhost:9090/api/v1/query?query=up%7Bjob%3D%22hms-backend%22%7D"
```

---

## Documentación adicional

- `docs/CHANGELOG.md`
- `docs/openapi.yaml`
- Carpeta operativa local `archivos/` para bitácora de ejecución y handoffs.
