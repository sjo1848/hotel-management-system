# Gate Evidence — 2026-07-31

## Scope

- Branch: `feature/gate-hardening-rbac-e2e`
- Base observada: `34360e1`
- Estado evaluado: working tree local sin commit
- Objetivo de esta pasada: cerrar gaps contractuales P0, endurecer runners y
  demostrar gates backend, frontend, seguridad, contrato, E2E y readiness.
- No se ejecuto commit, push ni deploy.

## Cambios validados

- `GET /api/v1/rooms/{id}` agregado con lookup tenant-scoped y `404` cuando la
  habitacion no pertenece al hotel autenticado.
- `CreateBookingRequest.guest_id` alineado entre backend, OpenAPI y cliente
  TypeScript generado.
- Path de holds alineado a `/rooms/{id}/holds/{hold_id}`.
- Comparacion router/OpenAPI preserva nombres de parametros; ya no normaliza
  todos los placeholders a `{id}`.
- Runners de integracion, seguridad y journeys levantan backend y base cuando
  hace falta usando la URL interna de Compose.
- `.env.prod` queda ignorado y con modo local `0600`; coverage, resultados E2E
  y artefactos de Playwright quedan ignorados.
- El runner Playwright con Chromium del sistema conserva trace y screenshot,
  y desactiva solo video porque no dispone del ffmpeg empaquetado de Playwright.

## Evidencia final

| Comando | Resultado | Evidencia resumida |
| --- | --- | --- |
| `git diff --check` | `PASS` | Sin errores de whitespace. |
| `cargo fmt --all -- --check` | `PASS` | Formato Rust estable. |
| `./scripts/ci-backend.sh` | `PASS` | 66 unit tests + 4 tests OpenAPI; clippy y fmt green. |
| `./scripts/ci-backend-integration.sh` | `PASS` | OpenAPI, analytics, ciclo operacional, tenant uniqueness/RLS/FK/context, booking, transacciones y rooms green. |
| `./scripts/backend-security-regression.sh` | `PASS` | RBAC 1/1 y CSRF/AuthN 1/1. |
| `./scripts/qa-core-journeys.sh` | `PASS` | CSRF/AuthN, RBAC, booking 3/3 y ciclo operacional green. |
| `./scripts/check-openapi-alignment.sh` | `PASS` | Router, OpenAPI fuente y mirror alineados. |
| `./scripts/qa-core-journeys-e2e.sh --runner docker` | `PASS` | Admin 5/5. |
| `E2E_USERNAME=recepcion_demo E2E_PASSWORD=demo2026pass E2E_GREP='reception role smoke' ./scripts/qa-core-journeys-e2e.sh --runner docker` | `PASS` | Recepcion 3/3; incluye `390x844` y `430x932`. |
| `E2E_USERNAME=housekeeping_demo E2E_PASSWORD=demo2026pass E2E_GREP='housekeeping role smoke' ./scripts/qa-core-journeys-e2e.sh --runner docker` | `PASS` | Housekeeping 2/2; incluye `390x844`. |
| `./scripts/gate.sh` | `PASS` | Backend, contrato, perfiles, RBAC, frontend lint, 45 tests, build, budgets y coverage. |
| `./scripts/prod-deploy-readiness.sh --env-file .env.prod --profile prod` | `PASS` condicionado | Config y Compose prod validos; no hay muestras de deploy suficientes para enforcement SLO. |

Detalles del gate frontend:

- build Vite: 3628 modulos transformados
- tests: 45/45
- coverage de sesion: `AuthContext.tsx 94.73%`, `App.tsx 97.29%`,
  `client.ts 90.16%`
- budgets: vendor `374.62/550 KB`, charts `217.31/250 KB`, app
  `94.20/180 KB`, CSS `114.60/115 KB`

## FAIL observados y cierre

1. El primer Playwright con Chromium del sistema fallo 5/5 antes de abrir las
   paginas porque faltaba el ffmpeg propio de Playwright. Se desactivo video
   solo en ese runner; trace y screenshot siguen activos. Repeticion: 5/5
   `PASS`.
2. El primer smoke de recepcion fallo 1/3 porque esperaba `Cola critica`, un
   bloque condicional ausente cuando no hay casos. Se reemplazo por el heading
   estable `Turno de recepcion`. Repeticion: 3/3 `PASS`.
3. Seguridad y journeys ejecutados simultaneamente chocaron sobre bases
   temporales SQLx (`_sqlx_test_* does not exist`). Se repitieron en secuencia:
   ambos comandos `PASS` en primer intento funcional.
4. La descarga inicial de `mcr.microsoft.com/playwright:v1.58.2-noble` se
   interrumpio por throughput local insuficiente. La cobertura se completo con
   Chromium del contenedor frontend.

## Review estricto

### Critical

- Sin hallazgos confirmados en el alcance revisado.

### High

- Sin hallazgos confirmados despues de cerrar aislamiento tenant, secreto local
  y drift contractual.

### Medium

- Estado al 2026-07-31: `WF-002`, `WF-003` y `WF-009` estaban abiertos; el
  delta del 2026-08-01 cierra `WF-003`.
- Readiness reporta `PASS` sin muestra operativa: 0 deploys en 30 dias y
  enforcement diferido hasta 10 muestras.
- Estado al 2026-07-31: budget CSS a `0.40 KB` del limite; el delta del
  2026-08-01 recupera aproximadamente 11 KiB de margen.
- `sqlx-postgres 0.7.4` emite future-incompatibility warning.

### Low

- npm 12 emite warning por ejecutarse sobre Node 20; no afecto lint, tests,
  generacion ni build de esta corrida.
- La checklist manual completa de seis anchos no se ejecuto; los smokes cubren
  los anchos indicados arriba y el estado general manual permanece sin marcar.

## DoD

- [x] API v1 preservada; cambios aditivos/correctivos.
- [x] OpenAPI fuente, mirror, changelog y cliente generado alineados.
- [x] Aislamiento tenant probado en servicio y suites de integracion/RLS.
- [x] Backend, seguridad y journeys en PASS secuencial.
- [x] Frontend lint, tests, build, coverage y budgets en PASS.
- [x] E2E admin, recepcion y housekeeping en PASS.
- [x] Readiness prod ejecutado con caveat de muestra documentado.
- [x] FAIL intermedios y su remediacion documentados.
- [x] Sin secretos ni artefactos de test preparados para commit.
- [ ] Checklist manual completa de todos los anchos.
- [ ] Commit/push/deploy, fuera de esta pasada.

## Delta — 2026-08-01

### Alcance y decisiones

- Se agrego `frontend/e2e/guest-lifecycle.spec.ts` para demostrar en navegador
  el ciclo walk-in, check-in, cargo extra, pago, checkout y limpieza
  `Dirty -> Cleaning -> Available`.
- El lookup de factura inexistente trata `404` como estado vacio esperado, sin
  activar el error global; los errores `5xx` continúan fallando.
- El update transaccional de reserva conserva los cargos extra al recalcular
  alojamiento y crear la factura de checkout.
- El runner E2E usa un limite controlado de 600 requests/min y siempre restaura
  el valor normal de 60 al finalizar; el default de produccion no se modifico.
- Tailwind limita el escaneo productivo a `frontend/src`. El CSS medido bajo de
  `114.60/115 KiB` a `104.01/115 KiB`, dejando aproximadamente 11 KiB de margen.
- `WF-003` pasa a `resolved`; en este corte `WF-002` y `WF-009` eran los
  siguientes P0.
- No se ejecuto commit, push ni deploy.

### Evidencia ejecutada

| Comando | Resultado | Evidencia resumida |
| --- | --- | --- |
| `docker compose exec -T frontend npm run lint` | `PASS` | TypeScript sin errores. |
| `docker compose exec -T frontend npm run test -- --run` | `PASS` | 12 archivos, 46/46 tests. |
| `docker compose exec -T frontend npm run build` | `PASS` | 3628 modulos; CSS `104.01/115 KiB`. |
| `docker compose exec -T -e DATABASE_URL='postgres://admin:password123@db:5432/hms_core' backend cargo test --test booking_transactional_integrity` | `PASS` | 4/4; checkout conserva cargo extra y factura por `21.500` centavos. |
| `E2E_GREP='guest lifecycle' ./scripts/qa-core-journeys-e2e.sh --runner docker` | `PASS` | 1/1 en 38.7 s; mutaciones completas y restauracion del rate limit a 60. |
| `E2E_GREP='auth lifecycle\|booking lifecycle\|billing journey\|dashboard journey\|rbac/admin journey' ./scripts/qa-core-journeys-e2e.sh --runner docker` | `PASS` | Admin 5/5. |
| `E2E_USERNAME=recepcion_demo E2E_PASSWORD=demo2026pass E2E_GREP='reception role smoke' ./scripts/qa-core-journeys-e2e.sh --runner docker` | `PASS` | Recepcion 3/3. |
| `E2E_USERNAME=housekeeping_demo E2E_PASSWORD=demo2026pass E2E_GREP='housekeeping role smoke' ./scripts/qa-core-journeys-e2e.sh --runner docker` | `PASS` | Housekeeping 2/2. |
| `./scripts/gate.sh` | `PASS` | Backend 66/66, OpenAPI 4/4, contrato, seguridad de perfiles, RBAC, frontend 46/46, build, budgets y coverage. |
| `./scripts/ci-backend-integration.sh --runner docker` | `PASS` | Todas las suites en primer intento funcional, incluida integridad transaccional 4/4. |
| `./scripts/backend-security-regression.sh --runner docker` | `PASS` | RBAC 1/1 y CSRF/AuthN 1/1. |
| `./scripts/qa-core-journeys.sh --runner docker` | `PASS` | CSRF/AuthN, RBAC, booking 3/3 y ciclo operacional. |
| `./scripts/prod-deploy-readiness.sh --env-file .env.prod --profile prod` | `PASS` condicionado | Config/Compose validos; 0 deploys y enforcement SLO diferido hasta 10 muestras. |
| `git diff --check` | `PASS` | Sin errores de whitespace. |

### FAIL observados y remediacion

1. El primer E2E mutante recibio `429` durante el pago: el journey real supera
   el limite local de 60 por cargas y refetches de la aplicacion. Se aislo el
   limite E2E en 600 y se agrego restauracion automatica a 60. Repeticion:
   `PASS` sin retries.
2. La primera invocacion host de `booking_transactional_integrity` fallo 4/4
   porque `localhost` resolvio otra instancia PostgreSQL; la base Compose no
   publica ese puerto. Se repitio dentro del contenedor con la URL interna:
   4/4 `PASS`.
3. El runner con la imagen oficial Playwright se interrumpio (`exit 130`) por
   una descarga local demasiado lenta. La misma cobertura se completo con el
   Chromium del contenedor frontend.
4. El recorrido manual encontro que el checkout descartaba cargos extra al
   recalcular el total. Se corrigio dentro de la transaccion y se agregaron
   aserciones backend y browser; ambas quedan en `PASS`.
5. Dos fixtures locales de los intentos fallidos quedaron `CONFIRMED` y
   `CHECKED_IN`. Se normalizaron de forma acotada a `CANCELLED`, sin borrar
   registros; habitaciones 102 y 105 verificadas `AVAILABLE`.

### Review estricto del delta

#### Critical

- Sin hallazgos confirmados.

#### High

- Cerrado: perdida silenciosa de cargos extra al actualizar estado y facturar.

#### Medium

- El limite normal de 60 requests/min puede ser ajustado para una sesion UI
  intensa; el runner solo aisla pruebas y no cambia la politica productiva.
- En este corte `WF-002` y `WF-009` mantenian invariantes/overrides pendientes;
  el delta siguiente cierra `WF-002`.
- Readiness no tiene muestra operativa: 0 deploys de los 10 minimos.
- `sqlx-postgres 0.7.4` conserva warning de incompatibilidad futura.

#### Low

- Desde una card de habitacion, `Reservar ahora` abre el drawer sin fechas y
  muestra cero noches antes de la validacion final; no permite persistir una
  reserva invalida, pero requiere mejora UX.
- npm 12 sobre Node 20 emite warning sin afectar los gates.

### DoD del delta

- [x] API v1 preservada; no hay cambio contractual.
- [x] Defecto financiero cubierto en integracion transaccional.
- [x] Estado vacio de factura cubierto por test unitario y navegador.
- [x] E2E mutante completo en PASS sin retries.
- [x] E2E admin, recepcion y housekeeping en PASS.
- [x] Gate, integracion, seguridad, journeys y readiness ejecutados.
- [x] CSS con margen medido y budget en PASS.
- [x] FAIL intermedios y remediacion documentados.
- [x] Rate limit normal verificado en 60 al cierre del runner.
- [ ] Checklist manual completa de seis anchos.
- [ ] Commit/push/deploy, fuera del alcance ejecutado.

## Delta — 2026-08-01 — WF-005

### Decision Y Alcance

- El catalogo provisionable de un tenant queda cerrado a `admin`, `ops`,
  `receptionist` y `housekeeping`; `saas_admin` sigue siendo un rol de sesion
  valido, pero nunca un rol administrable desde `/users`.
- `POST /api/v1/users` normaliza el rol, rechaza escalamiento de plataforma y
  audita al administrador actor junto con usuario y rol creados.
- `GET /api/v1/users` oculta identidades de plataforma y
  `DELETE /api/v1/users/{id}` devuelve `403` si el objetivo es `saas_admin`.
- La UI ofrece los cuatro roles tenant y usa `ManagedUser` para reflejar la
  respuesta real de `UserView`, separada del usuario autenticado con `hotel_id`.
- OpenAPI source/mirror y cliente generado tipan `CreateUserRequest.role` y
  `UserView.role`; `LoginResponse.role` conserva los cinco roles autenticables.

### Cambios Por Archivo

- `backend/src/application/user_service.rs`: lookup tenant-scoped previo a
  operaciones protegidas.
- `backend/src/infrastructure/web/handlers/ops/guests_users.rs`: filtro de
  plataforma, borrado fail-closed, normalizacion y auditoria con actor correcto.
- `backend/tests/rbac_authorization.rs`: cuatro altas tenant, canonicalizacion,
  actor de auditoria, listado sin plataforma y borrado `403` sin side effects.
- `backend/openapi.yaml`, `docs/openapi.yaml` y cliente generado: enums de rol
  diferenciados para login y administracion tenant.
- `frontend/src/types/domain.ts`, `usersService.ts` y `UsersPage.tsx`: tipos
  `TenantUserRole`/`ManagedUser` y eliminacion de ramas `saas_admin` imposibles.
- `UserCreateDrawer.tsx` y su test: selector completo, copy por alcance y envio
  del rol elegido.
- Workflow, checklist manual y changelog: WF-005 pasa a `resolved` con limites y
  evidencia explicitados.

### Evidencia De Comandos

| Comando | Resultado |
| --- | --- |
| `cargo test validate_role_rejects_platform_privilege_escalation` | `PASS` — 1/1 |
| `docker compose exec -T backend cargo test --test rbac_authorization -- --test-threads=1 --nocapture` | `PASS` — 1/1 |
| `./scripts/ci-backend-integration.sh` | `PASS` — OpenAPI 4/4; analytics 1/1; operational 1/1; uniqueness 1/1; RLS 3/3; bookings 3/3; FK 1/1; transactional 5/5; caja 1/1; rooms 2/2; tenant context 2/2 |
| `docker compose exec -T frontend npm run test -- --run src/features/users/components/UserCreateDrawer.test.tsx` | `PASS` — 1/1 |
| `./scripts/check-openapi-alignment.sh` | `PASS` |
| `./scripts/check-openapi-client-drift.sh` | `PASS` |
| `./scripts/gate.sh` (repeticion final post-review) | `PASS` — backend 69/69; OpenAPI 4/4; frontend 49/49; build y cobertura session >=80% |
| presupuesto frontend dentro de `gate.sh` | `PASS` — CSS 104.22/115 KB; app 96.85/180 KB; charts 217.31/250 KB; vendor 374.62/550 KB |
| `./scripts/backend-security-regression.sh` (final) | `PASS` — RBAC 1/1; CSRF/authn 1/1 |
| `./scripts/qa-core-journeys.sh` | `PASS` — CSRF 1/1; RBAC 1/1; booking 3/3; operational 1/1 |
| `./scripts/prod-deploy-readiness.sh` | `PASS` condicionado — entorno/KPI/composicion validos; SLO de release sin muestras suficientes (0/10) |
| Playwright CLI: `admin -> /users -> Nuevo Operador` | `PASS` — listado sin `saas_admin`; drawer con Recepcion, Operaciones, Housekeeping y Administrador; no se persistio un usuario de prueba |
| `git diff --check` | `PASS` |

### FAIL Encontrados Y Corregidos

1. `cargo fmt --all -- --check`: `FAIL` inicial por formato de las nuevas
   consultas RBAC; `cargo fmt --all` y repeticion: `PASS`.
2. `cargo test --test rbac_authorization` desde host: `FAIL` de infraestructura
   (`failed to lookup address information`) al intentar resolver el hostname de
   la red Docker; runner Docker oficial: `PASS` 1/1.
3. `cargo fmt` desde la raiz: `FAIL` de invocacion por ausencia de `Cargo.toml`;
   repetido con `--manifest-path backend/Cargo.toml`: `PASS`.
4. Lint post-review: `FAIL` al detectar una comparacion imposible con
   `saas_admin` luego de introducir `ManagedUser`; rama muerta eliminada y lint,
   test focalizado y gate completo repetidos en `PASS`.

### Review Estricto

#### Critical

- Ninguno abierto.

#### High

- Ninguno abierto.

#### Medium

- Cerrado: el frontend trataba `UserView` sin `hotel_id` como usuario de sesion;
  `ManagedUser` ahora representa el contrato real.
- Cerrado: la documentacion de `LoginResponse.role` excluia por error a
  `saas_admin`; ahora login admite cinco roles y solo el alta tenant admite cuatro.
- Abierto heredado: las identidades `saas_admin` siguen almacenadas con
  `hotel_id`; el filtro/bloqueo evita gestion tenant, pero la separacion global
  fisica requiere una evolucion de identidad fuera de WF-005.
- Abierto heredado: `AuditService::record` es best-effort y no comparte la
  transaccion del alta; una indisponibilidad de auditoria no revierte el usuario.
- Readiness conserva 0 deploys de los 10 minimos para enforcement SLO.

#### Low

- Queda pendiente la comprobacion manual del drawer en los seis anchos de la
  checklist; test de componente y navegador desktop estan cubiertos.
- La consulta trae el principal plataforma al proceso antes de filtrarlo en el
  handler; no se serializa ni llega al cliente, pero un repositorio de identidades
  separado simplificaria la frontera futura.
- Persisten warnings conocidos de `sqlx-postgres 0.7.4` y npm/Node; no afectaron
  los resultados.

### Que Romperia En Produccion

- Quitar el rechazo de `saas_admin` en alta permitiria escalamiento tenant a
  plataforma aunque la opcion permanezca oculta en UI.
- Quitar filtro o proteccion de borrado expondria o permitiria eliminar una
  identidad de plataforma desde administracion hotelera.
- Volver a auditar con `created.id` como actor destruiria la atribucion de altas.
- Reutilizar el tipo de usuario autenticado para `UserView` ocultaria drift del
  contrato y produciria supuestos falsos sobre `hotel_id`.

### DoD WF-005

- [x] Los cuatro roles tenant estan disponibles y tipados en UI/API.
- [x] `saas_admin` no puede provisionarse, listarse ni borrarse desde `/users`.
- [x] Alta normalizada y auditoria atribuida al administrador actor.
- [x] OpenAPI source/mirror, cliente generado y changelog alineados sin romper v1.
- [x] Happy path y excepcion critica automatizados en frontend/backend.
- [x] Navegador real valida listado y selector sin persistir datos de prueba.
- [x] Integracion, seguridad, journeys, readiness y gate final en `PASS`.
- [x] Review Critical/High/Medium/Low y riesgos de produccion documentados.
- [ ] Checklist manual completa de seis anchos.
- [ ] Commit/push/deploy, fuera del alcance ejecutado.

## Delta — 2026-08-01 — WF-002

### Decision e implementacion

- Se formaliza la maquina de estados de reserva: `Confirmed -> CheckedIn`,
  `Confirmed -> Cancelled` y `CheckedIn -> CheckedOut`; estados terminales no
  se reabren y una estadia activa no se cancela como reserva futura.
- Check-in exige huesped no vacio, cantidad positiva e identidad, contacto y
  condiciones de estadia confirmadas.
- Checkout exige reserva `CheckedIn`, habitacion `Occupied`, revision de cargos,
  liberacion, handoff a housekeeping y politica de saldo.
- `settled` exige factura `PAID` con monto cobrado suficiente para el total
  recalculado; `pending-approved` exige referencia operativa de 6 caracteres.
- Las validaciones se ejecutan dentro de la transaccion antes de persistir o
  generar side effects. Los rechazos dejan reserva, habitacion, factura y
  auditoria sin cambios parciales.
- El servicio heredado no transaccional ya no puede ejecutar cambios de estado.
- El editor generico deja de ofrecer check-in/checkout sin checklist y solo
  permite cancelar reservas `Confirmed`.
- OpenAPI y changelog documentan el comportamiento fail-closed sin modificar la
  forma del contrato API v1.
- `WF-002` pasa a `resolved`; `WF-009` queda como siguiente P0.

### Evidencia ejecutada

| Comando | Resultado | Evidencia resumida |
| --- | --- | --- |
| `cargo test domain::models::tests` | `PASS` | 6/6; secuencia de estados y checklists incluidos. |
| `docker compose exec -T -e DATABASE_URL='postgres://admin:password123@db:5432/hms_core' backend cargo test --test booking_transactional_integrity` | `PASS` | 5/5; rechazos sin side effects, checkout correcto y reasignacion atomica. |
| `E2E_GREP='guest lifecycle' ./scripts/qa-core-journeys-e2e.sh --runner docker` | `PASS` | 1/1 en 41.5 s; walk-in hasta limpieza con cuenta `settled`. |
| `./scripts/gate.sh` | `PASS` | Corrida final: backend 68/68, OpenAPI 4/4, frontend 46/46, build, budgets y coverage. |
| `./scripts/ci-backend-integration.sh --runner docker` | `PASS` | Todas las suites secuenciales; integridad transaccional 5/5. |
| `./scripts/backend-security-regression.sh --runner docker` | `PASS` | RBAC 1/1 y CSRF/AuthN 1/1. |
| `./scripts/qa-core-journeys.sh --runner docker` | `PASS` | CSRF/AuthN, RBAC, booking 3/3 y ciclo operacional. |
| `./scripts/check-openapi-alignment.sh` | `PASS` | Router, fuente y mirror alineados. |
| `./scripts/check-openapi-client-drift.sh` | `PASS` | Cliente TypeScript regenerado y sin drift. |
| `./scripts/prod-deploy-readiness.sh --env-file .env.prod --profile prod` | `PASS` condicionado | Config/Compose validos; enforcement SLO diferido por 0/10 muestras. |
| `git diff --check` | `PASS` | Sin errores de whitespace. |

### FAIL observado

- Una invocacion manual de `cargo fmt --all -- --check` desde la raiz fallo
  porque el workspace Rust vive en `backend/`. Se ejecuto desde el directorio
  correcto dentro de `./scripts/gate.sh`: `PASS`. No fue un fallo de producto.

### Review estricto

#### Critical

- Sin hallazgos confirmados.

#### High

- Cerrado: clientes API ya no pueden saltar la secuencia ni completar
  check-in/checkout sin sus precondiciones operativas y financieras.

#### Medium

- `WF-009`: `pending-approved` todavia usa la capability general de update;
  falta capability especifica, enforcement por rol y auditoria de override.
- El limite normal de 60 requests/min puede ajustarse en una sesion UI intensa;
  no se modifico la politica productiva en este ticket.
- Readiness conserva 0 deploys de los 10 minimos para enforcement SLO.
- `sqlx-postgres 0.7.4` conserva warning de incompatibilidad futura.

#### Low

- El editor heredado conserva codigo visual de exito de check-in/checkout que ya
  no es alcanzable desde sus acciones; retirarlo seria un refactor separado.
- npm 12 sobre Node 20 emite warning sin afectar los gates.

### DoD WF-002

- [x] Reglas expresadas en dominio y aplicadas en la transaccion PostgreSQL.
- [x] Cuenta `settled` validada contra factura cobrada tenant-scoped.
- [x] Rollback de intentos invalidos demostrado en integracion.
- [x] UI alineada; no ofrece atajos incompatibles.
- [x] API v1, OpenAPI, mirror, changelog y cliente generado alineados.
- [x] Unit, integracion, seguridad, journeys, navegador y gate en PASS.
- [x] Review Critical/High/Medium/Low documentado.
- [ ] Checklist manual completa de seis anchos.
- [ ] Commit/push/deploy, fuera del alcance ejecutado.

## Delta — 2026-08-01 — WF-009

### Decision e implementacion

- Se agrega la capability especifica `bookings.checkout.override`; el canon la
  asigna solo a `ADMIN` y genera las matrices backend/frontend.
- Un checkout con `pending-approved` falla con `403` antes de entrar al servicio
  si el actor no posee la capability. El checkout normal `settled` conserva su
  contrato y permisos existentes.
- El repositorio valida el saldo pendiente tenant-scoped y bajo lock; rechaza un
  override sin deuda real y registra actor, reserva, saldo y referencia dentro de
  la misma transaccion que completa el checkout.
- La UI solo ofrece la politica excepcional a usuarios autorizados y explica que
  la referencia queda persistida para auditoria.
- OpenAPI source/mirror, cliente TypeScript, changelog y workflow quedan alineados
  sin cambiar la forma del contrato API v1.
- Se modernizo el fixture de `operational_flow` para usar el servicio
  transaccional y cumplir los invariantes de WF-002; no hubo refactor productivo.

### Evidencia ejecutada

| Comando | Resultado | Evidencia resumida |
| --- | --- | --- |
| `./scripts/generate-rbac-from-canon.sh` | `PASS` | Canon y matrices generadas; override solo `ADMIN`. |
| `docker compose exec -T frontend npm run test -- --run src/features/auth/capabilities.test.ts` | `PASS` | 4/4; capability admin-only. |
| `docker compose exec -T backend cargo test infrastructure::web::middleware::rbac::tests` | `PASS` | 5/5; matriz backend alineada. |
| `docker compose exec -T backend cargo test --test booking_transactional_integrity` | `PASS` | 5/5; override atomico y auditoria verificada. |
| `docker compose exec -T backend cargo test --test rbac_authorization` | `PASS` | 1/1; recepcion 403 sin side effects, admin 200 con auditoria. |
| `./scripts/gate.sh` | `PASS` | Backend 68/68, OpenAPI 4/4, frontend 47/47, build, budgets y coverage. CSS app 104.01/115 KiB. |
| `./scripts/ci-backend-integration.sh --runner docker` | `PASS` | Todas las suites; integridad transaccional 5/5 y tenant runtime 2/2. |
| `./scripts/backend-security-regression.sh --runner docker` | `PASS` | RBAC 1/1 y CSRF/AuthN 1/1. |
| `./scripts/qa-core-journeys.sh --runner docker` | `PASS` | CSRF/AuthN, RBAC, booking 3/3 y ciclo operacional 1/1. |
| `E2E_GREP='guest lifecycle' ./scripts/qa-core-journeys-e2e.sh --runner docker` | `PASS` | 1/1 en 56.9 s; ciclo real hasta checkout normal y liberacion. |
| `./scripts/check-openapi-alignment.sh` + client drift | `PASS` | Router, source, mirror y cliente generado alineados. |
| `./scripts/prod-deploy-readiness.sh --env-file .env.prod --profile prod` | `PASS` condicionado | Config/Compose/KPI validos; enforcement SLO diferido por 0/10 muestras. |
| `git diff --check` | `PASS` | Sin errores de whitespace. |

### FAIL observados y remediacion

- El primer fixture RBAC uso `room_number='RBAC-OVERRIDE'`, mayor al
  `varchar(10)` del esquema: `FAIL`. Se corrigio a `RBAC-OVR` y el test completo
  quedo `PASS` 1/1; no hubo cambio productivo.
- La primera integracion completa detecto que `operational_flow` todavia intentaba
  transicionar estados con `BookingService`, atajo bloqueado por WF-002: `FAIL`.
  El fixture ahora usa `BookingTransactionService`, checklists y pago real; la
  prueba focal y la corrida integral posterior quedaron `PASS`.

### Review estricto

#### Critical

- Sin hallazgos confirmados.

#### High

- Cerrado: recepcion y operaciones ya no pueden autorizar deuda al checkout con
  la capability generica de actualizacion.
- Cerrado: un override autorizado ya no queda sin evidencia transaccional del
  actor, reserva, saldo y motivo/referencia.

#### Medium

- El campo historico `audit_events.action` limita el texto a 120 caracteres; la
  evidencia prioriza identificador de reserva, saldo y prefijo de referencia.
- El limite normal de 60 requests/min puede ajustarse para sesiones UI intensas;
  este ticket no modifica la politica productiva.
- Readiness conserva 0 deploys de los 10 minimos para enforcement SLO.
- `sqlx-postgres 0.7.4` conserva warning de incompatibilidad futura.

#### Low

- npm 12 sobre Node 20 emite warning sin afectar los gates.

### DoD WF-009

- [x] Capability canonica especifica y admin-only.
- [x] Enforcement backend fail-closed con 403 y sin side effects.
- [x] Saldo pendiente validado tenant-scoped dentro de la transaccion.
- [x] Auditoria atomica con actor, reserva, saldo y referencia.
- [x] UI oculta el override a roles no autorizados.
- [x] API v1, OpenAPI, mirror, changelog y cliente generado alineados.
- [x] Unit, integracion, seguridad, journeys, navegador y gate en PASS.
- [x] Review Critical/High/Medium/Low y fallos intermedios documentados.
- [ ] Checklist manual completa de seis anchos.
- [ ] Commit/push/deploy, fuera del alcance ejecutado.

## Delta — 2026-08-01 — WF-006

### Decision e implementacion

- La apertura de turno es automatica: inicia en el cierre anterior o, si no hay
  historia/cobros abiertos, en el primer cobro. Se evita una entidad de apertura
  manual que pueda quedar huerfana.
- El dashboard reemplaza la confirmacion simple por un arqueo con efectivo
  esperado, efectivo contado, diferencia, destinatario y notas de entrega.
- Cada cierre persiste contado, diferencia y handoff; Reportes presenta esos
  datos junto con la ventana y el mix de cobros.
- Cobros y cierres usan el mismo advisory lock tenant-scoped. El repositorio
  recalcula bajo lock, rechaza cierres stale y mueve un cobro tardio a la ventana
  siguiente, evitando perdida o doble imputacion.
- El formulario envia `expected_cash_amount_cents`: si el efectivo cambia mientras
  esta abierto, el backend exige recargar en vez de fabricar una diferencia.
- La migracion `0025` es aditiva. Clientes API v1 legacy pueden omitir los nuevos
  campos y conservan efectivo esperado + handoff generico.
- La suite `cash_shift_handoff` queda incorporada al gate de integracion permanente.

### Evidencia ejecutada

| Comando | Resultado | Evidencia resumida |
| --- | --- | --- |
| `cargo test cash_closure` | `PASS` | 3/3 unitarios del servicio de caja. |
| `docker compose exec -T backend cargo test --test cash_shift_handoff` | `PASS` | 1/1; arqueo -200, handoff, stale close, cobro tardio y balance stale. |
| `docker compose exec -T frontend npm run test -- --run src/features/dashboard/DashboardHome.test.tsx` | `PASS` | 3/3; formulario, payload, refresh, telemetria y error. |
| `docker compose exec -T frontend npm run lint` | `PASS` | TypeScript sin errores. |
| `./scripts/check-openapi-alignment.sh` | `PASS` | Router, source y mirror alineados. |
| `./scripts/check-openapi-client-drift.sh` | `PASS` | Cliente TypeScript regenerado y sin drift. |
| `./scripts/gate.sh` | `PASS` | Corrida final: backend 68/68, OpenAPI 4/4, frontend 47/47, build, budgets y coverage. |
| `./scripts/ci-backend-integration.sh --runner docker` | `PASS` | Todas las suites; incluye `cash_shift_handoff` 1/1 en el gate permanente. |
| `./scripts/backend-security-regression.sh --runner docker` | `PASS` | RBAC 1/1 y CSRF/AuthN 1/1; cierre legacy de ops preservado. |
| `./scripts/qa-core-journeys.sh --runner docker` | `PASS` | AuthN, RBAC, booking 3/3 y ciclo operacional 1/1. |
| `E2E_GREP='guest lifecycle' ./scripts/qa-core-journeys-e2e.sh --runner docker` | `PASS` | 1/1 en 51.9 s sobre stack recreado con migracion `0025`. |
| `./scripts/prod-deploy-readiness.sh --env-file .env.prod --profile prod` | `PASS` condicionado | Config/Compose/KPI validos; enforcement SLO diferido por 0/10 muestras. |
| `git diff --check` | `PASS` | Sin errores de whitespace. |

### FAIL observados y remediacion

- `cargo fmt --all -- --check` detecto formato pendiente en tres archivos nuevos:
  `FAIL`. Se ejecuto `cargo fmt --all`; las corridas posteriores de fmt y gate
  quedaron `PASS`.
- La primera secuencia de OpenAPI devolvio `FAIL` porque el generador de cliente no
  copia por si mismo `backend/openapi.yaml` a `docs/openapi.yaml`. Se sincronizo el
  mirror y alignment + drift quedaron `PASS` en todas las corridas posteriores.

### Review estricto

#### Critical

- Sin hallazgos confirmados.

#### High

- Cerrado: un cobro concurrente ya no puede quedar antes del nuevo baseline pero
  fuera del cierre; pagos y cierre se serializan por hotel.
- Cerrado: dos procesos no pueden cerrar la misma ventana con snapshots stale.

#### Medium

- Por compatibilidad v1, un cliente legacy aun puede omitir arqueo/handoff; el
  backend usa efectivo esperado y `Siguiente turno`. La UI first-party si exige
  ambos datos. Endurecerlo requiere version contractual o deprecacion.
- `audit_events` sigue siendo best-effort y posterior a la transaccion. La fila de
  `cash_closures` es la evidencia autoritativa y tenant-scoped del arqueo/handoff.
- La apertura automatica no modela fondo inicial de caja; agregar opening float es
  un futuro cambio contable, no necesario para conciliar los cobros actuales.
- Readiness conserva 0 deploys de los 10 minimos para enforcement SLO.

#### Low

- `sqlx-postgres 0.7.4` mantiene warning de incompatibilidad futura.
- npm 12 sobre Node 20 emite warning sin afectar gates.
- CSS app queda en 104.52/115 KiB; margen 10.48 KiB.

### Que Romperia En Produccion

- Desplegar binario sin aplicar `0025` haria fallar lecturas de cierres por columnas
  ausentes; el arranque normal aplica migraciones antes de servir trafico.
- Quitar el advisory lock de pagos o cierres reabriria la ventana de perdida/doble
  imputacion demostrada por la prueba de integracion.
- Cambiar a campos request obligatorios sin deprecacion rompería clientes API v1.

### DoD WF-006

- [x] Apertura y ventana de turno definidas.
- [x] Arqueo esperado/contado y diferencia persistidos.
- [x] Cierre y handoff visibles en dashboard/reportes.
- [x] Concurrencia pago/cierre y doble cierre protegidos.
- [x] Snapshot stale rechazado con recarga.
- [x] Migracion, API v1, OpenAPI, mirror, cliente y changelog alineados.
- [x] Test focal agregado al gate de integracion permanente.
- [x] Unit, integracion, seguridad, journeys, navegador y gate en PASS.
- [x] Review Critical/High/Medium/Low y fallos intermedios documentados.
- [ ] Checklist manual completa de seis anchos.
- [ ] Commit/push/deploy, fuera del alcance ejecutado.

## Delta — 2026-08-01 — WF-004

### Decision e implementacion

- El canon elimina `saas.hotels.read/write` de `admin`; solo `saas_admin`
  conserva gobierno de red, alta de propiedades y planes.
- Backend devuelve `403` a `admin` en lectura/escritura `/api/v1/hotels`; el
  contrato de endpoints y schemas v1 no cambia.
- Frontend oculta Red Global, bloquea `/network` para `admin` y mantiene el home
  HQ para `saas_admin`. El CTA tenant de pricing ahora abre `/reports`.
- El review detecto y cerro una escalada critica: `POST /api/v1/users` ya no
  admite `role=saas_admin`; devuelve `400` sin crear la fila.
- OpenAPI tipa los roles tenant provisionables y explicita que el principal de
  plataforma no se crea desde ese endpoint.
- Workflow y checklist manual reflejan la nueva frontera.

### Evidencia ejecutada

| Comando | Resultado | Evidencia resumida |
| --- | --- | --- |
| `./scripts/generate-rbac-from-canon.sh` + checks | `PASS` | Matrices backend/frontend generadas sin drift; SaaS solo `saas_admin`. |
| `docker compose exec -T backend cargo test infrastructure::web::middleware::rbac::tests` | `PASS` | 5/5; `admin` sin scope SaaS. |
| `docker compose exec -T frontend npm run test -- --run src/features/auth/capabilities.test.ts src/App.guards.test.tsx` | `PASS` | 14/14 focales; luego suite integral 48/48. |
| `docker compose exec -T backend cargo test infrastructure::web::validation::tests::validate_role_rejects_platform_privilege_escalation` | `PASS` | 1/1; `saas_admin` no provisionable por tenant. |
| `docker compose exec -T backend cargo test --test rbac_authorization` | `PASS` | 1/1; admin GET/POST hotels 403, escalada 400/cero filas, SaaS admin 200. |
| `./scripts/gate.sh` | `PASS` | Corrida final: backend 69/69, OpenAPI 4/4, frontend 48/48, build, budgets y coverage. |
| `./scripts/ci-backend-integration.sh --runner docker` | `PASS` | Todas las suites de integracion, incluida caja 1/1 y contexto tenant 2/2. |
| `./scripts/backend-security-regression.sh --runner docker` | `PASS` | Corrida final RBAC 1/1 y CSRF/AuthN 1/1. |
| `./scripts/qa-core-journeys.sh --runner docker` | `PASS` | AuthN, RBAC, booking 3/3 y ciclo operacional 1/1. |
| Playwright CLI `admin -> /network` | `PASS` | Red Global ausente; ruta directa redirige a `/forbidden` y muestra Error 403. |
| Playwright CLI `saas_admin_demo -> /network` | `PASS` | Home directo `/network`; HQ Multi-Hotel y Añadir Propiedad visibles. |
| `./scripts/prod-deploy-readiness.sh --env-file .env.prod --profile prod` | `PASS` condicionado | Config/Compose/KPI validos; enforcement SLO diferido por 0/10 muestras. |
| `git diff --check` | `PASS` | Sin errores de whitespace. |

### FAIL observado y remediacion

- La primera invocacion directa del wrapper de la skill Playwright fallo con
  `Permission denied` porque el archivo no tiene bit ejecutable. Se invoco con
  `bash`, como wrapper sin modificar, y ambos escenarios reales quedaron `PASS`.
  No fue un fallo de producto.

### Review estricto

#### Critical

- Cerrado durante review: un `admin` tenant podia enviar `role=saas_admin` a
  `POST /users`. El validador backend ahora lo rechaza y la integracion demuestra
  ausencia de side effects.

#### High

- Cerrado: `admin` ya no puede leer, crear ni gobernar propiedades SaaS mediante
  capability compartida.

#### Medium

- Los principales `saas_admin` siguen almacenados en `users` con `hotel_id`; una
  identidad de plataforma global separada es una evolucion arquitectonica futura.
- La auditoria de cambios de plan usa el tenant objetivo con un actor asociado al
  tenant de login; para operaciones cross-hotel puede perder atribucion por la FK
  tenant-scoped. Debe resolverse al separar identidades de plataforma.
- Readiness conserva 0 deploys de los 10 minimos para enforcement SLO.

#### Low

- El tipo frontend `UserRole` aun incluye `saas_admin`, aunque el selector no lo
  ofrece y backend lo bloquea; WF-005 alineara el modelo de roles provisionables.
- Playwright observo favicon 404 y warnings de Recharts por medicion headless; no
  afectaron navegacion ni gates.
- `sqlx-postgres 0.7.4` y npm/Node mantienen warnings conocidos.

### Que Romperia En Produccion

- Reincorporar capabilities SaaS a `admin` en el canon reabriria el acceso
  tenant/plataforma tanto en UI como API.
- Permitir `saas_admin` en el alta tenant anularia la separacion aun si `/network`
  permanece oculto.
- Editar matrices generadas sin cambiar el canon provocaria drift y fallo del gate.

### DoD WF-004

- [x] Canon separa admin tenant y saas_admin plataforma.
- [x] Backend fail-closed en lectura y escritura SaaS.
- [x] Autoprovision de rol plataforma bloqueado sin side effects.
- [x] Sidebar, route guard, home y CTA alineados.
- [x] API v1 preservada; OpenAPI, mirror, cliente y changelog alineados.
- [x] Navegador real prueba denegacion admin y acceso saas_admin.
- [x] Unit, integracion, seguridad, journeys y gate en PASS.
- [x] Review Critical/High/Medium/Low documentado.
- [ ] Checklist manual completa de seis anchos.
- [ ] Commit/push/deploy, fuera del alcance ejecutado.

## Delta — 2026-08-01 — WF-007

### Decision e implementacion

- `NoShow` queda separado de `Cancelled`; ambos son estados terminales y solo se
  alcanzan desde `Confirmed`.
- Cancelacion y no-show exigen un motivo normalizado de 6 a 250 caracteres. El
  backend persiste motivo, actor y timestamp en la misma transaccion que el estado
  y el evento de auditoria.
- No-show se rechaza antes de la fecha de llegada. Cancelacion y no-show liberan
  el exclusion constraint, disponibilidad, ocupacion y revenue operacional.
- Llegada tardia conserva `Confirmed` para permitir el check-in posterior. Exige
  ETA futura dentro de la estadia y nota de 6 a 250 caracteres, con actor,
  timestamp y auditoria transaccional.
- Un hold superpuesto no puede impedir una transicion terminal; se permite
  cancelar/no-show para liberar la reserva, sin relajar la validacion de holds en
  ediciones activas.
- La UI concentra las tres acciones en el centro operativo, elimina shortcuts de
  cancelacion sin evidencia y replica las restricciones de fecha del backend.
- V1 no genera una penalidad automatica por cancelacion/no-show: no existe una
  politica tarifaria contractual que permita calcularla sin inventar revenue.
- La migracion `0026`, OpenAPI source/mirror, cliente TypeScript, workflow,
  checklist manual, changelog y consultas de performance quedaron alineados.

### Evidencia ejecutada

| Comando | Resultado | Evidencia resumida |
| --- | --- | --- |
| `docker compose exec -T backend cargo test --test booking_transactional_integrity arrival_exceptions_are_validated_audited_and_release_inventory -- --nocapture` | `PASS` | 1/1; late arrival, motivo requerido, no-show temprano rechazado, actor/auditoria, hold y liberacion de overlap. |
| `docker compose exec -T frontend npm run test -- --run src/features/bookings/components/BookingArrivalExceptionActions.test.tsx` | `PASS` | 2/2; evidencia obligatoria, payloads y bloqueo de no-show anticipado. |
| `docker compose exec -T frontend npm run lint` | `PASS` | TypeScript sin errores. |
| `docker compose exec -T frontend npm run test -- --run` | `PASS` | 14 archivos y 51/51 tests. |
| `docker compose exec -T frontend npm run build` | `PASS` | Build Vite; CSS 106.77 KiB y assets emitidos. |
| `./scripts/ci-backend.sh` | `PASS` | fmt, Clippy, 69/69 unitarios y OpenAPI 4/4. |
| `./scripts/check-openapi-alignment.sh` | `PASS` | Router, source y mirror alineados. |
| `./scripts/check-openapi-client-drift.sh` | `PASS` | Cliente TypeScript generado sin drift. |
| `./scripts/ci-backend-integration.sh --runner docker` | `PASS` | Todas las suites; `booking_transactional_integrity` 6/6 con WF-007 incorporado. |
| `./scripts/backend-security-regression.sh --runner docker` | `PASS` | RBAC 1/1 y CSRF/AuthN 1/1. |
| `./scripts/qa-core-journeys.sh --runner docker` | `PASS` | AuthN, RBAC, booking 3/3 y ciclo operacional 1/1. |
| Playwright CLI, `admin -> /bookings -> Pablo Sosa -> centro operativo` | `PASS` | Controles visibles; sin motivo quedan bloqueados, con motivo se habilitan terminales y ETA historica permanece bloqueada. No se ejecuto una mutacion sobre datos demo. |
| `./scripts/gate.sh` | `PASS` | Backend 69/69, OpenAPI 4/4, frontend 51/51, build, budgets, coverage y governance. |
| `./scripts/prod-deploy-readiness.sh --env-file .env.prod --profile prod` | `PASS` condicionado | Config, Compose y KPI validos; enforcement SLO diferido por 0/10 muestras. |
| `git diff --check` | `PASS` | Sin errores de whitespace. |

### FAIL observados y remediacion

- La primera corrida focal de frontend esperaba segundos que `datetime-local`
  elimina: `FAIL`. Se alineo la expectativa con la precision real y quedo 2/2.
- Lint detecto un import de `updateBooking` sin uso despues de retirar un shortcut
  inseguro de cancelacion: `FAIL`. Se elimino y las corridas posteriores pasaron.
- `cargo fmt --all` ejecutado por error desde la raiz sin `Cargo.toml` fallo antes
  de correr tests. Se repitio desde `backend/`; no fue un fallo de producto.
- La primera corrida de `ci-backend` fallo por `clippy::nonminimal-bool`. Se aplico
  la expresion sugerida, se repitio el gate y quedo `PASS`.

### Review estricto

#### Critical

- Sin hallazgos confirmados abiertos.

#### High

- Cerrado: un hold superpuesto podia impedir cancelar/no-show y dejar inventario
  imposible de liberar. Las transiciones terminales omiten ese bloqueo y una
  prueba de integracion lo demuestra.
- Cerrado: los shortcuts de UI enviaban cancelacion sin motivo y el backend los
  rechazaria. Las acciones terminales quedaron unificadas en el centro operativo.

#### Medium

- HMS aun no modela timezone por hotel; fecha de no-show y ETA usan UTC de forma
  consistente entre cliente y backend. Una politica local por propiedad requiere
  ampliar el modelo contractual.
- Agregar `NoShow` a un enum v1 es aditivo, pero consumidores externos con switch
  exhaustivo deben incorporar el nuevo valor; el changelog lo explicita.
- No existe politica contractual de penalidad por cancelacion/no-show. Automatizar
  cargos ahora inventaria reglas contables; queda fuera de WF-007.
- Readiness conserva 0 deploys de los 10 minimos para enforcement SLO.

#### Low

- El CSS queda en 104.27 KiB medidos por el budget gate (106.77 KiB decimal del
  build), con 10.73 KiB binarios de margen frente al limite de 115 KiB.
- Playwright observa dos `404` esperados al consultar la factura inexistente de la
  reserva confirmada usada en el smoke; la UI representa correctamente ese estado.
- `sqlx-postgres 0.7.4` y npm 12 sobre Node 20 mantienen warnings conocidos.

### Que Romperia En Produccion

- Desplegar el binario sin aplicar `0026` haria fallar lecturas/escrituras de las
  nuevas columnas y no liberaria `NO_SHOW` del exclusion constraint.
- Volver a filtrar solamente `CANCELLED` ocuparia inventario y sumaria revenue de
  no-shows en disponibilidad, reportes o KPIs.
- Permitir transiciones por el servicio legacy reabriria el bypass de motivos,
  actor y auditoria; ese servicio rechaza cambios de estado.
- Interpretar la ETA con timezone local sin agregar timezone de hotel desalinearia
  UI y backend alrededor del cambio de fecha.

### DoD WF-007

- [x] Cancelacion, no-show y llegada tardia definidos con tradeoffs explicitos.
- [x] `NoShow` separado y terminal; transiciones invalidas rechazadas.
- [x] Motivo/nota, actor y timestamp persistidos y auditados transaccionalmente.
- [x] No-show anticipado y ETA pasada/fuera de estadia rechazados en backend.
- [x] Inventario, ocupacion, revenue y scripts de performance alineados.
- [x] API v1, OpenAPI, mirror, cliente generado y changelog alineados.
- [x] UI sin shortcuts inseguros y validacion visible comprobada en navegador real.
- [x] Unit, integracion, frontend, seguridad, journeys, gate y readiness en PASS.
- [x] Review Critical/High/Medium/Low y fallos intermedios documentados.
- [ ] Checklist manual completa de seis anchos.
- [ ] Commit/push/deploy, fuera del alcance ejecutado.

## Delta — 2026-08-01 — WF-008

### Decision e implementacion

- `Maintenance` deja de ser un cambio de estado aislado: cada apertura crea un
  `MaintenanceCase` con motivo, prioridad, responsable, actor y timestamp.
- Apertura de caso, cambio de habitacion a `MAINTENANCE` y auditoria se confirman
  en una unica transaccion tenant-scoped. Solo puede existir un caso abierto por
  habitacion.
- La resolucion exige evidencia, registra actor y timestamp, cierra el caso y
  devuelve siempre la habitacion a `DIRTY`; nunca libera inventario directamente.
- Los endpoints v1 existentes se preservan. Sus cuerpos son opcionales para
  compatibilidad legacy, mientras el cliente first-party envia evidencia explicita.
- Los cambios de estado genericos y masivos rechazan tanto entrar como salir de
  `Maintenance`, evitando saltar el workflow desde `Rooms` o un cliente API.
- Las habitaciones heredadas en `MAINTENANCE` reciben un caso por migracion; si
  aparece un registro fuera de banda sin caso, la resolucion crea evidencia de
  recuperacion dentro de la misma transaccion antes de cerrarlo.
- El board expone el caso abierto, incluye todo `Maintenance` en bloqueos aunque
  no tenga salida hoy y cruza habitaciones, salidas y casos con mapas O(n).
- OpenAPI source/mirror, cliente TypeScript, changelog, workflows y checklist
  manual quedaron alineados sin romper rutas v1.

### Evidencia ejecutada

| Comando | Resultado | Evidencia resumida |
| --- | --- | --- |
| `cargo fmt --all -- --check && cargo check --all-targets` desde `backend/` | `PASS` | Formato y compilacion de todos los targets. |
| `docker compose exec -T backend cargo test --test maintenance_workflow -- --nocapture` | `PASS` | 1/1; owner/prioridad, unicidad, rollback tenant, bloqueo del bypass, auditoria, resolucion y recuperacion legacy. |
| `docker compose exec -T backend cargo test --test operational_flow --test maintenance_workflow -- --nocapture` | `PASS` | 2 suites, 2/2 despues de optimizar el board. |
| `docker compose exec -T frontend npm run test -- --run src/features/housekeeping/components/MaintenanceCaseActions.test.tsx` | `PASS` | 2/2; evidencia obligatoria, apertura priorizada y resolucion con nota. |
| `docker compose exec -T frontend npm run lint` | `PASS` | TypeScript sin errores. |
| `docker compose exec -T frontend npm run test -- --run` | `PASS` | 15 archivos y 53/53 tests. |
| `docker compose exec -T frontend npm run build` | `PASS` | Build Vite; CSS 106.77 KiB decimal, assets emitidos. |
| `./scripts/ci-backend.sh` | `PASS` | fmt, Clippy, 70/70 unitarios y OpenAPI 4/4. |
| `./scripts/check-openapi-alignment.sh` | `PASS` | Router, source y mirror alineados. |
| `./scripts/check-openapi-client-drift.sh` | `PASS` | Cliente TypeScript generado sin drift. |
| `./scripts/ci-backend-integration.sh --runner docker` | `PASS` | Todas las suites en primer intento; WF-008 1/1, RLS 3/3 e integridad de reservas 6/6. |
| `./scripts/backend-security-regression.sh --runner docker` | `PASS` | RBAC 1/1 y CSRF/AuthN 1/1. |
| `./scripts/qa-core-journeys.sh --runner docker` | `PASS` | AuthN, RBAC, booking 3/3 y ciclo operacional 1/1. |
| Playwright CLI, `admin -> /housekeeping` | `PASS` | Bloqueos muestra 1; caso legacy y owner visibles; formulario bloqueado sin evidencia y habilitado con motivo, prioridad urgente y responsable. Sin mutar demo. |
| `./scripts/gate.sh` | `PASS` | Corrida final posterior al review: backend 70/70, OpenAPI 4/4, frontend 53/53, build, budgets, coverage y governance. |
| `./scripts/prod-deploy-readiness.sh` | `PASS` condicionado | Config, Compose y KPI validos; enforcement SLO diferido por 0/10 muestras. |
| `git diff --check` | `PASS` | Sin errores de whitespace. |

### FAIL observados y remediacion

- El watcher local alcanzo a aplicar una primera version de `0027` antes de que
  terminara el refinamiento y el reinicio reporto `VersionMismatch(27)`. Se
  restauro `0027` byte a byte, se verifico su SHA-384 contra `_sqlx_migrations`
  y todo ajuste posterior se agrego de forma inmutable en `0028`; no se altero
  historial ni checksum de base de datos.
- La primera invocacion directa del wrapper Playwright fallo con `Permission
  denied`; se ejecuto mediante `bash`, sin modificar la skill, y el smoke paso.
- Un `cargo fmt --check` posterior a la optimizacion detecto dos diferencias de
  formato. Se aplico `cargo fmt`, se repitio compile/check y el gate final paso.
- npm 12 advierte que no soporta oficialmente Node 20.20.0, pero lint, tests,
  build, Playwright y coverage finalizaron correctamente; queda como deuda de
  toolchain, no como fallo funcional.

### Review estricto

#### Critical

- Sin hallazgos confirmados abiertos.

#### High

- Cerrado: los endpoints genericos permitian representar `Maintenance` sin caso
  ni owner. Backend y UI ahora bloquean entrada/salida generica y masiva.
- Cerrado: estado, caso y auditoria podian divergir si se persistian por separado.
  Apertura y resolucion usan transacciones con lock de habitacion y unicidad de
  caso abierto.

#### Medium

- Cerrado: el dominio aun aceptaba `Maintenance -> Available` aunque el servicio
  lo rechazaba. Se elimino la transicion y se agrego una prueba de regresion.
- Cerrado: el board cruzaba colecciones con busquedas cuadraticas. Se reemplazo
  por indices en memoria O(n), sin introducir consultas N+1.
- Cerrado: el CTA de bloqueos apuntaba a salidas aun cuando el caso no tenia una
  salida ese dia. Ahora navega a la columna Maintenance correspondiente.
- `assigned_to` es texto controlado y no una FK de empleado/turno porque HMS aun
  no modela personal de mantenimiento. Permite ownership visible sin inventar un
  agregado fuera del alcance; la asignacion formal sigue pendiente.
- La compatibilidad v1 admite cuerpos vacios y genera evidencia default. El
  cliente first-party siempre exige datos explicitos; retirar el fallback requiere
  una version contractual o deprecacion.
- Readiness conserva 0 deploys de los 10 minimos para enforcement SLO.

#### Low

- El CSS queda en 104.27 KiB medidos por el budget gate, con 10.73 KiB de margen
  frente al limite de 115 KiB.
- `sqlx-postgres 0.7.4` mantiene un warning de incompatibilidad futura conocido.
- La etiqueta visual de una prioridad persistida usa el valor contractual ingles
  (`Medium`) en el caso existente; la accion de alta si presenta opciones en
  castellano. Es cosmético y no altera semantica.

### Que Romperia En Produccion

- Desplegar el binario sin aplicar `0027` y `0028` haria fallar la lectura del
  board y las escrituras de casos.
- Modificar `0027` despues de aplicada volveria a provocar mismatch de migracion;
  toda evolucion debe agregarse en una migracion nueva.
- Rehabilitar `MAINTENANCE` en PATCH/bulk de rooms permitiria crear estados sin
  caso o liberar habitaciones sin resolucion ni limpieza.
- Separar update de habitacion, caso y auditoria reintroduciria estados parciales
  ante errores o concurrencia.
- Cambiar la resolucion a `Available` publicaria inventario sin limpieza final.

### DoD WF-008

- [x] Caso de mantenimiento con motivo, prioridad y responsable.
- [x] Actor, timestamps y auditoria de apertura/resolucion.
- [x] Una sola incidencia abierta por habitacion y aislamiento tenant/RLS.
- [x] Apertura y resolucion transaccionales bajo concurrencia.
- [x] Retorno obligatorio a `Dirty`; `Maintenance -> Available` rechazado.
- [x] Bypass generico y masivo bloqueado en backend y UI.
- [x] Datos legacy migrados y recuperacion fuera de banda cubierta.
- [x] Board, contador y CTA alineados; smoke real sin mutaciones.
- [x] API v1, OpenAPI, mirror, cliente, changelog y workflows alineados.
- [x] Unit, integracion, frontend, seguridad, journeys, gate y readiness en PASS.
- [x] Review Critical/High/Medium/Low y fallos intermedios documentados.
- [ ] Checklist manual completa de seis anchos.
- [ ] Commit/push/deploy, fuera del alcance ejecutado.

## Delta — 2026-08-01 — WF-012

### Decision e implementacion

- V1 queda limitado a campos que el dominio persiste y cuya semantica ya esta
  definida. Documento, preferencias, historial CRM, rate plans y notas libres no
  se agregan hasta definir validacion, retencion, edicion y busqueda.
- `Room`, `Booking` y `Guest` documentan como requeridas todas las claves que el
  backend siempre serializa; una clave requerida puede mantener valor `null`
  cuando el dominio la modela como opcional.
- `Room` y `Guest` incorporan `hotel_id` al schema publicado. `Guest` incorpora
  `created_at`; ambos ya estaban presentes en la respuesta runtime.
- El tipo manual frontend queda alineado: `Booking.operational_data` es requerido
  y `Guest.phone`/`created_at` son claves requeridas nullable.
- La ficha de huesped deja de afirmar verificacion, categoria premium, perfil
  completo o historial inexistente. Expone contacto real y delimita V1.
- La matriz funcional define como recursos estructurados a extras, cobros,
  evidencia operativa, holds e incidencias, evitando reemplazarlos por texto libre.
- No se cambian rutas, payloads ni persistencia; el ajuste de OpenAPI es aditivo y
  corrige la precision del contrato v1 existente.

### Evidencia ejecutada

| Comando | Resultado | Evidencia resumida |
| --- | --- | --- |
| `cargo test --test openapi_contract` | `PASS` | 5/5; nueva prueba verifica required/properties exactos de Room, Booking y Guest. |
| `docker compose exec -T frontend npm run test -- --run src/features/guests/components/GuestDetailsSheet.test.tsx` | `PASS` | 1/1; copy limitado a datos persistidos y claims falsos ausentes. |
| `docker compose exec -T frontend npm run lint` | `PASS` | Tipos manuales nullable/required alineados sin errores. |
| `./scripts/check-openapi-alignment.sh` | `PASS` | Source y mirror identicos; rutas alineadas. |
| `./scripts/check-openapi-client-drift.sh` | `PASS` | Cliente regenerado: campos core requeridos y nullable correctos. |
| `./scripts/check-validation-governance.sh` | `PASS` | Documentacion de validacion conforme. |
| `./scripts/gate.sh` | `PASS` | Backend 70/70, OpenAPI 5/5, frontend 54/54, build, budgets, coverage y governance. |
| `./scripts/prod-deploy-readiness.sh` | `PASS` condicionado | Config, Compose y KPI validos; enforcement SLO diferido por 0/10 muestras. |
| `git diff --check` | `PASS` | Sin errores de whitespace. |

### FAIL observados y remediacion

- La primera corrida del test UI esperaba una sola aparicion del nombre; la vista
  lo muestra en encabezado y perfil. Se corrigio la expectativa a dos ocurrencias
  y la repeticion paso 1/1. Fue un fallo del test nuevo, no del producto.
- El smoke Playwright llego a `/login`, pero la credencial admin local ya no
  coincide con el default demo y devolvio `Credenciales invalidas`. No se roto ni
  sobrescribio ningun secreto para forzar la prueba. La validacion visual
  autenticada queda pendiente; el DOM de la ficha esta cubierto por test.
- El wrapper Playwright requiere invocacion mediante `bash` porque no tiene bit
  ejecutable; el navegador se cerro y los artefactos temporales se eliminaron.

### Review estricto

#### Critical

- Sin hallazgos confirmados abiertos.

#### High

- Cerrado: la UI presentaba `Huesped Verificado`, `Cliente Premium`, `Perfil
  completo` e historial sin campos ni proceso que respaldaran esas afirmaciones.
- Cerrado: OpenAPI omitia campos tenant y temporales que runtime ya exponia,
  generando clientes incompletos para entidades core.

#### Medium

- Cerrado: el tipo manual frontend trataba claves siempre serializadas como
  opcionales. Ahora distingue correctamente clave requerida y valor nullable.
- Agregar documento sin politica de tipo/pais/unicidad y retencion aumentaria
  riesgo de datos personales e identidades duplicadas; queda diferido a CRM.
- `total_price_cents` es el snapshot comercial V1; rate plans y tarifa nocturna
  explicita requieren un modelo de pricing separado y no se infieren dividiendo
  el total.
- Los timestamps backend basados en `NaiveDateTime` se publican como `date-time`,
  una convencion transversal ya existente. Normalizar offset/timezone merece un
  ticket contractual separado, no una modificacion parcial de estas entidades.
- Readiness conserva 0 deploys de los 10 minimos para enforcement SLO.

#### Low

- El CSS permanece en 104.27 KiB, con 10.73 KiB frente al limite de 115 KiB.
- `sqlx-postgres 0.7.4` y npm 12 sobre Node 20 mantienen warnings conocidos.
- La ficha repite el nombre en header y bloque de perfil; es intencional en el
  layout actual y queda probado explicitamente.

### Que Romperia En Produccion

- Volver opcionales en OpenAPI campos que runtime siempre envia degradaria los
  tipos generados y reintroduciria validaciones defensivas innecesarias.
- Declarar `phone` o `created_at` no-nullable romperia con registros validos que
  actualmente serializan `null`.
- Mostrar verificacion, premium, documento o preferencias sin fuente persistida
  induciria decisiones operativas sobre datos inventados.
- Calcular una tarifa nocturna dividiendo el total mezclaria pricing con extras,
  impuestos o descuentos futuros.

### DoD WF-012

- [x] Matriz de campos V1 decidida para huesped, reserva y habitacion.
- [x] Diferidos CRM/pricing explicitados con su razon.
- [x] Schemas core reflejan campos runtime required/nullable.
- [x] OpenAPI source, mirror y cliente generado alineados.
- [x] Tipo manual frontend alineado con el contrato.
- [x] UI elimina claims no respaldados por datos.
- [x] Pruebas contractuales y de UI agregadas.
- [x] Gate y readiness en PASS.
- [x] Review Critical/High/Medium/Low y fallos intermedios documentados.
- [ ] Smoke autenticado de ficha con credencial local vigente.
- [ ] Checklist manual completa de seis anchos.
- [ ] Commit/push/deploy, fuera del alcance ejecutado.
