#!/usr/bin/env bash
#
# Викочування стейджа. Запускати на сервері з /opt/strike-shop:
#
#   ./deploy/deploy.sh              # тег зі stack.env (staging)
#   TAG=9f2c1ab ./deploy/deploy.sh  # конкретний білд або відкат
#
set -euo pipefail

STACK_ENV="${STACK_ENV:-/etc/strike-shop/stack.env}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/docker-compose.staging.yml"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31m!! %s\033[0m\n' "$1" >&2; exit 1; }

[[ -r "$STACK_ENV" ]] || die "немає $STACK_ENV — скопіюй deploy/stack.env.example і заповни"
[[ -r "$COMPOSE_FILE" ]] || die "немає $COMPOSE_FILE"

# Змінні з файлу потрапляють у шелл, щоб можна було перебити TAG нижче.
set -a
# shellcheck disable=SC1090
. "$STACK_ENV"
set +a

# Шелл-змінні мають пріоритет над --env-file, тому підміна тега працює.
if [[ -n "${TAG:-}" ]]; then
  export BACKEND_IMAGE="${BACKEND_IMAGE%:*}:$TAG"
  export STOREFRONT_IMAGE="${STOREFRONT_IMAGE%:*}:$TAG"
fi

compose() { docker compose --env-file "$STACK_ENV" -f "$COMPOSE_FILE" "$@"; }

step "Образи"
echo "  backend:    $BACKEND_IMAGE"
echo "  storefront: $STOREFRONT_IMAGE"

step "Тягну образи з GHCR"
compose pull

step "Піднімаю базу і кеш"
compose up -d postgres redis

step "Міграції"
# Профіль tools, тому сервіс не піднімається разом з рештою.
compose --profile tools run --rm migrate

step "Піднімаю застосунки"
compose up -d --remove-orphans

step "Чекаю healthy"
for service in backend storefront; do
  cid="$(compose ps -q "$service")"
  [[ -n "$cid" ]] || die "$service не піднявся"
  for _ in $(seq 1 60); do
    state="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)"
    [[ "$state" == "healthy" ]] && break
    [[ "$state" == "unhealthy" ]] && {
      compose logs --tail=50 "$service"
      die "$service unhealthy — логи вище"
    }
    sleep 5
  done
  [[ "$state" == "healthy" ]] || { compose logs --tail=50 "$service"; die "$service не став healthy за 5 хв"; }
  echo "  $service: healthy"
done

step "Прибираю старі образи"
docker image prune -f >/dev/null

step "Готово"
compose ps
