# HMS Elite - Manual QA Checklist by Role

## Objetivo
Estandarizar una pasada manual de QA para validar HMS Elite en web y mobile con datos demo, foco en:

- permisos por rol
- flujos operativos principales
- drawers y sheets en mobile
- responsive en anchos reales
- restricciones de acceso y UX base

## Alcance
Esta checklist no reemplaza:

- `./scripts/gate.sh`
- tests automatizados
- validaciones contractuales de OpenAPI

Esta checklist complementa esos gates con validacion manual de uso real.

Los objetivos, jornadas, handoffs y estado de cobertura por rol se definen en
[`../ops/user-workflows-v1.md`](../ops/user-workflows-v1.md). Una casilla valida
evidencia observable; no convierte por si sola un workflow en `implemented`.

## Entorno base

### URL local
- `http://localhost:5173`

### Tenant demo
- `hotel_id`: `00000000-0000-0000-0000-000000000001`

### Password demo
- `demo2026pass`

### Usuarios demo
- `admin`
- `recepcion_demo`
- `ops_demo`
- `housekeeping_demo`
- `saas_admin_demo`

## Anchos a validar
- `375`
- `390`
- `430`
- `768`
- `1024`
- `1440`

## Criterios globales PASS
- no hay contenido cortado
- no hay CTA fuera de pantalla
- header del drawer o sheet permanece visible
- footer del drawer o sheet permanece visible o es alcanzable sin romper layout
- el body interno scrollea, no toda la app de forma incorrecta
- no hay texto ilegible ni badges superpuestos
- la sidebar y el header no rompen la navegacion
- los permisos de rol bloquean rutas y acciones fuera de alcance
- una ruta prohibida abierta directamente termina en `/forbidden`
- una mutacion prohibida responde `403`, aunque el CTA este oculto

## Estado de bloqueos contractuales

- `WF-001` resuelto el 2026-07-31: `GET /rooms/{id}` existe en router, servicio
  tenant-scoped, OpenAPI y cliente generado.
- `WF-010` resuelto el 2026-07-31: `CreateBookingRequest` declara `guest_id`
  opcional y nullable.
- `WF-011` resuelto el 2026-07-31: la plantilla de holds usa
  `/rooms/{id}/holds/{hold_id}` de forma consistente.

La recepcion sigue en cobertura `partial` hasta contar con E2E de navegador que
ejecute todas las mutaciones del ciclo completo; los smokes visuales no reemplazan
esa evidencia.

Los IDs y acciones de cierre estan definidos en
[`../ops/user-workflows-v1.md`](../ops/user-workflows-v1.md#registro-de-gaps).

## Smoke inicial
- [ ] Login con `admin`
- [ ] Login con `recepcion_demo`
- [ ] Login con `ops_demo`
- [ ] Login con `housekeeping_demo`
- [ ] Login con `saas_admin_demo`
- [ ] La app carga sin errores visibles de UI
- [ ] La sidebar y el header renderizan bien en `375`, `768` y desktop

## Matriz rapida por rol

### admin
Debe poder entrar a:
- [ ] `/`
- [ ] `/bookings`
- [ ] `/calendar`
- [ ] `/rooms`
- [ ] `/guests`
- [ ] `/housekeeping`
- [ ] `/reports`
- [ ] `/users`

Debe poder ejecutar:
- [ ] abrir `BookingDetailsSheet`
- [ ] abrir `WalkInBookingSheet`
- [ ] abrir `RoomAdminSheet`
- [ ] abrir `RoomCreateDrawer`
- [ ] abrir `GuestCreateDrawer`
- [ ] abrir `UserCreateDrawer`
- [ ] registrar cobro en reserva
- [ ] crear y editar holds
- [ ] reasignar habitacion

No debe poder operar:
- [ ] `/network`
- [ ] `GET/POST /api/v1/hotels`

### recepcion_demo
Debe poder entrar a:
- [ ] `/bookings`
- [ ] `/calendar`
- [ ] `/rooms`
- [ ] `/guests`

Debe poder ejecutar:
- [ ] usar board de recepcion
- [ ] abrir caso desde la cola
- [ ] navegar caso anterior/siguiente
- [ ] crear walk-in
- [ ] registrar llegada tardia con ETA futura dentro de la estadia y nota
- [ ] cancelar una reserva confirmada con motivo
- [ ] marcar no-show desde la fecha de llegada con motivo
- [ ] hacer check-in formal
- [ ] hacer checkout formal
- [ ] registrar cobro desde reserva

No debe poder operar:
- [ ] `/users`
- [ ] `/network`

### ops_demo
Debe poder entrar a:
- [ ] `/`
- [ ] `/bookings`
- [ ] `/rooms`
- [ ] `/housekeeping`
- [ ] `/reports`
- [ ] `/guests`

Debe poder ejecutar:
- [ ] usar planner de habitaciones
- [ ] abrir `RoomAdminSheet`
- [ ] cambiar estado de habitacion
- [ ] usar acciones masivas de habitaciones
- [ ] operar housekeeping

No debe poder operar:
- [ ] `/users`
- [ ] `/network`

### housekeeping_demo
Debe poder entrar a:
- [ ] `/housekeeping`

Debe poder ejecutar:
- [ ] ver salidas del dia
- [ ] mover `Dirty -> Cleaning`
- [ ] mover `Cleaning -> Available`
- [ ] enviar a `Maintenance`
- [ ] devolver a `Dirty`

No debe poder operar:
- [ ] `/rooms`
- [ ] `/reports`
- [ ] `/users`
- [ ] `/network`

### saas_admin_demo
Debe poder entrar a:
- [ ] `/network`

Debe poder ejecutar:
- [ ] ver KPIs HQ
- [ ] ver red global
- [ ] abrir sheet de alta de hotel

No debe poder operar:
- [ ] `/bookings`
- [ ] `/rooms`
- [ ] `/housekeeping`
- [ ] `/users`

## Checklist por flujo

### 1. Recepcion
Rol recomendado: `recepcion_demo`
Workflow: [`Recepcion`](../ops/user-workflows-v1.md#workflow-recepcion)

- [ ] El board carga bien en desktop
- [ ] El board carga bien en `375`
- [ ] La cola critica no rompe cards ni botones
- [ ] Los filtros y acciones siguen accesibles en mobile
- [ ] `BookingDrawer` abre bien en mobile
- [ ] `BookingEditDrawer` abre bien en mobile
- [ ] `BookingDetailsSheet` abre bien en mobile
- [ ] `WalkInBookingSheet` abre bien en mobile
- [ ] Footer del sheet visible en mobile
- [ ] La navegacion entre casos no rompe layout
- [ ] Cancelar y no-show permanecen deshabilitados sin un motivo valido
- [ ] No-show permanece deshabilitado antes de la fecha de llegada
- [ ] La ETA tardia permanece deshabilitada si es pasada o queda fuera de la estadia
- [ ] Cancelar/no-show liberan disponibilidad y no permiten reabrir el estado terminal
- [ ] Motivo, ETA/nota, actor y timestamp aparecen en reserva y auditoria segun la accion

### 2. Habitaciones
Rol recomendado: `ops_demo`
Workflow: [`Operaciones`](../ops/user-workflows-v1.md#workflow-operaciones)

- [ ] La pantalla carga bien en desktop
- [ ] La pantalla carga bien en `375`
- [ ] El planner no rompe header ni CTA
- [ ] El toggle `grid/list` es usable en mobile
- [ ] `RoomAdminSheet` abre bien en mobile
- [ ] Las acciones masivas son usables en tablet y desktop

Validaciones privilegiadas con rol `admin`:

- [ ] `RoomCreateDrawer` abre bien en mobile
- [ ] Los holds se ven y editan sin cortar contenido

### 3. Housekeeping
Rol recomendado: `housekeeping_demo`
Workflow: [`Housekeeping`](../ops/user-workflows-v1.md#workflow-housekeeping)

- [ ] El board carga bien en desktop
- [ ] El board carga bien en `375`
- [ ] Las columnas bajan correctamente en tablet
- [ ] Las cards no superponen estado ni acciones
- [ ] El cambio de estado funciona sin perder contexto
- [ ] Abrir incidencia exige motivo, prioridad y responsable y crea un caso visible
- [ ] `Rooms` no permite entrar ni salir de `Maintenance` por accion generica o masiva
- [ ] Resolver exige nota, audita al actor y devuelve la habitacion a `Dirty`
- [ ] Una habitacion `Maintenance` cuenta como bloqueo aunque no tenga salida hoy

### 4. Huespedes
Rol recomendado: `admin`

- [ ] `GuestCreateDrawer` abre bien en mobile
- [ ] `GuestDetailsSheet` abre bien en mobile
- [ ] Header visible
- [ ] Body con scroll interno
- [ ] CTA o cierre visibles
- [ ] La ficha muestra solo contacto y fecha realmente persistidos
- [ ] No afirma verificacion, categoria premium, preferencias ni historial inexistentes

### 5. Usuarios
Rol recomendado: `admin`
Workflow: [`Administracion del hotel`](../ops/user-workflows-v1.md#workflow-administracion-del-hotel)

- [ ] `UserCreateDrawer` abre bien en mobile
- [x] El selector expone exactamente `admin`, `ops`, `receptionist` y
  `housekeeping`; verificado por test y Playwright real el 2026-08-01
- [x] `saas_admin` no aparece en selector ni listado tenant; verificado por
  integración RBAC y Playwright real el 2026-08-01
- [ ] El selector de cuatro roles no rompe layout en los seis anchos manuales
- [ ] CTA final visible

### 6. HQ / Red Global
Rol recomendado: `saas_admin_demo`
Workflow: [`Administracion SaaS`](../ops/user-workflows-v1.md#workflow-administracion-saas)

- [ ] La vista `/network` carga bien
- [ ] El sheet de alta de hotel abre bien en mobile
- [ ] Header, body y footer mantienen layout correcto

## Checklist responsive por ancho

### 375
- [ ] Sidebar usable
- [ ] Header usable
- [ ] Recepcion usable
- [ ] Drawers principales usables

### 390
- [ ] Recepcion usable
- [ ] Habitaciones usable
- [ ] Housekeeping usable

### 430
- [ ] Drawers con CTA visibles
- [ ] Planner y boards legibles

### 768
- [ ] Tablet sin bloques apretados
- [ ] Grids bajan correctamente
- [ ] Drawers laterales mantienen estructura

### 1024
- [ ] Desktop intermedio sin saltos raros
- [ ] Sidebar colapsada usable
- [ ] Boards y tables con jerarquia correcta

### 1440
- [ ] Layout aireado
- [ ] No hay paneles desbalanceados
- [ ] Reportes y dashboard no se ven estirados de forma pobre

## Registro de resultado

### Evidencia automatizada 2026-07-31

- `./scripts/qa-core-journeys-e2e.sh --runner docker`: `PASS` (admin, 5/5).
- recepción con `E2E_GREP='reception role smoke'`: `PASS` (3/3; incluye
  `390x844` y `430x932`).
- housekeeping con `E2E_GREP='housekeeping role smoke'`: `PASS` (2/2; incluye
  `390x844`).
- primer intento del runner alternativo: `FAIL` de infraestructura por ffmpeg
  ausente con Chromium del sistema. Se desactivo solo video para ese runner;
  trace y screenshot siguen activos, y la repeticion completa paso.
- esta evidencia cierra los smokes automatizados, pero no marca como ejecutadas
  las casillas manuales restantes ni cambia por si sola workflows a
  `implemented`.

### Estado general
- [ ] PASS
- [ ] FAIL

### Defectos encontrados
- fecha:
- rol:
- ancho:
- ruta:
- componente:
- severidad:
- descripcion:
- evidencia:

### Cierre
- ejecutado por:
- fecha:
- version o commit:
- observaciones:
