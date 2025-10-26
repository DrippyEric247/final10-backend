FROM node:22.17.0-bullseye-slim AS deps
WORKDIR /app

COPY package*.json .npmrc ./

RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22.17.0-bullseye-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

COPY --from=deps /app/node_modules ./node_modules
COPY . .

CMD ["npm", "start"]