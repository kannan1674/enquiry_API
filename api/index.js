import mysql2 from 'mysql2';
import { handleMetaVerify } from '../services/metaVerify.js';
import { applyCorsHeaders } from '../config/cors.js';

void mysql2;

function requestPath(req) {
  const raw = req.url || '/';
  try {
    return new URL(raw, `https://${req.headers.host || 'localhost'}`).pathname;
  } catch {
    return String(raw).split('?')[0];
  }
}

function requestQuery(req) {
  const raw = req.url || '';
  try {
    return new URL(raw, `https://${req.headers.host || 'localhost'}`).searchParams;
  } catch {
    return new URLSearchParams(raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '');
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyCorsHeaders(req, res);
    res.statusCode = 204;
    res.end();
    return;
  }

  const path = requestPath(req);
  const isWebhook = path === '/api/whatsapp/webhook' || path === '/api/meta/webhook';

  if (req.method === 'GET' && isWebhook) {
    const query = requestQuery(req);
    const result = handleMetaVerify({
      mode: query.get('hub.mode'),
      token: query.get('hub.verify_token'),
      challenge: query.get('hub.challenge'),
    });

    if (result.ok) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end(result.challenge);
      return;
    }

    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Webhook verification failed');
    return;
  }

  applyCorsHeaders(req, res);
  const { default: app } = await import('../app.js');
  return app(req, res);
}
