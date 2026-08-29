import express from 'express';
import {
  signup,
  signin,
  sendOtp,
  resendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
} from '../controller/authController.js';

const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Auth router is working' });
});

router.post('/signup', signup);
router.post('/signin', signin);
router.post('/send-otp', sendOtp);
router.post('/resend-otp', resendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
