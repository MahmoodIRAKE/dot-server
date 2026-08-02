const express = require('express');
const { getPublicOrderStatus } = require('../controllers/publicController');

const router = express.Router();

// No auth — token in the URL is the credential
router.get('/orders/status/:token', getPublicOrderStatus);

module.exports = router;
