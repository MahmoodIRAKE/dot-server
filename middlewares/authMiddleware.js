const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ERROR_CODES, sendError } = require('../utils/httpErrors');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendError(
                res,
                401,
                ERROR_CODES.UNAUTHENTICATED,
                'Access denied. No token provided or invalid format.'
            );
        }

        const token = authHeader.substring(7);

        if (!token) {
            return sendError(
                res,
                401,
                ERROR_CODES.UNAUTHENTICATED,
                'Access denied. No token provided.'
            );
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

        const user = await User.findById(decoded.userId);
        if (!user) {
            return sendError(res, 401, ERROR_CODES.UNAUTHENTICATED, 'User not found.');
        }

        if (!user.isActive) {
            return sendError(res, 401, ERROR_CODES.ACCOUNT_DEACTIVATED, 'Account is deactivated.');
        }

        req.user = {
            userId: user._id,
            username: user.username,
            role: user.role,
            fullName: user.fullName,
            organizationCode: user.organizationCode,
            organizationId: user.organizationId || null
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);

        if (error.name === 'TokenExpiredError') {
            return sendError(res, 401, ERROR_CODES.TOKEN_EXPIRED, 'Token expired.');
        }

        if (error.name === 'JsonWebTokenError') {
            return sendError(res, 401, ERROR_CODES.TOKEN_INVALID, 'Invalid token.');
        }

        return sendError(res, 500, ERROR_CODES.INTERNAL_ERROR, 'Internal server error.');
    }
};

module.exports = authMiddleware;
