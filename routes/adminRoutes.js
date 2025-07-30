const express = require('express');
const {
    getAllOrders,
    getOrderDetails,
    updateOrder,
    changeOrderStatus,
    uploadFilesToOrder,
    addNewUser,
    blockUser,
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

// Upload files to order
router.post('/orders/:orderId/files',
    authMiddleware,
    authorizeRole("admin"),
    uploadFilesToOrder); // Upload files to order


// User management routes
router.post('/users',
    authMiddleware,
    authorizeRole("admin"),
    addNewUser);
// Add new user
router.put('/users/:userId/status', authMiddleware, blockUser); // Block/unblock user

module.exports = router;
