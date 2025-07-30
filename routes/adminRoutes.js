const express = require('express');
const {
    getAllOrders,
    getOrderDetails,
    updateOrder,
    changeOrderStatus,
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

// Upload files to orde
// Add new user
router.post('/users',
    authMiddleware,
    authorizeRole("admin"),
    addNewUser);

// Block/unblock user
router.put('/users/:userId/status',
    authMiddleware,
    blockUser);

module.exports = router;
