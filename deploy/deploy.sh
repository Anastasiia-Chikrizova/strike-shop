#!/usr/bin/env bash
#
# Production rollout. Run on the server from /opt/strike-shop:
#
#   ./deploy/deploy.sh                    # tag from stack.env (prod)
#   TAG=9f2c1ab ./deploy/deploy.sh        # a specific build, or a rollback
#   SERVICES=storefront ./deploy/deploy.sh  # only this app — skips migrate too
#
set -euo pipefail

STACK_ENV="${STACK_ENV:-/etc/strike-shop/stack.env}"
SERVICES="${SERVICES:-backend storefront}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/docker-compose.deploy.yml"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31m!! %s\033[0m\n' "$1" >&2; exit 1; }

[[ -r "$STACK_ENV" ]] || die "no $STACK_ENV — copy deploy/stack.env.example and fill it in"
[[ -r "$COMPOSE_FILE" ]] || die "no $COMPOSE_FILE"

# Pull the file into the shell so TAG can be overridden below.
set -a
# shellcheck disable=SC1090
. "$STACK_ENV"
set +a

# Shell variables win over --env-file, which is what makes the tag swap work.
if [[ -n "${TAG:-}" ]]; then
  export BACKEND_IMAGE="${BACKEND_IMAGE%:*}:$TAG"
  export STOREFRONT_IMAGE="${STOREFRONT_IMAGE%:*}:$TAG"
fi

compose() { docker compose --env-file "$STACK_ENV" -f "$COMPOSE_FILE" "$@"; }

declare -A PREV_IMAGE=()
rollback() {
  local any=0
  for service in $SERVICES; do
    [[ -n "${PREV_IMAGE[$service]:-}" ]] || continue
    case "$service" in
      backend)    export BACKEND_IMAGE="${PREV_IMAGE[$service]}" ;;
      storefront) export STOREFRONT_IMAGE="${PREV_IMAGE[$service]}" ;;
    esac
    any=1
  done
  if [[ "$any" -eq 0 ]]; then
    printf '\033[1;31m!! No previous image was running — nothing to roll back to.\033[0m\n' >&2
    return 1
  fi
  printf '\033[1;33m!! Rolling back to the previous image(s).\033[0m\n' >&2
  compose up -d --remove-orphans $SERVICES
  printf '\033[1;33m!! Rolled back. Migrations, if any ran this deploy, were NOT reverted — see deploy/README.md.\033[0m\n' >&2
}

step "Images"
for service in $SERVICES; do
  cid="$(compose ps -q "$service" 2>/dev/null || true)"
  if [[ -n "$cid" ]]; then
    PREV_IMAGE[$service]="$(docker inspect -f '{{.Config.Image}}' "$cid")"
  fi
  case "$service" in
    backend)    echo "  backend:    $BACKEND_IMAGE (was: ${PREV_IMAGE[backend]:-not running})" ;;
    storefront) echo "  storefront: $STOREFRONT_IMAGE (was: ${PREV_IMAGE[storefront]:-not running})" ;;
  esac
done

step "Pulling images from ECR"
compose pull $SERVICES

step "Starting database and cache"
compose up -d postgres redis

step "Migrations"
if [[ " $SERVICES " == *" backend "* ]]; then
  # Behind the tools profile, so the service does not come up with the rest.
  compose --profile tools run --rm migrate
else
  echo "  skipped — backend not in \$SERVICES ($SERVICES)"
fi

step "Starting applications"
compose up -d --remove-orphans $SERVICES

step "Starting ingress"
compose up -d nginx cloudflared

step "Waiting for healthy"
for service in $SERVICES; do
  cid="$(compose ps -q "$service")"
  [[ -n "$cid" ]] || die "$service did not start"
  for _ in $(seq 1 60); do
    state="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)"
    [[ "$state" == "healthy" ]] && break
    [[ "$state" == "unhealthy" ]] && {
      compose logs --tail=50 "$service"
      rollback || true
      die "$service is unhealthy — logs above"
    }
    sleep 5
  done
  if [[ "$state" != "healthy" ]]; then
    compose logs --tail=50 "$service"
    rollback || true
    die "$service did not become healthy within 5 min"
  fi
  echo "  $service: healthy"
done

step "Pruning old images"
docker image prune -f >/dev/null

step "Done"
compose ps
