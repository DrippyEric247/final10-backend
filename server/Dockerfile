# syntax=docker/dockerfile:1.7
FROM node:20-bullseye-slim AS deps
WORKDIR /app/server
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-bullseye-slim
WORKDIR /app/server
# bring node_modules built above
COPY --from=deps /app/server/node_modules ./node_modules
# copy server source from current build context
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
