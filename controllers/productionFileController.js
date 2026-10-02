const mongoose = require('mongoose');
const Order = require('../models/Order');
const Files = require('../models/files');
const admin = require('../config/firebase');

/** Design / print files and CNC / machine files uploaded by graphic designers. */
const PRODUCTION_FILE_EXTENSIONS = {
    design: ['pdf', 'ai', 'psd'],
    cnc: ['dxf', 'svg', 'nc', 'tap', 'gcode', 'dwg']
};
const ALLOWED_EXTENSIONS = [...PRODUCTION_FILE_EXTENSIONS.design, ...PRODUCTION_FILE_EXTENSIONS.cnc];

const ADMIN_ROLES = ['admin', 'superAdmin', 'miniAdmin'];
/** Role → order field that must reference the user for non-admin access. */
const ASSIGNED_FIELD_BY_ROLE = {
    graphicDesigner: 'assignedDesignerId',
    factoryWorker: 'assignedFactoryWorkerId'
};

const fileExtension = (name) => {
    const match = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return match ? match[1].toLowerCase() : '';
};

/** Order the current user may access, or null. Admins: any order; designers/factory workers: only orders assigned to them. */
async function findAccessibleOrder(user, orderId) {
    if (!mongoose.Types.ObjectId.isValid(orderId)) return null;
    const filter = { _id: orderId };
    if (!ADMIN_ROLES.includes(user.role)) {
        const field = ASSIGNED_FIELD_BY_ROLE[user.role];
        if (!field) return null;
        filter[field] = user.userId;
    }
    return Order.findOne(filter);
}

const listProductionFiles = async (req, res) => {
    try {
        const order = await findAccessibleOrder(req.user, req.params.orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        const files = await Files.find({ orderId: order._id, fileCategory: 'production' })
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, files });
    } catch (error) {
        console.error('Error listing production files:', error);
        res.status(500).json({ success: false, error: 'Internal server error while loading files' });
    }
};

/** Body: { files: [{ filePath, originalName?, fileSize? }] } — files already uploaded to storage under production/{orderNumber}/ */
const addProductionFiles = async (req, res) => {
    try {
        const order = await findAccessibleOrder(req.user, req.params.orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const files = Array.isArray(req.body?.files) ? req.body.files : [];
        if (files.length === 0) {
            return res.status(400).json({ success: false, error: 'No files provided' });
        }

        const requiredPrefix = `production/${order.orderNumber}/`;
        for (const file of files) {
            const filePath = String(file?.filePath || '');
            if (!filePath.startsWith(requiredPrefix) || filePath.includes('..')) {
                return res.status(400).json({ success: false, error: 'Invalid file path' });
            }
            const ext = fileExtension(file.originalName || filePath);
            if (!ALLOWED_EXTENSIONS.includes(ext) || fileExtension(filePath) !== ext) {
                return res.status(400).json({
                    success: false,
                    error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(', ')}`
                });
            }
        }

        const saved = await Files.insertMany(
            files.map((file) => ({
                userId: req.user.userId,
                uploadedBy: req.user.userId,
                orderId: order._id,
                customerFullName: order.customerFullName,
                filePath: file.filePath,
                fileCategory: 'production',
                originalName: file.originalName,
                fileSize: Number.isFinite(Number(file.fileSize)) ? Number(file.fileSize) : undefined
            }))
        );

        res.status(200).json({ success: true, files: saved });
    } catch (error) {
        console.error('Error saving production files:', error);
        res.status(500).json({ success: false, error: 'Internal server error while saving files' });
    }
};

const deleteProductionFile = async (req, res) => {
    try {
        const order = await findAccessibleOrder(req.user, req.params.orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        const { fileId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(fileId)) {
            return res.status(400).json({ success: false, error: 'Invalid file id' });
        }

        const file = await Files.findOneAndDelete({
            _id: fileId,
            orderId: order._id,
            fileCategory: 'production'
        });
        if (!file) {
            return res.status(404).json({ success: false, error: 'File not found' });
        }

        await admin.storage().bucket().file(file.filePath).delete().catch((err) => {
            console.warn('Could not delete production file from storage:', file.filePath, err.message);
        });

        res.status(200).json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting production file:', error);
        res.status(500).json({ success: false, error: 'Internal server error while deleting file' });
    }
};

module.exports = {
    PRODUCTION_FILE_EXTENSIONS,
    listProductionFiles,
    addProductionFiles,
    deleteProductionFile
};
