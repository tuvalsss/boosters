# Boosters background worker (BullMQ). Build context = repo root.
#   docker build -f apps/worker/Dockerfile -t boosters-worker .
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @boosters/db generate \
  && pnpm --filter "@boosters/worker..." build

FROM node:22-slim AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]
