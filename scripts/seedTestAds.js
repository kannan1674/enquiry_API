import '../config/loadEnv.js';
import { connectDatabase } from '../config/db.config.js';
import { Ad, InboundMessage, Tenant } from '../models/index.js';

const TEST_ADS = [
  {
    adId: '120330000012345678',
    adName: 'Chairs WhatsApp ad',
    campaignId: '12033000001111',
    campaignName: 'August leads',
    dailyBudget: 200,
    lifetimeBudget: 0,
    currency: 'INR',
    status: 'ACTIVE',
  },
  {
    adId: '12033000009999',
    adName: 'Sofas WhatsApp ad',
    campaignId: '12033000002222',
    campaignName: 'August leads',
    dailyBudget: 150,
    lifetimeBudget: 0,
    currency: 'INR',
    status: 'ACTIVE',
  },
  {
    adId: '12033000008888',
    adName: 'Tables lifetime ad',
    campaignId: '12033000003333',
    campaignName: 'Lifetime promo',
    dailyBudget: 0,
    lifetimeBudget: 5000,
    currency: 'INR',
    status: 'PAUSED',
  },
];

const TEST_QUERIES = [
  { adId: '120330000012345678', campaignId: '12033000001111', name: 'Priya', number: '919800000001', daysAgo: 2, message: 'Price for office chairs?' },
  { adId: '120330000012345678', campaignId: '12033000001111', name: 'Rahul', number: '919800000002', daysAgo: 5, message: 'Do you deliver chairs to Chennai?' },
  { adId: '120330000012345678', campaignId: '12033000001111', name: 'Priya', number: '919800000001', daysAgo: 8, message: 'Need 12 chairs for office' },
  { adId: '120330000012345678', campaignId: '12033000001111', name: 'Anita', number: '919800000003', daysAgo: 12, message: 'Is this still available?' },
  { adId: '120330000012345678', campaignId: '12033000001111', name: 'Vikram', number: '919800000004', daysAgo: 18, message: 'Hi, saw your chair ad' },
  { adId: '12033000009999', campaignId: '12033000002222', name: 'Sneha', number: '919800000005', daysAgo: 3, message: 'Sofa colours available?' },
  { adId: '12033000009999', campaignId: '12033000002222', name: 'Arun', number: '919800000006', daysAgo: 9, message: '3 seater sofa price?' },
  { adId: '12033000009999', campaignId: '12033000002222', name: 'Meera', number: '919800000007', daysAgo: 15, message: 'Need sofa for living room' },
];

function receivedAt(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(11, 30, 0, 0);
  return date;
}

async function resolveTenant() {
  const existing = await Tenant.findOne({
    where: { status: 'active' },
    order: [['id', 'ASC']],
  });
  if (existing) {
    return existing;
  }

  return Tenant.create({
    clientCode: 'TEST-ADS',
    companyName: 'Test Ads Client',
    status: 'active',
    timezone: 'Asia/Kolkata',
    accountType: 'direct',
  });
}

async function seed() {
  await connectDatabase();
  const tenant = await resolveTenant();

  for (const ad of TEST_ADS) {
    await Ad.upsert({
      ...ad,
      tenantId: tenant.id,
      isTest: true,
    });
  }

  for (const query of TEST_QUERIES) {
    const externalId = `test-ad-${query.adId}-${query.number}-${query.daysAgo}`;
    const [row, created] = await InboundMessage.findOrCreate({
      where: { externalId },
      defaults: {
        clientId: tenant.id,
        source: 'whatsapp',
        externalId,
        customerName: query.name,
        customerNumber: query.number,
        message: query.message,
        whatsappMessageId: externalId,
        status: 'new',
        rawPayload: { seeded: true, adId: query.adId },
        tenantId: tenant.id,
        customerWaId: query.number,
        adId: query.adId,
        campaignId: query.campaignId,
        referralSource: 'test_ad',
        receivedAt: receivedAt(query.daysAgo),
      },
    });

    if (!created && !row.adId) {
      await row.update({
        adId: query.adId,
        campaignId: query.campaignId,
        tenantId: tenant.id,
      });
    }
  }

  const ads = await Ad.findAll({ where: { isTest: true }, order: [['id', 'ASC']] });
  console.log(`Seeded ${ads.length} test ads for tenant ${tenant.id} (${tenant.companyName})`);
  ads.forEach((ad) => {
    console.log(`  ${ad.adId}  ${ad.adName}  daily=${ad.dailyBudget}  lifetime=${ad.lifetimeBudget}`);
  });
  process.exit(0);
}

seed().catch((error) => {
  console.error('Failed to seed test ads', error);
  process.exit(1);
});
