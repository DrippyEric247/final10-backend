# server/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app

# Only copy the manifests first for better layer caching
COPY package*.json ./

# Install prod deps (no cache mount to avoid Railway error)
RUN npm ci --omit=dev

# -------- runtime image --------
FROM node:20-alpine
WORKDIR /app

# Bring in node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the backend
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
