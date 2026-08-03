# User Workflows V1

## Objetivo

Definir como trabajan los usuarios internos de HMS Elite durante una jornada,
desde el evento que inicia su trabajo hasta el resultado y handoff esperado.
Este documento conecta responsabilidades, pantallas, permisos y evidencia sin
repetir las reglas de dominio del ciclo del huesped.

## Alcance V1

Roles incluidos:

- `receptionist`
- `housekeeping`
- `ops`
- `admin`
- `saas_admin`

El huesped es una entidad atendida por el staff, no un usuario autenticado en
V1. Mantenimiento es un destino operativo de incidencias, no un rol de acceso.

Quedan fuera de V1 hasta validar una necesidad comercial concreta:

- portal self-service del huesped
- cajero dedicado
- auditor nocturno
- supervisor o asignacion individual de housekeeping
- tecnico de mantenimiento
- contabilidad y facturacion avanzada
- revenue manager
- agente de reservas separado de recepcion

## Jerarquia Documental

Cuando dos fuentes difieran, se usa esta responsabilidad:

1. Este documento define actores, objetivos, jornadas, handoffs y cobertura.
2. [`guest-lifecycle-workflow.md`](guest-lifecycle-workflow.md) define estados,
   transiciones y reglas del ciclo operativo del huesped.
3. [`rbac-canon-v1.json`](../validation/rbac-canon-v1.json) define los permisos
   efectivos por rol.
4. [`backend/openapi.yaml`](../../backend/openapi.yaml) define el contrato HTTP
   publico de API v1.
5. [`manual-qa-role-checklist.md`](../validation/manual-qa-role-checklist.md)
   define la evidencia manual esperada.

Una diferencia no se resuelve ocultandola ni haciendo que un documento suplante
a otro. Debe registrarse como gap y cerrarse con cambio de producto, contrato,
implementacion y prueba cuando corresponda.

## Estados De Cobertura

- `implemented`: existe en producto y tiene evidencia suficiente.
- `partial`: existe, pero faltan pasos, reglas o evidencia end-to-end.
- `missing`: el flujo fue identificado pero no esta implementado.
- `blocked`: depende de una decision o capacidad previa.

## Matriz General

| Rol | Objetivo principal | Inicio habitual | Resultado | Estado |
| --- | --- | --- | --- | --- |
| `receptionist` | Resolver llegadas, estadias y salidas | Inicio de turno o llegada | Reserva y habitacion sincronizadas | `implemented` |
| `housekeeping` | Recuperar inventario despues de una salida | Habitacion `Dirty` | Habitacion `Available` o incidencia escalada | `partial` |
| `ops` | Resolver excepciones y coordinar la operacion | Alerta, bloqueo o revision del tablero | Conflicto resuelto y auditado | `partial` |
| `admin` | Gobernar la operacion del hotel | Alta, revision o excepcion administrativa | Tenant configurado y controlado | `partial` |
| `saas_admin` | Gobernar propiedades de la plataforma | Alta o cambio de una propiedad | Hotel habilitado y plan aplicado | `partial` |

Ningun flujo se considera completo solo porque las rutas o capacidades existan.
El estado requiere recorrido funcional y evidencia de sus mutaciones criticas.

## Workflow: Recepcion

### Proposito

Atender al huesped y mantener sincronizados reserva, habitacion y cuenta desde
la preparacion de la llegada hasta el checkout.

### Precondiciones

- sesion valida en el tenant correcto
- usuario con capacidades de reservas, huespedes y consulta de habitaciones
- inventario y reservas futuras cargados
- caja y politica de saldo definidas para la operacion

### Jornada Principal

1. Abrir el board de recepcion y revisar llegadas, salidas y casos bloqueados.
2. Preparar llegadas validando reserva, identidad, fechas y estado de habitacion.
3. Buscar al huesped o crear su ficha cuando se trate de un `walk-in`.
4. Crear o abrir la reserva y asignar una habitacion disponible.
5. Ejecutar check-in cuando reserva y habitacion cumplan las precondiciones.
6. Durante la estadia, consultar saldo, registrar cargos y gestionar cambios.
7. En pre-checkout, revisar cargos, pagos, saldo y politica financiera.
8. Ejecutar checkout y confirmar que la habitacion quede en `Dirty`.
9. Entregar habitaciones a housekeeping y casos excepcionales a `ops`.
10. Antes de terminar el turno, dejar casos pendientes identificados para el
    siguiente recepcionista u operador.

Las transiciones y bloqueos detallados se rigen por
[`guest-lifecycle-workflow.md`](guest-lifecycle-workflow.md).

El backend aplica la secuencia `Confirmed -> CheckedIn -> CheckedOut`, permite
`Confirmed -> Cancelled` y `Confirmed -> NoShow`, y valida los checklists, el
estado de habitacion, la cuenta y la evidencia de excepciones dentro de la misma
transaccion. La UI no es una frontera de seguridad.

### Excepciones

- Habitacion `Dirty` o `Maintenance`: bloquear check-in y derivar a `ops`.
- Huesped o reserva inconsistente: completar o corregir antes del check-in.
- Cancelacion: solo desde `Confirmed`, exige motivo y conserva actor y timestamp.
- No-show: solo desde `Confirmed` y desde la fecha de llegada; exige motivo y es
  un estado terminal distinto de `Cancelled`.
- Llegada tardia: conserva la reserva `Confirmed`; exige ETA futura dentro de la
  estadia y una nota, ambas auditadas. Luego permite completar el check-in normal.
- Cancelacion y no-show liberan inventario y dejan de computar como reserva activa
  o revenue operacional. V1 no genera penalidades ni cargos automaticos porque no
  existe todavia una politica tarifaria contractual para esos importes.
- Saldo pendiente: bloquear por defecto; cualquier excepcion requiere permiso,
  referencia y auditoria.
- Cambio de habitacion durante la estadia: solicitar a `ops` o `admin`, los
  roles habilitados actualmente para ejecutar la reasignacion.

### Handoffs

- A `housekeeping`: habitacion `Dirty` despues del checkout.
- A `ops`: bloqueo de inventario, reasignacion o conflicto operativo.
- A `admin`: override, politica financiera o configuracion.
- A siguiente turno: casos abiertos y saldos pendientes identificados.

### Trazabilidad

- Pantallas: `/bookings`, `/calendar`, `/rooms`, `/guests`.
- Capacidades: `bookings.*`, `bookings.extra_charges.*`, `guests.*`,
  `rooms.read`, `rooms.search`, `billing.balance.read`,
  `billing.invoice.read` segun el canon RBAC.
- Evidencia actual: integracion backend, smoke visual de recepcion, E2E de
  navegador del ciclo walk-in, check-in, cargo, pago, checkout y handoff a
  housekeeping, y pruebas transaccionales de cancelacion, no-show y llegada
  tardia.
- Cobertura: `implemented`; el ciclo principal, handoff de caja y excepciones de
  llegada estan definidos, aplicados en backend y cubiertos por pruebas.

## Workflow: Housekeeping

### Proposito

Devolver al inventario las habitaciones liberadas por checkout sin publicar
como disponible una habitacion que no haya completado limpieza.

### Precondiciones

- sesion valida con `housekeeping.read` y `housekeeping.write`
- checkout previo que deje la habitacion en `Dirty`
- board actualizado con salidas y prioridades

### Jornada Principal

1. Abrir `/housekeeping` y revisar salidas y prioridades.
2. Tomar una habitacion `Dirty` e iniciar limpieza.
3. Mover la habitacion a `Cleaning` mientras se realiza el trabajo.
4. Finalizar limpieza y devolverla a `Available`.
5. Si existe una incidencia, crear un caso con motivo, prioridad y responsable;
   la habitacion pasa a `Maintenance` y deja de ser vendible.
6. Resolver el caso con una nota de trabajo realizado; la habitacion vuelve
   obligatoriamente a `Dirty` para completar limpieza antes de liberarse.
7. Revisar que no queden habitaciones tomadas sin resultado al cerrar turno.

### Excepciones

- Incidencia tecnica: abrir el caso en `Maintenance` y asignarlo a `ops` o al
  equipo responsable; no usar cambios de estado genericos.
- Limpieza incompleta: conservar o devolver a `Dirty` segun la transicion
  permitida; nunca marcar `Available`.
- Estado inesperado o cambio concurrente: refrescar y derivar a `ops`.

### Handoffs

- A recepcion: habitacion `Available` y vendible.
- A `ops`: caso de incidencia con motivo, prioridad y responsable visible.
- A siguiente turno: habitaciones en proceso o bloqueadas identificadas.

### Trazabilidad

- Pantalla: `/housekeeping`.
- Capacidades: `housekeeping.read`, `housekeeping.write`.
- Evidencia actual: integracion backend, smoke visual y E2E de navegador que
  ejecuta `Dirty -> Cleaning -> Available` despues del checkout, mas workflow
  transaccional de incidencia con owner, resolucion, auditoria y retorno a `Dirty`.
- Cobertura: `partial`; falta planificacion formal de tareas por persona o turno.

## Workflow: Operaciones

### Proposito

Coordinar recepcion, inventario y housekeeping, resolviendo las excepciones que
un rol operativo acotado no puede cerrar por si mismo.

### Precondiciones

- sesion valida con rol `ops`
- acceso a dashboard, reservas, habitaciones, housekeeping y auditoria
- alerta, bloqueo o revision operativa que requiera intervencion

### Jornada Principal

1. Revisar KPIs, alertas, llegadas bloqueadas y estado del inventario.
2. Priorizar conflictos que impidan check-in, checkout o venta de habitaciones.
3. Validar disponibilidad y reasignar habitaciones cuando corresponda.
4. Corregir estados mediante transiciones permitidas, sin saltar el dominio.
5. Coordinar la resolucion con recepcion o housekeeping.
6. Confirmar que reserva, habitacion y cuenta queden consistentes.
7. Revisar la auditoria del cambio y devolver el caso al rol solicitante.
8. Escalar a `admin` si hace falta un override o cambio de politica.

### Excepciones

- No hay habitacion alternativa: mantener caso bloqueado y escalar a `admin`.
- Conflicto de concurrencia: recargar estado antes de reintentar.
- Cambio no permitido por dominio: no forzarlo desde UI; escalar con evidencia.
- Hold operativo: lectura y gestion estan alineadas entre frontend, backend y
  contrato; todavia falta evidencia E2E de navegador para sus mutaciones.

### Handoffs

- A recepcion: reserva lista para continuar.
- A housekeeping: prioridad o estado de habitacion corregido.
- A `admin`: override, configuracion o decision financiera.

### Trazabilidad

- Pantallas: `/`, `/bookings`, `/rooms`, `/housekeeping`, `/reports`,
  `/guests`.
- Capacidades: inventario operativo, reservas, housekeeping, caja, auditoria y
  reportes definidas para `ops` en el canon RBAC.
- Evidencia actual: tests backend seleccionados y checklist manual.
- Cobertura: `partial`; no existe un journey E2E propio de `ops` ni cierre
  formal de excepciones.

### Subflujo: Caja Por Turno

1. El turno abre automaticamente en el cierre anterior; si no existe uno, en
   el primer cobro registrado. No requiere una apertura manual que pueda quedar
   huerfana.
2. Dashboard muestra inicio, cantidad de cobros, efectivo esperado y medios no
   efectivos desde esa apertura.
3. Al finalizar, `ops` o `admin` cuenta el efectivo fisico e identifica el turno
   o persona que recibe.
4. El cierre persiste esperado, contado, diferencia, ventana, notas y handoff.
5. El siguiente cobro pertenece a la nueva ventana, incluso si concurrio con el
   cierre; un segundo cierre stale se rechaza y exige recargar.
6. Reportes conserva el historial para conciliacion y continuidad operativa.

#### Excepciones De Caja

- Diferencia de arqueo: se registra sin ocultarla y se explica en notas antes de
  entregar el turno.
- Cierre concurrente: no reintentar con datos viejos; recargar balance.
- Cobro posterior: queda en el turno siguiente y no modifica el cierre emitido.
- Cliente API legacy: puede omitir los campos aditivos; el backend usa efectivo
  esperado y `Siguiente turno` para preservar compatibilidad v1.

## Workflow: Administracion Del Hotel

### Proposito

Configurar y controlar un tenant hotelero, administrar accesos y resolver
excepciones que requieren autoridad superior a la operacion diaria.

### Precondiciones

- sesion valida con rol `admin`
- tenant identificado
- politica de usuarios, inventario y caja definida

### Jornada Principal

1. Configurar habitaciones, tarifas base y restricciones operativas.
2. Crear y retirar usuarios del hotel con el rol adecuado.
3. Revisar dashboard, reportes, caja y auditoria.
4. Investigar excepciones escaladas por recepcion u `ops`.
5. Autorizar o rechazar overrides con motivo y evidencia.
6. Confirmar el cierre operativo diario o semanal.

### Excepciones

- Cambio que afecta a toda la plataforma: derivar a `saas_admin`.
- Rol fuera del catalogo tenant: no elevar permisos temporalmente; cualquier
  identidad de plataforma se provisiona fuera de `/users` y se deriva a
  `saas_admin`.
- Override no soportado: conservar el caso bloqueado y abrir cambio tecnico.

### Handoffs

- A `ops`: configuracion o decision aplicada para continuar la operacion.
- A `saas_admin`: alta, plan, suspension o configuracion global del hotel.
- A soporte: defecto tecnico con evidencia reproducible.

### Trazabilidad

- Pantallas objetivo: `/`, `/rooms`, `/users`, `/reports` y auditoria.
- Capacidades: inventario, usuarios, reportes, caja y auditoria.
- Frontera vigente: `admin` queda limitado al tenant y `/network` se reserva a
  `saas_admin`; backend y frontend aplican la misma matriz canonica.
- Alta tenant disponible para `admin`, `ops`, `receptionist` y `housekeeping`;
  el backend oculta y protege identidades `saas_admin`, normaliza el rol y
  audita al administrador actor.
- Cobertura: `covered`; caja por turno, override de checkout, onboarding de
  roles y separacion tenant/plataforma estan resueltos.

## Workflow: Administracion SaaS

### Proposito

Dar de alta y gobernar propiedades dentro de HMS Elite sin intervenir en la
operacion cotidiana de cada hotel.

### Precondiciones

- sesion valida con rol `saas_admin`
- datos comerciales y plan acordados
- responsable del cliente identificado

### Jornada Principal

1. Abrir `/network` y revisar el estado de la red.
2. Crear la propiedad con sus datos minimos.
3. Asignar plan y funcionalidades contratadas.
4. Verificar que el tenant quede disponible para setup y onboarding.
5. Supervisar KPIs agregados y cambios de plan.
6. Registrar el handoff al `admin` del hotel.

### Excepciones

- Datos o plan incompletos: no activar la propiedad.
- Error de provisionamiento: mantener el alta bloqueada y escalar a soporte.
- Suspension, baja y reactivacion: flujo `missing` en V1.
- Acceso a operacion hotelera: fuera del alcance objetivo de `saas_admin`.

### Handoffs

- A `admin`: tenant creado para setup de habitaciones y usuarios.
- A onboarding: entorno listo para carga inicial y capacitacion.
- A soporte: fallo de provisionamiento o configuracion de plataforma.

### Trazabilidad

- Pantalla: `/network`.
- Capacidades: `saas.hotels.read`, `saas.hotels.write`.
- Evidencia actual: smoke manual de red global; sin E2E dedicado.
- Cobertura: `partial`; faltan activacion verificable, suspension y lifecycle
  completo de una propiedad.

## Handoffs Criticos

| Origen | Destino | Evento | Contrato de salida |
| --- | --- | --- | --- |
| Recepcion | Housekeeping | Checkout completado | Reserva `CheckedOut`, habitacion `Dirty` |
| Housekeeping | Recepcion | Limpieza completada | Habitacion `Available` |
| Recepcion | Ops | Llegada o estadia bloqueada | Caso, causa y estado actual identificados |
| Housekeeping | Ops | Incidencia o mantenimiento | Habitacion no vendible y motivo visible |
| Ops | Admin | Override o politica requerida | Evidencia y alternativa evaluada |
| SaaS admin | Admin | Hotel provisionado | Tenant, plan y responsable identificados |

## Registro De Gaps

| ID | Prioridad | Estado | Gap | Impacto | Proxima accion |
| --- | --- | --- | --- | --- | --- |
| `WF-001` | P0 | `resolved` | Frontend consumia `GET /rooms/{id}` sin ruta GET equivalente documentada | Podia bloquear validaciones de recepcion | Cerrado el 2026-07-31 con router, servicio tenant-scoped, OpenAPI, cliente y test |
| `WF-002` | P0 | `resolved` | Las invariantes formales de check-in/checkout dependian de la UI | Un cliente API podia saltar reglas | Cerrado el 2026-08-01 con maquina de estados, checklists, cuenta y rollback transaccional en backend |
| `WF-003` | P1 | `resolved` | No habia E2E navegador del ciclo completo | El journey real no estaba demostrado | Cerrado el 2026-08-01 con `frontend/e2e/guest-lifecycle.spec.ts`: walk-in hasta limpieza |
| `WF-004` | P1 | `resolved` | `admin` compartia capacidades SaaS con `saas_admin` | Frontera tenant/plataforma ambigua | Cerrado el 2026-08-01: `saas.hotels.read/write` quedan solo en `saas_admin`, con 403 y guard UI |
| `WF-005` | P1 | `resolved` | UI de usuarios no exponia todos los roles operativos | Onboarding dependia de proceso externo | Cerrado el 2026-08-01: cuatro roles tenant, proteccion plataforma, auditoria y pruebas |
| `WF-006` | P1 | `resolved` | Caja por turno y handoff entre turnos no estaban definidos end-to-end | Cierre operativo incompleto | Cerrado el 2026-08-01 con apertura automatica, arqueo, diferencia, cierre serializado y entrega trazable |
| `WF-007` | P2 | `resolved` | Cancelacion sin journey completo; no-show y late arrival ausentes | Excepciones habituales quedaban manuales | Cerrado el 2026-08-01 con estados separados, evidencia obligatoria, auditoria e inventario liberado |
| `WF-008` | P2 | `resolved` | Mantenimiento termina en un estado, no en un workflow | Habitaciones pueden quedar bloqueadas sin owner | Cerrado el 2026-08-01 con caso, motivo, prioridad, responsable, resolucion auditada y retorno obligatorio a `Dirty` |
| `WF-009` | P0 | `resolved` | Overrides de saldo usaban la capability general de update | Roles operativos podian intentar cerrar con saldo pendiente | Cerrado el 2026-08-01 con `bookings.checkout.override` solo admin, `403` fail-closed y auditoria transaccional |
| `WF-010` | P0 | `resolved` | `CreateBookingRequest` no declaraba `guest_id` aunque el walk-in lo necesita | El cliente generado no representaba el flujo documentado | Cerrado el 2026-07-31 en OpenAPI y cliente generado |
| `WF-011` | P1 | `resolved` | OpenAPI usaba `/rooms/{id}/holds/{id}` pero declaraba `hold_id` | Consumidores generados no representaban la edicion de holds | Cerrado el 2026-07-31 corrigiendo el path y regenerando el cliente |
| `WF-012` | P1 | `resolved` | Campos funcionales objetivo de huesped, reserva y habitacion exceden el contrato actual | Documentacion y capacidades efectivas pueden divergir | Cerrado el 2026-08-01 con matriz V1, schemas de respuesta exactos y UI sin claims de CRM inexistentes |

## Definicion De Terminado Por Workflow

Un workflow puede cambiar a `implemented` cuando:

- tiene actor, objetivo, inicio, pasos y resultado definidos
- explicita excepciones y handoffs
- cada accion esta vinculada a pantalla y capability
- las invariantes criticas se aplican en backend
- el contrato API v1 refleja las operaciones necesarias
- existe una prueba automatizada del happy path
- existe evidencia de al menos una excepcion critica
- la checklist manual por rol no contradice el comportamiento efectivo

## Mantenimiento

- Product/Ops mantiene objetivos, jornadas y handoffs.
- Engineering mantiene trazabilidad tecnica y registro de gaps.
- QA mantiene evidencia y estado de cobertura.
- Todo cambio de rol o capability debe revisar este documento, el canon RBAC y
  la checklist manual en la misma entrega.
