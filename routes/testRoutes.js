import express from 'express';
import { ping, db } from '../controller/testController.js';

const router = express.Router();

router.get('/', ping);
router.get('/db', db);

export default router;
