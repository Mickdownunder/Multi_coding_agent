#!/bin/bash

# Next.js Start Script
# Startet die generierte App im agent-workspace

set -e

echo "🚀 Starting Next.js App..."
echo ""

# Navigate to app directory
cd agent-workspace/apps/app

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo ""
fi

# Start development server
echo "🔥 Starting development server..."
npm run dev
