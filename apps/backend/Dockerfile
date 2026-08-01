# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /repo

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=@dtc/backend --include-workspace-root --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /repo

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY apps/backend apps/backend
COPY --from=deps /repo/node_modules ./node_modules

RUN npm run build --workspace=@dtc/backend

FROM node:22-alpine AS server-deps
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY --from=builder /repo/apps/backend/.medusa/server/package.json ./

RUN --mount=type=cache,target=/root/.npm npm install --omit=dev --no-audit --no-fund --prefer-offline

COPY --from=builder /repo/apps/backend/.medusa/server ./

FROM node:22-alpine AS runner
WORKDIR /app

ARG APP_ENV=production
LABEL app.env=$APP_ENV

ENV NODE_ENV=production
ENV APP_ENV=$APP_ENV
ENV PORT=9000

COPY --from=server-deps --chown=node:node /app ./

RUN mkdir -p /app/static && chown -R node:node /app/static

USER node

EXPOSE 9000

CMD ["npm", "run", "start"]
