# HMS Elite — Runbook de QA Manual V1

## 1. Objetivo

Ejecutar una validación manual reproducible de la aplicación web antes de una
demo o de un go-live controlado. Este documento valida comportamiento observable
por usuario, permisos, mutaciones críticas y layout responsive. No reemplaza
`./scripts/gate.sh`, los tests automatizados ni los contratos OpenAPI.

La matriz detallada de cobertura está en
[`manual-qa-role-checklist.md`](manual-qa-role-checklist.md). Este runbook define
el orden exacto para ejecutarla y cómo dejar evidencia.

## 2. Criterio de salida

La corrida es `PASS` únicamente si:

- todos los casos críticos QA-01 a QA-08 están `PASS`;
- ningún rol puede acceder a una ruta o mutación fuera de su alcance;
- no hay defectos `Critical` o `High` abiertos;
- las seis anchuras tienen evidencia o una razón explícita de bloqueo;
- cada `FAIL` tiene defecto registrado, severidad, evidencia y decisión;
- la evidencia queda asociada a un commit o versión identificable.

Un test automatizado en `PASS` no marca automáticamente una casilla manual como
ejecutada: la persona debe observar la UI y registrar resultado.

## 3. Preparación

### 3.1 Gate previo

Ejecutar antes de abrir el navegador:

```bash
./scripts/gate.sh
```

Registrar el resultado. Si falla un gate, detener la corrida y abrir un defecto de
infraestructura; no mezclarlo con defectos visuales.

### 3.2 Entorno

| Dato | Valor |
| --- | --- |
| URL | `http://localhost:5173` |
| Tenant | `00000000-0000-0000-0000-000000000001` |
| Password demo | consultar la configuración local; no copiar credenciales al registro |
| Anchos | `375`, `390`, `430`, `768`, `1024`, `1440` |
| Navegador | Chromium/Chrome estable, zoom 100% |
| Evidencia | screenshot y/o video por defecto; trace solo si aplica |

Usuarios demo:

| Usuario | Rol | Foco |
| --- | --- | --- |
| `admin` | `admin` | gobierno completo del hotel |
| `recepcion_demo` | `receptionist` | reservas, llegadas, estadías y salidas |
| `ops_demo` | `ops` | inventario, excepciones y coordinación |
| `housekeeping_demo` | `housekeeping` | limpieza e incidencias |
| `saas_admin_demo` | `saas_admin` | red global y alta de hotel |

### 3.3 Datos de prueba

Usar primero datos demo existentes. Antes de mutar una reserva o habitación,
anotar su identificador y estado inicial. Para un caso repetible, preparar:

- una reserva `Confirmed` con llegada futura dentro de la fecha de prueba;
- una reserva `Confirmed` cuya fecha de llegada sea hoy para no-show;
- una habitación `Available` y una `Dirty`;
- una habitación que pueda llevarse a `Maintenance` sin afectar una demo activa;
- un huésped existente y un nombre nuevo para walk-in.

No usar datos personales reales, credenciales reales ni producción.

## 4. Reglas de observación

En cada pantalla verificar simultáneamente:

- no hay texto cortado, superpuesto o ilegible;
- los CTA primarios y el cierre son alcanzables;
- drawers/sheets mantienen header, body con scroll interno y footer usable;
- después de guardar, la UI refleja el estado persistido al refrescar;
- errores de validación explican qué corregir y no borran datos válidos;
- la navegación no pierde el tenant ni deja una mutación duplicada;
- un refresh o back no reabre una acción terminal.

En mobile, probar interacción táctil equivalente (tap, scroll, cierre) y no solo
el cambio de viewport.

## 5. Casos de ejecución

### QA-01 — Smoke y sesión

Roles: todos. Prioridad: crítica.

1. Abrir la URL en ventana limpia.
2. Iniciar sesión con cada usuario de la tabla.
3. Confirmar landing, sidebar, header y ausencia de errores visibles.
4. Cerrar sesión y confirmar que una URL protegida devuelve a login.
5. Repetir en `375`, `768` y `1440`.

`PASS` si cada rol entra solo a su superficie esperada y la sesión no cruza
tenants. Evidencia: una captura por rol y una captura de la redirección.

### QA-02 — RBAC por ruta y mutación

Roles: `recepcion_demo`, `ops_demo`, `housekeeping_demo`, `saas_admin_demo`.
Prioridad: crítica.

1. Intentar abrir directamente `/users`, `/network`, `/rooms`, `/reports` y
   `/bookings` según el rol que no corresponda.
2. Confirmar que la ruta prohibida termina en `/forbidden` o en la pantalla de
   acceso denegado.
3. Verificar que la acción prohibida no aparece en UI.
4. Si se puede reproducir con DevTools, repetir la mutación y confirmar `403`.

`PASS` si ocultar el CTA no es la única defensa y no queda un cambio persistido.

### QA-03 — Recepción: walk-in a checkout

Rol: `recepcion_demo`. Prioridad: crítica.

1. Abrir `/bookings` y localizar o crear un huésped.
2. Crear walk-in con fechas válidas y habitación disponible.
3. Abrir el detalle y verificar huésped, habitación, estado y total persistidos.
4. Ejecutar check-in formal.
5. Agregar un cargo y registrar un pago.
6. Ejecutar checkout.
7. Confirmar reserva `CheckedOut`, saldo esperado y habitación `Dirty`.
8. Refrescar y comprobar que el estado no se perdió.

`PASS` si el handoff a housekeeping es visible y no se puede repetir una
transición terminal.

### QA-04 — Recepción: excepciones de llegada

Rol: `recepcion_demo`. Prioridad: crítica.

1. En una reserva `Confirmed`, abrir llegada tardía.
2. Intentar ETA pasada y ETA fuera de la estadía: ambas deben bloquearse.
3. Usar ETA futura dentro de la estadía y una nota válida.
4. Confirmar que conserva `Confirmed` y registra actor, hora y nota.
5. En otra reserva cuya llegada sea hoy, marcar no-show con motivo.
6. Intentar no-show antes de la fecha: debe bloquearse.
7. En una tercera reserva confirmada, cancelar con motivo.
8. Confirmar que cancelación y no-show liberan disponibilidad y son terminales.

`PASS` si los motivos son obligatorios, las reglas temporales se respetan y no
se confunden `Cancelled` y `NoShow`.

### QA-05 — Habitaciones e inventario

Roles: `ops_demo` y `admin`. Prioridad: crítica.

1. Abrir `/rooms` y validar planner en `grid` y `list`.
2. Cambiar una habitación `Available -> Dirty -> Cleaning -> Available` según
   las acciones permitidas.
3. Abrir `RoomAdminSheet` y verificar que el estado actualizado persiste.
4. Ejecutar una acción masiva sobre habitaciones de prueba.
5. Con `admin`, crear o editar un hold y confirmar fechas y habitación.
6. Intentar check-in sobre una habitación `Dirty` o `Maintenance`: debe
   bloquearse y explicar el motivo.

`PASS` si ninguna acción publica como vendible una habitación no liberada.

### QA-06 — Housekeeping e incidencia

Rol: `housekeeping_demo`. Prioridad: crítica.

1. Abrir `/housekeeping` y revisar salidas del día.
2. Mover una habitación `Dirty -> Cleaning -> Available`.
3. Crear una incidencia desde una habitación de prueba.
4. Confirmar que exige motivo, prioridad y responsable.
5. Verificar que la habitación queda `Maintenance` y no vendible.
6. Resolver con nota de trabajo.
7. Confirmar auditoría y retorno obligatorio a `Dirty`.

`PASS` si no se puede saltar `Maintenance` con una acción genérica o masiva.

### QA-07 — Huespedes y drawers

Rol: `admin`. Prioridad: alta.

1. Abrir `GuestCreateDrawer` y crear un huésped de prueba.
2. Abrir `GuestDetailsSheet` en cada ancho.
3. Confirmar header visible, body con scroll interno y CTA/cierre accesibles.
4. Verificar que solo muestra contacto y fecha realmente persistidos.
5. Confirmar que no afirma verificación, categoría premium, preferencias o
   historial si esos datos no existen.

`PASS` si la ficha es veraz y usable sin scroll de toda la aplicación.

### QA-08 — Administración del hotel y red global

Roles: `admin` y `saas_admin_demo`. Prioridad: crítica.

1. Con `admin`, abrir `/users`, crear un usuario de prueba y revisar roles.
2. Confirmar que el selector tenant expone solo `admin`, `ops`, `receptionist`
   y `housekeeping`.
3. Con `saas_admin_demo`, abrir `/network` y revisar KPIs globales.
4. Abrir el sheet de alta de hotel y revisar layout, validaciones y cierre sin
   completar un alta real.
5. Confirmar que `saas_admin` no aparece como rol asignable del tenant.

`PASS` si la administración tenant y la administración global permanecen
separadas.

### QA-09 — Responsive dirigido

Ejecutar después de QA-01 a QA-08. Prioridad: alta.

| Ancho | Pantallas mínimas | Qué observar |
| --- | --- | --- |
| `375` | recepción, housekeeping, huésped | CTA, sheets y scroll interno |
| `390` | recepción, habitaciones | board, filtros y acciones |
| `430` | drawers, planner | botones y cards legibles |
| `768` | housekeeping, habitaciones | columnas y grids |
| `1024` | recepción, reportes | sidebar y jerarquía |
| `1440` | dashboard, reportes | aire y no estiramiento pobre |

`PASS` requiere captura de cada ancho y ninguna condición global de la sección 4.

### QA-10 — Regresión de navegación

Rol: `admin`. Prioridad: alta.

1. Navegar por sidebar entre `/`, `/bookings`, `/calendar`, `/rooms`,
   `/guests`, `/housekeeping`, `/reports` y `/users`.
2. Abrir y cerrar un drawer en cada módulo.
3. Usar back, refresh y volver a la ruta original.
4. Confirmar que no aparecen overlays huérfanos, spinners infinitos ni errores.

### QA-11 — Estados de error y doble acción

Roles: `recepcion_demo` y `ops_demo`. Prioridad: alta.

1. En formularios, enviar campos obligatorios vacíos.
2. Hacer doble click/tap en guardar o confirmar.
3. Intentar una mutación sobre un registro que cambió en otra pestaña o tras
   refrescar.
4. Confirmar mensaje accionable, una sola mutación y estado consistente.

### QA-12 — Cierre y handoff

Todos los roles. Prioridad: crítica.

1. Revisar la lista de defectos creados durante la corrida.
2. Repetir cada caso corregido.
3. Adjuntar capturas, URL/ruta, rol, ancho, pasos y resultado esperado/actual.
4. Registrar commit, fecha, entorno y responsable.
5. Marcar corrida global `PASS` o `FAIL` según la sección 2.

## 6. Registro por caso

Copiar esta tabla para cada ejecución:

| Campo | Valor |
| --- | --- |
| Caso | `QA-__` |
| Rol/usuario | |
| Ancho | |
| Fecha/hora | |
| Commit | |
| Resultado | `PASS` / `FAIL` / `BLOCKED` |
| Evidencia | ruta a screenshot/trace/video |
| Defecto | ID o `N/A` |
| Observaciones | |

## 7. Registro de defectos

```text
ID: QA-YYYYMMDD-NNN
Severidad: Critical | High | Medium | Low
Caso:
Rol/usuario:
Ancho:
Ruta o pantalla:
Precondiciones:
Pasos para reproducir:
Resultado esperado:
Resultado actual:
Frecuencia: siempre | intermitente | una vez
Evidencia:
Commit/versión:
Owner:
Estado: abierto | corregido | verificado | diferido
Riesgo de producción:
```

## 8. Convención de evidencia

Guardar artefactos fuera del código fuente, por ejemplo:

```text
artifacts/manual-qa/2026-08-01/
  QA-03-reception-390-pass.png
  QA-06-housekeeping-375-pass.png
  QA-02-rbac-reception-forbidden.png
  defects/QA-20260801-001.md
```

No incluir tokens, contraseñas, datos personales reales ni cookies en capturas,
videos o traces. Si una evidencia los contiene, eliminarla del artefacto y
repetir la captura antes de compartirla.

## 9. Firma de cierre

```text
Ejecutado por:
Fecha:
Commit/versión:
Entorno:
Casos PASS:
Casos FAIL:
Casos BLOCKED:
Defectos Critical/High abiertos:
Decisión: PASS | FAIL | BLOCKED
Firma QA:
Firma Product/Operations:
```
