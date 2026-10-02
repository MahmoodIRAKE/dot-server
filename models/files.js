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
        enum: ['payment', 'work', 'public', 'production'],
        required: true
    },
    /** Production files only: original file name, size in bytes, and uploader. */
    originalName: { type: String, required: false },
    fileSize: { type: Number, required: false },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: false
    },
    /** Tokenized download URL for public-status images (no login). */
    publicUrl: {
        type: String,
        required: false
    },

    notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Files', files);
