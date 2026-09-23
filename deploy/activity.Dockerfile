FROM node:22-alpine AS deps
RUN npm install -g pnpm@11.10.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages
RUN HUSKY=0 pnpm install --filter 'marquinhos-activity-client...' --frozen-lockfile

FROM oven/bun:1.4.2-alpine AS builder
WORKDIR /app
COPY --from=deps /app /app
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
