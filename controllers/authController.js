const jwt = require('jsonwebtoken');
const User = require('../models/User');
const smsService = require('../services/smsService');
const verificationCache = require('../services/verificationCache');

/**
 * Generate JWT token
 * @param {Object} user - User object
 * @returns {string} - JWT token
 */
const generateToken = (user) => {
    return jwt.sign(
        { 
            userId: user._id, 
            username: user.username, 
            role: user.role 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
    );
};

/**
 * Client Sign-Up Flow
 * POST /api/auth/signUp
 */
const signUp = async (req, res) => {
    try {
        const { fullName, username, password, role, clientId } = req.body;

        // Validate required fields
        if (!fullName || !username || !password || !role || !clientId) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required'
            });
        }

        // Validate role
        if (role !== 'client') {
            return res.status(400).json({
                success: false,
                error: 'Invalid role. Only client registration is allowed'
            });
        }

        // Check if username (phone) already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Phone number already registered'
            });
        }

        // Create new user
        const user = new User({
            fullName,
            username,
            password,
            role,
            clientId,
            isActive: true
        });

        await user.save();

        // Generate 2FA code
        const verificationCode = smsService.generateVerificationCode();
        verificationCache.setCode(user._id.toString(), verificationCode);

        // Send SMS with verification code
        const smsSent = await smsService.sendVerificationCode(username, verificationCode);
        
        if (!smsSent) {
            // If SMS fails, delete the user and return error
            await User.findByIdAndDelete(user._id);
            return res.status(500).json({
                success: false,
                error: 'Failed to send verification code'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Verification code sent',
            userId: user._id
        });

    } catch (error) {
        console.error('SignUp error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * 2FA Verification
 * POST /api/auth/verify
 */
const verify = async (req, res) => {
    try {
        const { userId, code } = req.body;

        // Validate required fields
        if (!userId || !code) {
            return res.status(400).json({
                success: false,
                error: 'User ID and verification code are required'
            });
        }

        // Validate verification code
        const isValidCode = verificationCache.validateCode(userId, code);
        if (!isValidCode) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired verification code'
            });
        }

        // Get user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Generate JWT token
        const token = generateToken(user);

        res.json({
            success: true,
            message: 'Verification successful',
            token,
            user: {
                _id: user._id,
                fullName: user.fullName,
                username: user.username,
                role: user.role,
                clientId: user.clientId
            }
        });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Sign-In Flow
 * POST /api/auth/login
 */
const signIn = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate required fields
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        // Find user by username (phone number)
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        // Validate password
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = generateToken(user);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                _id: user._id,
                fullName: user.fullName,
                username: user.username,
                role: user.role,
                clientId: user.clientId
            }
        });

    } catch (error) {
        console.error('SignIn error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Forgot Password - Step 1: Request Code
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
    try {
        const { username } = req.body;

        // Validate required fields
        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        // Find user by username (phone number)
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Phone number not found'
            });
        }

        // Generate reset code
        const resetCode = smsService.generateVerificationCode();
        verificationCache.setCode(user._id.toString(), resetCode);

        // Send SMS with reset code
        const smsSent = await smsService.sendVerificationCode(username, resetCode);
        
        if (!smsSent) {
            return res.status(500).json({
                success: false,
                error: 'Failed to send reset code'
            });
        }

        res.json({
            success: true,
            message: 'Reset code sent to your phone'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Reset Password - Step 2: Reset with Code
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
    try {
        const { username, code, newPassword } = req.body;

        // Validate required fields
        if (!username || !code || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Phone number, code, and new password are required'
            });
        }

        // Find user by username (phone number)
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Phone number not found'
            });
        }

        // Validate reset code
        const isValidCode = verificationCache.validateCode(user._id.toString(), code);
        if (!isValidCode) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired reset code'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successful'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

module.exports = {
    signUp,
    signIn,
    verify,
    forgotPassword,
    resetPassword
};
