#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting Final10 deployment..."

# Check if we're in the right directory
echo "📁 Current directory: $(pwd)"
echo "📁 Directory contents:"
ls -la

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install

# Go back to root and install client dependencies
echo "📦 Installing client dependencies..."
cd ../client
npm install

# Build the client
echo "🏗️ Building client..."
npm run build

echo "✅ Build completed successfully!"
























