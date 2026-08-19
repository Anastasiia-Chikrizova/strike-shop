# Runbook — strike-shop prod

The operational half of [deploy/README.md](README.md): how to roll out, how to
roll back, how to get onto the box, and what to do when the site is down.
README explains *why* things are shaped the way they are; this file assumes you
already know and just need the commands.

There is one environment, `prod`, on one instance. No staging, no second
replica — an unhealthy deploy rolls back to the previous image on the same box.

## At a glance

| | |
| --- | --- |
| Storefront | https://strike-shop.win |
| API / admin | https://api.strike-shop.win · admin at [`/app`](https://api.strike-shop.win/app) |
| Health | `https://api.strike-shop.win/health`, `https://strike-shop.win/api/health` |
| AWS | account `814454905474`, region `eu-north-1` |
| Instance | one `t4g.small`, tagged `Name=strike-shop-prod-app` |
| Shell | Session Manager only — no SSH, no key pair, no port 22 |
| Stack | `/opt/strike-shop/docker-compose.deploy.yml`, project `strike-shop-prod` |
| Env files | `/etc/strike-shop/{stack,backend,storefront}.env`, `root:root 600` |
| Secrets of record | SSM Parameter Store, `/strike-shop/prod/{stack,backend,storefront}_env` |
| Images | ECR `814454905474.dkr.ecr.eu-north-1.amazonaws.com/strike-shop/{backend,storefront}`, arm64 only |
| Ingress | Cloudflare Tunnel → nginx; Cloudflare Access guards `/app` and `/admin` |

Two shorthands used throughout. On the instance you land as `ssm-user`, who is
**not** in the `docker` group, so every docker command needs `sudo`:

```bash
cd /opt/strike-shop
compose() { sudo docker compose --env-file /etc/strike-shop/stack.env -f docker-compose.deploy.yml "$@"; }
```

And from a laptop, resolving the instance by tag rather than hardcoding an id
that changes whenever the instance is replaced:

```bash
INSTANCE_ID=$(aws ec2 describe-instances --region eu-north-1 \
  --filters "Name=tag:Name,Values=strike-shop-prod-app" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)
```

## 1. Deploy

**Normal path: merge to `main`.** [`build-push.yml`](../.github/workflows/build-push.yml)
builds only the apps whose paths changed, pushes `:<sha>` and `:prod` to ECR,
then runs [`deploy.sh`](deploy.sh) on the instance over SSM with
`TAG=<sha> SERVICES=<what changed>`. Nothing to do by hand. The job prints the
whole rollout log, so read that before touching the box.

**Same thing on demand** (rebuilds both apps regardless of paths):

```bash
gh workflow run build-push.yml --ref main
```

**From the instance**, when CI is unavailable or you want to re-run the current
rollout — it is idempotent, safe to retry:

```bash
cd /opt/strike-shop && sudo -u ec2-user git pull && sudo ./deploy/deploy.sh
```

The script pulls, runs migrations, brings the stack up, and waits up to 5
minutes for both apps to report `healthy`. If they don't, it prints the logs,
rolls the app containers back to the previously running image, and exits
non-zero.

Useful overrides: `TAG=<sha>` picks a specific build, `SERVICES=storefront`
deploys one app only (and skips migrations).

**Migration policy: additive-only for one release cycle.** `deploy.sh` migrates
*before* the health check, and the auto-rollback only reverts the running
image, never the schema. Don't drop or rename a column in the same release that
stops writing to it — do it one release later.

## 2. Rollback

**A failed deploy has already rolled itself back.** `deploy.sh` restores the
image that was running before the pull and brings it up. Confirm and move on:

```bash
compose ps                      # both apps Up (healthy)?
curl -sI https://strike-shop.win | head -1
```

**A deploy that went green but shipped a bad release** — roll back by hand to
the previous commit's sha (from the workflow summary, or `git log` on `main`):

```bash
cd /opt/strike-shop && sudo TAG=<sha> ./deploy/deploy.sh
```

Two limits worth knowing before you rely on this:

- **~10 builds of history.** The ECR lifecycle policy
  ([`ecr.tf`](../infra/terraform/environments/prod/ecr.tf)) keeps 10 tagged
  images per repository. Older shas are gone from the registry — the image has
  to be rebuilt from that commit instead. The *automatic* rollback inside
  `deploy.sh` is not affected: it reuses an image already on the instance.
- **Migrations do not roll back.** If the bad release migrated the schema,
  the old image may not run against it. That is what the additive-only policy
  above is for. Once there is data worth keeping, `pg_dump` before rolling out.

Rolling back **infrastructure** is a different move: `git revert` the Terraform
change and re-apply. Note that editing `user_data` stops and starts the
instance — a couple of minutes of downtime and a new public IP — so treat it as
a planned window, not an in-place edit.

## 3. Get onto the instance

**Interactive shell** (needs the Session Manager plugin for the AWS CLI):

```bash
aws ssm start-session --target "$INSTANCE_ID" --region eu-north-1
```

**One command, without a session** — returns a command id to read the output
with `aws ssm get-command-invocation`:

```bash
aws ssm send-command --region eu-north-1 --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["docker ps"]' --query Command.CommandId --output text
```

**Copy a file up**, with a throwaway key that lives for 60 seconds — both
halves must run as one command or the key expires in between:

```bash
aws ec2-instance-connect send-ssh-public-key --region eu-north-1 \
  --instance-id "$INSTANCE_ID" --instance-os-user ec2-user \
  --ssh-public-key file://$HOME/.ssh/id_rsa.pub \
&& scp -o ProxyCommand="aws ssm start-session --target %h \
  --document-name AWS-StartSSHSession --parameters portNumber=%p \
  --region eu-north-1" ./file ec2-user@"$INSTANCE_ID":/tmp/
```

**Get into the database:**

```bash
sudo docker exec -it strike-shop-prod-postgres-1 psql -U medusa -d medusa
```

## 4. The site is down

Work down this list; stop at the first thing that is wrong.

**1. Is it us or the edge?**

```bash
curl -sI https://strike-shop.win | head -1
curl -sI https://api.strike-shop.win/health | head -1
```

A Cloudflare 502/503 means the edge is up and the origin is not — carry on.
A DNS failure or a Cloudflare 1000-series error is a tunnel/DNS problem, not a
container problem: check the tunnel's status in the Cloudflare dashboard and
`compose logs cloudflared`.

**2. What is actually running?**

```bash
compose ps
```

Anything not `Up (healthy)` is the lead. `Restarting` in a loop usually means
the container dies at startup — bad env value, missing secret, OOM.

**3. Read the logs of the thing that is wrong**, not of everything:

```bash
compose logs --tail=100 <service>
```

nginx's error log names the upstream it cannot reach, which tells you which app
to look at next.

**4. Out of memory?** The box is 2 GB with a 4 GB swapfile and per-service
cgroup limits — a container killed for exceeding its limit exits `137`:

```bash
sudo docker stats --no-stream
compose ps -a          # look for exit code 137
```

**5. Nothing obvious** — re-run the current rollout, it is idempotent:

```bash
sudo ./deploy/deploy.sh
```

**6. Still nothing** — full sweep, then read the last GitHub Actions run:

```bash
compose logs --tail=200 --timestamps
```

## 5. Symptoms seen before

| Symptom | Cause | Fix |
| --- | --- | --- |
| Admin login returns 200, then 401 on every request | Medusa sets the session cookie `Secure` in production; you are on `http://localhost:9000` | Log in through https://api.strike-shop.win/app |
| `exec format error` on start | an amd64 image on Graviton | rebuild for `linux/arm64`; `runs-on` and `PLATFORM` must move together |
| `cloudflared` restart loop, "token is not valid" | a mangled `TUNNEL_TOKEN` in `stack.env` — `>>` onto a file with no trailing newline splices lines | restore the file from SSM (§6); check `tail -c1` before appending |
| Storefront build fails at `test -s /tmp/storefront.env` | the `STOREFRONT_ENV` secret in the `prod` environment is empty | refill it in Settings → Environments → prod; the log looks like a Docker error but isn't |
| Every `/store/*` call returns 400 | the publishable key baked into the storefront bundle no longer exists — the seed regenerated it on a fresh database | keep the EBS data volume; otherwise read the new key out of `api_key` and rebuild the storefront |
| `permission denied` on every docker command | the SSM shell is `ssm-user`, not in the `docker` group | `sudo` |
| Payment stuck in `pending` | the Monobank webhook never arrived | check `monobank_webhook_log`; `MONO_WEBHOOK_URL` must be a public https URL |
| Automation gets an Access login page on `/admin/*` | Cloudflare Access guards those paths | use an Access service token (`CF-Access-Client-Id` / `CF-Access-Client-Secret`), don't reopen the path |

## 6. Changing a secret

The env files on the instance are *copies*. The source of truth is SSM
Parameter Store, which is what `user_data` reads at boot — edit the parameter
first, or a replaced instance silently comes back with the old value.

```bash
aws ssm put-parameter --region eu-north-1 --name /strike-shop/prod/stack_env \
  --type SecureString --overwrite --value file://stack.env
```

Then refresh the copy on the box and restart what reads it:

```bash
aws ssm get-parameter --region eu-north-1 --name /strike-shop/prod/stack_env \
  --with-decryption --query Parameter.Value --output text \
  | sudo tee /etc/strike-shop/stack.env >/dev/null
sudo chmod 600 /etc/strike-shop/stack.env
compose up -d
```

`NEXT_PUBLIC_*` values are the exception: they are baked into the storefront
bundle at build time, so changing them means updating the `STOREFRONT_ENV`
secret in the `prod` GitHub environment and rebuilding, not restarting.

## 7. Rebuilding the instance from nothing

The instance is disposable; the Postgres volume is not. Last verified end to
end on 2026-08-13 — the replacement found the data volume, did not reformat it,
and the database survived.

1. `terraform apply` in [`infra/terraform/environments/prod`](../infra/terraform/environments/prod).
   The EBS data volume carries `prevent_destroy`; if Terraform proposes to
   replace or delete it, stop and find out why.
2. `user_data` does the rest at boot: Docker, swap, the repo clone, mounting
   `/dev/sdf` at `/mnt/data` (formatting it *only* if it has no filesystem),
   fetching the three env files from SSM, then running `deploy.sh`.
3. Watch it: `sudo tail -f /var/log/cloud-init-output.log`.
4. Verify: `compose ps`, then the two health URLs above.

If the data volume is genuinely lost, the catalogue is reproducible —
`npm run backend:seed` — but the seed mints a **new** publishable key, so the
storefront has to be rebuilt with it before `/store/*` stops returning 400.
There are no database backups by choice; see "deliberately out of scope" in
[README.md](README.md).
