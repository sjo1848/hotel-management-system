# API Versioning & Deprecation Policy (HMS Elite)

Fecha efectiva: 2026-02-13  
Alcance: API HTTP pública bajo `/api/v1/*`

## 1) Principios

1. Estabilidad por versión mayor: `/api/v1` mantiene compatibilidad hacia atrás durante su ciclo de vida.
2. Cambios incrementales seguros: agregar campos/endpoints nuevos no debe romper clientes existentes.
3. Rupturas controladas: todo cambio incompatible requiere versión mayor nueva (`/api/v2`).
4. Comunicación anticipada: toda deprecación se anuncia con ventana mínima definida.

## 2) Reglas de compatibilidad

### Permitido en la misma versión mayor (`v1`)

1. Agregar endpoints nuevos.
2. Agregar campos opcionales en respuestas JSON.
3. Agregar nuevos `error_code` sin cambiar semántica de los existentes.
4. Ajustes internos de performance/seguridad sin cambiar contrato observable.

### No permitido en la misma versión mayor (`v1`)

1. Eliminar endpoints existentes.
2. Renombrar o eliminar campos existentes en request/response.
3. Cambiar tipos de campos existentes.
4. Cambiar códigos HTTP o `error_code` de casos existentes sin plan de transición.

## 3) Política de deprecación

1. Todo endpoint/campo deprecado debe marcarse en docs (`docs/openapi.yaml`) y changelog (`docs/CHANGELOG.md`).
2. Ventana mínima de deprecación recomendada: 90 días antes de remoción en nueva versión mayor.
3. Durante deprecación:
   - mantener comportamiento actual,
   - emitir advertencia en release notes,
   - documentar alternativa/migración.
4. La remoción definitiva ocurre solo en versión mayor nueva (`/api/v2`).

## 4) Breaking changes

Si un cambio rompe clientes:

1. Crear nueva versión de ruta (`/api/v2`).
2. Mantener `/api/v1` coexistiendo durante ventana de transición.
3. Publicar guía de migración (`docs/CHANGELOG.md` + sección dedicada).
4. Definir fecha de sunset explícita para `/api/v1`.

## 5) Contrato de errores

1. Mantener estable el shape de error:
   - `error_code`
   - `message`
   - `request_id`
   - `details`
2. Nuevos errores funcionales deben modelarse como errores de dominio (evitar mapear negocio a `500`).
3. `error_code` existentes no deben reciclarse para otra semántica.

## 6) Governance mínima

Antes de merge a `main` para cambios de API:

1. Verificar impacto de compatibilidad (safe vs breaking).
2. Actualizar OpenAPI, changelog y docs de migración cuando aplique.
3. Ejecutar CI full-stack + suites de seguridad.

## 7) Estado actual

1. Versión activa: `v1`.
2. Sin `v2` abierto al momento de este documento.
3. Esta política aplica a partir de la fecha efectiva.
