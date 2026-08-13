# Deployment

Live at [strike-shop.win](https://strike-shop.win); the API and admin at
[api.strike-shop.win](https://api.strike-shop.win/app). One environment, named
`prod` everywhere — there is no staging (see "why no staging" in
[infra/README.md](../infra/README.md)).

| File | What it is |
| --- | --- |
| [`.github/workflows/build-push.yml`](../.github/workflows/build-push.yml) | lint + typecheck on PRs (per app, path-filtered); builds both images for `linux/arm64` → GHCR on push/dispatch |
| [`docker-compose.deploy.yml`](../docker-compose.deploy.yml) | deploy stack: only `image:`, no `build:` |
| [`nginx/nginx.conf.template`](nginx/nginx.conf.template) | reverse proxy on plain HTTP, split by `server_name` — TLS terminates at the Cloudflare edge |
| [`deploy.sh`](deploy.sh) | pull → migrate → up → wait for healthy |
| `*.env.example` | templates; the real files live in `/etc/strike-shop/` and never go into git |

The `docker-compose.local.yml` in the repo root builds from source
(local/manual), `docker-compose.dev.yml` is for development. The server only
needs `docker-compose.deploy.yml`.

---

## 1. Prerequisites

- a Linux **arm64** VM with Docker — the images are arm64-only. On AWS that
  means a Graviton instance; an x86 `t3` will refuse to run them with
  `exec format error`. What is actually running is a `t4g.small` (2 GB) with a
  4 GB swapfile and the resource limits cut in `stack.env` — see §7. The VM is
  created by Terraform, not by hand: [infra/README.md](../infra/README.md);
- a Cloudflare Tunnel pointed at that VM, and two hostnames:
  `strike-shop.win` for the storefront, `api.strike-shop.win` for the backend,
  both routed to the tunnel (instead of A records pointing at a public IP);
- a Monobank sandbox token from https://api.monobank.ua/.

## 2. Server

On AWS this whole section is done by `user_data` in the Terraform module —
Docker, the compose plugin (not packaged for AL2023, so it goes in as a
binary), a 4 GB swapfile and the repo clone into `/opt/strike-shop`. On any
other VM, by hand:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # log back in afterward
sudo git clone https://github.com/Anastasiia-Chikrizova/strike-shop /opt/strike-shop
sudo chown -R "$USER" /opt/strike-shop
```

The repo is only needed on the server for the compose file and this script.

Public access goes through Cloudflare Tunnel, and `cloudflared` is a service in
`docker-compose.deploy.yml` — it reads `TUNNEL_TOKEN` from `stack.env`, dials
out, and needs no published port. Ports 80/443 are never opened: on AWS the
security group has no inbound rules at all. Two Published application routes in
the tunnel, `strike-shop.win` and `api.strike-shop.win`, both pointing at
`http://nginx:80`; nginx splits them by `server_name`.

Shell access is `aws ssm start-session` — no key pair, no port 22, no bastion.
Note that the SSM shell lands you as `ssm-user`, who is **not** in the `docker`
group, so every docker command there needs `sudo`.

## 3. Secrets on the server

```bash
sudo mkdir -p /etc/strike-shop
sudo cp /opt/strike-shop/deploy/*.env.example /etc/strike-shop/
# rename dropping .example, then fill in
sudo chmod 600 /etc/strike-shop/*.env
```

Generating secrets: `openssl rand -base64 32` for `JWT_SECRET`,
`COOKIE_SECRET`, `AUTH_MFA_ENCRYPTION_KEY`. For the Postgres password use
**`openssl rand -hex 24`**, not base64: the same value goes inside
`DATABASE_URL`, and `+`, `/` and `=` have meaning in a URL.

Both packages are public, so no `docker login` is needed to pull. If they are
ever made private, a PAT with only the `read:packages` scope:

```bash
echo "<PAT>" | docker login ghcr.io -u Anastasiia-Chikrizova --password-stdin
```

On AWS, getting the files onto the box without SSH: `scp` tunnelled through
Session Manager, with a throwaway key that lives for 60 seconds.

```bash
aws ec2-instance-connect send-ssh-public-key --region eu-north-1 \
  --instance-id <id> --instance-os-user ec2-user \
  --ssh-public-key file://$HOME/.ssh/id_rsa.pub \
&& scp -o ProxyCommand="aws ssm start-session --target %h \
  --document-name AWS-StartSSHSession --parameters portNumber=%p \
  --region eu-north-1" ./*.env ec2-user@<id>:/tmp/
```

Then, over SSM: `sudo install -o root -g root -m 600 /tmp/x.env
/etc/strike-shop/x.env && shred -u /tmp/x.env`.

## 4. GitHub

Settings → Environments → **prod** and **eks**, each with a secret named
`STOREFRONT_ENV` — the full contents of `storefront.env` as text. A push to
`main` builds `prod`; `workflow_dispatch` takes the environment as an input
and defaults to `eks`, so **pass `prod` explicitly** when that is what you
want:

```bash
gh workflow run build-push.yml --ref main -f environment=prod
```

The environment name is also the floating image tag (`:prod`, `:eks`)
alongside `:${{ github.sha }}`. An empty `STOREFRONT_ENV` fails the storefront
job before the build even starts, at `test -s /tmp/storefront.env` — which is
deliberate, since a bundle built without `NEXT_PUBLIC_*` is worthless, but the
log makes it look like a Docker problem rather than a missing secret.

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

**1. Build the backend.** Push to `main`, or Actions → Run workflow → prod.

**2. Bring up the database and backend:**

```bash
cd /opt/strike-shop
set -a; . /etc/strike-shop/stack.env; set +a
compose() { docker compose --env-file /etc/strike-shop/stack.env -f docker-compose.deploy.yml "$@"; }

compose pull backend
compose up -d postgres redis
compose --profile tools run --rm migrate
compose up -d backend
```

Do not bring up `nginx` yet: it `depends_on` the storefront, whose image does
not exist on the first pass, so compose would try to create it and fail. Both
domains return 502 until the last step — expected.

**3. Create an admin user** (over SSM, so `sudo`):

```bash
sudo docker exec -it strike-shop-prod-backend-1 \
  npx medusa user -e admin@strike.shop -p '<password>'
```

**4. Grab the publishable key.** The seed script creates one already, linked
to the Default Sales Channel, so the fastest route is straight from the
database:

```bash
sudo docker exec strike-shop-prod-postgres-1 \
  psql -U medusa -d medusa -c 'select title, token from api_key'
```

It is a public value by design — it ships inside the browser bundle. The admin
UI shows the same thing under Settings → Publishable API keys; enable Monobank
while you are there: Settings → Regions → Ukraine → Payment providers →
`monobank`.

Log into the admin **through the domain over HTTPS**, not through a forwarded
`localhost:9000`. In production Medusa sets the session cookie with `Secure`,
so over plain HTTP the login returns 200 and every following request 401 —
which reads like a wrong password and is not.

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

The script pulls the tags named in `stack.env` (`:prod`), runs migrations,
brings up the stack, and waits for both apps to report `healthy`. If they
don't, it prints the logs and exits non-zero.

Rolling back to a specific build (tag = commit sha, found in the workflow
summary):

```bash
TAG=9f2c1ab ./deploy/deploy.sh
```

Migrations don't roll back — rolling back the image with an incompatible DB
schema won't save you. Tolerable while the catalogue is seeded data; once
there is anything worth keeping, take a `pg_dump` before rolling out.

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

| Service | CPUs | Memory (default) | Memory (`t4g.small`) |
| --- | --- | --- | --- |
| postgres | 1.0 | 768m | 512m |
| redis | 0.5 | 256m | 128m |
| backend | 1.5 | 1536m | 1024m |
| storefront | 1.0 | 768m | 512m |
| nginx | 0.5 | 128m | 64m |
| cloudflared | 0.25 | 64m | 64m |
| **total** | **4.75** | **~3.5 GB** | **~2.2 GB** |

The defaults assume a 4 GB box. The instance actually in use has 2 GB, so
`stack.env` overrides them down the right-hand column; the sum still exceeds
RAM on purpose — these are ceilings, not reservations, and the 4 GB swapfile
absorbs the Medusa startup spike that would otherwise get Postgres
OOM-killed.

The backend gets the largest share because Medusa
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

## 8. Monobank

The site runs against the **sandbox**. It differs **only in the token** —
`MONO_API_URL` is the same
production `https://api.monobank.ua`. Both URLs must be public https,
otherwise the webhook won't arrive and the payment will hang in `pending`:

```
MONO_WEBHOOK_URL=https://api.strike-shop.win/webhooks/monobank
MONO_REDIRECT_URL=https://strike-shop.win/ua/monobank/return
```

Verify after rollout by checking that the `monobank_webhook_log` table is
filling up (it also records webhooks that failed signature verification).
Integration details: [apps/backend/src/lib/monobank/README.md](../apps/backend/src/lib/monobank/README.md).

## 9. Known issue: migrations inside the container

`npx medusa db:migrate` inside the container fails after exactly 10 seconds
with a message that blames the database:

```
Could not connect to the database while running migrations.
The connection timed out after 10 seconds, which usually indicates an
incorrect database URL or an SSL configuration issue.
```

**The message is wrong on both counts.** It comes from
`verifyMigrationConnection()` in `@medusajs/modules-sdk`, a pre-flight
`knex.raw("SELECT 1")` wrapped in a `Promise.race` against a fixed timeout.
Everything it names as a likely cause has been ruled out.

Previously reproduced on Docker Desktop (macOS/arm64) and assumed to be a
Docker Desktop artifact. **It is not** — it reproduced six times in a row on
the real instance (AL2023, arm64, native Docker), on an empty database.

| Suspect | Ruled out because |
| --- | --- |
| Unreachable DB | `psql` and `redis-cli` from the compose network answer instantly |
| Wrong URL | raw `pg` from the same image, same network, same `DATABASE_URL` — connects |
| Pool config | bare `knex`, and Medusa's own `createPgConnection`, run `SELECT 1` fine; also fine under 12 concurrent queries |
| SSL | Postgres refuses SSL *immediately* (`server does not support SSL`) — that is an error, not a hang |
| Redis | fails identically with `REDIS_URL=` (fake redis) |
| Resource limits | fails outside compose with no cgroup limits, 1.1 GB free, swap untouched, both cores idle |
| Baked-in `.env` | there is none in the image; `loadEnv()` does not change `DATABASE_URL` |

The real error only appears once the timeout is raised past knex's own
acquire timeout:

```bash
docker run ... -e MEDUSA_DB_MIGRATION_CONNECTION_TIMEOUT=90000 ... npx medusa db:migrate
# Knex: Timeout acquiring a connection. The pool is probably full.
```

With `DEBUG=knex:*` you can see the first connection working normally — it
runs `SELECT 1`, the `pgstream` schema probe and the `mikro_orm_migrations`
existence check — and then a second connection, the one the module migrations
use, never appearing in the log at all. It is created, silently fails to
connect, and tarn retries until the race times out.

**How it was unstuck:** mounting a `medusa-config.js` with explicit
`databaseDriverOptions: { connection: { ssl: false }, pool: { min: 2, max: 10 } }`
made the migrations run through, all 145 tables and the seed. But a control
run on a *freshly created* database with the **stock** config also succeeded,
so this is not a proven fix and the root cause is still open. The likeliest
remaining explanation is a bad half-state: the very first attempt creates
`mikro_orm_migrations` and dies, and subsequent runs stumble over it.

If it happens again, in order: raise
`MEDUSA_DB_MIGRATION_CONNECTION_TIMEOUT` and read the real error, turn on
`DEBUG=knex:*`, and only then start changing config. Do not trust the text of
the default message.

## 10. Deliberately out of scope here

- **backups** — the catalogue is seeded and reproducible, so losing the
  database costs one `seed` run. The moment there is data worth keeping: a
  cron `pg_dump` into Cloudflare R2 (same bucket as images, or a separate
  one), plus one restore actually performed, because an untested dump is not
  a recovery plan;
- **locking the site down from outsiders** — basic auth in nginx would break
  the Monobank webhook, so it needs to be applied selectively, not to the
  whole domain. Cloudflare Access on `/app` only would be the cheaper way in;
- **secrets in SSM Parameter Store** — the `*.env` files are placed by hand
  today, which means a recreated instance needs manual setup before it can
  serve. See the debt list in [infra/README.ru.md](../infra/README.ru.md);
- **a separate Medusa worker** — one instance handles both the API and
  background jobs (`MEDUSA_WORKER_MODE` defaults to `shared`). Splitting
  makes sense once there's a second machine.
