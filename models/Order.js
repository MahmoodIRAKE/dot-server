const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const orderSchema = new mongoose.Schema({
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: false
    },
    isPrivateClient: {
        type: Boolean,
        default: false
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organizations',
        required: false
    },
    assignedWorkerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: false
    },
    orderId: {
        type: String,
        allowNull: true
    },
    customerFullName: {
        type: String
    },
    totalPrice: {
        type: String,
        required: false
    },
    status: {
        type: String,
        default: 'new',
        enum: ['new','waiting for approval','in progress', 'paymentR','DONE', 'delayed', 'declined' ],

    },
    /**
     * External customer-facing progress (Customer Status Link only).
     * Independent of internal `status`.
     */
    customerStatus: {
        type: String,
        default: 'order_received',
        enum: ['order_received', 'in_production', 'installation', 'completed'],
        index: true
    },
    requiredDeliveryDate: {
        type: String,
        required: false
    },
    customerAddress:{
        type: String,
        required: false
    },
    customerPhoneNumber:{
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    },
    height:{
        type: String,
        required: false
    },
    width:{
        type: String,
        required: false
    },
    jobRef:{
        type: String,
        required: false
    },

    notes: { type: String },

    /** Unguessable token for public private-order status links (sparse unique). */
    publicStatusToken: {
        type: String,
        required: false,
        index: { unique: true, sparse: true }
    },
    /** When false/absent, the public status link is inactive. */
    publicStatusEnabled: {
        type: Boolean,
        default: false
    },
    /** When true — order is in the admin archive. */
    isArchived: {
        type: Boolean,
        default: false,
        index: true
    },
    archivedAt: {
        type: Date,
        required: false
    }
}, { timestamps: true });

orderSchema.plugin(AutoIncrement, { inc_field: 'orderNumber' });

module.exports = mongoose.model('Orders', orderSchema);
