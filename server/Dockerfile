# syntax=docker/dockerfile:1.7

FROM node:20-bullseye-slim

# Work at /app
WORKDIR /app

# Use the package.json that lives in /server
COPY server/package*.json ./

# Install server deps (creates /app/node_modules)
RUN npm ci --omit=dev --no-audit --no-fund

# Copy the server source into /app/server
COPY server ./server

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Start your app
CMD ["node", "server/index.js"]