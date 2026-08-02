const crypto = require('crypto');
const Order = require('../models/Order');

const PUBLIC_PATH_PREFIX = '/order-status';

function generateToken() {
    return crypto.randomBytes(24).toString('hex');
}

function formatPublicLink(order) {
    const token = order.publicStatusToken || null;
    return {
        orderId: order._id,
        orderNumber: order.orderNumber,
        token,
        publicPath: token ? `${PUBLIC_PATH_PREFIX}/${token}` : null,
        enabled: Boolean(order.publicStatusEnabled && token)
    };
}

function formatPublicStatus(order) {
    return {
        orderNumber: order.orderNumber,
        status: order.status,
        customerFullName: order.customerFullName || null,
        requiredDeliveryDate: order.requiredDeliveryDate || null,
        updatedAt: order.updatedAt
    };
}

function notFoundError(message = 'Order not found') {
    const err = new Error(message);
    err.status = 404;
    return err;
}

function badRequestError(message) {
    const err = new Error(message);
    err.status = 400;
    return err;
}

async function loadPrivateOrder(orderId, deps = {}) {
    const OrderModel = deps.Order || Order;
    const order = await OrderModel.findById(orderId);
    if (!order) {
        throw notFoundError('Order not found');
    }
    if (!order.isPrivateClient) {
        throw badRequestError('Public status links are only available for private orders');
    }
    return order;
}

/**
 * Get existing public link or create one (enable + token).
 */
async function ensurePublicLink(orderId, deps = {}) {
    const order = await loadPrivateOrder(orderId, deps);

    if (!order.publicStatusToken || !order.publicStatusEnabled) {
        order.publicStatusToken = order.publicStatusToken || generateToken();
        order.publicStatusEnabled = true;
        await order.save();
    }

    return formatPublicLink(order);
}

/**
 * Issue a new token and enable the link (invalidates previous URL).
 */
async function regeneratePublicLink(orderId, deps = {}) {
    const order = await loadPrivateOrder(orderId, deps);
    order.publicStatusToken = generateToken();
    order.publicStatusEnabled = true;
    await order.save();
    return formatPublicLink(order);
}

/**
 * Disable the public link and clear the token so old URLs stop working.
 */
async function revokePublicLink(orderId, deps = {}) {
    const order = await loadPrivateOrder(orderId, deps);
    order.publicStatusToken = undefined;
    order.publicStatusEnabled = false;
    await order.save();
    return formatPublicLink(order);
}

/**
 * Resolve a public status payload by token. Always 404 for invalid/revoked.
 */
async function getPublicStatusByToken(token, deps = {}) {
    const OrderModel = deps.Order || Order;

    if (!token || typeof token !== 'string' || !token.trim()) {
        return null;
    }

    const order = await OrderModel.findOne({
        publicStatusToken: token.trim(),
        publicStatusEnabled: true,
        isPrivateClient: true
    }).select('orderNumber status customerFullName requiredDeliveryDate updatedAt');

    if (!order) {
        return null;
    }

    return formatPublicStatus(order);
}

module.exports = {
    PUBLIC_PATH_PREFIX,
    generateToken,
    formatPublicLink,
    formatPublicStatus,
    ensurePublicLink,
    regeneratePublicLink,
    revokePublicLink,
    getPublicStatusByToken
};
