/**
 * Static checks for organization refactor (no DB/Firebase required).
 * Run: node scripts/verifyCodebase.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;

function fail(msg) {
    console.error('FAIL:', msg);
    failed++;
}

function ok(msg) {
    console.log('OK:', msg);
}

const codeFiles = [
    'models/Organization.js',
    'models/User.js',
    'models/Order.js',
    'utils/organizationAccess.js',
    'middlewares/authMiddleware.js',
    'controllers/clientController.js',
    'controllers/adminController.js',
    'routes/adminRoutes.js'
];

for (const file of codeFiles) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) fail(`Missing ${file}`);
    else ok(`Found ${file}`);
}

const forbiddenInJs = ['clientId'];
for (const file of codeFiles) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    for (const term of forbiddenInJs) {
        if (content.includes(term)) {
            fail(`${file} still references "${term}"`);
        }
    }
}

const { clientOrdersFilter, clientCanAccessOrder } = require('../utils/organizationAccess');

const orgId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';
const otherUser = '507f1f77bcf86cd799439013';

const filter = clientOrdersFilter({ userId, organizationId: orgId });
if (filter.organizationId?.toString() !== orgId) {
    fail('clientOrdersFilter should filter by organizationId');
} else {
    ok('clientOrdersFilter uses organizationId');
}

const legacyFilter = clientOrdersFilter({ userId, organizationId: null });
if (!legacyFilter.userID || legacyFilter.userID.toString() !== userId) {
    fail('clientOrdersFilter legacy fallback');
} else {
    ok('clientOrdersFilter legacy fallback');
}

const order = { organizationId: orgId, userID: otherUser };
if (!clientCanAccessOrder({ userId, organizationId: orgId }, order)) {
    fail('clientCanAccessOrder same org');
} else {
    ok('clientCanAccessOrder same org');
}

const ownLegacy = { userID: userId };
if (!clientCanAccessOrder({ userId, organizationId: orgId }, ownLegacy)) {
    fail('clientCanAccessOrder own legacy order');
} else {
    ok('clientCanAccessOrder own legacy order');
}

const otherOrder = { organizationId: '507f1f77bcf86cd799439099', userID: userId };
if (clientCanAccessOrder({ userId, organizationId: orgId }, otherOrder)) {
    fail('clientCanAccessOrder should deny other org');
} else {
    ok('clientCanAccessOrder denies other org');
}

require('../models/Organization');
require('../models/User');
require('../models/Order');
ok('Mongoose models load');

if (failed > 0) {
    console.error(`\n${failed} check(s) failed.`);
    process.exit(1);
}
console.log('\nAll checks passed.');
