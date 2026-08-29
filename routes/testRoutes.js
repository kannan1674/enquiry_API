const express = require('express');
const { ping, db } = require('../controller/testController');

const router = express.Router();

router.get('/', ping);
router.get('/db', db);

module.exports = router;
