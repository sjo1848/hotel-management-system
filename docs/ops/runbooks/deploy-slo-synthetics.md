# Runbook — Deploy con SLO Gate y Synthetics

## Objetivo
Estandarizar la validacion post-release con:
- synthetics funcionales
- gate SLO (p95 + error rate)
- rollback automatizado ante breach

## Flujo recomendado (release manual)
1. Ejecutar preflight:
   - `./scripts/prod-deploy-readiness.sh --env-file .env.prod --profile prod`
2. Disparar workflow:
   - `.github/workflows/deploy-with-rollback.yml`
3. Confirmar artefactos del run:
   - `post-deploy-synthetics-report`
   - `deploy-slo-gate-report`

## Inputs clave del workflow
- `target_ref`: commit/branch a desplegar.
- `env_file`: archivo de entorno.
- `profile`: `auto|dev|staging|prod`.
- `skip_tests`: salta smoke+synthetics (solo emergencia).
- `skip_synthetics`: salta solo synthetics.
- `synthetic_hotel_id`: hotel para login sintético.
- `run_slo_gate`: ejecuta gate SLO post-deploy.
- `execute_slo_rollback`: hace rollback automático si hay breach.

## Criterios de PASS/FAIL
- PASS:
  - deploy completado,
  - synthetics en `PASS`,
  - SLO gate sin breach.
- FAIL:
  - falla deploy/smoke/synthetics,
  - breach SLO con `--fail-on-breach` (workflow queda en fallo),
  - rollback automático falla.

## Comandos operativos (local/self-hosted)
- Synthetics:
  - `./scripts/post-deploy-synthetics.sh --env-file .env.prod --profile prod --report /tmp/hms_post_deploy_synthetics.md`
- SLO gate:
  - `./scripts/rollback-on-slo-breach.sh --env-file .env.prod --profile prod --target-ref HEAD~1 --fail-on-breach --execute-rollback --skip-deploy-tests --report /tmp/hms_rollback_on_slo.md`

## Notas de seguridad
- En `staging/prod`, `post-deploy-synthetics.sh` falla si detecta password placeholder o default (`admin123`).
- No usar `skip_tests`/`skip_synthetics` como modo normal de release; solo para mitigacion temporal con aprobacion operativa.
