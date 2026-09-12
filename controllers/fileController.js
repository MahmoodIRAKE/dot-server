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
    console.error('Error saving images paths:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error while saving files'
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
        console.error('Error getting images paths:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while loading files'
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
        console.error('Error deleting images paths:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while deleting files'
        });
    }
}
module.exports = {
    saveImagesPath,
    getImagesPathsByOrderId,
    deleteImagesPath
        };
