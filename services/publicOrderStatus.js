const crypto = require('crypto');
const Order = require('../models/Order');
const Files = require('../models/files');

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

function formatPublicImages(files) {
    if (!Array.isArray(files)) return [];
    return files
        .map((file) => {
            const url = file?.publicUrl || (typeof file?.filePath === 'string' && file.filePath.startsWith('http')
                ? file.filePath
                : null);
            if (!url) return null;
            return {
                url,
                notes: file.notes || null
            };
        })
        .filter(Boolean);
}

async function resolvePublicImageUrl(file) {
    if (file?.publicUrl) return file.publicUrl;
    if (typeof file?.filePath === 'string' && file.filePath.startsWith('http')) {
        return file.filePath;
    }
    if (!file?.filePath) return null;
    try {
        const admin = require('../config/firebase');
        const bucket = admin.storage().bucket();
        const [url] = await bucket.file(file.filePath).getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000
        });
        return url || null;
    } catch (error) {
        console.warn('Could not sign public image URL:', file.filePath, error.message);
        return null;
    }
}

function formatPublicStatus(order, images = []) {
    return {
        orderNumber: order.orderNumber,
        customerStatus: order.customerStatus || 'order_received',
        customerFullName: order.customerFullName || null,
        requiredDeliveryDate: order.requiredDeliveryDate || null,
        updatedAt: order.updatedAt,
        images: formatPublicImages(images)
    };
}

function notFoundError(message = 'Order not found') {
    const err = new Error(message);
    err.status = 404;
    return err;
}

async function loadOrder(orderId, deps = {}) {
    const OrderModel = deps.Order || Order;
    const order = await OrderModel.findById(orderId);
    if (!order) {
        throw notFoundError('Order not found');
    }
    return order;
}

/**
 * Get existing public link or create one (enable + token).
 * Available for all order types (private and organization).
 */
async function ensurePublicLink(orderId, deps = {}) {
    const order = await loadOrder(orderId, deps);

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
    const order = await loadOrder(orderId, deps);
    order.publicStatusToken = generateToken();
    order.publicStatusEnabled = true;
    await order.save();
    return formatPublicLink(order);
}

/**
 * Disable the public link and clear the token so old URLs stop working.
 */
async function revokePublicLink(orderId, deps = {}) {
    const order = await loadOrder(orderId, deps);
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
    const FilesModel = deps.Files || Files;

    if (!token || typeof token !== 'string' || !token.trim()) {
        return null;
    }

    const order = await OrderModel.findOne({
        publicStatusToken: token.trim(),
        publicStatusEnabled: true
    }).select('_id orderNumber customerStatus customerFullName requiredDeliveryDate updatedAt');

    if (!order) {
        return null;
    }

    let files = [];
    try {
        const query = FilesModel.find({
            fileCategory: 'public',
            $or: [{ orderId: order._id }, { orderId: String(order._id) }]
        });
        if (query && typeof query.select === 'function') {
            files = await query.select('publicUrl filePath notes').sort({ createdAt: 1 });
        } else {
            files = await query;
        }
    } catch (error) {
        console.warn('Error loading public images for order status:', error.message);
        files = [];
    }

    const images = [];
    for (const file of files || []) {
        const url = await resolvePublicImageUrl(file);
        if (url) {
            images.push({ publicUrl: url, notes: file.notes || null });
        }
    }

    return formatPublicStatus(order, images);
}

module.exports = {
    PUBLIC_PATH_PREFIX,
    generateToken,
    formatPublicLink,
    formatPublicStatus,
    formatPublicImages,
    ensurePublicLink,
    regeneratePublicLink,
    revokePublicLink,
    getPublicStatusByToken
};
