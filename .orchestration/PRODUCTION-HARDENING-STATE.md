# PRODUCTION-HARDENING

- task: provider-agnostic production hardening
- base_sha: bb569d4bb35d6780c29bb55667893c5f94dc3edf
- branch: feature/production-hardening
- current_status: READY_FOR_PRODUCTION_HARDENING_HUMAN_GATE
- candidate_commit: see final HEAD reported by orchestrator (this state file is intentionally not self-referential)
- remote_ci: PASS on the validation candidate; final state-only HEAD requires its own canonical CI run
- provider_decisions: deferred
- deployment: prohibited/not performed
- real_data: prohibited/not used
- preexisting_untracked_preserved: true

## Lanes

- runtime-config-topology: REWORK — dev Dockerfiles were accidentally changed; split dev/prod images
- database-release-smoke: REWORK — production compose context and release ordering must be explicit
- security-operations-critic: INDEPENDENCE_NOT_AVAILABLE; no independent certification claimed
- integration-production-critic: INDEPENDENCE_NOT_AVAILABLE; documentary reconciliation applied in this file

## Completed provider-agnostic increments

- separate pinned production Dockerfiles and static nginx frontend
- standalone production compose with internal backend and only frontend published
- strict production config/auth/cookie/CORS/metrics guards
- explicit migration, backup, restore, smoke and app-only rollback procedures
- PostgreSQL URL interfaces with dev compose fallback only
- encrypted/off-host backup hooks, retention, checksums and restrictive umask
- destructive restore/DR guards and honest RPO INCONCLUSIVE semantics
- RLS migration 0030 plus focused tenant tests and security matrix
- production security/operations documentation

## Validation

- backend unit/config tests: PASS (70 lib tests; config focus 9/9)
- frontend lint: PASS
- frontend production build to temporary output: PASS
- shell syntax: PASS
- cargo fmt: PASS
- OpenAPI alignment: PASS
- legacy schema convergence: PASS
- production/dev compose static config: PASS
- Docker production build: PASS for backend and frontend production images
- SQLx tenant/security runtime tests: PASS on clean synthetic PostgreSQL runtime
- backup/restore: PASS; restore drill mechanics PASS, RPO NOT_MEASURED/INCONCLUSIVE
- production image health and synthetic smoke: PASS
- production env profile and compose validation: PASS
- canonical full-stack CI: PASS on validation candidate; final state-only HEAD requires recheck

## Final limitations

- provider-specific database endpoint, VPS, DNS, TLS, firewall and external backup are deferred
- restore-drill RPO measurement remains a production-operations follow-up; no restore failure was observed
- frontend npm audit reports unresolved transitive/dev findings, including critical vitest/@vitest/coverage-v8; triage is required before production eligibility
- existing frontend/e2e/probe.tmp.spec.ts and prior untracked artifacts were preserved and excluded from changes
- no production eligibility is asserted

## Runtime limitation

Workers were callable for implementation. Independent critic certification must
be attempted after implementation. If unavailable, record
INDEPENDENCE_NOT_AVAILABLE and do not fabricate PASS.

## Closure state

- runtime_security_operations_critic: INDEPENDENCE_NOT_AVAILABLE
- runtime_integration_production_critic: INDEPENDENCE_NOT_AVAILABLE
- deployment: not performed
- real_data: not used
- provider-specific work deferred: VPS/provider, VM sizing, public IP, disk product, DNS, external backup destination, final firewall implementation
