# 🔗 LinkedIn Profile Scraper
Chrome Extension + Node.js backend for extracting and storing LinkedIn profile data.

## 🚀 Quick Start 
## Backend Setup

cd backend

npm install

npm run dev

Server runs on http://localhost:3000

## Chrome Extension Setup
Open chrome://extensions/

Enable Developer mode

Click "Load unpacked"

Select the chrome-extension folder
## 📋 How to Use
Click extension icon in Chrome

Add LinkedIn profile URLs (minimum 3)

Click "Process All Links"

Data is saved to backend automatically
## 🛠️ Tech Stack
Frontend: Chrome Extension (Vanilla JS)

Backend: Node.js, Express, SQLite, Sequelize

Features: Batch processing, CRUD operations, Search

## 📡 Main API Endpoints
POST /api/profiles - Save profile data

GET /api/profiles - Get all profiles

GET /api/profiles/stats - View statistics

POST /api/database/reset - Clear database

## 🧹 Useful Commands
## Reset database
 POST http://localhost:3000/api/database/reset

## View stats
http://localhost:3000/api/profiles/stats
## 📁 Structure
├── chrome-extension/   # Extension files
└── backend/           # API server


Made with ❤️ by Yashika

