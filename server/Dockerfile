# syntax=docker/dockerfile:1.7

# --- dependencies layer ---
    FROM node:20-bullseye-slim AS deps
    WORKDIR /app
    
    COPY package*.json ./
    
    RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
        npm ci --omit=dev --no-audit --no-fund
    
    # --- production layer ---
    FROM node:20-bullseye-slim
    WORKDIR /app
    
    ENV NODE_ENV=production
    ENV PORT=8080
    EXPOSE 8080
    
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    
    CMD ["npm", "start"]
    
