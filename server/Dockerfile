# ✅ Playwright image already has Chromium + fonts + deps installed
FROM mcr.microsoft.com/playwright:v1.46.1-jammy

# Make npm faster & more tolerant on CI networks
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-timeout 600000

ENV NODE_VERSION=20.18.1
WORKDIR /app

# Install deps with cache to avoid repeated downloads
COPY package*.json ./
RUN --mount=type=cache,id=final10-npm,target=/root/.npm npm install --omit=dev

# Copy app code last (keeps cache warm)
COPY . .

# Env + port
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Playwright browsers are already here:
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Start your server (uses your "start" script)
CMD ["npm", "start"]
