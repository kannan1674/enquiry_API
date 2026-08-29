const express = require('express');
const { getInboundMessages } = require('../controller/inboundMessageController');

const router = express.Router();

router.get('/', getInboundMessages);

module.exports = router;