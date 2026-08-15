const express = require('express');
const { getWorkerOrders, getWorkerOrderDetails } = require('../controllers/workerController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/authorizeRole');

const router = express.Router();

router.get(
    '/orders',
    authMiddleware,
    authorizeRole('worker'),
    getWorkerOrders
);

router.get(
    '/orders/:orderId',
    authMiddleware,
    authorizeRole('worker'),
    getWorkerOrderDetails
);

module.exports = router;
