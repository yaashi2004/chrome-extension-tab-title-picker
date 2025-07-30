# 🔗 LinkedIn Profile Scraper - Chrome Extension + Express Backend

## 📌 Task 2: Interacting with Page and Express Backend

This project is a Chrome Extension that takes LinkedIn profile URLs from the user, opens each profile one-by-one, scrapes key public information, and sends it to a Node.js + Express backend where it is stored in a database using Sequelize ORM.

---

## 🛠️ Tech Stack

- Frontend: **Chrome Extension (JavaScript)**
- Backend: **Node.js + Express**
- ORM: **Sequelize**
- Database:**SQLite**

---

## 🚀 Features

- Input and parse multiple LinkedIn profile URLs (minimum 3)
- Opens each LinkedIn profile in a new tab automatically
- Scrapes the following public data from each profile:
  - Full Name
  - Profile URL
  - About Section
  - Bio Line
  - Location
  - Follower Count
  - Connection Count
- Sends scraped data to backend API
- Stores data in a structured relational database
- All code is version-controlled and uploaded on GitHub

---


---

## 🧪 How It Works

1. User pastes 3+ LinkedIn profile URLs into the extension popup.
2. On clicking the "Start" button:
   - The extension opens each profile URL in a new tab.
   - Content script automatically scrapes public profile info.
   - The scraped data is sent to the backend API (`POST /api/profile`).
3. Backend API receives the data and stores it in the database.
4. Data is ready for any future use like dashboards, analysis, etc.

---

## 🛠️ Backend Setup (Express + Sequelize)


cd backend
npm install
# Set up your DB credentials in .env
node app.js

 -----


## 🧩 Chrome Extension Setup

Go to chrome://extensions/

Enable Developer Mode

Click "Load unpacked"

Select the extension/ folder