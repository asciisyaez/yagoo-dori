# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:${PATH} \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=dependencies /workspace/node_modules ./node_modules
COPY --from=dependencies /workspace/apps/web/node_modules ./apps/web/node_modules
COPY --from=dependencies /workspace/packages/core/node_modules ./packages/core/node_modules
COPY . .
RUN pnpm build

FROM ${NODE_IMAGE} AS runner
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=dev
ARG SOURCE_URL=https://github.com/asciisyaez/yagoo-dori
LABEL org.opencontainers.image.title="Yagoo-dori" \
      org.opencontainers.image.description="Noncommercial hololive Dreams research fansite" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.licenses="UNLICENSED"

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app

COPY --from=builder --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /workspace/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]
CMD ["node", "apps/web/server.js"]
