const { Sequelize } = require('sequelize');
const path = require('path');

// Database configuration based on environment
const config = {
  development: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', 'database.sqlite'),
    logging: console.log, // Show SQL queries in development
    define: {
      timestamps: true, // Automatically add createdAt and updatedAt
      underscored: false, // Use camelCase instead of snake_case
      freezeTableName: true, // Don't pluralize table names
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:', // In-memory database for tests
    logging: false, // Disable logging in tests
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true,
    }
  },
  production: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', 'production.sqlite'),
    logging: false, // Disable logging in production
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true,
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
};

// Get current environment
const env = process.env.NODE_ENV || 'development';
const currentConfig = config[env];

// Create Sequelize instance
const sequelize = new Sequelize(currentConfig);

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    console.log(`📊 Database: ${currentConfig.storage}`);
    console.log(`🔧 Environment: ${env}`);
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to database:', error.message);
    return false;
  }
};

// Sync database (create tables if they don't exist)
const syncDatabase = async (force = false) => {
  try {
    console.log('🔄 Syncing database...');
    await sequelize.sync({ force }); // force: true will drop existing tables
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

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
  closeDatabase,
  config: currentConfig
};