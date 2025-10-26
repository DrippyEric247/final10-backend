# syntax=docker/dockerfile:1.7

# --- deps layer ---
    FROM node:20-bullseye-slim AS deps
    WORKDIR /app
    
    # Copy dependency files
    COPY package*.json ./
    
    # Install dependencies with proper cache key
    RUN npm ci --omit=dev --no-audit --no-fund
    
    # --- runtime layer ---
    FROM node:20-bullseye-slim
    WORKDIR /app
    
    ENV NODE_ENV=production
    ENV PORT=8080
    EXPOSE 8080
    
    # Copy node_modules and rest of app
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    
    CMD ["npm", "start"]
    
    
