# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS deps
WORKDIR /repo

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/storefront/package.json apps/storefront/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=@dtc/storefront --include-workspace-root --no-audit --no-fund

FROM node:24-alpine AS builder
WORKDIR /repo

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /repo /repo
COPY apps/storefront apps/storefront

ARG STOREFRONT_ENV_HASH

RUN --mount=type=secret,id=app_env,target=/run/secrets/app_env \
    echo "app_env hash: $STOREFRONT_ENV_HASH" && \
    set -a; \
    [ -f /run/secrets/app_env ] && . /run/secrets/app_env; \
    set +a; \
    if [ -z "$NEXT_PUBLIC_MEDUSA_BACKEND_URL" ]; then \
      echo "NEXT_PUBLIC_MEDUSA_BACKEND_URL is empty: mount build secret id=app_env"; \
      exit 1; \
    fi; \
    npm run build --workspace=@dtc/storefront

FROM node:24-alpine AS runner
WORKDIR /app

ARG APP_ENV=production
LABEL app.env=$APP_ENV

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /repo/apps/storefront/.next/standalone ./
COPY --from=builder /repo/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=builder /repo/apps/storefront/public ./apps/storefront/public

# The COPYs above run as root, so /app is read-only for the app user. The one
# thing Next writes at runtime is its incremental cache (ISR, fetch results,
# optimized images) — hand over that directory alone and leave the rest
# immutable. Without it the server logs EACCES and re-renders every request.
RUN mkdir -p apps/storefront/.next/cache \
    && chown node:node apps/storefront/.next/cache

USER node

EXPOSE 8000

CMD ["node", "apps/storefront/server.js"]
