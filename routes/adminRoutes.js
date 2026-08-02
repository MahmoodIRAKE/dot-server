const express = require('express');
const {
    getAllOrders,
    getOrderDetails,
    createAdminOrder,
    updateOrder,
    changeOrderStatus,
    getOrderAuditHistory,
    createOrderPublicLink,
    regenerateOrderPublicLink,
    revokeOrderPublicLink,
    addNewUser,
    updateUser,
    deleteUser,
    createNewWorker,
    assignOrderToWorker,
    blockUser,
    getAllUsers,
    createOrganization,
    getAllOrganizations,
    getOrganizationById
} = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRole = require("../middlewares/authorizeRole");

const router = express.Router();

// Order management routes

// Get all orders
router.get('/orders',
    authMiddleware,
    authorizeRole("admin"),
    getAllOrders);

router.post('/orders',
    authMiddleware,
    authorizeRole("admin"),
    createAdminOrder);

router.get('/users',
    authMiddleware,
    authorizeRole("admin"),
    getAllUsers);

router.post('/organizations',
    authMiddleware,
    authorizeRole("admin"),
    createOrganization);

router.get('/organizations',
    authMiddleware,
    authorizeRole("admin"),
    getAllOrganizations);

router.get('/organizations/:organizationId',
    authMiddleware,
    authorizeRole("admin"),
    getOrganizationById);

router.get('/orders/:orderId/audit-logs',
    authMiddleware,
    authorizeRole("admin"),
    getOrderAuditHistory);

router.post('/orders/:orderId/public-link',
    authMiddleware,
    authorizeRole("admin"),
    createOrderPublicLink);

router.post('/orders/:orderId/public-link/regenerate',
    authMiddleware,
    authorizeRole("admin"),
    regenerateOrderPublicLink);

router.delete('/orders/:orderId/public-link',
    authMiddleware,
    authorizeRole("admin"),
    revokeOrderPublicLink);

router.get('/orders/:orderId',
    authMiddleware,
    authorizeRole("admin"),
    getOrderDetails); // Get order details

// Update order details
router.put('/orders/:orderId',
    authMiddleware,
    authorizeRole("admin"),
    updateOrder);

// Change order status
router.patch('/orders/:orderId/status',
    authMiddleware,
    authorizeRole("admin"),
    changeOrderStatus);

router.patch('/orders/:orderId/worker',
    authMiddleware,
    authorizeRole("admin"),
    assignOrderToWorker);

// Upload files to orde
// Add new user (client)
router.post('/users',
    authMiddleware,
    authorizeRole("admin"),
    addNewUser);

router.post('/createNewWorker',
    authMiddleware,
    authorizeRole("admin"),
    createNewWorker);

// Update user (profile + organization; cascades organizationId to user's orders)
router.put('/users/:userId',
    authMiddleware,
    updateUser);

// Delete client user (orders and their organizationId are kept)
router.delete('/users/:userId',
    authMiddleware,
    deleteUser);

// Block/unblock user
router.put('/users/:userId/status',
    authMiddleware,
    blockUser);

module.exports = router;
