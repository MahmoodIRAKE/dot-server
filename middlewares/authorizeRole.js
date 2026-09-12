const { ERROR_CODES } = require('../utils/httpErrors');

module.exports = function authorizeRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: insufficient role.',
                message: 'Access denied: insufficient role.',
                code: ERROR_CODES.FORBIDDEN
            });
        }
        next();
    };
};
