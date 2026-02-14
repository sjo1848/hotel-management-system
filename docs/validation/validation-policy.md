# HMS Elite — Política de Validación

## Objetivo
Definir una estrategia consistente para evitar duplicación y huecos entre frontend/backend/domain.

## Capas de validación
1. **Web/DTO layer (backend)**
   - Validación de formato/sintaxis (tipos, longitud, formato básico, campos obligatorios).
2. **Domain layer**
   - Invariantes de negocio (fechas válidas, transiciones de estado, reglas de consistencia).
3. **Frontend layer**
   - Validación UX inmediata para feedback rápido al usuario (sin reemplazar backend).

## Reglas
- El backend siempre es autoridad final.
- Las invariantes de negocio no deben quedar solo en frontend.
- Cada error de validación mapea a `error_code` estable (`INVALID_INPUT` + details estructurado).
- Evitar duplicación innecesaria: shared schema donde aporte valor, manteniendo independencia de capas.

## Checklist por endpoint nuevo
- [ ] DTO validation definida
- [ ] Domain invariants cubiertas
- [ ] Error mapping documentado
- [ ] Tests unit/integration agregados

