const dns = require('dns');
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.join(__dirname, '.env') });

dns.setDefaultResultOrder('ipv4first');

const dbSettings = {
  host: String(process.env.DB_HOST || '127.0.0.1').trim(),
  port: Number(process.env.DB_PORT) || 3306,
  user: String(process.env.DB_USER || 'root').trim(),
  password: process.env.DB_PASSWORD || '',
  database: String(process.env.DB_NAME || 'enquiry_system').trim(),
};

const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';
const dialectOptions = {};
if (useSsl) {
  dialectOptions.ssl = {
    require: true,
    rejectUnauthorized: false,
    servername: dbSettings.host,
  };
  if (process.env.DB_SSL_CA) {
    dialectOptions.ssl.ca = fs.readFileSync(process.env.DB_SSL_CA);
    dialectOptions.ssl.rejectUnauthorized = true;
  }
}

const sequelizeOptions = {
  host: dbSettings.host,
  port: dbSettings.port,
  dialect: 'mysql',
  logging: false,
  dialectOptions,
};

const sequelize = new Sequelize(
  dbSettings.database,
  dbSettings.user,
  dbSettings.password,
  {
    ...sequelizeOptions,
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
);

async function ensureDatabase() {
  if (String(process.env.DB_SKIP_CREATE || '').toLowerCase() === 'true') {
    return;
  }

  const admin = new Sequelize('', dbSettings.user, dbSettings.password, {
    ...sequelizeOptions,
  });

  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbSettings.database}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await admin.close();
  }
}

async function authenticateWithRetry(attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await sequelize.authenticate();
      return;
    } catch (error) {
      lastError = error;
      const code = error?.parent?.code || error?.original?.code || error.name;
      const retryable = ['ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET'].includes(code)
        || error.name === 'SequelizeHostNotFoundError'
        || error.name === 'SequelizeConnectionError';
      if (!retryable || attempt === attempts) {
        throw error;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 750 * attempt);
      });
    }
  }
  throw lastError;
}

async function initDatabase() {
  await ensureDatabase();
  const bcrypt = require('bcryptjs');
  const models = require('../models');
  await authenticateWithRetry();
  await sequelize.sync({ alter: true });
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const [admin] = await models.User.findOrCreate({
    where: { email: 'admin@enquiry.local' },
    defaults: {
      tenantId: null,
      name: 'Agency Super Admin',
      email: 'admin@enquiry.local',
      mobile: '9999999999',
      role: 'agency_super_admin',
      passwordHash: await bcrypt.hash(adminPassword, 10),
      status: 'active',
    },
  });
  if (!admin.passwordHash) {
    await admin.update({ passwordHash: await bcrypt.hash(adminPassword, 10) });
  }
}

module.exports = {
  sequelize,
  dbSettings,
  initDatabase,
};
