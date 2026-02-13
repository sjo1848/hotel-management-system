# Accesos de Prueba — Login y Hoteles (2026-02-13)

## Resumen rápido
Usá esta combinación en el login:

1. `Hotel ID` correcto del usuario.
2. `Usuario` exacto.
3. `Clave`: `admin123`.

Si `Hotel ID` no coincide con el usuario, el backend responde `401 UNAUTHORIZED`.

## Hoteles y usuarios listos para probar

| Hotel | hotel_id | Usuario | Rol | Clave |
|---|---|---|---|---|
| Hotel Sede Central | `00000000-0000-0000-0000-000000000001` | `admin` | `admin` | `admin123` |
| Hotel Sede Central | `00000000-0000-0000-0000-000000000001` | `ops` | `ops` | `admin123` |
| Hotel Sede Central | `00000000-0000-0000-0000-000000000001` | `receptionist` | `receptionist` | `admin123` |
| Hotel Sede Central | `00000000-0000-0000-0000-000000000001` | `housekeeping` | `housekeeping` | `admin123` |
| Hotel Viena | `ad11ca4b-1fbc-432e-a315-3161eb9b31f8` | `admin_viena` | `admin` | `admin123` |

## Cómo probar en UI (frontend)
En `http://localhost:5173/login` completar:

1. `Hotel ID`: copiar de la tabla.
2. `Usuario`: copiar de la tabla.
3. `Clave`: `admin123`.
4. Click en **Acceder al Sistema**.

## Cómo probar por API (copiar/pegar)

### Caso válido (debe dar `200`)
```bash
curl -i -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"hotel_id":"00000000-0000-0000-0000-000000000001","username":"ops","password":"admin123"}'
```

### Caso inválido por tenant (debe dar `401`)
```bash
curl -i -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"hotel_id":"00000000-0000-0000-0000-000000000001","username":"admin_viena","password":"admin123"}'
```

## Verificación ejecutada
Pruebas realizadas el `2026-02-13` sobre backend en Docker:

1. `admin` + hotel central -> `200`
2. `ops` + hotel central -> `200`
3. `receptionist` + hotel central -> `200`
4. `housekeeping` + hotel central -> `200`
5. `admin_viena` + hotel Viena -> `200`
6. `admin_viena` + hotel central -> `401` (esperado)

## Errores comunes

1. `401 UNAUTHORIZED`:
   - `Hotel ID` incorrecto para ese usuario.
   - Usuario/clave mal escritos.
2. No conecta frontend/backend:
   - verificar contenedores con `docker compose ps`.
   - backend debe estar en `http://localhost:3001`.
3. Cambiaste datos en DB y dejó de entrar:
   - volver a usar los usuarios de esta tabla o regenerar credenciales de QA.

## Nota de seguridad
Estas credenciales son solo para QA/desarrollo. No usar en producción.
