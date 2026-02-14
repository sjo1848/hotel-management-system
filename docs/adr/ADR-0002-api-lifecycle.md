# ADR-0002: API Lifecycle y Gobernanza Contractual

## Estado
Aceptado

## Contexto
Existe `/api/v1` y contrato OpenAPI. Falta política formal de deprecación/versionado y enforcement para evitar breaking changes no controlados.

## Decisión
1. Mantener `/api/v1` como línea estable.
2. Reglas de deprecación:
   - comunicar deprecación con mínimo 2 releases de antelación.
   - documentar fecha de sunset en changelog contractual.
3. Breaking changes:
   - requieren versión mayor (`/api/v2`) o feature-flag de transición validada.
4. Enforcement CI:
   - si cambia OpenAPI, PR debe incluir entrada en `docs/api-changelog.md`.
   - si el cambio es breaking, debe incluir plan de migración y version bump.

## Artefactos obligatorios
- `docs/api-changelog.md`
- `docs/errors/error-codes-v1.md`

## Tradeoffs
- ✅ Mayor previsibilidad para integraciones.
- ✅ Menor riesgo de romper clientes en producción.
- ⚠️ Mayor overhead de proceso en cambios API.

## Validación
- Gate CI de alineación OpenAPI + gate changelog contractual.
- Revisión de compatibilidad en PR template.

