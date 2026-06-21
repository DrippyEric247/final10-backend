# syntax=docker/dockerfile:1.7
# Alternate build when Railway root directory is set to server/
FROM node:20-bullseye-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-bullseye-slim
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=512
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
