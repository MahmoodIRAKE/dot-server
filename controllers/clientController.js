const Order = require('../models/Order');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Files = require("../models/files");
const { clientOrdersFilter, clientCanAccessOrder } = require('../utils/organizationAccess');
const { createClientUser, formatCreatedUser } = require('../services/createClientUser');

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

        if (!req.user.organizationId) {
            return res.status(400).json({
                success: false,
                error: 'Your account is not linked to an organization. Contact your administrator.'
            });
        }



        // Create new order
        const newOrder = new Order({
            userID: req.user.userId,
            organizationId: req.user.organizationId || undefined,
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

        // Find orders for the authenticated client's organization
        const orders = await Order.find(clientOrdersFilter(req.user))
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

        const order = await Order.findById(orderId);

        if (!clientCanAccessOrder(req.user, order)) {
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


        const { fullName, phoneNumber } = req.body;

        // Update user profile (organization code is managed by admin)
        const updatedUser = await User.findByIdAndUpdate(
            req.user.userId,
            { fullName, phoneNumber },
            { new: true, runValidators: true }
        ).populate('organizationId', 'name organizationCode');

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
                role: updatedUser.role,
                phoneNumber: updatedUser.phoneNumber,
                organizationCode: updatedUser.organizationCode,
                organizationId: updatedUser.organizationId?._id || updatedUser.organizationId,
                organization: updatedUser.organizationId
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

// List client users in the caller's organization
const getOrganizationUsers = async (req, res) => {
    try {
        if (!req.user.organizationId) {
            return res.status(400).json({
                success: false,
                error: 'Your account is not linked to an organization.'
            });
        }

        const users = await User.find({
            organizationId: req.user.organizationId,
            role: 'client'
        }).select('username fullName phoneNumber isActive createdAt organizationCode');

        res.status(200).json({
            success: true,
            users
        });
    } catch (error) {
        console.error('Error fetching organization users:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching organization users'
        });
    }
};

// Add a new client user to the caller's organization
const addOrganizationUser = async (req, res) => {
    try {
        if (!req.user.organizationId) {
            return res.status(400).json({
                success: false,
                error: 'Your account is not linked to an organization.'
            });
        }

        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }
        if (!organization.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Organization is inactive'
            });
        }

        const { fullName, phoneNumber, password } = req.body;
        if (!fullName || !phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: fullName, phoneNumber'
            });
        }

        const result = await createClientUser({ fullName, phoneNumber, password, organization });
        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }

        res.status(201).json({
            success: true,
            message: 'User added to your organization successfully',
            user: formatCreatedUser(result.user)
        });
    } catch (error) {
        console.error('Error adding organization user:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while adding user'
        });
    }
};

module.exports = {
    createOrder,
    getClientOrders,
    updateOrder,
    updateProfile,
    orderConfirm,
    getOrganizationUsers,
    addOrganizationUser
};
