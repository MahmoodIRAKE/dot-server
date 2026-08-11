const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderChangeLog = require('../models/OrderChangeLog');

/** Business fields that may be audited. */
const AUDITED_FIELDS = [
    'customerFullName',
    'customerPhoneNumber',
    'customerAddress',
    'requiredDeliveryDate',
    'description',
    'height',
    'width',
    'jobRef',
    'notes',
    'totalPrice',
    'status',
    'customerStatus',
    'assignedWorkerId',
    'userID',
    'organizationId',
    'isPrivateClient'
];

const IGNORED_FIELDS = new Set([
    '_id',
    '__v',
    'createdAt',
    'updatedAt',
    'orderNumber',
    'orderId'
]);

function toPlainOrder(order) {
    if (!order) return {};
    if (typeof order.toObject === 'function') {
        return order.toObject({ depopulate: true, flattenMaps: true });
    }
    if (order._doc && typeof order._doc === 'object') {
        return { ...order._doc };
    }
    return { ...order };
}

function getFieldValue(order, fieldName) {
    if (!order) return undefined;
    if (typeof order.get === 'function') {
        const viaGet = order.get(fieldName);
        if (viaGet !== undefined) return viaGet;
    }
    return toPlainOrder(order)[fieldName];
}

function serializeValue(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
        if (Number.isNaN(value)) return null;
        return String(value);
    }
    if (value instanceof mongoose.Types.ObjectId) {
        return value.toString();
    }
    if (typeof value === 'object') {
        if (value._id) return String(value._id);
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value).trim();
}

function valuesEqual(a, b) {
    return serializeValue(a) === serializeValue(b);
}

function displayValue(value) {
    const serialized = serializeValue(value);
    return serialized === null ? '(empty)' : serialized;
}

/** Create logs have null oldValue — show only the initial value, not "(empty) → …". */
function formatFieldChangeText(fieldName, oldValue, newValue) {
    const oldSerialized = serializeValue(oldValue);
    const newDisplay = displayValue(newValue);
    if (oldSerialized === null) {
        return `${fieldName}: ${newDisplay}`;
    }
    return `${fieldName}: ${displayValue(oldValue)} → ${newDisplay}`;
}

function resolveActor(reqUser) {
    if (!reqUser || !reqUser.userId) {
        throw new Error('Authenticated user context is required for audit logging');
    }
    return {
        userId: reqUser.userId,
        userName: reqUser.fullName || reqUser.username || 'Unknown'
    };
}

function computeFieldChanges(existingOrder, updateData) {
    const changes = [];
    if (!updateData || typeof updateData !== 'object') {
        return changes;
    }

    for (const [fieldName, newRaw] of Object.entries(updateData)) {
        if (IGNORED_FIELDS.has(fieldName)) continue;
        if (!AUDITED_FIELDS.includes(fieldName)) continue;

        const oldRaw = getFieldValue(existingOrder, fieldName);
        if (valuesEqual(oldRaw, newRaw)) continue;

        changes.push({
            fieldName,
            oldValue: serializeValue(oldRaw),
            newValue: serializeValue(newRaw)
        });
    }
    return changes;
}

function computeCreateChanges(order) {
    const changes = [];
    for (const fieldName of AUDITED_FIELDS) {
        const serialized = serializeValue(getFieldValue(order, fieldName));
        if (serialized === null) continue;
        changes.push({
            fieldName,
            oldValue: null,
            newValue: serialized
        });
    }
    return changes;
}

function buildChangeText(changes, prefix) {
    if (!changes || changes.length === 0) return null;
    const lines = changes
        .map((c) => formatFieldChangeText(c.fieldName, c.oldValue, c.newValue))
        .join('; ');
    return prefix ? `${prefix}: ${lines}` : lines;
}

function buildLogDocuments(order, changes, actor) {
    if (!changes || changes.length === 0) return [];
    return changes.map((change) => ({
        orderId: order._id,
        orderNumber: order.orderNumber,
        userId: actor.userId,
        userName: actor.userName,
        fieldName: change.fieldName,
        oldValue: change.oldValue,
        newValue: change.newValue
    }));
}

function buildLogDocument(order, changes, actor) {
    const docs = buildLogDocuments(order, changes, actor);
    return docs[0] || null;
}

function formatAuditLog(doc) {
    const fieldName = doc.fieldName ?? null;
    const oldValue = doc.oldValue ?? null;
    const newValue = doc.newValue ?? null;
    const text = fieldName
        ? formatFieldChangeText(fieldName, oldValue, newValue)
        : (doc.text || null);

    return {
        id: doc._id,
        userId: doc.userId,
        userName: doc.userName,
        fieldName,
        oldValue,
        newValue,
        text,
        createdAt: doc.createdAt
    };
}

function expandLogDocument(doc) {
    if (doc.fieldName) {
        return [formatAuditLog(doc)];
    }

    if (Array.isArray(doc.changes) && doc.changes.length > 0) {
        return doc.changes.map((change, index) => formatAuditLog({
            _id: `${doc._id}-${index}`,
            userId: doc.userId,
            userName: doc.userName,
            fieldName: change.fieldName,
            oldValue: change.oldValue,
            newValue: change.newValue,
            createdAt: doc.createdAt
        }));
    }

    if (doc.text) {
        return [formatAuditLog(doc)];
    }

    return [];
}

/**
 * Save order + write one change-log row per changed field.
 * No Mongo transactions — keep it simple and reliable.
 */
async function saveNewOrderWithAudit(orderDoc, actor, deps = {}) {
    const LogModel = deps.OrderChangeLog || OrderChangeLog;
    const savedOrder = await orderDoc.save();
    const changes = computeCreateChanges(savedOrder);
    const docs = buildLogDocuments(savedOrder, changes, actor);
    if (docs.length > 0) {
        await LogModel.insertMany(docs);
    }
    return savedOrder;
}

async function updateOrderWithAudit({ orderId, updateData, actor }, deps = {}) {
    const OrderModel = deps.Order || Order;
    const LogModel = deps.OrderChangeLog || OrderChangeLog;

    const existing = await OrderModel.findById(orderId);
    if (!existing) {
        const err = new Error('Order not found');
        err.status = 404;
        throw err;
    }

    const plainExisting = toPlainOrder(existing);
    const changes = computeFieldChanges(plainExisting, updateData);
    if (changes.length === 0) {
        return { order: existing, changes: [] };
    }

    const updatedOrder = await OrderModel.findByIdAndUpdate(
        orderId,
        { $set: updateData },
        { new: true, runValidators: true }
    );

    const docs = buildLogDocuments(plainExisting, changes, actor);
    await LogModel.insertMany(docs);

    return { order: updatedOrder, changes };
}

async function getOrderAuditLogs(orderId, deps = {}) {
    const OrderModel = deps.Order || Order;
    const LogModel = deps.OrderChangeLog || OrderChangeLog;

    const order = await OrderModel.findById(orderId).select('_id orderNumber');
    if (!order) {
        return null;
    }

    const docs = await LogModel.find({ orderId: order._id })
        .sort({ createdAt: -1 })
        .lean();

    return {
        orderId: order._id,
        orderNumber: order.orderNumber,
        logs: docs.flatMap(expandLogDocument)
    };
}

module.exports = {
    AUDITED_FIELDS,
    IGNORED_FIELDS,
    toPlainOrder,
    getFieldValue,
    serializeValue,
    valuesEqual,
    displayValue,
    formatFieldChangeText,
    resolveActor,
    computeFieldChanges,
    computeCreateChanges,
    buildChangeText,
    buildLogDocument,
    buildLogDocuments,
    formatAuditLog,
    expandLogDocument,
    saveNewOrderWithAudit,
    updateOrderWithAudit,
    getOrderAuditLogs
};
