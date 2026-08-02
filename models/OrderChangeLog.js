const mongoose = require('mongoose');

/**
 * One document = one field change on an order.
 * who (userId/userName) + when (createdAt) + field + old/new values.
 */
const orderChangeLogSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Orders',
        required: true,
        index: true
    },
    orderNumber: {
        type: Number,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    fieldName: {
        type: String,
        required: true
    },
    oldValue: {
        type: String,
        default: null
    },
    newValue: {
        type: String,
        default: null
    }
}, {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'order_change_logs',
    strict: false // allow reading legacy docs that used text/changes[]
});

orderChangeLogSchema.index({ orderId: 1, createdAt: -1 });

module.exports = mongoose.model('OrderChangeLog', orderChangeLogSchema);
