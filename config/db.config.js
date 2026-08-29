const path = require('path');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbSettings = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'enquiry_system',
};

const sequelize = new Sequelize(
  dbSettings.database,
  dbSettings.user,
  dbSettings.password,
  {
    host: dbSettings.host,
    port: dbSettings.port,
    dialect: 'mysql',
    logging: false,
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
  const admin = new Sequelize('mysql', dbSettings.user, dbSettings.password, {
    host: dbSettings.host,
    port: dbSettings.port,
    dialect: 'mysql',
    logging: false,
  });

  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbSettings.database}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await admin.close();
}

async function initDatabase() {
  await ensureDatabase();
  const bcrypt = require('bcryptjs');
  const models = require('../models');
  await sequelize.authenticate();
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
