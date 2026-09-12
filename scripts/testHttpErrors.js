const assert = require('assert');
const {
    ERROR_CODES,
    inferErrorCode,
    isTechnicalDetail,
    sanitizeErrorBody
} = require('../utils/httpErrors');

assert.strictEqual(inferErrorCode(401, 'User not authenticated'), ERROR_CODES.UNAUTHENTICATED);
assert.strictEqual(inferErrorCode(401, 'Token expired.'), ERROR_CODES.TOKEN_EXPIRED);
assert.strictEqual(inferErrorCode(401, 'Invalid token'), ERROR_CODES.TOKEN_INVALID);
assert.strictEqual(inferErrorCode(403, 'Forbidden'), ERROR_CODES.FORBIDDEN);
assert.strictEqual(inferErrorCode(403, 'Access denied: insufficient role.'), ERROR_CODES.FORBIDDEN);
assert.strictEqual(inferErrorCode(404, 'Order not found'), ERROR_CODES.NOT_FOUND);
assert.strictEqual(inferErrorCode(400, 'All fields are required'), ERROR_CODES.VALIDATION_ERROR);
assert.strictEqual(inferErrorCode(400, 'Phone number already registered'), ERROR_CODES.CONFLICT);
assert.strictEqual(inferErrorCode(500, 'Internal server error while creating order'), ERROR_CODES.INTERNAL_ERROR);

assert.strictEqual(isTechnicalDetail('auth/phone-number-already-exists'), true);
assert.strictEqual(isTechnicalDetail('E11000 duplicate key'), true);
assert.strictEqual(isTechnicalDetail('Order not found'), false);

const leaked = sanitizeErrorBody(
    { success: false, error: 'auth/email-already-exists: The email is already used.' },
    400
);
assert.strictEqual(leaked.error, 'Request failed');
assert.strictEqual(leaked.code, ERROR_CODES.VALIDATION_ERROR);

const tagged = sanitizeErrorBody({ success: false, error: 'Order not found' }, 404);
assert.strictEqual(tagged.code, ERROR_CODES.NOT_FOUND);
assert.strictEqual(tagged.error, 'Order not found');

console.log('All httpErrors checks passed.');
