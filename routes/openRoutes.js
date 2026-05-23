const express = require('express');
const { openApiAuth, openApiCreateOrder } = require('../controllers/openApiController');

const router = express.Router();

// Public Open API — for registered client users (Postman / external integrations)
router.post('/auth', openApiAuth);
router.post('/orders', openApiCreateOrder);

module.exports = router;
