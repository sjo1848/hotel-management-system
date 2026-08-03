# Public Demo Flow

Use this only for temporary external demos. Do not treat it as production.

## What it does

- recreates `backend` and `frontend` with staging-like runtime flags
- generates a strong temporary admin password if you do not provide one
- rotates the selected admin password directly in PostgreSQL
- exposes the frontend through a Cloudflare quick tunnel

## Command

```bash
./scripts/public-demo.sh
```

Optional overrides:

```bash
ADMIN_USER=admin \
ADMIN_PASSWORD='strong-demo-password' \
HOTEL_ID=00000000-0000-0000-0000-000000000001 \
JWT_SECRET="$(openssl rand -hex 32)" \
./scripts/public-demo.sh
```

## Notes

- The script keeps running while the tunnel is alive.
- The printed URL is the one to share with the client.
- The default hotel demo seed is `00000000-0000-0000-0000-000000000001`.
- `frontend/vite.config.js` allows public tunnel hostnames so Vite does not reject the external domain.
- This is suitable for review/demo only. For a stable client environment, use a real staging deployment with a fixed domain and TLS termination.
