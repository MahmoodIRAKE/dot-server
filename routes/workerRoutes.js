const express = require('express');
const { getWorkerOrders, getWorkerOrderDetails } = require('../controllers/workerController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/authorizeRole');

const router = express.Router();

/** Internal DOT employees: field worker, graphic designer, factory worker */
const internalEmployees = ['worker', 'graphicDesigner', 'factoryWorker'];

router.get(
    '/orders',
    authMiddleware,
    authorizeRole(...internalEmployees),
    getWorkerOrders
);

router.get(
    '/orders/:orderId',
    authMiddleware,
    authorizeRole(...internalEmployees),
    getWorkerOrderDetails
);

module.exports = router;
