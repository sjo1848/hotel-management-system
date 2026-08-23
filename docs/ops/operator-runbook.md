# Operator Runbook — HMS Elite

Operational entry point for the repository tooling. Run commands from the repository root and use environment-specific credentials/secrets rather than demo defaults.

For the detailed provider-independent release, backup and restore contract, see [`production-operations.md`](production-operations.md).

## Quick reference

| Task | Command |
|---|---|
| Production preflight | `./scripts/prod-deploy-readiness.sh --profile prod` |
| Application deploy / rollback wrapper | `./scripts/deploy-with-rollback.sh --target-ref <ref> --env-file <file> --profile prod` |
| Database backup | `./scripts/backup.sh` |
| Database restore | `./scripts/restore.sh <backup> --recreate-db --yes` |
| Application rollback drill | `./scripts/deploy-rollback-drill.sh` |
| Restore / DR drill | `./scripts/restore-drill.sh` |
| Production smoke | `./scripts/production-smoke.sh` |
| Synthetic demo seed | `./scripts/seed-demo-data.sh` |

## Release sequence

1. Select and verify the target commit/ref.
2. Run the production profile preflight.
3. Create and verify the pre-release backup.
4. Apply migrations only through the controlled migration path.
5. Deploy the application artifact/ref.
6. Run health/readiness and authenticated smoke checks.
7. Keep the release only after the validation succeeds.

`deploy-with-rollback.sh` can restore the **application version/ref** after a failed deployment. It does **not** automatically perform a destructive database restore.

## Database restore boundary

Database restore is a separate operator action because it can destroy or replace data.

A destructive production restore requires the safeguards implemented by `restore.sh`, including maintenance mode, database-operation authorization and explicit confirmation. Review [`production-operations.md`](production-operations.md) before executing it.

Application rollback and database restore must not be treated as the same operation.

## Health and readiness

- Backend health: `GET /health`
- Backend readiness: `GET /ready`
- Production preflight: `./scripts/prod-deploy-readiness.sh --profile prod`
- Production smoke: `./scripts/production-smoke.sh`

Do not mark a release healthy only because the container is running; use the readiness and smoke checks.

## Backup and recovery

`backup.sh` produces a PostgreSQL dump plus checksum and supports operator-injected encryption/off-site copy commands. `restore-drill.sh` exercises recovery behavior without turning a synthetic drill into a claim about real operational RPO.

RPO/RTO handling and the external-storage contract are documented in [`production-operations.md`](production-operations.md).

## Security and incident response

- Authentication / cross-tenant anomaly response: [`runbooks/auth-anomaly-cross-tenant.md`](runbooks/auth-anomaly-cross-tenant.md)
- Threat model: [`threat-model.md`](threat-model.md)
- Environment/profile validation: `./scripts/validate-env-profile.sh`
- Backend security regression: `./scripts/backend-security-regression.sh`

## Demo tooling

The public-demo helper is documented in [`public-demo.md`](public-demo.md). It is intended for synthetic review/demo data and is separate from the production release path.
