FROM oven/bun:1.4.2-alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/activity/package.json ./apps/activity/package.json
COPY apps/bot/package.json ./apps/bot/package.json

RUN bun install --frozen-lockfile --os=linux --cpu=x64

COPY apps/activity/ ./apps/activity/

ARG VITE_API_ORIGIN
ARG VITE_DISCORD_CLIENT_ID

ENV VITE_API_ORIGIN=$VITE_API_ORIGIN
ENV VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID

WORKDIR /app/apps/activity

RUN bun run build

FROM nginx:1.27-alpine

COPY deploy/nginx/activity.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/activity/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
