const Order = require('../models/Order');

const ORDER_FIELD_KEYS = [
    'customerFullName',
    'customerPhoneNumber',
    'customerAddress',
    'requiredDeliveryDate',
    'description',
    'height',
    'width',
    'jobRef',
    'notes'
];

function pickOrderFields(body) {
    const fields = {};
    for (const key of ORDER_FIELD_KEYS) {
        if (body[key] !== undefined) {
            fields[key] = body[key];
        }
    }
    return fields;
}

function validateOrderFields(fields) {
    const missing = [];
    if (!fields.customerAddress) missing.push('customerAddress');
    if (!fields.customerPhoneNumber) missing.push('customerPhoneNumber');
    return missing;
}

async function createClientOrder(user, body) {
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

    const savedOrder = await newOrder.save();
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
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
    };
}

module.exports = {
    ORDER_FIELD_KEYS,
    pickOrderFields,
    createClientOrder,
    formatOpenOrder
};
