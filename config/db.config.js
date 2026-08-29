import './loadEnv.js';
import dns from 'dns';
import mysql2 from 'mysql2';
import { Sequelize } from 'sequelize';

dns.setDefaultResultOrder('ipv4first');

let sequelizeInstance = null;

export function getSequelize() {
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

  sequelizeInstance = new Sequelize(database, username, password, {
    host,
    port,
    dialect: 'mysql',
    dialectModule: mysql2,
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
  });

  return sequelizeInstance;
}

export async function connectDatabase() {
  const db = getSequelize();

  await db.authenticate();

  if (!process.env.VERCEL) {
    const { InboundMessage } = await import('../models/index.js');
    await InboundMessage.sync();
  }

  console.log('Database connected successfully');

  return db;
}

export async function testDatabaseConnection() {
  return connectDatabase();
}

export function getDbSettings() {
  return {
    host: process.env.DB_HOST || '',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || '',
    database: process.env.DB_NAME || '',
  };
}
