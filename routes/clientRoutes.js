const express = require('express');
const {
    createOrder,
    getClientOrders,
    updateOrder,
    updateProfile,
} = require('../controllers/clientController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// Order routes for clients
router.get('/orders', authMiddleware, getClientOrders); // Get client's orders
router.post('/orders', authMiddleware, createOrder); // Create new order
router.put('/orders/:orderId', authMiddleware, updateOrder); // Update order

// Profile routes for clients
router.put('/users/:userId', authMiddleware, updateProfile); // Update profile

module.exports = router;
