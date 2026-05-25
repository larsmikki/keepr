FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY server/ server/
COPY client/ client/
RUN npm run build -w client
RUN npm run build -w server

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci -w server --omit=dev

COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/server/src/db/migrations server/dist/db/migrations
COPY --from=builder /app/client/dist client/dist

RUN apk add --no-cache su-exec wget \
  && mkdir -p /app/vault \
  && chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3110
ENV VAULT_ROOT=/app/vault

EXPOSE 3110

HEALTHCHECK --interval=5m --timeout=5s --start-period=90s --retries=3 \
  CMD wget --spider -q http://localhost:3110/api/health || exit 1

ENTRYPOINT ["/bin/sh", "-c", "chown -R node:node /app/vault && exec su-exec node node server/dist/index.js"]
