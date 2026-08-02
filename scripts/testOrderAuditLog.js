/**
 * Automated tests for order audit log (no live DB required).
 * Run: node scripts/testOrderAuditLog.js
 */
const mongoose = require('mongoose');
const authorizeRole = require('../middlewares/authorizeRole');
const {
    serializeValue,
    valuesEqual,
    resolveActor,
    computeFieldChanges,
    computeCreateChanges,
    buildChangeText,
    buildLogDocuments,
    formatAuditLog,
    expandLogDocument,
    updateOrderWithAudit,
    getOrderAuditLogs
} = require('../services/orderAuditLog');

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

assertEqual(serializeValue(null), null, 'serialize null');
assertEqual(serializeValue(undefined), null, 'serialize undefined');
assertEqual(serializeValue(''), null, 'serialize empty string as null');
assertEqual(serializeValue('12'), '12', 'serialize string');
assertEqual(serializeValue(12), '12', 'serialize number');
assert(valuesEqual('12', 12), 'string "12" equals number 12');
assert(!valuesEqual('12', '112'), 'different widths not equal');

// Form sends all fields; only width changed → only width logged
{
    const existing = {
        status: 'waiting for approval',
        width: '12',
        height: '10',
        notes: null,
        totalPrice: null
    };
    const changes = computeFieldChanges(existing, {
        status: 'waiting for approval',
        width: '112',
        height: '10',
        notes: '',
        totalPrice: ''
    });
    assertEqual(changes.length, 1, 'full form → only width');
    assertEqual(changes[0].fieldName, 'width', 'field is width not status');
    assertEqual(changes[0].oldValue, '12', 'width old');
    assertEqual(changes[0].newValue, '112', 'width new');
}

{
    const changes = computeFieldChanges(
        { status: 'new', width: '12' },
        { status: 'new', width: 112 }
    );
    assertEqual(changes[0].fieldName, 'width', 'numeric width detected');
}

{
    const existing = { status: 'new', notes: 'old', height: '10' };
    const changes = computeFieldChanges(existing, {
        status: 'DONE',
        notes: 'new',
        height: '10'
    });
    assertEqual(changes.length, 2, 'two real changes');
}

{
    const changes = computeFieldChanges(
        { status: 'new', width: '12' },
        { status: 'new', width: 12 }
    );
    assertEqual(changes.length, 0, 'no false positives');
}

{
    const created = computeCreateChanges({
        status: 'new',
        customerFullName: 'Walk-in',
        notes: null
    });
    assert(created.some((c) => c.fieldName === 'status'), 'create has status');
    assert(created.every((c) => c.oldValue === null), 'create old is null');
}

{
    const actor = resolveActor({
        userId: '507f1f77bcf86cd799439045',
        fullName: 'John Smith'
    });
    assertEqual(actor.userName, 'John Smith', 'actor name');
}

{
    const docs = buildLogDocuments(
        { _id: '1', orderNumber: 7 },
        [{ fieldName: 'width', oldValue: '12', newValue: '112' }],
        { userId: 'u1', userName: 'Admin' }
    );
    assertEqual(docs.length, 1, 'one row per field');
    assertEqual(docs[0].fieldName, 'width', 'doc fieldName');
    assertEqual(docs[0].oldValue, '12', 'doc oldValue');
    assertEqual(docs[0].newValue, '112', 'doc newValue');
}

{
    const formatted = formatAuditLog({
        _id: 'abc',
        userId: 'u',
        userName: 'Admin',
        fieldName: 'width',
        oldValue: '12',
        newValue: '112',
        createdAt: 't'
    });
    assertEqual(formatted.fieldName, 'width', 'format fieldName');
    assertEqual(formatted.oldValue, '12', 'format old');
    assertEqual(formatted.newValue, '112', 'format new');
    assertEqual(formatted.text, 'width: 12 → 112', 'format text always present');
}

{
    const expanded = expandLogDocument({
        _id: 'x',
        userId: 'u',
        userName: 'A',
        changes: [{ fieldName: 'height', oldValue: '1', newValue: '2' }],
        createdAt: 't'
    });
    assertEqual(expanded.length, 1, 'legacy changes expand');
    assertEqual(expanded[0].fieldName, 'height', 'legacy field');
    assertEqual(expanded[0].text, 'height: 1 → 2', 'legacy text');
}

(async () => {
    const orderId = '507f1f77bcf86cd799439099';
    const existing = {
        _id: orderId,
        orderNumber: 99,
        status: 'new',
        width: '12',
        notes: 'old',
        toObject() {
            return {
                _id: orderId,
                orderNumber: 99,
                status: 'new',
                width: '12',
                notes: 'old'
            };
        }
    };

    const inserted = [];
    const mockOrder = {
        findById(id) {
            return Promise.resolve(id === orderId ? existing : null);
        },
        findByIdAndUpdate(id, data) {
            const set = data.$set || data;
            return Promise.resolve({ ...existing.toObject(), ...set, _id: id });
        }
    };
    const mockLog = {
        insertMany(docs) {
            inserted.push(...docs);
            return Promise.resolve(docs);
        }
    };

    const result = await updateOrderWithAudit(
        {
            orderId,
            updateData: { status: 'new', width: '112', notes: 'old' },
            actor: { userId: '507f1f77bcf86cd799439045', userName: 'Admin' }
        },
        { Order: mockOrder, OrderChangeLog: mockLog }
    );

    assertEqual(result.changes.length, 1, 'update detects only width');
    assertEqual(inserted.length, 1, 'inserts one log');
    assertEqual(inserted[0].fieldName, 'width', 'inserted field is width');
    assertEqual(inserted[0].oldValue, '12', 'inserted old');
    assertEqual(inserted[0].newValue, '112', 'inserted new');

    inserted.length = 0;
    const noChange = await updateOrderWithAudit(
        {
            orderId,
            updateData: { status: 'new', width: '12' },
            actor: { userId: '507f1f77bcf86cd799439045', userName: 'Admin' }
        },
        { Order: mockOrder, OrderChangeLog: mockLog }
    );
    assertEqual(noChange.changes.length, 0, 'unchanged → no log');
    assertEqual(inserted.length, 0, 'unchanged → no insert');

    let notFound = false;
    try {
        await updateOrderWithAudit(
            {
                orderId: 'missing',
                updateData: { width: '1' },
                actor: { userId: '507f1f77bcf86cd799439045', userName: 'Admin' }
            },
            { Order: mockOrder, OrderChangeLog: mockLog }
        );
    } catch (err) {
        notFound = err.status === 404;
    }
    assert(notFound, 'missing order → 404');

    const history = await getOrderAuditLogs(orderId, {
        Order: {
            findById() {
                return {
                    select() {
                        return Promise.resolve({ _id: orderId, orderNumber: 1052 });
                    }
                };
            }
        },
        OrderChangeLog: {
            find() {
                return {
                    sort() {
                        return {
                            lean() {
                                return Promise.resolve([
                                    {
                                        _id: 2,
                                        userId: 45,
                                        userName: 'John',
                                        fieldName: 'width',
                                        oldValue: '12',
                                        newValue: '112',
                                        createdAt: '2026-07-29T11:00:00Z'
                                    }
                                ]);
                            }
                        };
                    }
                };
            }
        }
    });
    assertEqual(history.logs[0].fieldName, 'width', 'api returns fieldName');
    assertEqual(history.logs[0].oldValue, '12', 'api returns oldValue');
    assertEqual(history.logs[0].newValue, '112', 'api returns newValue');
    assertEqual(history.logs[0].text, 'width: 12 → 112', 'api returns text');

    let nextCalled = false;
    authorizeRole('admin')(
        { user: { role: 'admin' } },
        { status() { return this; }, json() {} },
        () => { nextCalled = true; }
    );
    assert(nextCalled, 'admin allowed');

    const fs = require('fs');
    const path = require('path');
    const routes = fs.readFileSync(path.join(__dirname, '../routes/adminRoutes.js'), 'utf8');
    assert(routes.includes("'/orders/:orderId/audit-logs'"), 'audit route exists');

    delete mongoose.connection.models.OrderChangeLog;
    require('../models/OrderChangeLog');
    ok('OrderChangeLog model loads');

    assertEqual(buildChangeText([{ fieldName: 'a', oldValue: '1', newValue: '2' }]), 'a: 1 → 2', 'buildChangeText');

    if (failed > 0) {
        console.error(`\n${failed} check(s) failed.`);
        process.exit(1);
    }
    console.log('\nAll order audit log checks passed.');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
