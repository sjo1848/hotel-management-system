# Operator Runbook — HMS Elite

Runbook maestro para operadores externos del entorno HMS Elite. Cada sección
referencia los scripts y gates del repo. Ejecutar desde la raíz del repositorio.

## 0. Referencia rápida

| Tarea | Comando |
|---|---|
| Deploy con rollback automático | `./scripts/deploy-with-rollback.sh` |
| Preflight antes de deploy prod | `./scripts/prod-deploy-readiness.sh [--profile prod]` |
| Backup de base de datos | `./scripts/backup.sh` |
| Restore | `./scripts/restore.sh <backup.sql.gz> [--recreate-db]` |
| Drill de rollback | `./scripts/deploy-rollback-drill.sh` |
| Drill de restore/DR | `./scripts/restore-drill.sh` |
| Semilla demo | `./scripts/seed-demo-data.sh [DEMO_PASSWORD=<pass>]` |

## 1. Deploy

1. Ejecutar preflight: `./scripts/prod-deploy-readiness.sh [--profile prod]`
   (valida perfil, compose resuelto, SLO de release, KPIs de negocio, seguridad
   de secretos). Si falla, no desplegar.
2. Desplegar con rollback automático:

```bash
./scripts/deploy-with-rollback.sh --target-ref origin/main --env-file .env --profile auto
```

- Hace backup pre-deploy en `scripts/backups/predeploy_<ts>.sql.gz`.
- On failure ejecuta rollback automático (restore de backup + redeploy del ref
  previo) y registra el evento.
- `--skip-tests` omite el smoke post-deploy (no recomendado).

## 2. Rollback

- Automático vía `deploy-with-rollback.sh` (no requiere acción manual).
- Verificación programática: `./scripts/deploy-rollback-drill.sh` valida que el
  fallo controlado devuelva `HEAD` al commit previo y health 200 en backend/frontend.
- Criterio de cierre: backend `:3001/health` y frontend `:5173/login` responden.

## 3. Backup y Restore

Backup:

```bash
./scripts/backup.sh   # → scripts/backups/hms_backup_*_<ts>.sql.gz
```

Restore:

```bash
./scripts/restore.sh ./scripts/backups/<file>.sql.gz --recreate-db --yes
```

Drill DR: `./scripts/restore-drill.sh` — mide RTO y RPO y valida paridad de
tablas (reporte en `docs/ops/drills/`).

## 4. Health y readiness

- Backend: `GET /health` (respuesta `{"status":"operational"}`).
- Valorar gateway: `./scripts/prod-deploy-readiness.sh`.

## 5. Alertas primarias

| Alerta | Runbook |
|---|---|
| Login failure rate / refresh unauthorized / cross-tenant forbidden | `runbooks/auth-anomaly-cross-tenant.md` |
| `PoolTimedOut` en CI backend | `runbooks/ci-backend-pooltimeout.md` |

Ver `docs/ops/runbooks/README.md` para el índice completo.

## 6. Buenas prácticas

- No exponer credenciales: `admin123`/dev-defaults bloqueados por
  `validate-env-profile.sh`/gates en CI fuera de `local`.
- Confirmar que los gates (`CI Stability Guard`, e2e a11y, anti-escape tenant)
  estén verdes antes de un release (ver `PROJECT_STATUS.md`).
- El demo público (`scripts/public-demo.sh`) es **temporal y no apto para
  producción** (ver `docs/ops/public-demo.md`).