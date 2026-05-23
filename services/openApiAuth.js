const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function extractBearerToken(req) {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7) || null;
}

function generateClientToken(user) {
    return jwt.sign(
        {
            userId: user._id,
            username: user.username,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

async function authenticateClientByCredentials(phoneNumber, password) {
    if (!phoneNumber || !password) {
        return {
            error: 'phoneNumber and password are required',
            status: 400
        };
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
        return { error: 'Invalid credentials', status: 401 };
    }
    if (!user.isActive) {
        return { error: 'Account is deactivated', status: 401 };
    }
    if (user.role !== 'client') {
        return { error: 'Only client accounts can use the Open API', status: 403 };
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
        return { error: 'Invalid credentials', status: 401 };
    }

    return { user };
}

async function authenticateClientByToken(token) {
    if (!token) {
        return {
            error: 'Access denied. No token provided or invalid format.',
            status: 401
        };
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return { error: 'User not found', status: 401 };
        }
        if (!user.isActive) {
            return { error: 'Account is deactivated', status: 401 };
        }
        if (user.role !== 'client') {
            return { error: 'Only client accounts can use the Open API', status: 403 };
        }
        return { user };
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { error: 'Token expired', status: 401 };
        }
        if (error.name === 'JsonWebTokenError') {
            return { error: 'Invalid token', status: 401 };
        }
        throw error;
    }
}

/**
 * Resolve client user from Bearer token or phoneNumber + password in body.
 */
async function resolveOpenApiClient(req) {
    const token = extractBearerToken(req);
    if (token) {
        return authenticateClientByToken(token);
    }

    const { phoneNumber, password } = req.body;
    if (phoneNumber && password) {
        return authenticateClientByCredentials(phoneNumber, password);
    }

    return {
        error: 'Authentication required: use Authorization Bearer <token> or send phoneNumber and password in the request body',
        status: 401
    };
}

function formatOpenApiUser(user) {
    return {
        userId: user._id,
        username: user.username,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        organizationCode: user.organizationCode,
        organizationId: user.organizationId
    };
}

module.exports = {
    JWT_SECRET,
    extractBearerToken,
    generateClientToken,
    authenticateClientByCredentials,
    authenticateClientByToken,
    resolveOpenApiClient,
    formatOpenApiUser
};
