# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS deps
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=@dtc/backend --include-workspace-root --no-audit --no-fund

FROM node:24-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/backend apps/backend
COPY --from=deps /repo/node_modules ./node_modules

RUN npm run build --workspace=@dtc/backend

FROM node:24-alpine AS server-deps
WORKDIR /app

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/backend/.medusa/server ./

RUN npm prune --omit=dev --no-audit --no-fund

FROM node:24-alpine AS runner
WORKDIR /app

ARG APP_ENV=production
LABEL app.env=$APP_ENV

ENV NODE_ENV=production
ENV PORT=9000

COPY --from=server-deps --chown=node:node /app ./

RUN mkdir -p /app/static && chown -R node:node /app/static

USER node

EXPOSE 9000

CMD ["npm", "run", "start"]
