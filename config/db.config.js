const dns = require('dns');
const { Sequelize } = require('sequelize');

dns.setDefaultResultOrder('ipv4first');

let sequelizeInstance = null;

function getSequelize() {
  if (sequelizeInstance) {
    return sequelizeInstance;
  }

  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 3306);
  const username = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host) {
    throw new Error('DB_HOST is not configured');
  }

  if (!username) {
    throw new Error('DB_USER is not configured');
  }

  if (!password) {
    throw new Error('DB_PASSWORD is not configured');
  }

  if (!database) {
    throw new Error('DB_NAME is not configured');
  }

  sequelizeInstance = new Sequelize(
    database,
    username,
    password,
    {
      host,
      port,
      dialect: 'mysql',
      logging: false,

      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },

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
    }
  );

  return sequelizeInstance;
}

async function connectDatabase() {
  const db = getSequelize();

  await db.authenticate();

  console.log('Database connected successfully');

  return db;
}

async function testDatabaseConnection() {
  return connectDatabase();
}

function getDbSettings() {
  return {
    host: process.env.DB_HOST || '',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || '',
    database: process.env.DB_NAME || '',
  };
}

module.exports = {
  getSequelize,
  connectDatabase,
  testDatabaseConnection,
  getDbSettings,
};