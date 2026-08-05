# strike-shop

Monorepo for the shop: a Medusa backend (`apps/backend`) and a Next.js
storefront (`apps/storefront`). Package manager is npm, scripts run through
turbo.

## Running locally

Requires Node.js 20+, PostgreSQL 15+, and Redis (optional — without
`REDIS_URL` Medusa falls back to in-memory implementations).

1. Install dependencies:

```bash
npm install
```

2. Create the backend env file and fill in `DATABASE_URL`:

```bash
cp apps/backend/.env.template apps/backend/.env
```

3. Run migrations (from `apps/backend`):

```bash
npx medusa db:migrate
```

4. Create an admin user (from `apps/backend`):

```bash
npx medusa user -e admin@test.com -p supersecret
```

5. Start both apps:

```bash
npm run dev
```

Backend at `http://localhost:9000` (admin at `/app`), storefront at
`http://localhost:8000`.

Grab the publishable key from the admin: Settings → Publishable API key. Put
it in `apps/storefront/.env.local`.

## Storefront environment variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Publishable API key from the backend | — |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | Public backend URL, baked into the bundle at build time | `http://localhost:9000` |
| `MEDUSA_BACKEND_URL` | Private backend URL for server-side calls | value of `NEXT_PUBLIC_MEDUSA_BACKEND_URL` |
| `NEXT_PUBLIC_DEFAULT_REGION` | Default region country code | `ua` |
| `NEXT_PUBLIC_BASE_URL` | Storefront base URL | `https://localhost:8000` |

## Deployment

Staging runs on a Linux VM (amd64), exposed via Cloudflare Tunnel. Images are
built by GitHub Actions and pushed to GHCR. Steps, server setup, and secrets
are described in [deploy/README.md](deploy/README.md).

## Payments

The Monobank integration is documented separately:
[apps/backend/src/lib/monobank/README.md](apps/backend/src/lib/monobank/README.md).
