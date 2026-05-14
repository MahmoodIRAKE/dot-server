const express = require('express');
const { getWorkerOrders } = require('../controllers/workerController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/authorizeRole');

const router = express.Router();

router.get(
    '/orders',
    authMiddleware,
    authorizeRole('worker'),
    getWorkerOrders
);

module.exports = router;
