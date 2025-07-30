const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Database configuration
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite'),
  logging: console.log, // Show SQL queries in development
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true,
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Import Profile model
const Profile = require('./profile')(sequelize, DataTypes);

// Initialize database function
const initializeDatabase = async () => {
  try {
    console.log('🔄 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    
    console.log('🔄 Syncing database models...');
    await sequelize.sync({ alter: true }); // alter: true will update tables without dropping data
    console.log('✅ Database models synced successfully');
    
    console.log('✅ Database initialization complete');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return false;
  }
};

// Test connection function
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
};

// Sync database function
const syncDatabase = async (force = false) => {
  try {
    console.log('🔄 Syncing database...');
    await sequelize.sync({ force });
    console.log('✅ Database synced successfully');
    
    if (force) {
      console.log('⚠️  All tables were dropped and recreated');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database sync failed:', error.message);
    return false;
  }
};

// Close database connection
const closeDatabase = async () => {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database:', error.message);
  }
};

// Export everything
module.exports = {
  sequelize,
  Sequelize,
  Profile,
  initializeDatabase,  // This was missing!
  testConnection,
  syncDatabase,
  closeDatabase
};