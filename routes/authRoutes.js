const express = require('express');
const {
    signUp,
    signIn,
    verify,
    forgotPassword,
    resetPassword,
} = require('../controllers/authController');

const router = express.Router();

// Public authentication routes
router.post('/signUp', signUp);           // Client registration
router.post('/verify', verify);           // 2FA verification
router.post('/login', signIn);            // User login
router.post('/forgot-password', forgotPassword); // Request password reset
router.post('/reset-password', resetPassword);   // Reset password with code

module.exports = router;
