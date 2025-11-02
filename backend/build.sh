#!/usr/bin/env bash
set -o errexit

echo "📦 Installing Node.js dependencies..."
npm install

echo "🐍 Installing Python dependencies..."
pip install --upgrade pip
pip install youtube-comment-downloader yt-dlp

echo "✅ Build complete!"
