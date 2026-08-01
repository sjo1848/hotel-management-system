# HMS Elite - QA Short Protocol

## Objetivo
Ejecutar una pasada corta y seria antes de mostrar HMS Elite o cerrar una tanda de cambios, sin reemplazar los gates automatizados.

## Orden recomendado
1. Ejecutar smoke admin general.
2. Ejecutar smoke de recepcion.
3. Hacer pasada manual corta por rol.
4. Registrar solo defects reales.

## Smokes automatizados

### Admin general
Desde la raiz del repo:

```bash
./scripts/playwright-smoke.sh
```

Valida:
- login/logout
- recepcion
- dashboard
- billing visible
- reports
- RBAC admin

### Recepcion
Desde la raiz del repo:

```bash
./scripts/playwright-reception-smoke.sh
```

Valida:
- acceso de `recepcion_demo`
- menu acotado al rol
- board de recepcion
- walk-in en mobile
- apertura del booking center

## Credenciales demo
- `hotel_id`: `00000000-0000-0000-0000-000000000001`
- password: `demo2026pass`

Usuarios:
- `admin`
- `recepcion_demo`
- `ops_demo`
- `housekeeping_demo`
- `saas_admin_demo`

## Pasada manual corta

### 1. recepcion_demo
- entrar a `/bookings`
- abrir un caso desde la cola o la tabla
- abrir `Nueva Reserva`
- verificar que el sheet tenga CTA visible en mobile

### 2. ops_demo
- entrar a `/rooms`
- revisar planner y holds
- abrir `Gestionar habitacion`
- entrar a `/housekeeping`

### 3. housekeeping_demo
- entrar a `/housekeeping`
- mover `Dirty -> Cleaning`
- mover `Cleaning -> Available`

### 4. saas_admin_demo
- entrar a `/network`
- verificar vista HQ

## Criterio de cierre
- `./scripts/playwright-smoke.sh` en `PASS`
- `./scripts/playwright-reception-smoke.sh` en `PASS`
- QA manual sin defects criticos
- si hay defect, registrar:
  - rol
  - ancho
  - pantalla
  - resultado esperado
  - resultado actual
