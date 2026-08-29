import express from 'express';
import { getInboundMessages } from '../controller/inboundMessageController.js';

const router = express.Router();

router.get('/', getInboundMessages);

export default router;
