const express = require('express');
const {
    getAllOrders,
    getOrderDetails,
    createAdminOrder,
    updateOrder,
    changeOrderStatus,
    changeCustomerStatus,
    getOrderAuditHistory,
    createOrderPublicLink,
    regenerateOrderPublicLink,
    revokeOrderPublicLink,
    getOrderPrint,
    archiveOrder,
    unarchiveOrder,
    deleteArchivedOrder,
    addNewUser,
    updateUser,
    deleteUser,
    createNewWorker,
    assignOrderToWorker,
    blockUser,
    getAllUsers,
    createOrganization,
    getAllOrganizations,
    getOrganizationById,
    deleteOrganization
} = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/authorizeRole');

const router = express.Router();

/** Full admin: create / update / delete clients, orgs, staff */
const adminOnly = ['admin', 'superAdmin'];
/** Admin + miniAdmin: orders + read-only clients/orgs/users */
const orderManagers = ['admin', 'superAdmin', 'miniAdmin'];

// Orders — admin + miniAdmin
router.get('/orders',
    authMiddleware,
    authorizeRole(...orderManagers),
    getAllOrders);

router.post('/orders',
    authMiddleware,
    authorizeRole(...orderManagers),
    createAdminOrder);

router.get('/orders/:orderId/audit-logs',
    authMiddleware,
    authorizeRole(...orderManagers),
    getOrderAuditHistory);

router.get('/orders/:orderId/print/:printType',
    authMiddleware,
    authorizeRole(...orderManagers),
    getOrderPrint);

router.post('/orders/:orderId/public-link',
    authMiddleware,
    authorizeRole(...orderManagers),
    createOrderPublicLink);

router.post('/orders/:orderId/public-link/regenerate',
    authMiddleware,
    authorizeRole(...orderManagers),
    regenerateOrderPublicLink);

router.delete('/orders/:orderId/public-link',
    authMiddleware,
    authorizeRole(...orderManagers),
    revokeOrderPublicLink);

router.get('/orders/:orderId',
    authMiddleware,
    authorizeRole(...orderManagers),
    getOrderDetails);

router.put('/orders/:orderId',
    authMiddleware,
    authorizeRole(...orderManagers),
    updateOrder);

router.patch('/orders/:orderId/status',
    authMiddleware,
    authorizeRole(...orderManagers),
    changeOrderStatus);

router.patch('/orders/:orderId/customer-status',
    authMiddleware,
    authorizeRole(...orderManagers),
    changeCustomerStatus);

router.patch('/orders/:orderId/worker',
    authMiddleware,
    authorizeRole(...orderManagers),
    assignOrderToWorker);

// Archive / delete — admin only (not miniAdmin)
router.post('/orders/:orderId/archive',
    authMiddleware,
    authorizeRole(...adminOnly),
    archiveOrder);

router.post('/orders/:orderId/unarchive',
    authMiddleware,
    authorizeRole(...adminOnly),
    unarchiveOrder);

router.delete('/orders/:orderId',
    authMiddleware,
    authorizeRole(...adminOnly),
    deleteArchivedOrder);

// Users — read for admin + miniAdmin; mutations admin only
router.get('/users',
    authMiddleware,
    authorizeRole(...orderManagers),
    getAllUsers);

router.post('/users',
    authMiddleware,
    authorizeRole(...adminOnly),
    addNewUser);

router.put('/users/:userId',
    authMiddleware,
    authorizeRole(...adminOnly),
    updateUser);

router.delete('/users/:userId',
    authMiddleware,
    authorizeRole(...adminOnly),
    deleteUser);

router.put('/users/:userId/status',
    authMiddleware,
    authorizeRole(...adminOnly),
    blockUser);

// Organizations — read for admin + miniAdmin; create admin only
router.get('/organizations',
    authMiddleware,
    authorizeRole(...orderManagers),
    getAllOrganizations);

router.get('/organizations/:organizationId',
    authMiddleware,
    authorizeRole(...orderManagers),
    getOrganizationById);

router.post('/organizations',
    authMiddleware,
    authorizeRole(...adminOnly),
    createOrganization);

router.delete('/organizations/:organizationId',
    authMiddleware,
    authorizeRole(...adminOnly),
    deleteOrganization);

// Create worker or miniAdmin — admin only
router.post('/createNewWorker',
    authMiddleware,
    authorizeRole(...adminOnly),
    createNewWorker);

module.exports = router;
