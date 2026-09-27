const express = require('express');
const {
    saveImagesPath,
    getImagesPathsByOrderId,
    deleteImagesPath,
    setPaymentFiles

} = require('../controllers/fileController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRole = require("../middlewares/authorizeRole");
const {uploadFilesToOrder} = require("../controllers/adminController");

const router = express.Router();

router.post('/orders/files',
    authMiddleware,
    authorizeRole("client","admin","superAdmin","miniAdmin"),
    saveImagesPath);

router.get('/orders/files/:orderId',
    authMiddleware,
    authorizeRole("client","admin","superAdmin","miniAdmin"),
    getImagesPathsByOrderId);

router.put('/orders/:orderId/payment-files',
    authMiddleware,
    authorizeRole("client","admin","superAdmin","miniAdmin"),
    setPaymentFiles);

router.delete('/orders/files/:filePath',
    authMiddleware,
    authorizeRole("client","admin","superAdmin","miniAdmin"),
    deleteImagesPath);

module.exports = router;
