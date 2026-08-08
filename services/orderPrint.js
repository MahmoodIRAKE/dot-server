const Order = require('../models/Order');
const Files = require('../models/files');

const PRINT_TYPES = ['technical', 'field', 'commercial'];

function notFoundError(message = 'Order not found') {
    const err = new Error(message);
    err.status = 404;
    return err;
}

function badRequestError(message) {
    const err = new Error(message);
    err.status = 400;
    return err;
}

function organizationName(order) {
    const org = order.organizationId;
    if (!org) return null;
    if (typeof org === 'object' && org.name) return org.name;
    return null;
}

function organizationCode(order) {
    const org = order.organizationId;
    if (!org || typeof org !== 'object') return null;
    return org.organizationCode || null;
}

function workerName(order) {
    const worker = order.assignedWorkerId;
    if (!worker) return null;
    if (typeof worker === 'object') {
        return worker.fullName || worker.username || null;
    }
    return null;
}

function buildMeta(order) {
    return {
        orderId: order._id,
        orderNumber: order.orderNumber,
        printedAt: new Date().toISOString(),
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
        companyName: 'DOT',
        isPrivateClient: Boolean(order.isPrivateClient)
    };
}

async function loadOrderForPrint(orderId) {
    const order = await Order.findById(orderId)
        .populate('organizationId', 'name organizationCode')
        .populate('assignedWorkerId', 'fullName username');
    if (!order) {
        throw notFoundError('Order not found');
    }
    return order;
}

/**
 * Type 1 — technical / production sheet
 */
async function getTechnicalPrintData(orderId) {
    const order = await loadOrderForPrint(orderId);
    const workFiles = await Files.find({
        orderId: order._id,
        fileCategory: 'work'
    }).select('filePath notes fileCategory createdAt');

    return {
        printType: 'technical',
        title: 'Technical Order Sheet',
        titleHe: 'גיליון טכני להזמנה',
        meta: buildMeta(order),
        data: {
            jobRef: order.jobRef || null,
            status: order.status || null,
            requiredDeliveryDate: order.requiredDeliveryDate || null,
            customerFullName: order.customerFullName || null,
            height: order.height || null,
            width: order.width || null,
            description: order.description || null,
            notes: order.notes || null,
            assignedWorker: workerName(order),
            organizationName: organizationName(order)
        },
        files: workFiles.map((f) => ({
            filePath: f.filePath,
            notes: f.notes || null,
            createdAt: f.createdAt
        }))
    };
}

/**
 * Type 2 — field worker at customer site
 */
async function getFieldPrintData(orderId) {
    const order = await loadOrderForPrint(orderId);
    return {
        printType: 'field',
        title: 'Field Work Order',
        titleHe: 'הזמנת עבודה בשטח',
        meta: buildMeta(order),
        data: {
            customerFullName: order.customerFullName || null,
            customerPhoneNumber: order.customerPhoneNumber || null,
            customerAddress: order.customerAddress || null,
            requiredDeliveryDate: order.requiredDeliveryDate || null,
            jobRef: order.jobRef || null,
            height: order.height || null,
            width: order.width || null,
            description: order.description || null,
            notes: order.notes || null,
            assignedWorker: workerName(order),
            status: order.status || null
        }
    };
}

/**
 * Type 3 — commercial / order summary
 */
async function getCommercialPrintData(orderId) {
    const order = await loadOrderForPrint(orderId);
    return {
        printType: 'commercial',
        title: 'Order Summary',
        titleHe: 'סיכום הזמנה',
        meta: buildMeta(order),
        data: {
            organizationName: organizationName(order),
            organizationCode: organizationCode(order),
            customerFullName: order.customerFullName || null,
            customerPhoneNumber: order.customerPhoneNumber || null,
            customerAddress: order.customerAddress || null,
            totalPrice: order.totalPrice || null,
            status: order.status || null,
            requiredDeliveryDate: order.requiredDeliveryDate || null,
            jobRef: order.jobRef || null,
            description: order.description || null,
            notes: order.notes || null,
            assignedWorker: workerName(order),
            clientType: order.isPrivateClient ? 'לקוח פרטי' : 'לקוח ארגוני'
        }
    };
}

async function getOrderPrintData(orderId, printType) {
    if (!PRINT_TYPES.includes(printType)) {
        throw badRequestError(
            `Invalid print type. Allowed: ${PRINT_TYPES.join(', ')}`
        );
    }
    if (printType === 'technical') return getTechnicalPrintData(orderId);
    if (printType === 'field') return getFieldPrintData(orderId);
    return getCommercialPrintData(orderId);
}

module.exports = {
    PRINT_TYPES,
    getOrderPrintData,
    getTechnicalPrintData,
    getFieldPrintData,
    getCommercialPrintData
};
