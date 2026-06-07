# Boosters web (Next.js PWA). Build context = repo root.
#   docker build -f apps/web/Dockerfile -t boosters-web .
# Public env (NEXT_PUBLIC_*) is baked at build time — pass via --build-arg or a
# root .env present at build, then provide server env at runtime.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @boosters/db generate \
  && pnpm --filter "@boosters/web..." build

FROM node:22-slim AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
