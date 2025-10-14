# server/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app

# Copy and install dependencies with cache support
COPY package*.json ./
RUN --mount=type=cache,id=npm-cache,target=/root/.npm npm install --omit=dev

# Build the production image
FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
