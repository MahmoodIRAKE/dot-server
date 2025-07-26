const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const orderSchema = new mongoose.Schema({
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
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
    requiredDeliveryDate: {
        type: String,
        required: false
    },
    customerAddress:{
        type: String,
        required: true
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

    notes: { type: String },
}, { timestamps: true });

orderSchema.plugin(AutoIncrement, { inc_field: 'orderNumber' });

module.exports = mongoose.model('Orders', orderSchema);
