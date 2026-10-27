FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS tools
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate

FROM tools AS builder
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates unzip curl && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://downloads.rclone.org/rclone-current-linux-amd64.zip -o /tmp/rclone.zip \
  && unzip /tmp/rclone.zip -d /tmp/rclone \
  && mv /tmp/rclone/rclone-*-linux-amd64/rclone /usr/local/bin/rclone \
  && chmod 755 /usr/local/bin/rclone \
  && rm -rf /tmp/rclone /tmp/rclone.zip
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
