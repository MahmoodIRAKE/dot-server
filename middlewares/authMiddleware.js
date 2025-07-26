const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                error: 'Access denied. No token provided or invalid format.' 
            });
        }

        // Extract token from "Bearer <token>"
        const token = authHeader.substring(7);

        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Access denied. No token provided.' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Check if user still exists and is active
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ 
                success: false,
                error: 'User not found.' 
            });
        }

        if (!user.isActive) {
            return res.status(401).json({ 
                success: false,
                error: 'Account is deactivated.' 
            });
        }

        // Add user info to request
        req.user = {
            userId: user._id,
            username: user.username,
            role: user.role,
            fullName: user.fullName,
            clientId: user.clientId
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid token.' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                error: 'Token expired.' 
            });
        }

        res.status(500).json({ 
            success: false,
            error: 'Internal server error.' 
        });
    }
};

module.exports = authMiddleware;
