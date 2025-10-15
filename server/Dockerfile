# syntax=docker/dockerfile:1.7

# --- deps layer ---
    FROM node:20-bullseye-slim AS deps
    WORKDIR /app
    
    # Only copy the manifests so we can cache installs
    COPY package*.json ./
    
    # Fast, reproducible install + cache
    RUN --mount=type=cache,target=/root/.npm \
        npm ci --omit=dev --no-audit --no-fund
    
    # --- runtime image ---
    FROM node:20-bullseye-slim
    WORKDIR /app
    
    ENV NODE_ENV=production
    ENV PORT=8080
    EXPOSE 8080
    
    # Bring in node_modules from deps layer
    COPY --from=deps /app/node_modules ./node_modules
    
    # Now copy the rest of the server code (small context if path is correct)
    COPY . .
    
    # Start your server (uses package.json "start")
    CMD ["npm", "start"]
    
