const express = require('express');
const {
    createOrder,
    getClientOrders,
    updateOrder,
    updateProfile,
    saveImagesPath
} = require('../controllers/clientController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRole = require("../middlewares/authorizeRole");
const {uploadFilesToOrder} = require("../controllers/adminController");

const router = express.Router();

// Order routes for clients
router.get('/orders',
    authMiddleware,
    authorizeRole("client"),
    getClientOrders);

router.post('/orders',
    authMiddleware,
    authorizeRole("client"),
    createOrder
);

// Update order
router.put('/orders/:orderId',
    authMiddleware,
    authorizeRole("client"),
    updateOrder);


router.post('/orders/:orderId/files',
    authMiddleware,
    authorizeRole("client"),
    saveImagesPath);

// Profile routes for clients
router.put('/users/:userId',
    authMiddleware,
    authorizeRole("client"),
    updateProfile);
module.exports = router;
