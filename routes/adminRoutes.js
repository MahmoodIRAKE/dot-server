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

const router = express.Router();

// Order management routes
router.get('/orders', authMiddleware, getAllOrders); // Get all orders
router.get('/orders/:orderId', authMiddleware, getOrderDetails); // Get order details
router.put('/orders/:orderId', authMiddleware, updateOrder); // Update order details
router.patch('/orders/:orderId/status', authMiddleware, changeOrderStatus); // Change order status
router.post('/orders/:orderId/files', authMiddleware, uploadFilesToOrder); // Upload files to order

// User management routes
router.post('/users', authMiddleware, addNewUser); // Add new user
router.put('/users/:userId/status', authMiddleware, blockUser); // Block/unblock user

module.exports = router;
