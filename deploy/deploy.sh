#!/usr/bin/env bash
#
# Staging rollout. Run on the server from /opt/strike-shop:
#
#   ./deploy/deploy.sh              # tag from stack.env (staging)
#   TAG=9f2c1ab ./deploy/deploy.sh  # a specific build, or a rollback
#
set -euo pipefail

STACK_ENV="${STACK_ENV:-/etc/strike-shop/stack.env}"
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

step "Images"
echo "  backend:    $BACKEND_IMAGE"
echo "  storefront: $STOREFRONT_IMAGE"

step "Pulling images from GHCR"
compose pull

step "Starting database and cache"
compose up -d postgres redis

step "Migrations"
# Behind the tools profile, so the service does not come up with the rest.
compose --profile tools run --rm migrate

step "Starting applications"
compose up -d --remove-orphans

step "Waiting for healthy"
for service in backend storefront; do
  cid="$(compose ps -q "$service")"
  [[ -n "$cid" ]] || die "$service did not start"
  for _ in $(seq 1 60); do
    state="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)"
    [[ "$state" == "healthy" ]] && break
    [[ "$state" == "unhealthy" ]] && {
      compose logs --tail=50 "$service"
      die "$service is unhealthy — logs above"
    }
    sleep 5
  done
  [[ "$state" == "healthy" ]] || { compose logs --tail=50 "$service"; die "$service did not become healthy within 5 min"; }
  echo "  $service: healthy"
done

step "Pruning old images"
docker image prune -f >/dev/null

step "Done"
compose ps
