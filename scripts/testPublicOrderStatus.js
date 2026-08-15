/**
 * Tests for private-order public status links (no live DB required).
 * Run: node scripts/testPublicOrderStatus.js
 */
const fs = require('fs');
const path = require('path');
const {
    generateToken,
    formatPublicLink,
    formatPublicStatus,
    ensurePublicLink,
    regeneratePublicLink,
    revokePublicLink,
    getPublicStatusByToken,
    PUBLIC_PATH_PREFIX
} = require('../services/publicOrderStatus');

let failed = 0;

function fail(msg) {
    console.error('FAIL:', msg);
    failed++;
}

function ok(msg) {
    console.log('OK:', msg);
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        fail(`${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    } else {
        ok(msg);
    }
}

function assert(condition, msg) {
    if (!condition) fail(msg);
    else ok(msg);
}

// --- token generation ---
{
    const a = generateToken();
    const b = generateToken();
    assert(typeof a === 'string' && a.length === 48, 'token length 48 hex chars');
    assert(a !== b, 'tokens are unique');
    assert(/^[a-f0-9]+$/.test(a), 'token is hex');
}

// --- safe public DTO (no sensitive fields) ---
{
    const dto = formatPublicStatus({
        orderNumber: 42,
        status: 'in progress',
        customerStatus: 'in_production',
        customerFullName: 'John Doe',
        requiredDeliveryDate: '2026-07-01',
        updatedAt: '2026-08-02T10:00:00.000Z',
        customerPhoneNumber: '0501234567',
        customerAddress: 'secret',
        totalPrice: '9999',
        notes: 'internal',
        assignedWorkerId: 'w1'
    });
    assertEqual(dto.orderNumber, 42, 'public has orderNumber');
    assertEqual(dto.customerStatus, 'in_production', 'public has customerStatus');
    assert(!Object.prototype.hasOwnProperty.call(dto, 'status'), 'public has no internal status');
    assertEqual(dto.customerFullName, 'John Doe', 'public has name');
    assertEqual(dto.requiredDeliveryDate, '2026-07-01', 'public has delivery date');
    assert(Array.isArray(dto.images), 'public has images array');
    assertEqual(dto.images.length, 0, 'public images empty by default');
    assert(!Object.prototype.hasOwnProperty.call(dto, 'customerPhoneNumber'), 'no phone');
    assert(!Object.prototype.hasOwnProperty.call(dto, 'totalPrice'), 'no price');
    assert(!Object.prototype.hasOwnProperty.call(dto, 'notes'), 'no notes');
    assert(!Object.prototype.hasOwnProperty.call(dto, 'assignedWorkerId'), 'no worker');
}

{
    const dto = formatPublicStatus(
        { orderNumber: 1, customerStatus: 'completed' },
        [{ publicUrl: 'https://cdn.example/img.jpg', notes: 'front' }, { publicUrl: '', notes: 'skip' }]
    );
    assertEqual(dto.images.length, 1, 'skips files without publicUrl');
    assertEqual(dto.images[0].url, 'https://cdn.example/img.jpg', 'public image url');
    assertEqual(dto.images[0].notes, 'front', 'public image notes');
}

// --- link formatting ---
{
    const link = formatPublicLink({
        _id: 'oid1',
        orderNumber: 7,
        publicStatusToken: 'abc123',
        publicStatusEnabled: true
    });
    assertEqual(link.token, 'abc123', 'link token');
    assertEqual(link.publicPath, `${PUBLIC_PATH_PREFIX}/abc123`, 'link publicPath');
    assertEqual(link.enabled, true, 'link enabled');
}

(async () => {
    const privateId = '507f1f77bcf86cd799439011';
    const publicClientId = '507f1f77bcf86cd799439022';

    function makeOrderDoc(seed) {
        const doc = {
            _id: seed._id,
            orderNumber: seed.orderNumber || 1,
            isPrivateClient: seed.isPrivateClient,
            publicStatusToken: seed.publicStatusToken,
            publicStatusEnabled: seed.publicStatusEnabled || false,
            status: seed.status || 'new',
            customerStatus: seed.customerStatus || 'order_received',
            customerFullName: seed.customerFullName || 'Walk-in',
            requiredDeliveryDate: seed.requiredDeliveryDate || '2026-07-01',
            updatedAt: seed.updatedAt || '2026-08-01T00:00:00.000Z',
            customerPhoneNumber: '050',
            totalPrice: '100',
            async save() {
                return this;
            }
        };
        return doc;
    }

    let store = {
        [privateId]: makeOrderDoc({
            _id: privateId,
            orderNumber: 42,
            isPrivateClient: true
        }),
        [publicClientId]: makeOrderDoc({
            _id: publicClientId,
            orderNumber: 99,
            isPrivateClient: false
        })
    };

    const mockFiles = {
        find() {
            return {
                select() {
                    return {
                        sort() {
                            return Promise.resolve([]);
                        }
                    };
                }
            };
        }
    };

    const mockOrder = {
        findById(id) {
            return Promise.resolve(store[id] || null);
        },
        findOne(query) {
            const found = Object.values(store).find((o) => {
                if (query.publicStatusToken && o.publicStatusToken !== query.publicStatusToken) return false;
                if (query.publicStatusEnabled === true && !o.publicStatusEnabled) return false;
                return true;
            });
            return {
                select() {
                    return Promise.resolve(found || null);
                }
            };
        }
    };

    let missing = false;
    try {
        await ensurePublicLink('missing', { Order: mockOrder });
    } catch (err) {
        missing = err.status === 404;
    }
    assert(missing, 'missing order → 404');

    // ensure works for organization (non-private) orders too
    const orgCreated = await ensurePublicLink(publicClientId, { Order: mockOrder });
    assert(orgCreated.enabled, 'ensure enables link for non-private order');
    assert(typeof orgCreated.token === 'string' && orgCreated.token.length > 0, 'non-private token set');

    // ensure creates token for private order
    const created = await ensurePublicLink(privateId, { Order: mockOrder });
    assert(created.enabled, 'ensure enables link');
    assert(typeof created.token === 'string' && created.token.length > 0, 'ensure sets token');
    assertEqual(created.publicPath, `${PUBLIC_PATH_PREFIX}/${created.token}`, 'ensure publicPath');
    const firstToken = created.token;

    // ensure is stable (same token)
    const again = await ensurePublicLink(privateId, { Order: mockOrder });
    assertEqual(again.token, firstToken, 'ensure keeps stable token');

    // public lookup works
    const status = await getPublicStatusByToken(firstToken, { Order: mockOrder, Files: mockFiles });
    assert(status, 'public status found');
    assertEqual(status.orderNumber, 42, 'public status orderNumber');
    assertEqual(status.customerStatus, 'order_received', 'public status customerStatus');
    assert(Array.isArray(status.images), 'public status images array');
    assertEqual(status.images.length, 0, 'public status no images by default');
    assert(!Object.prototype.hasOwnProperty.call(status, 'status'), 'public status no internal status');
    assert(!Object.prototype.hasOwnProperty.call(status, 'totalPrice'), 'public status no price');

    const orgStatus = await getPublicStatusByToken(orgCreated.token, { Order: mockOrder, Files: mockFiles });
    assert(orgStatus, 'public status found for non-private order');
    assertEqual(orgStatus.orderNumber, 99, 'non-private public status orderNumber');

    // regenerate invalidates old token
    const regenerated = await regeneratePublicLink(privateId, { Order: mockOrder });
    assert(regenerated.token !== firstToken, 'regenerate issues new token');
    const oldGone = await getPublicStatusByToken(firstToken, { Order: mockOrder, Files: mockFiles });
    assertEqual(oldGone, null, 'old token no longer resolves');
    const newOk = await getPublicStatusByToken(regenerated.token, { Order: mockOrder, Files: mockFiles });
    assert(newOk, 'new token resolves');

    // revoke → 404
    const revoked = await revokePublicLink(privateId, { Order: mockOrder });
    assertEqual(revoked.enabled, false, 'revoke disables');
    assertEqual(revoked.token, null, 'revoke clears token');
    const afterRevoke = await getPublicStatusByToken(regenerated.token, { Order: mockOrder, Files: mockFiles });
    assertEqual(afterRevoke, null, 'revoked token → null');

    // empty token
    assertEqual(await getPublicStatusByToken('', { Order: mockOrder }), null, 'empty token → null');
    assertEqual(await getPublicStatusByToken(null, { Order: mockOrder }), null, 'null token → null');

    // routes wired
    const adminRoutes = fs.readFileSync(path.join(__dirname, '../routes/adminRoutes.js'), 'utf8');
    assert(adminRoutes.includes("'/orders/:orderId/customer-status'"), 'admin customer-status route');
    assert(adminRoutes.includes("'/orders/:orderId/public-link'"), 'admin public-link route');
    assert(adminRoutes.includes("'/orders/:orderId/public-link/regenerate'"), 'admin regenerate route');
    assert(adminRoutes.includes('revokeOrderPublicLink'), 'admin revoke wired');

    const publicRoutes = fs.readFileSync(path.join(__dirname, '../routes/publicRoutes.js'), 'utf8');
    assert(publicRoutes.includes("'/orders/status/:token'"), 'public status route');

    const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    assert(server.includes("'/api/public'"), 'server mounts /api/public');

    const orderModel = fs.readFileSync(path.join(__dirname, '../models/Order.js'), 'utf8');
    assert(orderModel.includes('publicStatusToken'), 'Order has publicStatusToken');
    assert(orderModel.includes('publicStatusEnabled'), 'Order has publicStatusEnabled');
    assert(orderModel.includes('customerStatus'), 'Order has customerStatus');

    const filesModel = fs.readFileSync(path.join(__dirname, '../models/files.js'), 'utf8');
    assert(filesModel.includes("'public'"), 'Files model allows public category');

    if (failed > 0) {
        console.error(`\n${failed} public status link check(s) failed.`);
        process.exit(1);
    }
    console.log('\nAll public order status checks passed.');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
