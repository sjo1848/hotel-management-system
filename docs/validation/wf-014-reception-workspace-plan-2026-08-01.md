# WF-014 — Workspace Operativo de Recepción

Fecha: 2026-08-01
Producto: HMS Elite
Branch base verificada: `feature/gate-hardening-rbac-e2e`
Commit base requerido: `7fc72194cc7348373377515e22593000d2443622`
Estado: plan detallado; implementación no iniciada

## 1. Instrucción para el siguiente agente

Actuá como Principal Engineer, Product Designer, QA Lead y Security Engineer.
Implementá WF-014 respetando arquitectura hexagonal, RBAC, API v1 y todos los
gates del repositorio.

Antes de modificar archivos:

1. Leer este documento completo.
2. Leer [WF-013](wf-013-guided-ux-handoff-2026-08-01.md), especialmente la
   validación ejecutada.
3. Ejecutar `git status --short` y `git log -3 --oneline`.
4. Confirmar que `7fc7219` está en la historia y que no existen cambios locales
   de otro usuario/agente.
5. No usar `git reset`, `git checkout --`, `git clean` ni descartar cambios.
6. Crear `feature/wf-014-reception-workspace` desde la base verificada si el
   usuario autoriza comenzar el ticket en una rama nueva. Si se continúa en la
   rama actual, documentarlo en Gate 0.

WF-013 ya está implementado, validado y commiteado. No repetirlo ni reemplazar
sus tests; WF-014 debe reorganizar la presentación conservando su comportamiento.

## 2. Decisión de producto

La pantalla de recepción debe dejar de comportarse como una página de marketing
con muchas secciones verticales. Debe convertirse en un workspace operativo:

- navegación por tareas;
- cola compacta de casos;
- detalle progresivo;
- una acción principal visible;
- continuidad entre casos;
- guía contextual compacta;
- mismo dominio, permisos y contrato API.

No se resolverá agregando más botones a la pantalla principal. Más botones sin
jerarquía aumentan carga cognitiva y riesgo de error. La solución elegida es
reducir contenido simultáneo y revelar detalle según tarea y selección.

## 3. Problema actual

La página combina en una única columna vertical:

- encabezado y acciones globales;
- rail completo del modo guiado;
- métricas operativas;
- búsqueda y filtros;
- selección de casos;
- holds;
- cola detallada;
- resumen estadístico adicional;
- tabla completa de reservas;
- detalle en sheet con resumen, guía, próxima acción, huésped, reasignación,
  check-in/checkout, cuenta, acciones secundarias y auditoría.

Consecuencias:

- parece una landing page;
- exige mucho scroll;
- repite datos y prioridades;
- mezcla trabajo inmediato con consulta histórica;
- obliga a abrir/cerrar sheets en desktop;
- la acción siguiente compite con información secundaria;
- la guía ocupa demasiado espacio cuando no se necesita;
- el usuario pierde contexto entre cola y caso.

## 4. Resultado esperado

Un recepcionista debe poder:

1. Entrar a `/bookings` y entender el estado del turno en menos de 5 segundos.
2. Encontrar un caso por huésped, habitación o reserva.
3. Filtrar por etapa operativa con un clic.
4. Seleccionar un caso sin abandonar la cola en desktop.
5. Identificar bloqueo y próxima acción sin abrir múltiples secciones.
6. Completar check-in, cuenta o checkout desde contenido organizado.
7. Continuar al siguiente caso sin volver manualmente al inicio.
8. Usar la guía solo cuando la necesita.
9. Operar en mobile sin CTA fuera de pantalla ni scroll horizontal.

## 5. Arquitectura de información definitiva

La página tendrá cinco vistas principales:

| Vista | Propósito | Fuente de datos | Contenido |
| --- | --- | --- | --- |
| `Turno` | Resolver lo prioritario | `FrontDeskBoard.action_queue` más fallback de lanes | Urgentes, bloqueos, llegadas y salidas ordenadas |
| `Llegadas` | Preparar ingresos | `arrivals_blocked` + `arrivals_ready` | Bloqueadas primero, luego listas |
| `En casa` | Gestionar estadías activas | `in_house` | Cuenta, excepciones y seguimiento |
| `Salidas` | Cerrar cuenta y liberar habitación | `departures_today` | Saldo, checkout y handoff a housekeeping |
| `Reservas` | Consulta completa | `GET /bookings` existente | Tabla, filtros por estado, exportación y edición |

La vista inicial es `Turno`.

No crear rutas nuevas para cada pestaña en V1. Mantener estado local para reducir
riesgo. Deep links con query params quedan diferidos a un ticket posterior.

## 6. Layout objetivo

### 6.1 Desktop ancho (`>= 1280px`)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Recepción     Buscar huésped/habitación/reserva     + Nueva reserva │
│ Fecha operativa                 Ayuda guiada        Menú secundario │
├──────────────────────────────────────────────────────────────────────┤
│ Turno | Llegadas | En casa | Salidas | Reservas                    │
├──────────────────────────┬───────────────────────────────────────────┤
│ COLA                     │ CASO SELECCIONADO                        │
│                          │                                           │
│ 3 urgentes · 12 casos    │ María Gómez · Habitación 204             │
│ filtros compactos        │ Confirmada · próxima acción: check-in     │
│                          │                                           │
│ [caso compacto]          │ Resumen | Operación | Cuenta | Historial │
│ [caso compacto]          │                                           │
│ [caso compacto]          │ contenido de pestaña                     │
│                          │                                           │
│                          │ [CTA principal fijo]                     │
└──────────────────────────┴───────────────────────────────────────────┘
```

Dimensiones recomendadas:

- cola: `360px` a `420px`, nunca menos de `340px`;
- detalle: resto disponible, mínimo `640px`;
- altura de workspace: `calc(100dvh - header/tabs)`, con scroll interno
  independiente en cola y detalle;
- evitar que toda la página crezca por cada caso.

### 6.2 Desktop/tablet (`768px` a `1279px`)

- mostrar navegación y lista a ancho completo;
- abrir el caso en `BookingDetailsSheet` existente;
- conservar header/footer del sheet fijos y body con scroll interno;
- no intentar panel dividido si el detalle quedaría menor a `640px`.

### 6.3 Mobile (`375px`, `390px`, `430px`)

- barra superior compacta;
- búsqueda en una fila propia;
- tabs con scroll horizontal y estado seleccionado visible;
- lista de casos de una columna;
- detalle en sheet/pantalla completa;
- footer sticky con acción principal, siguiente caso y cerrar;
- filtros secundarios dentro de popover/drawer, no como fila interminable;
- cero overflow horizontal.

## 7. Barra superior

Acciones visibles, en este orden:

1. Título `Recepción`.
2. Búsqueda global del turno.
3. Fecha operativa.
4. `Nueva reserva`.
5. `Ayuda guiada`.
6. Menú `Más` con exportación y acciones de consulta.

No dejar el filtro de la tabla histórica en el encabezado global. Ese filtro
pertenece exclusivamente a la pestaña `Reservas`.

### 7.1 Búsqueda

Buscar sobre los datos disponibles por:

- nombre del huésped;
- número de habitación;
- tipo de habitación;
- ID completo o prefijo de reserva;
- lane, título y detalle de bloqueo.

No prometer búsqueda por teléfono: `FrontDeskBoardEntry` no expone teléfono.

Requisitos:

- normalización de mayúsculas y acentos;
- actualización inmediata local, sin request por tecla;
- botón accesible para limpiar cuando hay texto;
- atajo `/` cuando el foco no está dentro de input/textarea/select;
- `Escape` limpia la búsqueda si el input está enfocado.

## 8. Navegación principal

Usar tabs semánticas con:

- `role="tablist"`;
- `role="tab"`;
- `aria-selected`;
- navegación por teclado izquierda/derecha;
- indicador visual que no dependa solo del color;
- contador compacto opcional, por ejemplo `Llegadas 5`.

Al cambiar de vista:

- conservar fecha operativa;
- limpiar selección si el caso no pertenece a la nueva vista;
- preservar búsqueda solo si sigue siendo útil; decisión recomendada: conservarla;
- llevar foco al encabezado de resultados;
- no ejecutar mutaciones.

## 9. Cola compacta de casos

Cada fila debe mostrar únicamente:

- prioridad/lane;
- huésped;
- habitación;
- hora o rango relevante;
- bloqueo o estado de cuenta en una línea;
- una acción primaria o indicador de selección.

Ejemplo:

```text
[BLOQUEADA] Juan Pérez                     Hab. 305
Habitación en limpieza desde la última actualización
                                            Revisar →
```

No mostrar dentro de cada fila:

- tarjetas anidadas de estadía y cuenta;
- párrafos explicativos repetidos;
- dos botones que abren el mismo caso;
- precio como bloque grande;
- auditoría completa;
- acciones terminales.

### 9.1 Orden

Vista `Turno`:

1. llegadas bloqueadas;
2. salidas pendientes;
3. llegadas listas;
4. estadías en casa que requieran seguimiento;
5. resto de casos.

Conservar el orden del backend cuando `action_queue` ya prioriza casos. Agregar
fallbacks solo para entradas faltantes, sin duplicar booking IDs.

### 9.2 Selección

- clic en fila selecciona y abre detalle;
- `Enter` abre la fila enfocada;
- selección visual clara con borde, fondo e indicador textual;
- checkbox múltiple solo si se mantiene exportación/recorrido seleccionado;
- no presentar selección múltiple como “acción masiva” si no hay mutaciones
  masivas reales.

## 10. Panel de detalle

En desktop, reemplazar el sheet como interacción principal por un panel inline.
En tablet/mobile, reutilizar el sheet.

El contenido funcional debe ser compartido para evitar dos implementaciones.
Extraer el cuerpo actual de `BookingDetailsSheet` a un componente presentacional
reutilizable, por ejemplo `BookingCaseWorkspace`.

### 10.1 Header compacto

Mostrar:

- huésped;
- habitación;
- estado de reserva;
- ID corto;
- rango de estadía;
- próxima acción;
- cantidad de controles pendientes.

No repetir cuatro tarjetas métricas antes del contenido.

### 10.2 Pestañas internas

#### `Resumen`

- huésped y vínculo a ficha;
- habitación y estado;
- check-in/check-out;
- noches;
- total actual y saldo en formato compacto;
- bloqueo vigente;
- próxima acción.

#### `Operación`

- checklist de check-in si `Confirmed`;
- checklist de checkout si `CheckedIn`;
- reasignación solo para `ops/admin`;
- late arrival, cancelación y no-show como sección secundaria/colapsable;
- explicación de bloqueo y acción permitida por rol.

#### `Cuenta`

- alojamiento;
- extras;
- total;
- cobrado;
- saldo pendiente;
- registrar cobro;
- lista de pagos y cargos;
- política de saldo para checkout.

#### `Historial`

- auditoría;
- actor y timestamp;
- terminal reason;
- late arrival;
- cambios de habitación;
- estado vacío explícito.

### 10.3 Acción principal fija

El footer del detalle debe mostrar una sola acción primaria contextual:

- `Completar checklist de llegada`;
- `Registrar check-in`;
- `Registrar cobro`;
- `Completar checklist de salida`;
- `Registrar checkout`;
- `Continuar con siguiente caso` cuando el caso ya está resuelto.

Acciones secundarias:

- refrescar;
- editar;
- caso anterior/siguiente;
- cerrar en sheet.

Cancelar y no-show permanecen dentro de `Operación`, con confirmación de dos
pasos. Nunca deben ocupar el CTA principal.

## 11. Modo guiado compacto

Resolver el hallazgo `QA-20260801-002`: actualmente existe toggle en header y
toggle dentro del rail. Debe quedar un solo control principal en el header.

### 11.1 Estado cerrado

```text
✨ Siguiente: completar llegada    2/5    [Continuar]
```

Debe ocupar una sola fila o un botón/pill compacto.

### 11.2 Estado abierto

- mostrar misión actual;
- progreso;
- pasos `Ahora/Pendiente/Completado`;
- CTA para navegar al contexto;
- reiniciar recorrido;
- cerrar panel sin desactivar permanentemente el modo.

Implementación recomendada:

- desktop: popover/panel lateral no modal;
- mobile: bottom sheet;
- mantener `GuideRail` como lógica/presentación reutilizable, pero agregar una
  variante `compact` o extraer `CompactGuideAssistant`;
- conservar localStorage y eventos reales de WF-013;
- hacer clic en un paso navega, pero no marca progreso;
- la guía nunca ejecuta check-in, checkout, pago o transición terminal.

## 12. Estados de UI obligatorios

### Loading

- skeleton compacto para lista y panel;
- no cambiar el ancho del layout al terminar;
- conservar fecha y tab seleccionada.

### Vacío

- `Turno`: “No hay casos pendientes para esta fecha”.
- `Llegadas`: “No hay llegadas pendientes”.
- `En casa`: “No hay estadías activas”.
- `Salidas`: “No hay salidas pendientes”.
- `Reservas`: mensaje del DataTable existente.

Cada estado vacío puede ofrecer una única acción pertinente, nunca un grupo de
botones genéricos.

### Error

- mensaje específico;
- botón `Reintentar`;
- no mostrar cero casos como si fuera un resultado válido;
- conservar búsqueda, tab y fecha;
- usar `getErrorMessage` existente.

### Sin selección

En desktop, el panel derecho muestra:

- foco del turno;
- cantidad de casos;
- instrucción “Seleccioná un caso para comenzar”;
- CTA al primer caso solo si existe.

## 13. RBAC y seguridad

No cambiar capacidades.

### `receptionist`

- reservas, huéspedes y lectura de habitaciones;
- check-in, pagos y checkout según canon actual;
- no reasigna habitación si no posee capacidad/rol permitido;
- no administra usuarios ni red global.

### `ops/admin`

- pueden ver controles adicionales existentes, incluida reasignación cuando
  corresponda.

Reglas:

- ocultar CTA no reemplaza autorización backend;
- una mutación prohibida debe seguir devolviendo `403`;
- no inferir permisos por nombre de ruta;
- no ampliar roles disponibles;
- no incluir datos personales que el contrato actual no expone.

## 14. Accesibilidad

Requisitos no negociables:

- orden de tabulación lógico;
- tabs con semántica ARIA;
- fila seleccionada con `aria-selected` o equivalente;
- caso activo anunciado;
- foco se mueve al panel al abrir con teclado;
- al cerrar sheet, foco vuelve a la fila origen;
- `Escape` cierra overlays, no toda la página;
- no depender solo de color para prioridad/estado;
- contraste WCAG AA con themes existentes;
- CTA mínimo `44px` en mobile;
- `aria-live="polite"` para guía y confirmaciones no destructivas;
- confirmaciones destructivas con título y descripción claros;
- respetar `prefers-reduced-motion` mediante patrones existentes.

## 15. Performance

- no agregar requests por cada fila;
- usar datos agregados existentes de `/front-desk/board`;
- mantener derivaciones con `useMemo` solo cuando sean costosas/estables;
- evitar duplicar arrays completos en estados separados;
- montar contenido pesado de detalle solo para el caso seleccionado;
- pestaña `Historial` puede cargar/renderizar auditoría al activarse;
- conservar lazy imports donde aporten reducción real;
- no agregar librería de estado o tabs si los componentes actuales alcanzan;
- mantener CSS dentro del presupuesto vigente de `115 KiB`.

## 16. Modelo de estado frontend

Estado mínimo recomendado:

```ts
type ReceptionWorkspaceView =
  | "shift"
  | "arrivals"
  | "in-house"
  | "departures"
  | "reservations";

type BookingCaseTab = "summary" | "operation" | "account" | "history";
```

Estados:

- `workspaceView`;
- `selectedBookingId`;
- `caseTab`;
- `searchQuery`;
- `boardDate`;
- `selectedBookingIds` solo si continúa el recorrido múltiple;
- `guideExpanded`;
- filtros históricos solo dentro de `reservations`.

No duplicar `selectedBooking` y `selectedBookingId` sin una razón. Preferencia:
guardar ID y derivar entidad desde `bookings`; al refrescar, conservar el ID y
reemplazar la entidad derivada.

## 17. Componentes propuestos

Nombres orientativos; el agente puede ajustar nombres sin cambiar responsabilidades.

### Nuevos

- `ReceptionWorkspace.tsx`: layout, tabs y coordinación de lista/detalle.
- `ReceptionWorkspaceTabs.tsx`: navegación principal accesible.
- `ReceptionQueueList.tsx`: lista compacta reutilizable.
- `ReceptionQueueItem.tsx`: fila individual y estados.
- `BookingCaseWorkspace.tsx`: cuerpo compartido desktop/sheet.
- `BookingCaseTabs.tsx`: resumen/operación/cuenta/historial.
- `CompactGuideAssistant.tsx`: guía cerrada/expandida.

### Modificar

- `BookingsPage.tsx`: queries, acciones globales y composición del workspace.
- `FrontDeskBoardPanel.tsx`: extraer lógica reutilizable o reemplazar su layout
  monolítico; no duplicar el cockpit.
- `BookingDetailsSheet.tsx`: quedar como contenedor responsive del cuerpo común.
- `GuideRail.tsx` / `GuideHint.tsx`: variante compacta, sin romper housekeeping.
- tests y smokes afectados.

### Evitar

- un componente nuevo de más de 500 líneas;
- copiar el contenido completo de `BookingDetailsSheet` al panel desktop;
- lógica de dominio dentro de componentes visuales;
- CSS global nuevo para resolver layouts que Tailwind ya cubre.

## 18. Archivos previstos

La lista exacta se confirma en Gate 0, pero el alcance esperado es:

- `frontend/src/features/bookings/BookingsPage.tsx`
- `frontend/src/features/bookings/components/FrontDeskBoardPanel.tsx`
- `frontend/src/features/bookings/components/BookingDetailsSheet.tsx`
- nuevos componentes bajo `frontend/src/features/bookings/components/`
- `frontend/src/features/guided/components/GuideRail.tsx`
- `frontend/src/features/guided/components/GuideHint.tsx`
- posible `CompactGuideAssistant.tsx`
- tests unitarios correspondientes
- `frontend/e2e/reception-role-smoke.spec.ts`
- documentación/evidencia en `docs/validation/`

No se esperan cambios en:

- backend Rust;
- migraciones SQL;
- `backend/openapi.yaml`;
- `docs/openapi.yaml`;
- cliente OpenAPI generado;
- roles/capacidades.

Si durante implementación parece necesario cambiar estos archivos, detenerse y
registrar la razón antes de ampliar scope.

## 19. Implementación incremental obligatoria

Máximo ocho pasos:

1. Extraer lógica/fixtures de la cola sin cambiar comportamiento y dejar tests
   existentes verdes.
2. Crear tabs principales y mover la tabla histórica a `Reservas`.
3. Crear lista compacta y estados loading/empty/error.
4. Extraer `BookingCaseWorkspace` y reutilizarlo en el sheet actual.
5. Agregar panel dividido desktop y selección/foco accesible.
6. Reorganizar detalle en cuatro tabs con CTA sticky.
7. Convertir la guía a asistente compacto y eliminar toggle duplicado.
8. Completar responsive, tests, Playwright, gates, review y evidencia.

Cada paso debe compilar y conservar recorridos anteriores. No acumular todos los
cambios antes del primer test.

## 20. Criterios de aceptación

### Información y navegación

- `AC-01`: `/bookings` abre en `Turno`.
- `AC-02`: existen exactamente las vistas `Turno`, `Llegadas`, `En casa`,
  `Salidas` y `Reservas`.
- `AC-03`: la tabla completa aparece solo en `Reservas`.
- `AC-04`: métricas operativas no se repiten antes y después del workspace.
- `AC-05`: la búsqueda filtra huésped, habitación e ID con normalización de
  acentos.

### Desktop

- `AC-06`: en `>=1280px`, cola y detalle se ven simultáneamente.
- `AC-07`: seleccionar una fila actualiza el panel sin cerrar la cola.
- `AC-08`: cola y detalle tienen scroll interno independiente.
- `AC-09`: sin selección existe estado vacío accionable.

### Tablet/mobile

- `AC-10`: debajo de `1280px`, el caso abre en sheet.
- `AC-11`: en `375/390/430`, no existe overflow horizontal.
- `AC-12`: header, body y footer del sheet permanecen utilizables.
- `AC-13`: CTA principal es visible o alcanzable sin romper layout.

### Caso

- `AC-14`: el detalle tiene `Resumen`, `Operación`, `Cuenta` e `Historial`.
- `AC-15`: solo una acción primaria domina cada estado.
- `AC-16`: cancelación/no-show mantienen confirmación de dos pasos.
- `AC-17`: restricciones de check-in/checkout permanecen intactas.
- `AC-18`: siguiente/anterior conserva recorrido de cola.

### Guía

- `AC-19`: existe un solo toggle principal del modo guiado.
- `AC-20`: guía cerrada ocupa como máximo una fila compacta.
- `AC-21`: tocar un paso navega sin marcarlo completado.
- `AC-22`: guía nunca ejecuta una mutación crítica.
- `AC-23`: progreso localStorage/eventos de WF-013 se conserva.

### Seguridad y contrato

- `AC-24`: receptionist no obtiene acciones nuevas de ops/admin.
- `AC-25`: rutas/mutaciones prohibidas siguen en `/forbidden`/`403`.
- `AC-26`: OpenAPI v1 no cambia.
- `AC-27`: no se agregan campos ficticios ni handoff local no persistido.

## 21. Tests unitarios requeridos

### `ReceptionWorkspaceTabs.test.tsx`

- render exacto de cinco tabs;
- `Turno` seleccionado por defecto;
- clic y teclado cambian vista;
- `aria-selected` correcto;
- callback una vez por interacción.

### `ReceptionQueueList.test.tsx`

- orden de lanes;
- deduplicación por booking ID;
- búsqueda con y sin acentos;
- empty por vista;
- loading/error/retry;
- selección de fila;
- Enter abre caso;
- no renderiza dos CTA equivalentes.

### `BookingCaseWorkspace.test.tsx`

- cuatro tabs internas;
- contenido visible solo en tab activa;
- próxima acción según estado;
- permisos de reasignación;
- foco al abrir;
- cuenta y auditoría no inventan datos;
- CTA de guía navega sin mutación.

### `CompactGuideAssistant.test.tsx`

- estado compacto/expandido;
- un solo toggle;
- progreso correcto;
- navegación sin completar pasos;
- reinicio explícito;
- `aria-live` y foco.

### Regresión obligatoria

Mantener verdes:

- `FrontDeskBoardPanel.test.tsx` o migrar sus casos equivalentes sin perder
  cobertura;
- `BookingDetailsSheet.test.tsx`;
- `BookingArrivalExceptionActions.test.tsx`;
- `GuideRail.test.tsx`;
- `GuideHint.test.tsx`;
- `receptionGuide.test.ts`;
- tests de billing, check-in y checkout existentes.

No eliminar tests solo porque el componente se extrae. Moverlos o reemplazarlos
por cobertura equivalente demostrable.

## 22. Playwright/E2E requerido

Actualizar `frontend/e2e/reception-role-smoke.spec.ts` con:

1. Login como `recepcion_demo`.
2. Vista `Turno` seleccionada por defecto.
3. Cambio por las cinco vistas.
4. Búsqueda con resultado y sin resultado.
5. Selección de caso y detalle correcto.
6. Desktop `1440`: cola y panel simultáneos.
7. Tablet `768/1024`: detalle en sheet.
8. Mobile `375/390/430`: sin overflow y CTA visible.
9. Guía compacta abre, navega y no cambia progreso por clic.
10. Cancelación/no-show conserva confirmación.
11. Usuario receptionist no ve acción de reasignación privilegiada.
12. Navegación anterior/siguiente conserva la cola.

Conservar los smokes WF-013 y adaptarlos al nuevo layout, no borrarlos.

## 23. Comandos exactos de validación

### Focalizados

```bash
docker compose exec -T frontend npm run test -- --run \
  src/features/bookings/components/ReceptionWorkspaceTabs.test.tsx \
  src/features/bookings/components/ReceptionQueueList.test.tsx \
  src/features/bookings/components/BookingCaseWorkspace.test.tsx \
  src/features/guided/components/CompactGuideAssistant.test.tsx \
  src/features/bookings/components/BookingArrivalExceptionActions.test.tsx \
  src/features/guided/receptionGuide.test.ts
```

Ajustar paths si los nombres finales cambian y registrar el comando real.

### Frontend

```bash
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run test -- --run
docker compose exec -T frontend npm run build
```

### Contrato y recorridos

```bash
./scripts/check-openapi-alignment.sh
./scripts/qa-core-journeys.sh
./scripts/playwright-reception-smoke.sh
```

### Gate final

```bash
LC_ALL=C HMS_KPI_RUNNER=docker ./scripts/gate.sh
```

Si el entorno no usa locale decimal problemático, registrar si `LC_ALL=C` fue
necesario. No ocultar FAIL intermedios.

## 24. Evidencia requerida

Registrar en `docs/validation/`:

- Gate 0 completo;
- comandos exactos;
- PASS/FAIL;
- fallos intermedios y corrección;
- screenshots por ancho;
- evidencia desktop split view;
- evidencia mobile sheet;
- evidencia de teclado/foco;
- evidencia de RBAC receptionist;
- CSS final y margen contra `115 KiB`;
- review Critical/High/Medium/Low;
- DoD.

Usar `output/playwright/` para artefactos temporales. No commitear screenshots,
traces o videos con cookies, tokens o datos personales.

## 25. Review estricto obligatorio

### Critical

- mutación crítica disparada por navegación/guía;
- bypass RBAC;
- pérdida o corrupción de reserva/pago;
- selección de caso equivocado antes de mutar.

### High

- CTA principal ejecuta acción distinta a la indicada;
- saldo/bloqueo oculto antes de checkout;
- cola omite casos operativos;
- layout mobile impide cerrar o confirmar;
- progreso guiado marca tareas no ejecutadas.

### Medium

- foco incorrecto;
- filtros inconsistentes;
- duplicación de casos;
- contenido todavía demasiado largo;
- doble toggle de guía;
- estados vacíos ambiguos.

### Low

- copy inconsistente;
- espaciado/alineación;
- animación innecesaria;
- icono sin etiqueta accesible.

## 26. Qué rompería producción

- derivar mal el caso seleccionado y aplicar un cobro/transición a otra reserva;
- desmontar el panel y perder datos de formulario sin advertencia;
- cambiar tab/vista durante una mutación y permitir doble envío;
- esconder un bloqueo financiero detrás de una pestaña sin indicador;
- asumir que ocultar un botón reemplaza autorización backend;
- cargar auditoría/cuenta por cada fila y degradar el board;
- mantener dos implementaciones divergentes del detalle desktop/mobile;
- eliminar tests anteriores durante la extracción.

## 27. Fuera de alcance

- backend nuevo;
- cambios OpenAPI;
- portal del huésped;
- nuevo rol de mantenimiento/cajero/auditor;
- handoff de turno persistente;
- búsqueda por teléfono si el board no lo expone;
- deep links/query params de caso;
- acciones masivas nuevas;
- facturación avanzada;
- rediseño de housekeeping completo;
- sistema de diseño global;
- refactor general de CSS;
- librería nueva de estado o componentes sin necesidad demostrada.

## 28. Definition of Done

- [ ] Gate 0 documentado antes de código.
- [ ] Workspace con cinco vistas.
- [ ] Cola compacta sin duplicados.
- [ ] Split view desktop.
- [ ] Sheet tablet/mobile.
- [ ] Detalle compartido y organizado en cuatro tabs.
- [ ] Una acción principal contextual.
- [ ] Guía compacta con un solo toggle.
- [ ] RBAC sin regresión.
- [ ] API v1 intacta.
- [ ] Tests heredados conservados.
- [ ] Tests nuevos agregados.
- [ ] Seis anchos validados.
- [ ] Lint PASS.
- [ ] Suite frontend PASS.
- [ ] Build PASS.
- [ ] Journeys PASS.
- [ ] Playwright recepción PASS.
- [ ] Gate final PASS.
- [ ] CSS dentro de presupuesto.
- [ ] Review Critical/High/Medium/Low documentado.
- [ ] Evidencia PASS/FAIL registrada.
- [ ] Sin cambios fuera de alcance.
- [ ] Commit intencional solo después de DoD completa.

## 29. Gate 0 esperado del agente implementador

Antes de implementar, responder con:

### Resumen en cinco líneas

1. Qué problema resuelve.
2. Qué layout se implementará.
3. Qué comportamiento se conserva.
4. Qué no se tocará.
5. Cómo se validará.

### Archivos

Lista exacta de archivos nuevos y modificados.

### Pasos

Máximo ocho, alineados con la sección 19.

### Tests

Comandos exactos y estado inicial `PENDING`. Al finalizar, reemplazar por
`PASS/FAIL` con evidencia.

## 30. Criterio final de decisión

WF-014 se considera exitoso si recepción se percibe y funciona como una estación
de trabajo: el usuario navega por tareas, mantiene la cola visible, ve solo el
detalle necesario y siempre entiende cuál es la siguiente acción.

No se considera exitoso solo porque “se vea más limpio”. Debe reducir scroll,
duplicación y cambios de contexto sin perder reglas, datos, permisos ni
trazabilidad.
