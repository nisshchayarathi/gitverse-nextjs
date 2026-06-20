# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Common runtime/build dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      openssl \
    && rm -rf /var/lib/apt/lists/*


FROM base AS deps

# Install dependencies (incl. dev deps for build)
COPY package.json package-lock.json* ./
RUN npm ci --include=dev


FROM base AS builder

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js and generate Prisma client
RUN npm run build

# Keep only production deps (keeps generated Prisma client artifacts too)
RUN npm prune --omit=dev


FROM base AS runner

STOPSIGNAL SIGTERM

# `git` is required at runtime for repository analysis (git clone/log/ls-files)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      git \
      openssh-client \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
  PORT=8080
EXPOSE 8080

# Copy runtime assets
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Compile background worker in the runner stage so it always runs
# even when the builder layer is served from cache and dist-worker/
# is no longer committed in the repository.
RUN npm run build:worker

CMD ["npm", "start"]
