const { InboundMessage } = require('../models');
const { connectDatabase } = require('../config/db.config');

const getInboundMessages = async (req, res) => {
  try {
    await connectDatabase();
    const messages = await InboundMessage.findAll({
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
};

module.exports = { getInboundMessages };
