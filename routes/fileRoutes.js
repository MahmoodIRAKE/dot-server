const express = require('express');
const {
    saveImagesPath,
    getImagesPathsByOrderId,
    deleteImagesPath

} = require('../controllers/fileController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRole = require("../middlewares/authorizeRole");
const {uploadFilesToOrder} = require("../controllers/adminController");

const router = express.Router();

router.post('/orders/files',
    authMiddleware,
    authorizeRole("client","admin"),
    saveImagesPath);

router.get('/orders/files/:orderId',
    authMiddleware,
    authorizeRole("client","admin"),
    getImagesPathsByOrderId);

router.delete('/orders/files/:filePath',
    authMiddleware,
    authorizeRole("client","admin"),
    deleteImagesPath);

module.exports = router;
