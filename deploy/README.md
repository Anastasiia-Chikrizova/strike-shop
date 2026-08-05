# Staging deployment

| File | What it is |
| --- | --- |
| [`.github/workflows/build-push.yml`](../.github/workflows/build-push.yml) | builds both images for `linux/arm64` → GHCR |
| [`docker-compose.staging.yml`](../docker-compose.staging.yml) | deploy stack: only `image:`, no `build:` |
| [`Caddyfile`](Caddyfile) | reverse proxy + automatic Let's Encrypt |
| [`deploy.sh`](deploy.sh) | pull → migrate → up → wait for healthy |
| `*.env.example` | templates; the real files live in `/etc/strike-shop/` and never go into git |

The `docker-compose.yml` in the repo root builds from source (local/manual),
`docker-compose.dev.yml` is for development. The server only needs
`docker-compose.staging.yml`.

---

## 1. Prerequisites

- a Linux VM with Docker;
- a Cloudflare Tunnel pointed at that VM, and two domains (or subdomains):
  `staging.…` for the storefront, `api.staging.…` for the backend, bound to
  the tunnel (instead of A records pointing at a public IP);
- a Monobank sandbox token from https://api.monobank.ua/.

## 2. Server

Docker from the official repo (the distro package ships an old version
without `docker compose`):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # log back in afterward
```

Public access goes through Cloudflare Tunnel (`cloudflared`), so 80/443 don't
need to be opened externally — `caddy` in `docker-compose.staging.yml` only
listens for what the tunnel forwards to it, and the tunnel itself is set up
separately (TODO: document `cloudflared` as a service/container here once
that's settled).

The repo is only needed on the server for the compose file and this script:

```bash
sudo git clone https://github.com/Anastasiia-Chikrizova/strike-shop /opt/strike-shop
sudo chown -R "$USER" /opt/strike-shop
```

## 3. Secrets on the server

```bash
sudo mkdir -p /etc/strike-shop
sudo cp /opt/strike-shop/deploy/*.env.example /etc/strike-shop/
# rename dropping .example, then fill in
sudo chmod 600 /etc/strike-shop/*.env
```

Generating secrets: `openssl rand -base64 32` for `JWT_SECRET`,
`COOKIE_SECRET`, `AUTH_MFA_ENCRYPTION_KEY`; `openssl rand -base64 24` for the
Postgres password (also used in `DATABASE_URL` — keep them in sync).

GHCR access (images are private until the package is made public) — a PAT
with only the `read:packages` scope:

```bash
echo "<PAT>" | docker login ghcr.io -u Anastasiia-Chikrizova --password-stdin
```

## 4. GitHub

Settings → Environments → **staging** (and later **prod**), each with a
secret named `STOREFRONT_ENV` — the full contents of `storefront.env` as
text. The workflow picks the Environment based on the branch: `dev` →
staging, `master` → prod.

---

## 5. First deployment

The order isn't arbitrary: `NEXT_PUBLIC_*` values get baked into the bundle
at build time, and the publishable key only exists after the backend has run
once. So the backend goes up first, and only then is the storefront built.

**1. Build the backend.** Push to `dev`, or Actions → Run workflow → staging.

**2. Bring up the database and backend:**

```bash
cd /opt/strike-shop
set -a; . /etc/strike-shop/stack.env; set +a
compose() { docker compose --env-file /etc/strike-shop/stack.env -f docker-compose.staging.yml "$@"; }

compose pull backend
compose up -d postgres redis
compose --profile tools run --rm migrate
compose up -d backend caddy
```

The storefront domain will return 502 for now — that's expected, there's no
upstream yet.

**3. Create an admin user:**

```bash
compose run --rm backend npx medusa user -e admin@strike.shop -p '<password>'
```

**4. Grab the publishable key** in the admin at `https://api.staging.…/app` →
Settings → Publishable API keys, and enable Monobank there too:
Settings → Regions → Ukraine → Payment providers → `monobank`.

**5. Fill in `storefront.env`** with the key and domains, put the same
contents into the `STOREFRONT_ENV` secret, and re-run the workflow.

**6. Roll everything out:**

```bash
./deploy/deploy.sh
```

## 6. Routine deployment

```bash
cd /opt/strike-shop && git pull && ./deploy/deploy.sh
```

The script pulls images tagged `staging`, runs migrations, brings up the
stack, and waits for both apps to report `healthy`. If they don't, it prints
the logs and exits non-zero.

Rolling back to a specific build (tag = commit sha, found in the workflow
summary):

```bash
TAG=9f2c1ab ./deploy/deploy.sh
```

Migrations don't roll back — rolling back the image with an incompatible DB
schema won't save you. Tolerable on staging; for prod, take a `pg_dump`
before rolling out.

## 7. Monobank on staging

The sandbox differs **only in the token** — `MONO_API_URL` is the same
production `https://api.monobank.ua`. Both URLs must be public https,
otherwise the webhook won't arrive and the payment will hang in `pending`:

```
MONO_WEBHOOK_URL=https://api.staging.…/webhooks/monobank
MONO_REDIRECT_URL=https://staging.…/ua/monobank/return
```

Verify after rollout by checking that the `monobank_webhook_log` table is
filling up (it also records webhooks that failed signature verification).
Integration details: [apps/backend/src/lib/monobank/README.md](../apps/backend/src/lib/monobank/README.md).

## 8. Known issue: migrations inside the container

**Verified locally (Docker Desktop, macOS/arm64):** `npx medusa db:migrate`
hangs inside the container. The process goes to sleep in `epoll_wait`,
migrations never apply, and Medusa's own timeout kills it:

```
Could not connect to the database while running migrations.
The connection timed out after 10 seconds
```

The message is misleading — the database is fine. What's been ruled out by
testing:

| Suspect | Ruled out because |
| --- | --- |
| Unreachable DB | raw `pg` from the same container — 37ms, `knex` — 96ms |
| SSL | `createPgConnection` defaults ssl to `false` |
| Redis | hangs the same way without `REDIS_URL` |
| DB state | hangs on both a fresh and an already-migrated DB |
| Node version | 20 and 22 hang identically |
| Base image | alpine (musl) and bookworm (glibc) — same result |
| Build artifact | the same `.medusa/server` runs fine on the host (145 tables) |
| Parent `node_modules` | mounted into the container — didn't help |

There's one consistent pattern: **inside Docker it always hangs, outside
Docker it always works.** Looks like a Docker Desktop on macOS artifact, so
the first thing to try is just running it on the actual instance — real
Linux, real Docker.

If it reproduces on the server, the workaround is: install Node 20 on the
instance itself, clone the repo, and run migrations from the host against the
containerized Postgres (temporarily publishing its port on `127.0.0.1`). The
app itself runs fine in the container — verified, both backend and
storefront come up healthy against an already-migrated database.

The timeout is configurable, by the way:
`MEDUSA_DB_MIGRATION_CONNECTION_TIMEOUT` (milliseconds). Raising it doesn't
fix anything — the process just hangs longer.

## 9. Deliberately out of scope here

- **backups** — unnecessary for staging; for prod, at minimum a cron
  `pg_dump` into Cloudflare R2 (same bucket as images, or a separate one);
- **locking staging down from outsiders** — basic auth in Caddy would break
  the Monobank webhook, so it needs to be applied selectively, not to the
  whole domain;
- **a separate Medusa worker** — one instance handles both the API and
  background jobs (`MEDUSA_WORKER_MODE` defaults to `shared`). Splitting
  makes sense once there's a second machine.
