const express = require('express');
const {
    signUp,
    signIn,
    verify,
    verifyForget,
    forgotPassword,
    resetPassword,
    updateProfile,
} = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// Public authentication routes
router.post('/signUp', signUp);           // Client registration
router.post('/verify', verify);           // 2FA verification
router.post('/verify-forget', verifyForget);           // 2FA verification
router.post('/login', signIn);            // User login
router.post('/forgot-password', forgotPassword); // Request password reset
router.post('/reset-password', resetPassword);   // Reset password with code

/** Any authenticated user — edit own name / phone */
router.put('/profile', authMiddleware, updateProfile);

module.exports = router;
