const express = require('express');
const {
    saveImagesPath

} = require('../controllers/fileController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRole = require("../middlewares/authorizeRole");
const {uploadFilesToOrder} = require("../controllers/adminController");

const router = express.Router();

router.post('/orders/files',
    authMiddleware,
    authorizeRole("client","admin"),
    saveImagesPath);


module.exports = router;
