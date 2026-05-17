# Multi-stage build for production-grade Next.js deployment
FROM node:20-alpine AS base

# 1. Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package configuration
COPY package.json package-lock.json* ./

# Install npm dependencies securely
RUN npm ci --legacy-peer-deps

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set dynamic environment variable placeholders for build time
ENV NEXT_TELEMETRY_DISABLED 1
ENV DATABASE_URL "file:./dev.db"

# Generate Prisma Client & execute production build
RUN npx prisma generate
RUN npm run build

# 3. Production runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN addsystemuser --system --uid 1001 nextjs

# Copy built public files and server bundles
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/dev.db ./dev.db

# Automatically leverage output trace to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# Ensure the app can write to the SQLite database
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Execute database migration and start the server
CMD ["npm", "run", "start"]
