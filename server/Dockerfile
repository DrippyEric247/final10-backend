# syntax=docker/dockerfile:1.7
FROM node:20-bullseye-slim
WORKDIR /app

# Copy package files from this folder
COPY package*.json ./

# Install production dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

# Copy the rest of your server code
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]

    
