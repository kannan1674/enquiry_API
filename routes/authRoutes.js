const express = require('express');
const {
  signup,
  signin,
  sendOtp,
  resendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
} = require('../controller/authController');

const router = express.Router();

router.post('/signup', signup);
router.post('/signin', signin);
router.post('/send-otp', sendOtp);
router.post('/resend-otp', resendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
