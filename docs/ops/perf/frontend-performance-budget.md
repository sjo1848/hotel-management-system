# HMS Elite — Frontend Performance Budget

- Fecha-hora baseline: `2026-02-14 18:25:50 -0300`
- Scope inicial: bundle budget para `Dashboard` y `Bookings` (bloques críticos operativos).

## Budgets definidos (HMS-FE-T01)

| Asset | Budget max (KB) |
|---|---:|
| `vendor-*.js` | 550 |
| `charts-*.js` | 250 |
| `index-*.js` | 180 |
| `index-*.css` | 100 |

## Baseline medido (HMS-FE-T02)

Comando:

```bash
./scripts/frontend-perf-budget.sh
```

Resultado actual:

| Asset | Actual (KB) | Budget (KB) | Estado |
|---|---:|---:|---|
| `vendor-OVjm2-36.js` | 474.25 | 550 | PASS |
| `charts-XLfuuNRj.js` | 217.29 | 250 | PASS |
| `index-CulLQaB-.js` | 141.94 | 180 | PASS |
| `index-DGgEtU-u.css` | 81.42 | 100 | PASS |

## Enforcement

- Script: `scripts/frontend-perf-budget.sh`
- Gate local: `scripts/gate.sh`
- Gate CI-like: `scripts/gate-ci.sh`
- CI workflow: `full-stack-ci.yml` (`Frontend Performance Budget Gate`)
