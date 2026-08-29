const dns = require('dns');
const { Sequelize } = require('sequelize');

dns.setDefaultResultOrder('ipv4first');

let sequelizeInstance = null;
let connectionPromise = null;

/**
 * Read DB configuration from environment variables.
 */
function getDbSettings() {
  return {
    host: String(process.env.DB_HOST || '').trim(),
    port: Number(process.env.DB_PORT || 3306),
    user: String(process.env.DB_USER || '').trim(),
    password: String(process.env.DB_PASSWORD || ''),
    database: String(process.env.DB_NAME || '').trim(),

    ssl:
      String(process.env.DB_SSL || 'true')
        .trim()
        .toLowerCase() === 'true',
  };
}

/**
 * Validate DB environment variables.
 */
function validateDbSettings(settings) {
  const missing = [];

  if (!settings.host) {
    missing.push('DB_HOST');
  }

  if (!settings.port || Number.isNaN(settings.port)) {
    missing.push('DB_PORT');
  }

  if (!settings.user) {
    missing.push('DB_USER');
  }

  if (!settings.password) {
    missing.push('DB_PASSWORD');
  }

  if (!settings.database) {
    missing.push('DB_NAME');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing database environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Create Sequelize instance only when it is actually needed.
 */
function getSequelize() {
  if (sequelizeInstance) {
    return sequelizeInstance;
  }

  const settings = getDbSettings();

  validateDbSettings(settings);

  const options = {
    host: settings.host,
    port: settings.port,

    dialect: 'mysql',

    logging: false,

    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },

    define: {
      underscored: true,
      timestamps: true,

      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  };

  // Aiven MySQL normally requires SSL
  if (settings.ssl) {
    options.dialectOptions = {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },

      connectTimeout: 30000,
    };
  }

  sequelizeInstance = new Sequelize(
    settings.database,
    settings.user,
    settings.password,
    options
  );

  return sequelizeInstance;
}

/**
 * Connect/authenticate with the database.
 *
 * connectionPromise prevents multiple simultaneous
 * authenticate() calls during a Vercel cold start.
 */
async function connectDatabase() {
  const sequelize = getSequelize();

  if (!connectionPromise) {
    connectionPromise = sequelize
      .authenticate()
      .then(() => {
        console.log('Database connected successfully');

        return sequelize;
      })
      .catch((error) => {
        // Allow another connection attempt later
        connectionPromise = null;

        console.error('Database connection failed:', {
          name: error.name,
          message: error.message,

          code:
            error?.original?.code ||
            error?.parent?.code ||
            null,
        });

        throw error;
      });
  }

  await connectionPromise;

  return sequelize;
}

/**
 * Test database connection.
 */
async function testDatabaseConnection() {
  return connectDatabase();
}

/**
 * Close connection.
 *
 * Usually you should NOT call this after every
 * Vercel request because connection reuse is useful.
 */
async function closeDatabase() {
  if (!sequelizeInstance) {
    return;
  }

  try {
    await sequelizeInstance.close();

    console.log('Database connection closed');
  } finally {
    sequelizeInstance = null;
    connectionPromise = null;
  }
}

module.exports = {
  getSequelize,
  connectDatabase,
  testDatabaseConnection,
  getDbSettings,
  closeDatabase,
};