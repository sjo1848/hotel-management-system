# HMS Elite — Screenshots y Walkthrough (v0.1.0)

Capturas verificadas del stack local con el dataset demo (hotel "Sede Central",
`00000000-0000-0000-0000-000000000001`), usuario `admin` / `demo2026pass`.
Tomadas el 2026-08-03 con Playwright headless (viewport 1440x900).

## Acceso

| Pantalla | Credencial | Archivo |
|---|---|---|
| Login | `admin` / `demo2026pass` | `01-login.png` |
| Login completo | hotel + usuario + clave | `02-login-filled.png` |

Las credenciales se siembran con `scripts/seed-demo-data.sh` (`DEMO_PASSWORD=demo2026pass`).

## Workspaces

| # | Pantalla | Ruta | Qué muestra |
|---|---|---|---|
| 1 | Dashboard | `/` | Pulso del hotel: ocupación, llegadas/salidas, reservas activas, caja del turno, alertas operativas y automatizaciones. |
| 2 | Recepción | `/bookings` | Turno de recepción: llegadas, en casa, salidas, reservas y modo guiado del turno. |
| 3 | Calendario | `/calendar` | Planning board por habitación y fecha, con conflictos y fuera de servicio. |
| 4 | Habitaciones | `/rooms` | Inventario con estados (disponible, ocupada, limpieza, mantenimiento) y tarifas. |
| 5 | Huéspedes | `/guests` | Directorio de huéspedes con contacto y ficha. |
| 6 | Housekeeping | `/housekeeping` | Shift workspace: cola de limpieza (por limpiar, en limpieza, listas) y mantenimiento. |
| 7 | Red Global | `/network` | HQ multi-hotel: consolidado por cadena, benchmark y drill-down. Requiere `saas_admin_demo` / `demo2026pass`. |
| 8 | Usuarios | `/users` | Control de acceso y RBAC por rol operativo. |
| 9 | Reportes | `/reports` | Cockpit financiero: ingresos, ocupación y caja sobre el dataset demo. |

## Notas

- `/network` exige el rol `saas_admin_demo` (capability `saas.hotels.read`); con
  `admin` la app redirige a `/forbidden` (deny-by-default, comportamiento esperado).
- Todas las pantallas se validaron con contenido real del seed (14 habitaciones,
  9+ huéspedes, 10 reservas activas, caja con cobros) antes de capturar.
