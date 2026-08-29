import { getSequelize, getDbSettings } from '../config/db.config.js';

export async function ping(req, res) {
  res.json({
    success: true,
    message: 'API is reachable',
    service: 'enquiry-system-api',
    time: new Date().toISOString(),
  });
}

export async function db(req, res, next) {
  try {
    const sequelize = getSequelize();
    const dbSettings = getDbSettings();
    await sequelize.authenticate();
    const [rows] = await sequelize.query('SELECT 1 AS ok, DATABASE() AS database_name, NOW() AS server_time');
    const result = rows[0] || {};

    res.json({
      success: true,
      message: 'Database is reachable',
      host: dbSettings.host,
      port: dbSettings.port,
      database: result.database_name || dbSettings.database,
      serverTime: result.server_time,
    });
  } catch (error) {
    next(error);
  }
}
