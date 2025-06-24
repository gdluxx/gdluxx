FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN mkdir -p data && chown 1000:1000 data

RUN pnpm build

FROM node:20-slim AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=builder --chown=1000:1000 /app/build ./build
COPY --from=builder --chown=1000:1000 /app/static ./static
COPY --from=builder --chown=1000:1000 /app/package.json ./package.json
COPY --from=builder --chown=1000:1000 /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=1000:1000 /app/src/lib/server/schema.sql ./schema.sql

RUN pnpm install --frozen-lockfile --prod && \
    pnpm store prune && \
    rm -rf /root/.cache /tmp/* /var/cache/apt/*

ENV NODE_ENV=production
ENV PORT=7755
ENV HOST=0.0.0.0

USER 1000

EXPOSE 7755

VOLUME ["/app/data"]

STOPSIGNAL SIGTERM

CMD ["node", "build/index.js"]