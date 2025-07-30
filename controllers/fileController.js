const Order = require('../models/Order');
const User = require('../models/User');
const Files = require("../models/files");

const saveImagesPath = async (req, res )=>{

    let fileData =req.body
    const newFile = new Files.bulkSave(fileData)
    res.status(200).json({
        success: true,
        message: 'paths saved  successfully',
    });
};
module.exports = {
    saveImagesPath
};
