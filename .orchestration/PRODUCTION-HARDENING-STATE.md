# PRODUCTION-HARDENING

- task: provider-agnostic production hardening
- base_sha: bb569d4bb35d6780c29bb55667893c5f94dc3edf
- branch: feature/production-hardening
- current_status: READY_FOR_VPS_SELECTION_AND_PRODUCTION_IMPLEMENTATION_GATE
- provider_decisions: deferred
- deployment: prohibited/not performed
- real_data: prohibited/not used
- preexisting_untracked_preserved: true

## Lanes

- runtime-config-topology: REWORK — dev Dockerfiles were accidentally changed; split dev/prod images
- database-release-smoke: REWORK — production compose context and release ordering must be explicit
- security-operations-critic: REWORK loops completed; INDEPENDENCE_NOT_AVAILABLE
- integration-production-critic: REWORK loops completed; INDEPENDENCE_NOT_AVAILABLE

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
- Docker production build: attempted; interrupted during slow base-image download, no deployment
- SQLx tenant/security runtime tests: BLOCKED by local PostgreSQL hostname/password environment

## Final limitations

- provider-specific database endpoint, VPS, DNS, TLS, firewall and external backup are deferred
- smoke and RLS runtime execution require a valid synthetic PostgreSQL/application environment
- existing frontend/e2e/probe.tmp.spec.ts and prior untracked artifacts were preserved and excluded from changes
- no production eligibility is asserted

## Runtime limitation

Workers were callable for implementation. Independent critic certification must
be attempted after implementation. If unavailable, record
INDEPENDENCE_NOT_AVAILABLE and do not fabricate PASS.
