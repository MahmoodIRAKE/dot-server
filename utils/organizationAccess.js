const Order = require('../models/Order');

/**
 * Build a query filter so client users see all orders for their organization.
 * Falls back to userID-only for legacy users without an organization.
 */
function clientOrdersFilter(reqUser) {
    if (reqUser.organizationId) {
        return { organizationId: reqUser.organizationId };
    }
    return { userID: reqUser.userId };
}

/**
 * Returns true if the client user may access the given order document.
 */
function clientCanAccessOrder(reqUser, order) {
    if (!order) return false;
    if (reqUser.organizationId && order.organizationId) {
        return order.organizationId.toString() === reqUser.organizationId.toString();
    }
    // Legacy orders without organizationId: only the creator can access
    if (reqUser.organizationId && !order.organizationId) {
        return order.userID.toString() === reqUser.userId.toString();
    }
    return order.userID.toString() === reqUser.userId.toString();
}

module.exports = {
    clientOrdersFilter,
    clientCanAccessOrder
};
