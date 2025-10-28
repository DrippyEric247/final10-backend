# syntax=docker/dockerfile:1.7
FROM node:20-bullseye-slim AS deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-bullseye-slim
WORKDIR /app
# bring node_modules built above
COPY --from=deps /app/server/node_modules /app/server/node_modules
# copy the actual server source
COPY server ./server

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]
