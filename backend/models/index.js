const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Setup database connection
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../database/linkedin_profiles.db'),
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

// Import models
const db = { sequelize };
db.Profile = require('./profile')(sequelize, DataTypes);

// Initialize database and sync models
const initializeDatabase = async () => {
  try {
    console.log('🔄 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connected');

    console.log('🔄 Synchronizing models...');
    // Create tables if they don't exist; do not alter existing schema or create backups
    await sequelize.sync({ alter: false });
    console.log('✅ Models synchronized');
    return true;
  } catch (err) {
    console.error('❌ Database init failed:', err);
    return false;
  }
};

module.exports = { ...db, initializeDatabase };
