# Boosters API (NestJS/Fastify). Build context = repo root.
#   docker build -f apps/api/Dockerfile -t boosters-api .
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @boosters/db generate \
  && pnpm --filter "@boosters/api..." build

FROM node:22-slim AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
