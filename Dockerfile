ARG PNPM_VERSION=11.3.0
ARG RUNTIME=runtime-base

FROM node:24-slim AS builder

LABEL org.opencontainers.image.source=https://github.com/gdluxx/gdluxx

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN mkdir -p data && chown 1000:1000 data

RUN pnpm build

FROM node:24-slim AS production-deps

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate && \
    apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod && \
    pnpm store prune && \
    rm -rf /root/.cache /tmp/*

FROM node:24-slim AS runtime-base

FROM runtime-base AS runtime-ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/cache/apt/* /var/lib/apt/lists/*

FROM ${RUNTIME} AS runner

WORKDIR /app

COPY --from=builder --chown=1000:1000 /app/build ./build
COPY --from=builder --chown=1000:1000 /app/static ./static
COPY --from=builder --chown=1000:1000 /app/package.json ./package.json
COPY --from=builder --chown=1000:1000 /app/src/lib/server/schema.sql ./schema.sql
COPY --from=production-deps /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=7755
ENV HOST=0.0.0.0

USER 1000

EXPOSE 7755

VOLUME ["/app/data"]

STOPSIGNAL SIGTERM

CMD ["sh", "-c", "[ -w /app/data ] || (echo 'ERROR: /app/data not writable' && exit 1) && if [ -n \"$DOWNLOAD_PATH\" ]; then mkdir -p \"$DOWNLOAD_PATH\" && [ -w \"$DOWNLOAD_PATH\" ] || (echo \"ERROR: DOWNLOAD_PATH ($DOWNLOAD_PATH) is not writable or could not be created\" && exit 1); fi && node build/index.js"]
