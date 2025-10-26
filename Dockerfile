# syntax=docker/dockerfile:1.7

# --- deps layer ---
FROM node:20-bullseye-slim AS deps
WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install dependencies with proper cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

# --- runtime layer ---
FROM node:20-bullseye-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy server code
COPY server/ .

CMD ["npm", "start"]
    
    
