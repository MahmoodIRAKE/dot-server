const Order = require('../models/Order');
const User = require('../models/User');
const Files = require("../models/files");

// Create new order (Client only)
const createOrder = async (req, res) => {
    try {

        // Validate required fields
        const {
            customerFullName,
            customerPhoneNumber,
            customerAddress,
            requiredDeliveryDate,
            description,
            height,
            width,
            notes
        } = req.body;

        // Check required fields
        if (!customerFullName || !customerPhoneNumber || !customerAddress) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: customerFullName, customerPhoneNumber, customerAddress'
            });
        }

        // Create new order
        const newOrder = new Order({
            userID: req.user.userId,
            customerFullName,
            customerPhoneNumber,
            customerAddress,
            requiredDeliveryDate,
            description,
            height,
            width,
            notes,
            status: 'new' // Default status
        });

        // Save order to database
        const savedOrder = await newOrder.save();

        // Return success response
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: savedOrder
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while creating order'
        });
    }
};

// Get orders for the authenticated client
const getClientOrders = async (req, res) => {
    try {

        // Find orders for the authenticated client
        const orders = await Order.find({ userID: req.user.userId })
            .sort({ createdAt: -1 }); // Most recent first

        res.status(200).json({
            success: true,
            orders: orders
        });

    } catch (error) {
        console.error('Error fetching client orders:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching orders'
        });
    }
};

// Update order (Client only - can only update their own orders)
const updateOrder = async (req, res) => {
    try {

        const { orderId } = req.params;

        // Find the order and verify ownership
        const order = await Order.findOne({_id: orderId, userID: req.user.userId});

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }


        // Extract updatable fields (clients cannot update status, totalPrice, or admin fields)
        const {
            customerFullName,
            customerPhoneNumber,
            customerAddress,
            requiredDeliveryDate,
            description,
            height,
            width,
            notes
        } = req.body;



        // Create update object with only allowed fields
        const updateData = {};
        if (customerFullName !== undefined) updateData.customerFullName = customerFullName;
        if (customerPhoneNumber !== undefined) updateData.customerPhoneNumber = customerPhoneNumber;
        if (customerAddress !== undefined) updateData.customerAddress = customerAddress;
        if (requiredDeliveryDate !== undefined) updateData.requiredDeliveryDate = requiredDeliveryDate;
        if (description !== undefined) updateData.description = description;
        if (height !== undefined) updateData.height = height;
        if (width !== undefined) updateData.width = width;
        if (notes !== undefined) updateData.notes = notes;

        // Update the order
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Order updated successfully',
            order: updatedOrder
        });

    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while updating order'
        });
    }
};

const saveImagesPath = async (req, res )=>{

    let fileData =req.body
    const newFile = new Files.bulkSave(fileData)
    res.status(200).json({
        success: true,
        message: 'paths saved  successfully',
    });
};
const orderConfirm = async (req, res )=>{

    try{
        await Order.findByIdAndUpdate(
            req.params.userId,
            {
                status:'paymentR'
            },
            { new: true, runValidators: true })
    }catch (e) {
        console.error('Error changing status:', e);
        res.status(500).json({
            success: false,
            error: 'Internal server error while changing status'
        });
    }
}
// Update client profile
const updateProfile = async (req, res) => {
    try {


        const { fullName, username } = req.body;

        // Update user profile
        const updatedUser = await User.findByIdAndUpdate(
            req.user.userId,
            { fullName, username },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                userId: updatedUser._id,
                username: updatedUser.username,
                fullName: updatedUser.fullName,
                role: updatedUser.role
            }
        });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while updating profile'
        });
    }
};

module.exports = {
    createOrder,
    getClientOrders,
    updateOrder,
    updateProfile,
    saveImagesPath,
    orderConfirm
};
