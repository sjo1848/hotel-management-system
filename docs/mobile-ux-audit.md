# Auditoría de UX móvil — HMS Elite Frontend

**Fecha:** 2026-08-06
**Viewport de referencia:** 390 × 844 px (táctil)
**Alcance:** Todas las pantallas autenticadas + login. Análisis estático de código y mediciones reales con Playwright.

## Resumen ejecutivo

No hay desborde horizontal a nivel de página en ningún sector (`scrollWidth === innerWidth === 390` en Bookings, Rooms, Calendar, Guests, Users, Housekeeping, Reports, Network). Los problemas reales son cuatro categorías transversales:

1. **Touch targets por debajo de 44px** — originado en `button.tsx` (default `h-9`=36px, `sm h-8`=32px).
2. **Texto de botón fuera de su caja** — causado por `whitespace-nowrap` global en el botón base combinado con labels largos en ancho fijo.
3. **Información redundante** que entierra la acción/propósito principal.
4. **Scroll horizontal sin columna de identidad anclada** — las tablas pierden el nombre del registro al navegar lateralmente.

Los `inner-scroll` horizontales de filtros/tabs/≥tablas/calendario son intencionales y swipeables (OK), no defectos.

---

## Sistémico (afecta a todo el app)

### S1 · `components/ui/button.tsx`
- **L8** base incluye `whitespace-nowrap`.
- **L24** `size default: h-9 px-4 py-2` → **36px**.
- **L25** `size sm: h-8 ... text-xs` → **32px**.
- **L27** `size icon: h-9 w-9` → 36px.

Consecuencia: cualquier botón sin override de altura queda debajo de la guía táctil y los labels largos no quiebran línea (desbordan su caja en ancho fijo).

Medido: CTA de guiado `Siguiente: Abrí un caso del turno 0/5` → botón `w=217px` contra texto `textW=285px` (Bookings y Housekeeping) — el texto queda **fuera del botón**.

**Fix sugerido:** `default h-10` (40px) o `min-h-11`; `sm h-9` (36px) o `min-h-10`; reconsiderar `whitespace-nowrap` por `truncate` condicional o permitir wrap en labels largos.

### S2. `components/ui/data-table.tsx`
- **L76** `<Table className="min-w-[720px]">` fuerza scroll lateral en toda tabla a 390px, aun en tablas de 3 columnas.
- **Sin `sticky left-0`** en la primera `<th>`/`<td>` → la columna de identidad (nombre) desaparece al scrollear.

**Fix sugerido:** `min-w-0 md:min-w-[720px]` + primera columna identidad `sticky left-0 bg-...` (patrón ya existente en `CalendarTimeline`).

---

## Bookings

### B1. `bookings/components/ReceptionQueueItem.tsx`
- **L76** `Hab. {room_number} · {room_type}` con `shrink-0` compite con el nombre en la misma fila; en 390px el room puede empujar el nombre truncado.

### B2. `guided/components/CompactGuideAssistant.tsx`
- **L39** contenedor `flex flex-wrap` con botón expandible + CTA externo.
- **L48** label `Siguiente: {label}` con `truncate` a la izquierda.
- **L61-66** CTA `Button size="sm"` (`h-9`) con label variable; label largo desborda (ver S1, medido).

### B3. `bookings/components/ReceptionWorkspaceTabs.tsx`
- **L73** tabs `h-10 shrink-0` (40px) — apenas bajo el estándar de 44px; 5 tabs + counts generan swipe denso.

### B4. `bookings/components/BookingCaseWorkspace.tsx`
- **(PR #25 ya aplicado)** footer de acciones pasó a grid 2 cols en base → contenido visible de 114→246px. Quedan botones `h-9`/`h-10` y labels largos ("Completar checklist de llegada") en `:541-610`.

---

## Housekeeping

### H1. `housekeeping/HousekeepingPage.tsx`
- **L65** status **duplicado** en la misma tarjeta: subtitle traducido ("Por limpiar / En limpieza / ...") + badge derecho ("Atención / Turno") + counts ya visibles arriba.
- **L65** cola con `max-h-[calc(100vh-22rem)] overflow-y-auto` → en móvil genera mini-scroll que empuja el workspace muy abajo.
- CTA de guiado con mismo overflow que Bookings.

### H2. `housekeeping/components/HousekeepingRoomWorkspace.tsx`
- **L24** bottom sheet `fixed inset-x-0 bottom-0 max-h-[86vh]` ocupa casi toda la pantalla en móvil y tapa la cola; `z-30` debe competir bien con el header sticky `z-40` del shell.

---

## Calendar / Schedule

### C1. `schedule/CalendarTimeline.tsx`
- **L74** celdas de 74px con `text-[10px] px-1` → nombre huésped + estado se truncaan severamente sin affordance (es el único componente con `sticky left-0` correcto en L33/L47).
- **L52** "Estado actual: {status}" en el header anclado agrega ruido al ancho.

### C2. `schedule/CalendarAgenda.tsx`
- **L50** botón fila tappable con "Ver detalle" interno: **duplica** la acción de la fila (redundante) + muestra `item.booking.status` en inglés ("Confirmed") inconsistente con el `statusLabel` traducido del Timeline.

### C3. `schedule/CalendarPage.tsx`
- **L96-101** toolbar 390px con `Anterior/Siguiente` (min-h-11) + range pill + 2 segmentados con `ml-auto` → wraps/desborda; sugiere apilar rango + modos en su propia fila.
- **L100-101** segmentados `min-h-9` (36px).

---

## Rooms

### R1. `rooms/components/AvailabilityPicker.tsx`
- **L109** `numberOfMonths={2}` en el popover → calendario 2-meses más ancho que 390px: corta/desborda el popover. En móvil debe ser 1 mes.

### R2. `rooms/components/RoomBulkActionBar.tsx`
- **L77-98** pills de desglose de estado (`Disp/Ocupadas/Impieza/Mant.`) **duplican** los filter chips de `RoomsInventoryPanel` → en móvil generan 3-4 filas de chips y esconden los botones de confirmar.
- **L100-110** texto helper redundante ("El backend valida el lote completo.").
- **L150/160/169** botones `h-10` (40px).

### R3. `rooms/components/RoomHoldsBoardPanel.tsx`
- **L201** `grid min-w-[760px]` con scroll.
- **L209** (header) y **L220** (fila) **sin `sticky left-0`** → al scrollear se pierde la columna de habitación por completo (a diferencia de CalendarTimeline).
- **L229** "Gestionar" `h-9` (36px); **L304** `h-10`.

### R4. `rooms/components/RoomInventoryPlanner.tsx`
- **L171/L360** "Gestionar"/"Ver detalle" `h-9` (36px).
- **L109-124** pill "Ventana visible" con helper redundante duplicando la línea de resumen.

---

## Guests / Users

### G1. `guests/GuestsPage.tsx`
- **L78** "Ver Ficha" `h-8` (**32px**).
- **L39-44** micro-ID `text-[10px] tracking-widest` ruidoso en cada fila.
- **L94** columna Acciones `w-[100px]` (compatible al min 720px).

### U1. `users/UsersPage.tsx`
- **L84** dropdown trigger `h-8 w-8` (**32px**) como única acción por fila.
- **L63** micro-ID "10px" ruidoso.
- **L112** button create `h-12` correcto.

---

## Reports

### P1. `reports/ReportsPage.tsx`
- **L235** **nota de desarrollador que llegó a la UI**: "La UI responde bien en mobile y tablet; charts y cierres apilan sin romper el layout." — texto técnico de dev, no de producto → entierra el rango de fechas real. **Eliminar en producción.**
- **L417-434** tarjeta de cierre con 6 `<span>`s de montos (Cash %, cobros, Efectivo, Contado, Diferencia, Tarjeta) → en 390px una lista vertical alta de cifras duplicadas; colapsar compartición/monto en una línea.
- **L251/206** botones `h-10` (40px).

---

## Dashboard
- **Sin problemas** (`DashboardHome`, `DashboardControlCenter`, `DashboardOperationPanel`, `DashboardPerformancePanel`, `HotelPulseSummary`, `CashShiftSummary`). Tabs `min-w-7.5-rem h-11`, KPIs apilan perpendicular, sin overflow.

---

##  Capa compartida / Shell

### L1. `layouts/DashboardLayout.tsx`
- **L362** logout `h-9` (36px).
- **L478** header responsive sticky `z-40`; tooltip sidebar `z-[120` (relevado en bug de check-in).
- Drawer móvil `w-28`/`w-18rem` colapsable — correcto.

---

## Top prioridades (impacto / costo)

| # | Fix | Archivo:Línea | Impacto | Costo |
|---|-----|---------------|---------|-------|
| 1 | Touch targets botón base + wrap | `button.tsx:8,24,25` | Alto (todo el app) | Bajo |
| 2 | Tabla responsive + columna identidad anclada | `data-table.tsx:76` | Alto (Guests+Users+Rooms) | Bajo |
| 3 | Stacking toolbar calendar | `CalendarPage.tsx:96-101` | Alto (móvil bookings) | Bajo |
| 4 | Quitar nota dev + colapsar montos | `ReportsPage.tsx:235,417-434` | Medio | Bajo |
| 5 | 1 mes en móvil | `AvailabilityPicker.tsx:109` | Medio | Bajo |
| 6 | Remove pills duplicados en móvil | `RoomBulkActionBar.tsx:77-98` | Medio | Bajo |
| 7 | sticky columna habitación | `RoomHoldsBoardPanel.tsx:209,220` | Medio | Bajo |
| 8 | touch targets `h-9`/`h-8` en listas | Guests/Users/Rooms/HouseKeeping | Medio | Medio |
| 9 | Celda trunca affordance | `CalendarTimeline.tsx:74` | Medio | Medio |

---

## Acciones tomadas

- **2026-08-06** PR #25: `fix/mobile-checkin-actions-overlap` — footer de acciones del sheet de check-in pasa de columna a grid 2 cols en móvil (contenido visible 114px → 242px). Gates frontend verdes.