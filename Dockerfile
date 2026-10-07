# syntax=docker/dockerfile:1
# bun is used only as a fast package manager; the app itself still runs on Node.
FROM oven/bun:1-slim AS bun

# --- Build the static frontend ---
FROM node:20-slim AS frontend-build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

# --- Backend runtime, serving the built frontend ---
FROM node:20-slim AS backend
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY backend/package.json backend/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "src/server.js"]
