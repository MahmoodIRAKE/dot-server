const Order = require('../models/Order');
const User = require('../models/User');
const Files = require("../models/files");

const saveImagesPath = async (req, res )=>{
try{
    let fileData =req.body
    const newFile = await Files.insertMany(fileData);
    res.status(200).json({
        success: true,
        message: 'paths saved  successfully',
    });
}catch(error){
    res.status(500).json({
        success: false,
        message: 'Error saving images paths',
        error: error.message
    });
}
};

const getImagesPathsByOrderId = async (req, res )=>{
    try{
        let {orderId} =req.params
        const newFile = await Files.find({orderId});
        res.status(200).json({
            success: true,
            message: 'paths saved  successfully',
            data: newFile
        });
    }catch(error){
        res.status(500).json({
            success: false,
            message: 'Error getting images paths',
            error: error.message
        });
    }
    };

const deleteImagesPath = async (req, res )=>{
    try{
        let {filePath} =req.params
        const newFile = await Files.deleteMany({filePath});
        res.status(200).json({
            success: true,
            message: 'paths deleted  successfully',
            data: newFile
        });
    }catch(error){
        res.status(500).json({  
            success: false,
            message: 'Error deleting images paths',
            error: error.message
        });
    }
}
module.exports = {
    saveImagesPath,
    getImagesPathsByOrderId,
    deleteImagesPath
        };
