import { InboundMessage } from '../models/index.js';

export async function getInboundMessages(req, res) {
  try {
    const messages = await InboundMessage.findAll({
      attributes: [
        'id',
        'source',
        'customerName',
        'customerNumber',
        'message',
        'adId',
        'campaignId',
        'tenantId',
        'phoneNumberId',
        'status',
        'receivedAt',
      ],
      order: [['receivedAt', 'DESC']],
      limit: 100,
    });

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error('Get inbound messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch inbound messages',
    });
  }
}
