# WF-017 — Tablero de Planificación del Calendario

Fecha: 2026-08-02
Producto: HMS Elite
Área: Calendario (`/calendar`)
Estado: plan detallado; implementación no iniciada
Audiencia: siguiente agente implementador

## 1. Mandato para el agente implementador

Actuá como Principal Engineer, Product Designer, QA Lead y Security Engineer.
Implementá WF-017 respetando API v1, RBAC, aislamiento multi-tenant,
accesibilidad, responsive y los gates del repositorio.

Este documento es contractual para el ticket. No sustituir decisiones concretas
por un rediseño visual genérico.

Antes de editar:

1. Leer este documento completo.
2. Leer [WF-014](wf-014-reception-workspace-plan-2026-08-01.md) y reutilizar el
   cuerpo compartido de detalle de reserva disponible en la base real.
3. Leer [WF-016](wf-016-rooms-inventory-workspace-plan-2026-08-02.md) para no
   duplicar la administración de inventario o bloqueos.
4. Ejecutar `git status --short` y `git log -5 --oneline --decorate`.
5. Preservar cualquier implementación activa de WF-015/WF-016.
6. Crear `feature/wf-017-calendar-planning-board` desde una base limpia
   autorizada y registrar SHA en Gate 0.
7. No usar comandos destructivos ni descartar cambios ajenos.
8. Entregar Gate 0 antes de modificar código.

## 2. Decisión de producto

El Calendario debe ser un tablero de planificación temporal, no una página con
sidebar de estadísticas, leyenda separada y una tabla rígida.

Debe responder:

1. ¿Qué habitación está asignada a qué reserva y durante qué noches?
2. ¿Qué entradas, salidas o conflictos ocurren en la ventana visible?
3. ¿Qué habitación tiene un bloqueo que impide venderla?
4. ¿Cómo abro el caso sin perder el contexto temporal?

La solución tendrá dos modos de presentación:

- `Timeline`: matriz habitación × fecha, optimizada para desktop/tablet.
- `Agenda`: lista por día, optimizada para mobile y lectura lineal.

No crear dos fuentes de datos ni dos lógicas de negocio. Timeline y Agenda deben
ser dos presentaciones de un mismo modelo derivado.

## 3. Alcance exacto

Incluido:

- ruta `/calendar`;
- rango visible y navegación temporal;
- habitaciones;
- reservas del rango;
- holds del rango usando API existente;
- modos Timeline y Agenda;
- filtros de habitación/estado de reserva;
- resumen compacto del rango;
- selección y detalle de reserva;
- detalle contextual de hold/habitación en modo lectura;
- estados loading, empty, partial error y retry;
- responsive y accesibilidad;
- tests y Playwright.

No incluido:

- drag and drop;
- reasignar reserva arrastrando;
- crear reserva desde celda vacía;
- cambiar fechas arrastrando bordes;
- editar holds desde Calendario;
- cambiar estado de habitación;
- rediseñar Recepción o Habitaciones;
- vista mensual clásica;
- sincronización externa iCal;
- channel manager;
- nuevas APIs;
- query params/deep links;
- realtime/WebSocket.

## 4. Diagnóstico del estado actual

Problemas comprobados:

- `CalendarPage` consulta todas las habitaciones y reservas;
- `TapeChart` vuelve a consultar habitaciones y reservas;
- existen dos estados paralelos de datos sin coordinación;
- los botones Anterior/Siguiente del PageHeader no tienen `onClick`;
- `CalendarPage` declara `selectedBooking` y `BookingDetailsSheet`, pero nunca
  selecciona una reserva;
- `TapeChart` usa otro `BookingEditDrawer` y otro estado de selección;
- sidebar muestra estadísticas derivadas de un fetch distinto al chart;
- `bookings.length` se rotula `Reservas Activas` aunque puede incluir estados no
  activos;
- no hay error visible ni retry; sólo `console.error`;
- loading reemplaza todo el chart;
- búsqueda por ocupación ejecuta `find` por cada habitación y día;
- sólo se muestra la primera reserva que coincida, ocultando conflictos;
- `isWithinInterval` incluye checkout, pero una estadía ocupa
  `[check_in, check_out)`, no la noche de checkout;
- reservas canceladas/no-show pueden ocupar visualmente la cinta;
- el nombre del huésped y la interacción dependen de un `div` clickeable;
- estado depende en gran medida de color;
- 14 columnas fuerzan scroll y no existe alternativa mobile;
- habitaciones Dirty/Maintenance se señalan sólo con iconos sin texto;
- no se muestran holds, por lo que una celda sin reserva puede parecer libre
  aunque esté bloqueada;
- no hay tests focalizados de Calendar/TapeChart.

## 5. Usuarios y RBAC

La ruta exige `bookings.read`.

Usuarios habituales:

- `admin`: lectura, actualización de reservas y acceso a habitaciones/holds;
- `ops`: lectura/actualización y acceso a habitaciones/holds;
- `receptionist`: lectura/actualización y acceso a habitaciones/holds;
- `housekeeping`: sin `bookings.read`, no accede;
- `saas_admin`: sin `bookings.read`, no accede.

Reglas:

- mostrar datos de reserva sólo con `bookings.read`;
- controles de edición sólo con `bookings.update`;
- holds sólo si existe `rooms.read`;
- no ampliar RBAC;
- no usar rol cuando existe capability;
- backend sigue siendo autoridad;
- no exponer huésped o detalles en telemetría.

## 6. Fuente de datos única

`CalendarPage` debe poseer queries y estado. `TapeChart` o su reemplazo debe ser
presentacional.

Recursos:

```text
calendar:rooms
calendar:bookings:{start}:{end}
calendar:holds:{start}:{end}
```

Reglas:

- habitaciones pueden cachearse con stale time razonable;
- reservas se consultan por ventana exacta;
- holds se consultan por ventana exacta;
- Timeline y Agenda consumen el mismo modelo;
- una navegación de rango no debe montar un segundo fetch duplicado;
- respuestas viejas no reemplazan el rango actual;
- error de holds no oculta bookings;
- error de bookings no oculta habitaciones/holds;
- eliminar el fetch duplicado de `CalendarPage` o `TapeChart`, no dejar ambos.

## 7. Semántica temporal obligatoria

Reservas ocupan noches con intervalo semiabierto:

```text
check_in <= day < check_out
```

La fecha `check_out` es salida, no noche ocupada.

Holds usan la misma convención observada en el producto:

```text
start_date <= day < end_date
```

Reglas:

- `Confirmed` y `CheckedIn` ocupan la cinta;
- `CheckedOut` sólo se muestra como histórico/agenda si coincide con salida,
  pero no ocupa noches futuras;
- `Cancelled` y `NoShow` no bloquean ocupación por defecto;
- filtro opcional permite ver canceladas/no-show como eventos, no como ocupación;
- check-in y checkout deben tener marcadores diferenciados;
- si dos reservas activas se superponen en la misma habitación/noche, mostrar
  `Conflicto` y ambas referencias, nunca elegir silenciosamente la primera;
- un hold y una reserva activos en la misma noche también generan conflicto;
- estado actual Dirty/Maintenance no debe proyectarse como estado histórico o
  futuro; se muestra junto a la habitación como `Estado actual`.

Crear utilidades puras y testeables para intervalos y conflictos.

## 8. Arquitectura de información

### 8.1 Header

Contenido:

1. título `Calendario`;
2. subtítulo `Ocupación, movimientos y bloqueos por fecha`;
3. estado `Actualizado HH:mm`;
4. botón `Actualizar`.

No usar `Calendario Maestro` si no existe otro calendario subordinado.

### 8.2 Toolbar temporal

Orden:

1. `Anterior`;
2. `Hoy`;
3. `Siguiente`;
4. rango visible textual;
5. selector `7 días | 14 días | 30 días`;
6. selector `Timeline | Agenda`;
7. filtros.

Default desktop:

- 14 días;
- Timeline.

Default mobile:

- 7 días;
- Agenda.

El agente puede implementar default responsive mediante hook estable. No cambiar
automáticamente el modo después de que el usuario lo eligió.

Anterior/Siguiente avanzan exactamente la cantidad de días seleccionada. Hoy
restablece inicio al día local actual.

### 8.3 Resumen compacto

Una sola fila, no sidebar:

- reservas activas visibles;
- llegadas;
- salidas;
- holds;
- conflictos.

Todos calculados sobre la ventana visible y filtros activos, con etiquetas
claras. No mostrar `Total habitaciones` como gran card; puede aparecer en la
toolbar como `N habitaciones`.

### 8.4 Contenido

- Timeline o Agenda;
- panel de detalle contextual sólo después de selección;
- leyenda compacta junto al contenido;
- errores parciales dentro de su región.

## 9. Layout desktop

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Calendario                                      [Actualizar]         │
├─────────────────────────────────────────────────────────────────────┤
│ [<] [Hoy] [>]  02–15 Ago  [7|14|30] [Timeline|Agenda] [Filtros]    │
├─────────────────────────────────────────────────────────────────────┤
│ 18 reservas · 6 llegadas · 4 salidas · 2 bloqueos · 0 conflictos   │
├──────────────────────────────────────────────┬──────────────────────┤
│ Habitación │ 02 │ 03 │ 04 │ ... │ 15       │ Reserva seleccionada │
│ 101 Doble  │████ Ana Gómez ███│            │ Resumen              │
│ 102 Suite  │    │ HOLD │       │            │ Operación            │
│ 103 Doble  │ conflicto │       │            │ Cuenta / historial   │
└──────────────────────────────────────────────┴──────────────────────┘
```

Reglas:

- Timeline ocupa todo el ancho sin selección;
- con selección y >=1280, detalle inline entre 35% y 42%;
- timeline conserva al menos 58%;
- detalle y chart tienen scroll independiente;
- header de fechas y primera columna sticky;
- scroll horizontal sólo dentro del chart;
- no sidebar permanente;
- no cards anidadas por cada celda.

## 10. Layout tablet/mobile

### Tablet 768–1279

- contenido ancho completo;
- detalle en sheet;
- Timeline puede usar scroll interno;
- Agenda disponible y recomendada;
- toolbar envuelve sin ocultar labels.

### Mobile 375/390/430

- Agenda default;
- navegación temporal sticky bajo header si no tapa navegación global;
- selector de día;
- lista agrupada por `Llegadas`, `En casa`, `Salidas`, `Bloqueos` y `Conflictos`;
- cada item muestra hora sólo si existe dato real; actualmente API expone fecha,
  no inventar hora;
- detalle full-screen sheet;
- no timeline de 800 px como único acceso;
- sin overflow horizontal de página;
- target mínimo 44 x 44 px.

## 11. Timeline

### 11.1 Filas

Primera columna:

- número;
- tipo;
- estado actual textual;
- indicador de hold/conflicto si corresponde;
- botón accesible `Ver habitación {number}` sólo si aporta detalle disponible.

Orden default por número, usando comparación natural. No inferir piso.

### 11.2 Barras de reserva

Cada barra:

- comienza en check-in visible;
- termina antes de checkout;
- status con texto/icono/color;
- nombre de huésped cuando hay espacio;
- nombre accesible completo;
- click/Enter/Space selecciona reserva;
- no depender de `title`;
- bordes indican inicio/continuación/fin.

Si reserva comienza antes de ventana, mostrar continuación a la izquierda. Si
termina después, continuación a la derecha.

### 11.3 Holds

- patrón visual distinto de reservas;
- tipo traducido;
- no mostrar motivo completo en celda;
- selección abre resumen read-only con motivo y rango;
- no permitir edición desde Calendar.

### 11.4 Conflictos

- icono + texto `Conflicto`;
- color de alta severidad sin depender sólo de color;
- selección muestra elementos implicados;
- CTA navega a Recepción/Habitaciones según tipo y capability;
- Calendar no resuelve conflicto mediante drag/drop.

### 11.5 Celdas vacías

Rotular accesiblemente `Sin asignación`.

No afirmar `Disponible` porque pueden existir reglas o estados que Calendar no
conoce. No crear reserva desde click vacío en WF-017.

## 12. Agenda

Agenda reutiliza el mismo modelo temporal.

Selector de día dentro del rango visible.

Orden de grupos:

1. Conflictos;
2. Llegadas;
3. Salidas;
4. En casa;
5. Bloqueos;
6. Sin movimientos, si se muestra.

Cada item:

- habitación;
- huésped o tipo de hold;
- estado;
- rango;
- tipo de movimiento;
- una acción `Ver detalle`.

No duplicar una reserva en `Llegadas` y `En casa` el mismo día. Prioridad:
Llegada > Salida > En casa para agrupación principal, aunque el detalle pueda
explicar ambos bordes.

Empty del día:

`No hay movimientos ni bloqueos visibles para esta fecha`.

## 13. Filtros

Filtros permitidos:

- búsqueda por habitación o huésped;
- tipo de habitación;
- estado de reserva: activas / incluir canceladas;
- sólo conflictos;
- sólo habitaciones fuera de servicio actual;

No añadir filtros que API/modelo no soporte.

Aplicar client-side sobre datos de la ventana.

Mostrar filtros activos como chips removibles y acción `Limpiar filtros`.

La búsqueda por huésped sólo está disponible con bookings.read, que ya protege
la ruta. No enviar texto de búsqueda a telemetría.

## 14. Detalle contextual

Reserva seleccionada:

- reutilizar cuerpo compartido de WF-014 si existe en la base;
- desktop inline;
- tablet/mobile sheet;
- permisos y acciones idénticos a Recepción;
- no mantener simultáneamente `BookingDetailsSheet` y `BookingEditDrawer` con
  responsabilidades duplicadas;
- cambio exitoso invalida bookings del rango y actualiza chart;
- selección persiste si reserva sigue dentro del rango;
- si sale del rango, cerrar con mensaje claro.

Hold seleccionado:

- habitación;
- tipo;
- rango;
- motivo;
- acción `Abrir habitación` si rooms.read;
- read-only en Calendar.

Conflicto seleccionado:

- lista de reservas/holds implicados;
- fechas;
- una acción por elemento;
- no mutación automática.

## 15. Estados y errores parciales

### Loading inicial

- header/toolbar visibles;
- skeleton de resumen y filas;
- no mostrar cero real.

### Error de habitaciones

- chart no puede construir filas;
- mostrar error principal con retry;
- no presentar reservas huérfanas como calendario válido.

### Error de bookings

- mostrar habitaciones y holds;
- banner local `No se pudieron cargar las reservas`;
- retry bookings;
- resumen marca reservas `No disponible`, no cero.

### Error de holds

- bookings permanecen visibles;
- mensaje local y retry;
- no afirmar ausencia de bloqueos.

### Empty

- sin habitaciones: estado administrativo;
- rango sin reservas/holds: matriz vacía válida con explicación;
- filtro sin coincidencias: limpiar filtros.

### Refresh

- mantener datos anteriores;
- `Actualizando…`;
- evitar clicks múltiples;
- actualizar timestamp sólo tras éxito;
- anunciar de forma polite.

## 16. Accesibilidad

Obligatorio:

- toolbar con labels;
- botones Anterior/Siguiente con nombre y rango resultante;
- selector de rango y modo con `aria-pressed` o tabs apropiados;
- tabla Timeline con captions/headers asociables;
- primera columna y fechas semánticas;
- barras operables por teclado;
- no `div` clickeable;
- status no depende sólo de color;
- resumen de conflictos accesible;
- Agenda como alternativa lineal;
- foco visible;
- target 44 x 44;
- Sheet con focus trap/retorno;
- reduced motion;
- contraste AA;
- no tooltips esenciales;
- `aria-live` moderado para rango/refresh/error.

## 17. Performance

No ejecutar `bookings.find` dentro de cada celda.

Preindexar:

```ts
Map<roomId, CalendarAllocation[]>
Map<dateKey, CalendarAgendaItem[]>
```

Objetivos:

- una query de rooms;
- una query de bookings por rango;
- una query de holds por rango;
- sin fetch duplicado entre padre/chart;
- cache por rango;
- navegación rápida no mezcla respuestas;
- cálculo derivado con memoización;
- Timeline 30 días puede usar scroll, no miles de nodos innecesarios;
- considerar windowing sólo si medición demuestra necesidad; no agregar librería;
- no montar Timeline grande cuando Agenda mobile está activa.

## 18. Estado recomendado

```ts
type CalendarMode = "timeline" | "agenda";
type CalendarRangeDays = 7 | 14 | 30;

type CalendarState = {
  startDate: string;
  rangeDays: CalendarRangeDays;
  mode: CalendarMode;
  selectedDate: string;
  selectedItem: { type: "booking" | "hold" | "conflict"; id: string } | null;
  search: string;
  includeInactiveBookings: boolean;
  onlyConflicts: boolean;
  onlyOutOfService: boolean;
};
```

No persistir en URL/localStorage en V1.

## 19. Componentes propuestos

- `CalendarPage.tsx`: queries, rango, selección y permisos.
- `CalendarToolbar.tsx`.
- `CalendarRangeSummary.tsx`.
- `CalendarTimeline.tsx`: presentación sin fetch propio.
- `CalendarTimelineRow.tsx`.
- `CalendarAllocationBar.tsx`.
- `CalendarAgenda.tsx`.
- `CalendarAgendaDayPicker.tsx`.
- `CalendarFilters.tsx`.
- `CalendarDetailPanel.tsx`.
- `calendarModel.ts`: intervalos, indexación, conflictos y resumen.

Reutilizar detalle de booking de WF-014 y presentación de room/hold de WF-016 si
ya están integrados. No crear dependencia circular entre features.

Eliminar/reemplazar:

- fetch interno de `TapeChart`;
- sidebar de estadísticas/leyenda;
- botones header sin acción;
- `BookingDetailsSheet` muerto;
- drawer duplicado si el cuerpo compartido lo sustituye.

## 20. Archivos previstos

Modificar:

- `frontend/src/features/schedule/CalendarPage.tsx`
- `frontend/src/features/schedule/TapeChart.tsx` o reemplazarlo
- tests nuevos junto a schedule
- `frontend/e2e/calendar-role-smoke.spec.ts`

Posibles:

- componentes/utilidades de sección 19;
- servicio adaptador sólo si clarifica responsabilidades;
- evidencia WF-017.

No modificar:

- backend;
- migraciones;
- OpenAPI;
- RBAC;
- lógica de dominio de reservas;
- Housekeeping;
- Room workflows;
- Dashboard;
- layout global.

## 21. Implementación incremental

1. Tests de caracterización y utilidades temporales semiabiertas.
2. Unificar queries en CalendarPage y eliminar fetch duplicado.
3. Implementar toolbar/rango funcional y resumen compacto.
4. Extraer modelo indexado con reservas, holds y conflictos.
5. Implementar Timeline accesible desktop.
6. Implementar Agenda mobile y filtros.
7. Integrar detalle compartido y errores parciales.
8. Responsive, Playwright, gates, review y evidencia.

Máximo ocho pasos; test focalizado tras cada uno.

## 22. Criterios de aceptación

- `AC-01`: título visible `Calendario`.
- `AC-02`: existen Timeline y Agenda.
- `AC-03`: desktop default 14/Timeline.
- `AC-04`: mobile default 7/Agenda sin sobrescribir elección del usuario.
- `AC-05`: Anterior/Siguiente/Hoy funcionan.
- `AC-06`: avance coincide con rango elegido.
- `AC-07`: existe una sola fuente de rooms/bookings/holds.
- `AC-08`: no hay fetch duplicado padre/chart.
- `AC-09`: queries usan rango exacto.
- `AC-10`: respuestas antiguas no reemplazan rango actual.
- `AC-11`: checkout no ocupa su fecha de salida.
- `AC-12`: hold end_date tampoco ocupa fecha final.
- `AC-13`: canceladas/no-show no ocupan por default.
- `AC-14`: conflictos no se silencian.
- `AC-15`: hold+booking superpuesto es conflicto.
- `AC-16`: estado actual de room no se proyecta históricamente.
- `AC-17`: resumen usa ventana/filtros visibles.
- `AC-18`: no existe sidebar permanente.
- `AC-19`: Timeline tiene header/primera columna sticky.
- `AC-20`: overflow es interno.
- `AC-21`: barra de reserva es accesible por teclado.
- `AC-22`: continuación fuera de rango es visible.
- `AC-23`: celdas vacías dicen Sin asignación, no Disponible.
- `AC-24`: Agenda agrupa en orden definido.
- `AC-25`: reserva no se duplica entre grupos.
- `AC-26`: Agenda tiene empty por día.
- `AC-27`: filtros funcionan y pueden limpiarse.
- `AC-28`: búsqueda no llega a telemetría.
- `AC-29`: detalle reserva reutiliza cuerpo compartido.
- `AC-30`: no coexisten dos editores divergentes.
- `AC-31`: hold es read-only.
- `AC-32`: mutación exitosa refresca rango.
- `AC-33`: error bookings conserva rooms/holds.
- `AC-34`: error holds conserva bookings/rooms.
- `AC-35`: error rooms presenta retry principal.
- `AC-36`: loading no muestra ceros falsos.
- `AC-37`: estado vacío distingue ausencia de datos y filtro.
- `AC-38`: ruta sigue protegida por bookings.read.
- `AC-39`: controles mutantes por bookings.update.
- `AC-40`: no cambian API/RBAC.
- `AC-41`: Agenda funciona a 375/390/430.
- `AC-42`: no hay overflow de página en siete anchos.
- `AC-43`: contraste/status no depende sólo de color.
- `AC-44`: foco retorna al cerrar detalle.
- `AC-45`: target mínimo 44 px.
- `AC-46`: cálculo evita find por celda.
- `AC-47`: no se agregan dependencias.
- `AC-48`: componentes nuevos <=400 líneas o justificación.
- `AC-49`: lint/tests/build/Playwright/gates PASS.

## 23. Tests unitarios

### `calendarModel.test.ts`

- intervalo check-in/check-out;
- reserva que cruza rango;
- hold semiabierto;
- cancelada/no-show;
- CheckedIn/CheckedOut;
- dos bookings superpuestos;
- booking+hold;
- resumen de llegadas/salidas;
- Agenda sin duplicación;
- indexación por room/date.

### `CalendarPage.test.tsx`

- una carga por recurso;
- botones temporales;
- selector 7/14/30;
- Timeline/Agenda;
- error parcial;
- retry;
- refresh;
- detalle/close;
- capability update/read;
- no sidebar/estados muertos.

### `CalendarTimeline.test.tsx`

- sticky semantics;
- headers;
- barras/continuaciones;
- keyboard;
- conflicto;
- hold;
- celda vacía;
- status actual textual.

### `CalendarAgenda.test.tsx`

- selector de día;
- grupos/orden;
- sin duplicación;
- empty;
- acción detalle;
- mobile semantics.

### Regresión

- guards de calendar;
- detalle WF-014;
- actualización de booking refresca;
- Rooms/holds services no cambian contrato.

## 24. Playwright

Crear `frontend/e2e/calendar-role-smoke.spec.ts`.

Escenarios:

1. admin abre Calendario;
2. Timeline 14 días default desktop;
3. Anterior/Siguiente/Hoy cambian rango;
4. 7/30 cambia columnas y requests;
5. reserva termina antes de checkout;
6. conflicto visible con datos deterministas;
7. hold visible y read-only;
8. selección abre detalle inline desktop;
9. selección abre sheet tablet/mobile;
10. mutación autorizada refresca;
11. receptionist puede leer/editar según capability actual;
12. housekeeping no accede;
13. fallo bookings conserva holds;
14. fallo holds conserva bookings;
15. Agenda mobile agrupa correctamente;
16. teclado selecciona barra;
17. cierre retorna foco;
18. sin overflow 390/768/1024/1280/1440.

Capturas Timeline/Agenda/detalle/conflicto/error parcial.

## 25. Comandos de validación

```bash
git status --short
git log -5 --oneline --decorate
docker compose exec -T frontend npm run test -- --run src/features/schedule/calendarModel.test.ts
docker compose exec -T frontend npm run test -- --run src/features/schedule/CalendarPage.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/schedule/CalendarTimeline.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/schedule/CalendarAgenda.test.tsx
docker compose exec -T frontend npm run test -- --run src/App.guards.test.tsx
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run test -- --run
docker compose exec -T frontend npm run build
docker compose exec -T frontend npx playwright test e2e/calendar-role-smoke.spec.ts --project=chromium
./scripts/check-openapi-alignment.sh
./scripts/qa-core-journeys.sh
./scripts/gate.sh
```

Registrar PASS/FAIL y exit code individual.

## 26. Evidencia

Crear:

`docs/validation/wf-017-calendar-planning-board-evidence-YYYY-MM-DD.md`

Incluir branch/SHA, diff, AC-01..49, comandos, resultados, cantidad de tests,
requests, capturas, matriz temporal, RBAC, errores parciales, review, performance,
seguridad, riesgos y DoD.

## 27. Review estricto

### Critical

- edición sin capability;
- detalle de huésped cross-tenant;
- booking equivocado por selección/celda;
- cambio de API/RBAC;
- conflicto oculto que permite decisión incorrecta.

### High

- checkout ocupa noche incorrecta;
- fetch duplicado;
- rango viejo reemplaza actual;
- cancelada bloquea inventario;
- error parcial derriba todo;
- dos editores divergentes;
- Calendar afirma disponibilidad sin evidencia.

### Medium

- toolbar no funcional;
- Timeline inaccesible;
- sin Agenda mobile;
- status sólo por color;
- stats inconsistentes;
- scroll de página.

### Low

- microcopy/spacing/iconos inconsistentes.

## 28. Qué rompería producción

- interpretar checkout como noche ocupada;
- ocultar overlaps por usar `find`;
- editar reserva distinta a la seleccionada;
- mostrar rango viejo tras navegación rápida;
- duplicar PATCH por dos drawers;
- considerar celda vacía vendible;
- exponer huésped sin permiso;
- cargar todos los bookings sin rango;
- perder selección/foco tras refresh;
- depender sólo del color.

## 29. Seguridad

- capabilities en render/handlers;
- backend autoridad;
- no datos personales en telemetría;
- no localStorage;
- keys de cache seguras ante tenant switch;
- no secretos E2E;
- errores sin stack/PII;
- holds read-only en Calendar;
- sin HTML sin sanitizar.

## 30. Fuera de alcance

- drag/drop;
- create booking desde celda;
- edición de hold;
- inventario/housekeeping actions;
- vista mensual;
- exportar;
- multi-hotel;
- realtime;
- API/backend/RBAC;
- refactor global.

## 31. DoD

- [ ] Gate 0.
- [ ] Rama limpia WF-017.
- [ ] Fuente de datos única.
- [ ] Navegación temporal funcional.
- [ ] 7/14/30.
- [ ] Timeline y Agenda.
- [ ] Semántica semiabierta testeada.
- [ ] Conflictos visibles.
- [ ] Holds visibles read-only.
- [ ] Detalle compartido.
- [ ] Errores parciales.
- [ ] RBAC preservado.
- [ ] Mobile sin overflow.
- [ ] Accesibilidad teclado.
- [ ] Performance indexada.
- [ ] Tests focalizados PASS.
- [ ] Lint/suite/build PASS.
- [ ] Playwright PASS.
- [ ] OpenAPI/journeys/gate PASS.
- [ ] Review y evidencia.
- [ ] API/RBAC sin cambios.

## 32. Gate 0 esperado

Resumen de cinco líneas, archivos exactos, máximo ocho pasos y comandos de tests
con estado PENDIENTE/PASS/FAIL.

## 33. Criterio final

WF-017 cumple sólo si el calendario representa correctamente noches, movimientos,
holds y conflictos; funciona en Timeline y Agenda; no duplica datos ni editores;
mantiene contexto al abrir un caso; y es operable con teclado y mobile.

Un TapeChart más bonito que conserve fetch duplicado, checkout inclusivo,
conflictos ocultos o ausencia de errores visibles no cumple el ticket.
