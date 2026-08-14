# Stage 1: Builder
FROM node:24-alpine AS builder

# Enable corepack
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . ./

# Build-time public env vars (inlined by Vite at build time)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build app
RUN pnpm build

# Stage 2: Production
FROM node:24-alpine AS production

WORKDIR /app

RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy prisma schema, config and migrations (needed for migrate deploy at runtime)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src/lib/auth/auth.ts ./src/lib/auth/auth.ts
COPY --from=builder /app/src/lib/email.ts ./src/lib/email.ts

# Regenerate Prisma client for production runtime
RUN pnpm prisma generate

# Copy built output
COPY --from=builder /app/.output ./.output

# Start the app
CMD ["node", ".output/server/index.mjs"]
