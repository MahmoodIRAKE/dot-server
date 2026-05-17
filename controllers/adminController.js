const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Files = require('../models/files');
const { organizationCodeFromBody } = require('../utils/organizationCodeFromBody');
const { createClientUser, formatCreatedUser } = require('../services/createClientUser');
const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const admin = require("firebase-admin");

const workerPopulateFields = 'username fullName phoneNumber role';
const clientUserPopulateFields = 'username fullName organizationCode phoneNumber organizationId';
const organizationPopulateFields = 'name organizationCode isActive';

async function resolveOrganization({ organizationId, organizationCode }) {
    const code = organizationCode;
    if (organizationId) {
        if (!mongoose.Types.ObjectId.isValid(organizationId)) {
            return { error: 'Invalid organizationId' };
        }
        const org = await Organization.findById(organizationId);
        if (!org) return { error: 'Organization not found' };
        return { organization: org };
    }
    if (code) {
        const org = await Organization.findOne({ organizationCode: code });
        if (!org) return { error: 'Organization not found for this organizationCode' };
        return { organization: org };
    }
    return { error: 'organizationId or organizationCode is required' };
}

// Get all orders (Admin only)
const getAllOrders = async (req, res) => {
    try {

        // Get all orders with user information
        const orders = await Order.find()
            .populate('userID', clientUserPopulateFields)
            .populate('organizationId', organizationPopulateFields)
            .populate('assignedWorkerId', workerPopulateFields)
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
            .populate('userID', clientUserPopulateFields)
            .populate('organizationId', organizationPopulateFields)
            .populate('assignedWorkerId', workerPopulateFields);

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
        ).populate('userID', clientUserPopulateFields)
            .populate('organizationId', organizationPopulateFields)
            .populate('assignedWorkerId', workerPopulateFields);

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
        ).populate('userID', clientUserPopulateFields)
            .populate('organizationId', organizationPopulateFields)
            .populate('assignedWorkerId', workerPopulateFields);

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

// Add new client user to an organization (Admin only)
const addNewUser = async (req, res) => {
    try {
        const { fullName, password, phoneNumber, organizationId } = req.body;
        const organizationCode = organizationCodeFromBody(req.body);

        if (!fullName || !phoneNumber || (!organizationCode && !organizationId)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: fullName, phoneNumber, and organizationId or organizationCode'
            });
        }

        const { organization, error: orgError } = await resolveOrganization({
            organizationId,
            organizationCode
        });
        if (orgError) {
            return res.status(400).json({ success: false, error: orgError });
        }

        if (!organization.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Organization is inactive'
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
            message: 'User created successfully',
            user: formatCreatedUser(result.user)
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while creating user'
        });
    }
};

// Create worker user only (Admin) — separate from addNewUser (clients)
const createNewWorker = async (req, res) => {
    let firebaseUser;
    try {
        const { fullName, phoneNumber, password } = req.body;

        if (!fullName || !phoneNumber || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: fullName, phoneNumber, password'
            });
        }

        const username = `${phoneNumber}@dot.com`;
        const existingUser = await User.findOne({ $or: [{ username }, { phoneNumber }] });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this phone number or username already exists'
            });
        }

        try {
            firebaseUser = await admin.auth().createUser({
                email: username,
                password,
                displayName: fullName,
                phoneNumber: `+972${phoneNumber.replace(/^0/, '')}`,
                disabled: false
            });
        } catch (firebaseError) {
            console.error('Firebase Auth Error:', firebaseError);
            return res.status(400).json({
                message: 'Failed to create Firebase user',
                error: firebaseError.message
            });
        }

        const newUser = new User({
            fullName,
            username,
            password:'123456aA!',
            role: 'worker',
            isActive: true,
            needToChangePassword: true,
            code: '123456',
            phoneNumber,
            firebaseUid: firebaseUser.uid
        });

        const savedUser = await newUser.save();
        res.status(201).json({
            success: true,
            message: 'Worker created successfully',
            user: {
                userId: savedUser._id,
                username: savedUser.username,
                fullName: savedUser.fullName,
                role: savedUser.role,
                phoneNumber: savedUser.phoneNumber
            }
        });
    } catch (error) {
        if (firebaseUser && firebaseUser.uid) {
            try {
                await admin.auth().deleteUser(firebaseUser.uid);
            } catch (cleanupError) {
                console.error('Failed to cleanup Firebase user:', cleanupError);
            }
        }
        console.error('Error creating worker:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while creating worker'
        });
    }
};

// Assign or unassign worker on an order (Admin). Body: { workerId } — null/empty to unassign
const assignOrderToWorker = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { workerId } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        if (workerId === undefined || workerId === null || workerId === '') {
            const updated = await Order.findByIdAndUpdate(
                orderId,
                { assignedWorkerId: null },
                { new: true }
            )
                .populate('userID', clientUserPopulateFields)
                .populate('organizationId', organizationPopulateFields)
                .populate('assignedWorkerId', workerPopulateFields);
            return res.status(200).json({
                success: true,
                message: 'Worker unassigned from order',
                order: updated
            });
        }

        if (!mongoose.Types.ObjectId.isValid(workerId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid workerId'
            });
        }

        const worker = await User.findById(workerId);
        if (!worker || worker.role !== 'worker') {
            return res.status(400).json({
                success: false,
                error: 'workerId must reference an existing user with role worker'
            });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { assignedWorkerId: worker._id },
            { new: true, runValidators: true }
        )
            .populate('userID', clientUserPopulateFields)
            .populate('organizationId', organizationPopulateFields)
            .populate('assignedWorkerId', workerPopulateFields);

        res.status(200).json({
            success: true,
            message: 'Order assigned to worker successfully',
            order: updatedOrder
        });
    } catch (error) {
        console.error('Error assigning order to worker:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while assigning order'
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
        const users = await User.find().populate('organizationId', organizationPopulateFields);
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
};

const createOrganization = async (req, res) => {
    try {
        const { name, organizationCode } = req.body;
        if (!name || !organizationCode) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, organizationCode'
            });
        }

        const existing = await Organization.findOne({ organizationCode });
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'An organization with this organizationCode already exists'
            });
        }

        const organization = await new Organization({ name, organizationCode }).save();
        res.status(201).json({
            success: true,
            message: 'Organization created successfully',
            organization
        });
    } catch (error) {
        console.error('Error creating organization:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while creating organization'
        });
    }
};

const getAllOrganizations = async (req, res) => {
    try {
        const organizations = await Organization.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            organizations
        });
    } catch (error) {
        console.error('Error fetching organizations:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching organizations'
        });
    }
};

const getOrganizationById = async (req, res) => {
    try {
        const { organizationId } = req.params;
        const organization = await Organization.findById(organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }

        const users = await User.find({
            organizationId: organization._id,
            role: 'client'
        }).select('username fullName phoneNumber isActive createdAt');

        res.status(200).json({
            success: true,
            organization,
            users
        });
    } catch (error) {
        console.error('Error fetching organization:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching organization'
        });
    }
};

module.exports = {
    getAllOrders,
    getOrderDetails,
    updateOrder,
    changeOrderStatus,
    addNewUser,
    createNewWorker,
    assignOrderToWorker,
    blockUser,
    getAllUsers,
    createOrganization,
    getAllOrganizations,
    getOrganizationById
};
