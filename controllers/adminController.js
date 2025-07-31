const Order = require('../models/Order');
const User = require('../models/User');
const Files = require('../models/files');
const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const admin = require("firebase-admin");

// Get all orders (Admin only)
const getAllOrders = async (req, res) => {
    try {

        // Get all orders with user information
        const orders = await Order.find()
            .populate('userID', 'username fullName clientId')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            orders: orders
        });

    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching orders'
        });
    }
};

// Get order details (Admin only)
const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;

        // Find order with user information
        const order = await Order.findById(orderId)
            .populate('userID', 'username fullName clientId');

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        // Get files associated with this order
        const files = await Files.find({ orderId: orderId });

        res.status(200).json({
            success: true,
            order: order,
            files: files
        });

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching order details'
        });
    }
};

// Update order details (Admin only)
const updateOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        // Find the order
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        // Extract all updatable fields
        const {
            customerFullName,
            customerPhoneNumber,
            customerAddress,
            requiredDeliveryDate,
            description,
            height,
            width,
            notes,
            totalPrice,
            status
        } = req.body;

        // Validate required fields if they're being updated
        if (customerFullName !== undefined && !customerFullName) {
            return res.status(400).json({
                success: false,
                error: 'customerFullName cannot be empty'
            });
        }

        if (customerPhoneNumber !== undefined && !customerPhoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'customerPhoneNumber cannot be empty'
            });
        }

        if (customerAddress !== undefined && !customerAddress) {
            return res.status(400).json({
                success: false,
                error: 'customerAddress cannot be empty'
            });
        }

        // Validate status if it's being updated
        if (status !== undefined) {
            const validStatuses = ['new', 'waiting for approval', 'in progress', 'paymentR', 'DONE', 'delayed', 'declined'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status value'
                });
            }
        }

        // Create update object
        const updateData = {};
        if (customerFullName !== undefined) updateData.customerFullName = customerFullName;
        if (customerPhoneNumber !== undefined) updateData.customerPhoneNumber = customerPhoneNumber;
        if (customerAddress !== undefined) updateData.customerAddress = customerAddress;
        if (requiredDeliveryDate !== undefined) updateData.requiredDeliveryDate = requiredDeliveryDate;
        if (description !== undefined) updateData.description = description;
        if (height !== undefined) updateData.height = height;
        if (width !== undefined) updateData.width = width;
        if (notes !== undefined) updateData.notes = notes;
        if (totalPrice !== undefined) updateData.totalPrice = totalPrice;
        if (status !== undefined) updateData.status = status;

        // Update the order
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            updateData,
            { new: true, runValidators: true }
        ).populate('userID', 'username fullName clientId');

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

// Change order status manually (Admin only)
const changeOrderStatus = async (req, res) => {
    try {

        const { orderId } = req.params;
        const { status } = req.body;


        // Find and update the order
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { status: status },
            { new: true, runValidators: true }
        ).populate('userID', 'username fullName clientId');

        if (!updatedOrder) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            order: updatedOrder
        });

    } catch (error) {
        console.error('Error changing order status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while changing order status'
        });
    }
};

// Upload files to order (Admin only)

// Add new user (Admin only)
const addNewUser = async (req, res) => {
    try {

        const { username, fullName, password, role, clientId, phoneNumber } = req.body;

        // Validate required fields
        if (!username || !fullName || !password || !role || !clientId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: username, fullName, password, role, clientId'
            });
        }

        // Check if username already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Username already exists'
            });
        }
        let  firebaseUser

        try {

            firebaseUser = await admin.auth().createUser({
                email: `${phoneNumber}@dot.com`, // Create email from phone number
                password: "123456aA!",
                displayName: fullName,
                phoneNumber: `+972${phoneNumber.replace(/^0/, '')}`, // Format for Firebase (assuming Israeli numbers)
                disabled: false,

            });
        }catch (firebaseError) {
            console.error("Firebase Auth Error:", firebaseError);
            return res.status(400).json({
                message: "Failed to create Firebase user",
                error: firebaseError.message
            });
        }
        // Create new user
        const newUser = new User({
            fullName,
            username:`${phoneNumber}@dot.com` ,
            password,
            role: 'client',
            clientId,
            isActive: true,
            needToChangePassword: true,
            code: "123456",
            phoneNumber,
            firebaseUid: firebaseUser.uid // Store Firebase UID for future reference
        });

        const savedUser = await newUser.save();
        //todo: sms
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                userId: savedUser._id,
                username: savedUser.username,
                fullName: savedUser.fullName,
                role: savedUser.role,
                clientId: savedUser.clientId
            }
        });
    //todo: send username and password to the client via sms / email
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while creating user'
        });
    }
};

// Block/Unblock user (Admin only)
const blockUser = async (req, res) => {
    try {
        // Check if user has admin role
        if (!['admin', 'superAdmin'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin privileges required.'
            });
        }

        const { userId } = req.params;
        const { isActive } = req.body;

        // Validate isActive field
        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'isActive must be a boolean value'
            });
        }

        // Prevent admin from blocking themselves
        if (userId === req.user.userId.toString()) {
            return res.status(400).json({
                success: false,
                error: 'Cannot block/unblock your own account'
            });
        }

        // Update user status
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { isActive: isActive },
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
            message: `User ${isActive ? 'activated' : 'blocked'} successfully`,
            user: {
                userId: updatedUser._id,
                username: updatedUser.username,
                fullName: updatedUser.fullName,
                role: updatedUser.role,
                isActive: updatedUser.isActive
            }
        });

    } catch (error) {
        console.error('Error blocking/unblocking user:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while updating user status'
        });
    }
};

const getAllUsers   = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({
            success: true,
            users: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching users'
        });
    }
}

module.exports = {
    getAllOrders,
    getOrderDetails,
    updateOrder,
    changeOrderStatus,
    addNewUser,
    blockUser,
    getAllUsers
};
