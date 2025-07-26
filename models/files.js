const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const files = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    customerFullName: {
        type: String
    },
    filePath: {
        type: String,
        required: true
    },
    fileCategory: {
        type: String,
        enum: ['payment', 'work'],
        required: true
    },

    notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Files', files);
