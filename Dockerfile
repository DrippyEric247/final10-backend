# ✅ Playwright image already has Chromium + fonts + deps installed
FROM mcr.microsoft.com/playwright:v1.46.1-jammy

WORKDIR /app

# Install only prod deps for a smaller image
COPY package*.json ./
RUN --mount=type=cache,id=npm-cache-{{.RunID}},target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

# Copy the rest
COPY . .

# Env + port
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# If you use Playwright at runtime, browsers are already present here:
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Start your server (uses your "start" script)
CMD ["npm", "start"]
