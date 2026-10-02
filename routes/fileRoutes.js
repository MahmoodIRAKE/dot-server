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
const {
    listProductionFiles,
    addProductionFiles,
    deleteProductionFile
} = require('../controllers/productionFileController');

const router = express.Router();

// Production (design / CNC) files — view: admins + assigned designer/factory worker; manage: admins + assigned designer
router.get('/orders/:orderId/production-files',
    authMiddleware,
    authorizeRole("admin","superAdmin","miniAdmin","graphicDesigner","factoryWorker"),
    listProductionFiles);

router.post('/orders/:orderId/production-files',
    authMiddleware,
    authorizeRole("admin","superAdmin","miniAdmin","graphicDesigner"),
    addProductionFiles);

router.delete('/orders/:orderId/production-files/:fileId',
    authMiddleware,
    authorizeRole("admin","superAdmin","miniAdmin","graphicDesigner"),
    deleteProductionFile);

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
