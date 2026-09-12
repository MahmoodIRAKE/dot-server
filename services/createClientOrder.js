const Order = require('../models/Order');
const { saveNewOrderWithAudit } = require('./orderAuditLog');
const { applyWorksFromBody, sanitizeWork } = require('../utils/orderWorks');

const PRIVATE_WORK_REQUIRED_KEYS = ['description', 'height', 'width', 'jobRef'];

const ORDER_FIELD_KEYS = [
    'customerFullName',
    'customerPhoneNumber',
    'customerAddress',
    'requiredDeliveryDate',
    'description',
    'height',
    'width',
    'jobRef',
    'notes',
    'works'
];

const PRIVATE_CUSTOMER_KEYS = [
    'customerFullName',
    'customerPhoneNumber',
    'customerAddress',
    'requiredDeliveryDate'
];

function pickOrderFields(body) {
    const fields = {};
    for (const key of ORDER_FIELD_KEYS) {
        if (body[key] !== undefined) {
            fields[key] = body[key];
        }
    }
    Object.assign(fields, applyWorksFromBody(body));
    return fields;
}

function validateOrderFields(fields) {
    const missing = [];
    if (!fields.customerAddress) missing.push('customerAddress');
    if (!fields.customerPhoneNumber) missing.push('customerPhoneNumber');
    return missing;
}

function actorFromUser(user) {
    return {
        userId: user._id || user.userId,
        userName: user.fullName || user.username || 'Unknown'
    };
}

async function createClientOrder(user, body, actor = null) {
    if (!user.organizationId) {
        return {
            success: false,
            status: 400,
            error: 'Your account is not linked to an organization. Contact your administrator.'
        };
    }

    const orderFields = pickOrderFields(body);
    const missing = validateOrderFields(orderFields);
    if (missing.length > 0) {
        return {
            success: false,
            status: 400,
            error: `Missing required fields: ${missing.join(', ')}`
        };
    }

    const newOrder = new Order({
        userID: user._id,
        organizationId: user.organizationId,
        ...orderFields,
        status: 'new'
    });

    const auditActor = actor || actorFromUser(user);
    const savedOrder = await saveNewOrderWithAudit(newOrder, auditActor);
    return { success: true, order: savedOrder };
}

function validatePrivateOrderFields(fields) {
    const missing = [];
    for (const key of PRIVATE_CUSTOMER_KEYS) {
        if (!fields[key]) {
            missing.push(key);
        }
    }
    const works = Array.isArray(fields.works) && fields.works.length > 0
        ? fields.works.map(sanitizeWork)
        : [sanitizeWork(fields)];
    works.forEach((work, index) => {
        for (const key of PRIVATE_WORK_REQUIRED_KEYS) {
            if (!work[key] || !String(work[key]).trim()) {
                missing.push(works.length > 1 ? `works[${index}].${key}` : key);
            }
        }
    });
    return missing;
}

async function createPrivateOrder(body, actor) {
    const orderFields = pickOrderFields(body);
    const missing = validatePrivateOrderFields(orderFields);
    if (missing.length > 0) {
        return {
            success: false,
            status: 400,
            error: `Missing required fields: ${missing.join(', ')}`
        };
    }

    if (!actor || !actor.userId) {
        return {
            success: false,
            status: 401,
            error: 'Authenticated admin context is required'
        };
    }

    const newOrder = new Order({
        ...orderFields,
        isPrivateClient: true,
        status: 'new'
    });

    const savedOrder = await saveNewOrderWithAudit(newOrder, actor);
    return { success: true, order: savedOrder };
}

function formatOpenOrder(order) {
    return {
        orderId: order._id,
        orderNumber: order.orderNumber,
        organizationId: order.organizationId,
        customerFullName: order.customerFullName,
        customerPhoneNumber: order.customerPhoneNumber,
        customerAddress: order.customerAddress,
        requiredDeliveryDate: order.requiredDeliveryDate,
        description: order.description,
        height: order.height,
        width: order.width,
        jobRef: order.jobRef,
        notes: order.notes,
        works: order.works,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
    };
}

module.exports = {
    ORDER_FIELD_KEYS,
    pickOrderFields,
    createClientOrder,
    createPrivateOrder,
    formatOpenOrder,
    actorFromUser
};
