# ✅ Playwright image already has Chromium + fonts + deps installed
FROM mcr.microsoft.com/playwright:v1.46.1-jammy

# Set Node version explicitly
ENV NODE_VERSION=20.18.1

WORKDIR /app

# Install only prod deps for a smaller image
COPY package*.json ./
RUN npm ci --only=production

# Copy everything else
COPY . .

# Env + port
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Playwright browsers are already here:
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Start your server (uses your "start" script)
CMD ["npm", "start"]

