# Staging deployment

| File | What it is |
| --- | --- |
| [`.github/workflows/build-push.yml`](../.github/workflows/build-push.yml) | lint + typecheck on PRs (per app, path-filtered); builds both images for `linux/arm64` → GHCR on push/dispatch |
| [`docker-compose.deploy.yml`](../docker-compose.deploy.yml) | deploy stack: only `image:`, no `build:` |
| [`Caddyfile`](Caddyfile) | reverse proxy on plain HTTP — TLS terminates at the Cloudflare edge |
| [`deploy.sh`](deploy.sh) | pull → migrate → up → wait for healthy |
| `*.env.example` | templates; the real files live in `/etc/strike-shop/` and never go into git |

The `docker-compose.local.yml` in the repo root builds from source
(local/manual), `docker-compose.dev.yml` is for development. The server only
needs `docker-compose.deploy.yml`.

---

## 1. Prerequisites

- a Linux **arm64** VM with Docker — the images are arm64-only. On AWS that
  means a Graviton instance (`t4g.medium` and up); an x86 `t3` will refuse to
  run them with `exec format error`;
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
need to be opened externally — `caddy` in `docker-compose.deploy.yml` only
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
staging, `main` → prod. Those two are the only long-lived branches; `main`
is the repository default.

Each image job `needs` its own `lint-backend`/`lint-storefront` job (lint +
typecheck, path-filtered — a PR touching only the storefront doesn't wait on
the backend's checks), so a red gate pushes nothing to GHCR. It matters here
more than usual: `apps/storefront/next.config.js` sets
`typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`, so the image
build itself would happily ship code that does not typecheck.

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
compose() { docker compose --env-file /etc/strike-shop/stack.env -f docker-compose.deploy.yml "$@"; }

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

## 7. Architecture, resource limits, sizing and logs

Images are built for `linux/arm64` only, on GitHub's `ubuntu-24.04-arm`
runners (free for public repos, so the build is native rather than QEMU-
emulated). The target is AWS Graviton — `t4g` is roughly 20% cheaper than the
equivalent `t3` at better price/performance, and Node runs on it natively.

The cost of that choice: the instance must be arm64. Changing `PLATFORM` in
`build-push.yml` without changing `runs-on` in the same job still produces a
working image, just ~10x slower via emulation — they have to move together.


Every service declares `deploy.resources.limits`. Compose V2 honours these
outside swarm, so they are real cgroup limits, not documentation. The reason
they exist is sizing: without them one runaway Node process takes the whole
box down with it, and there is no defensible way to pick an instance type —
only guessing with a safety margin, which means paying for idle RAM.

Defaults in `docker-compose.deploy.yml`, all overridable from `stack.env`:

| Service | CPUs | Memory |
| --- | --- | --- |
| postgres | 1.0 | 768m |
| redis | 0.5 | 256m |
| backend | 1.5 | 1536m |
| storefront | 1.0 | 768m |
| caddy | 0.5 | 128m |
| **total** | **4.5** | **~3.4 GB** |

That fits a 4 GB instance. The backend gets the largest share because Medusa
serves the API and runs background jobs in one process
(`MEDUSA_WORKER_MODE=shared`); the storefront only serves a prebuilt
standalone bundle and never compiles at runtime.

These are starting points, not measurements. Before shrinking anything, watch
real usage under load:

```bash
docker stats --no-stream
```

`docker-compose.dev.yml` sets deliberately looser limits (2 GB per app),
because those containers install dependencies and compile on every change.

Logs rotate at `50m × 3` per service — about 750 MB across the stack. The
previous `250m × 7` allowed ~8.75 GB, which is most of a small EBS volume.
Tunable via `LOG_MAX_SIZE` / `LOG_MAX_FILE`.

## 8. Monobank on staging

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

## 9. Known issue: migrations inside the container

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

## 10. Deliberately out of scope here

- **backups** — unnecessary for staging; for prod, at minimum a cron
  `pg_dump` into Cloudflare R2 (same bucket as images, or a separate one);
- **locking staging down from outsiders** — basic auth in Caddy would break
  the Monobank webhook, so it needs to be applied selectively, not to the
  whole domain;
- **a separate Medusa worker** — one instance handles both the API and
  background jobs (`MEDUSA_WORKER_MODE` defaults to `shared`). Splitting
  makes sense once there's a second machine.
