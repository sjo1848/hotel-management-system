# Accesos de Prueba — Login y Hoteles (2026-02-13)

## Objetivo
Dejar un set de accesos verificables para pruebas manuales de login multi-tenant.

## Hoteles disponibles
1. `Hotel Sede Central`
   - `hotel_id`: `00000000-0000-0000-0000-000000000001`
2. `Hotel Viena`
   - `hotel_id`: `ad11ca4b-1fbc-432e-a315-3161eb9b31f8`

## Usuarios de prueba (activos)
Todos estos usuarios tienen contraseña de prueba: `admin123`

### Hotel Sede Central (`00000000-0000-0000-0000-000000000001`)
1. `admin` (rol: `admin`)
2. `ops` (rol: `ops`)
3. `receptionist` (rol: `receptionist`)
4. `housekeeping` (rol: `housekeeping`)

### Hotel Viena (`ad11ca4b-1fbc-432e-a315-3161eb9b31f8`)
1. `admin_viena` (rol: `admin`)

## Cómo probar login
En la pantalla de login completar:
1. `Hotel ID`: uno de los `hotel_id` listados arriba.
2. `Usuario`: uno de los usernames del hotel elegido.
3. `Clave`: `admin123`

## Notas
1. Estos accesos son de QA/desarrollo y deben rotarse o eliminarse antes de producción.
2. Si querés, en el siguiente paso dejo también un documento de "matriz esperada de permisos por rol" para validar qué debería poder hacer cada usuario tras login.
