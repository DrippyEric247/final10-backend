# syntax=docker/dockerfile:1.7
FROM node:20-bullseye-slim
WORKDIR /app

# copy only the server's package files first
COPY server/package*.json server/

# install deps inside server folder
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund --prefix server

# copy rest of the server code
COPY server/ server/

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]

    
    
