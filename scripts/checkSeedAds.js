import '../config/loadEnv.js';
import { connectDatabase } from '../config/db.config.js';
import { Ad, InboundMessage, User } from '../models/index.js';

await connectDatabase();

const ads = await Ad.findAll({ raw: true });
const messages = await InboundMessage.findAll({
  where: { adId: '120330000012345678' },
  raw: true,
});
const users = await User.findAll({
  attributes: ['id', 'name', 'email', 'role', 'tenantId', 'status'],
  raw: true,
});

console.log('ADS', JSON.stringify(ads, null, 2));
console.log('MESSAGES', messages.length, messages.map((m) => ({
  id: m.id,
  tenantId: m.tenantId,
  adId: m.adId,
  receivedAt: m.receivedAt,
})));
console.log('USERS', JSON.stringify(users, null, 2));
process.exit(0);
