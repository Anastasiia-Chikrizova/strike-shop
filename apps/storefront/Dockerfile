# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /repo

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/storefront/package.json apps/storefront/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=@dtc/storefront --include-workspace-root --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /repo

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /repo /repo
COPY apps/storefront apps/storefront

RUN --mount=type=secret,id=app_env,target=/run/secrets/app_env \
    set -a; \
    [ -f /run/secrets/app_env ] && . /run/secrets/app_env; \
    set +a; \
    if [ -z "$NEXT_PUBLIC_MEDUSA_BACKEND_URL" ]; then \
      echo "NEXT_PUBLIC_MEDUSA_BACKEND_URL is empty: mount build secret id=app_env"; \
      exit 1; \
    fi; \
    npm run build --workspace=@dtc/storefront

FROM node:22-alpine AS runner
WORKDIR /app

ARG APP_ENV=production
LABEL app.env=$APP_ENV

ENV NODE_ENV=production
ENV APP_ENV=$APP_ENV
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /repo/apps/storefront/.next/standalone ./
COPY --from=builder /repo/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=builder /repo/apps/storefront/public ./apps/storefront/public

USER node

EXPOSE 8000

CMD ["node", "apps/storefront/server.js"]
