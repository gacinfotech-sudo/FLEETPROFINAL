# Multi-stage Dockerfile for FleetPro
# Production-optimized Node.js application build with security best practices

# ============================================================================
# STAGE 1: BUILD
# ============================================================================
FROM node:20-alpine AS builder

# Install build dependencies (temporary)
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (production + dev for build tools)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript and Vite
RUN npm run build

# ============================================================================
# STAGE 2: RUNTIME
# ============================================================================
FROM node:20-alpine

# Install runtime dependencies only (minimal footprint)
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    tini

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/server ./server

# Copy monitoring and configuration
COPY --chown=nodejs:nodejs monitoring ./monitoring
COPY --chown=nodejs:nodejs scripts ./scripts

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/data && \
    chown -R nodejs:nodejs /app/logs /app/data && \
    chmod 755 /app/logs /app/data

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5050

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5050/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/sbin/dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]

# Labels for metadata
LABEL maintainer="FleetPro Team <support@fleetpro.local>"
LABEL version="1.0.0"
LABEL description="FleetPro - Production-ready fleet management system"
LABEL org.opencontainers.image.source="https://github.com/fleetpro/fleetpro"
LABEL org.opencontainers.image.documentation="https://docs.fleetpro.local"
