const Order = require('../models/Order');
const User = require('../models/User');
const Files = require("../models/files");
const admin = require('../config/firebase');

const saveImagesPath = async (req, res )=>{
try{
    let fileData =req.body
    if ([].concat(fileData || []).some((f) => f && f.fileCategory === 'production')) {
        return res.status(400).json({
            success: false,
            error: 'Production files must be saved via /orders/:orderId/production-files'
        });
    }
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
        const newFile = await Files.find({ orderId, fileCategory: { $ne: 'production' } });
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
        const newFile = await Files.deleteMany({ filePath, fileCategory: { $ne: 'production' } });
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
/**
 * Sets the order's payment files to exactly the given list (final state).
 * Records not in the list are removed (DB + storage); listed paths are kept or added once.
 */
const setPaymentFiles = async (req, res) => {
    try {
        const { orderId } = req.params;
        const files = Array.isArray(req.body?.files) ? req.body.files : [];
        const finalPaths = files.map((f) => f.filePath).filter(Boolean);

        const removed = await Files.find({
            orderId,
            fileCategory: 'payment',
            filePath: { $nin: finalPaths }
        }).select('filePath');

        await Files.deleteMany({
            orderId,
            fileCategory: 'payment',
            filePath: { $nin: finalPaths }
        });

        for (const file of files) {
            if (!file.filePath) continue;
            await Files.updateOne(
                { orderId, fileCategory: 'payment', filePath: file.filePath },
                {
                    $setOnInsert: {
                        userId: file.userId,
                        orderId,
                        customerFullName: file.customerFullName,
                        filePath: file.filePath,
                        fileCategory: 'payment'
                    }
                },
                { upsert: true }
            );
        }

        const bucket = admin.storage().bucket();
        const removedPaths = [...new Set(removed.map((f) => f.filePath))];
        await Promise.all(
            removedPaths.map((p) =>
                bucket.file(p).delete().catch((err) => {
                    console.warn('Could not delete payment file from storage:', p, err.message);
                })
            )
        );

        const data = await Files.find({ orderId, fileCategory: 'payment' });
        res.status(200).json({
            success: true,
            message: 'payment files updated successfully',
            data
        });
    } catch (error) {
        console.error('Error setting payment files:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while updating payment files'
        });
    }
};

module.exports = {
    saveImagesPath,
    getImagesPathsByOrderId,
    deleteImagesPath,
    setPaymentFiles
        };
