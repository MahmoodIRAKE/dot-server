const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Files = require('../models/files');
const { organizationCodeFromBody } = require('../utils/organizationCodeFromBody');
const { createClientUser, formatCreatedUser } = require('../services/createClientUser');
const { createPrivateOrder } = require('../services/createClientOrder');
const {
    resolveActor,
    updateOrderWithAudit,
    getOrderAuditLogs
} = require('../services/orderAuditLog');
const {
    ensurePublicLink,
    regeneratePublicLink,
    revokePublicLink
} = require('../services/publicOrderStatus');
const { getOrderPrintData } = require('../services/orderPrint');
const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const admin = require('../config/firebase');

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

/** Resolve org for admin user assign; organizationId wins when both are provided. */
async function resolveOrganizationForAssign({ organizationId, organizationCode }) {
    if (organizationId) {
        if (!mongoose.Types.ObjectId.isValid(organizationId)) {
            return { status: 400, error: 'Invalid organization id' };
        }
        const org = await Organization.findById(organizationId);
        if (!org) return { status: 404, error: 'Organization not found' };
        return { organization: org };
    }
    if (organizationCode) {
        const org = await Organization.findOne({ organizationCode });
        if (!org) return { status: 404, error: 'Organization not found' };
        return { organization: org };
    }
    return null;
}

const DISALLOWED_USER_UPDATE_FIELDS = ['role', 'username', 'clientId'];

function formatAdminUserResponse(user) {
    return {
        userId: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        organizationCode: user.organizationCode ?? null,
        organizationId: user.organizationId ?? null,
        isActive: user.isActive
    };
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

// Create order for an unregistered private client (Admin only)
const createAdminOrder = async (req, res) => {
    try {
        const actor = resolveActor(req.user);
        const result = await createPrivateOrder(req.body, actor);

        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                error: result.error
            });
        }

        const order = await Order.findById(result.order._id)
            .populate('assignedWorkerId', workerPopulateFields);

        res.status(201).json({
            success: true,
            message: 'Private order created successfully',
            order
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while creating order'
        });
    }
};

// Update order details (Admin only)
const updateOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        const {
            customerFullName,
            customerPhoneNumber,
            customerAddress,
            requiredDeliveryDate,
            description,
            height,
            width,
            jobRef,
            notes,
            totalPrice,
            status
        } = req.body;

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

        if (status !== undefined) {
            const validStatuses = ['new', 'waiting for approval', 'in progress', 'paymentR', 'DONE', 'delayed', 'declined'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status value'
                });
            }
        }

        const updateData = {};
        if (customerFullName !== undefined) updateData.customerFullName = customerFullName;
        if (customerPhoneNumber !== undefined) updateData.customerPhoneNumber = customerPhoneNumber;
        if (customerAddress !== undefined) updateData.customerAddress = customerAddress;
        if (requiredDeliveryDate !== undefined) updateData.requiredDeliveryDate = requiredDeliveryDate;
        if (description !== undefined) updateData.description = description;
        if (height !== undefined) updateData.height = height;
        if (width !== undefined) updateData.width = width;
        if (jobRef !== undefined) updateData.jobRef = jobRef;
        if (notes !== undefined) updateData.notes = notes;
        if (totalPrice !== undefined) updateData.totalPrice = totalPrice;
        if (status !== undefined) updateData.status = status;

        const actor = resolveActor(req.user);
        const { order: updated } = await updateOrderWithAudit({
            orderId,
            updateData,
            actor
        });

        const updatedOrder = await Order.findById(updated._id)
            .populate('userID', clientUserPopulateFields)
            .populate('organizationId', organizationPopulateFields)
            .populate('assignedWorkerId', workerPopulateFields);

        res.status(200).json({
            success: true,
            message: 'Order updated successfully',
            order: updatedOrder
        });

    } catch (error) {
        if (error.status === 404) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
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

        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'status is required'
            });
        }

        const actor = resolveActor(req.user);
        const { order: updated } = await updateOrderWithAudit({
            orderId,
            updateData: { status },
            actor
        });

        const updatedOrder = await Order.findById(updated._id)
            .populate('userID', clientUserPopulateFields)
            .populate('organizationId', organizationPopulateFields)
            .populate('assignedWorkerId', workerPopulateFields);

        res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            order: updatedOrder
        });

    } catch (error) {
        if (error.status === 404) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        console.error('Error changing order status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while changing order status'
        });
    }
};

// Get audit / change history for an order (Admin only)
const getOrderAuditHistory = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid order id'
            });
        }

        const history = await getOrderAuditLogs(orderId);
        if (!history) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            orderId: history.orderId,
            orderNumber: history.orderNumber,
            logs: history.logs
        });
    } catch (error) {
        console.error('Error fetching order audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching order audit logs'
        });
    }
};

function handlePublicLinkError(res, error, actionLabel) {
    if (error.status === 404) {
        return res.status(404).json({
            success: false,
            error: 'Order not found'
        });
    }
    if (error.status === 400) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
    console.error(`Error ${actionLabel} public order link:`, error);
    return res.status(500).json({
        success: false,
        error: `Internal server error while ${actionLabel} public order link`
    });
}

// Get or create a public status link for any order (Admin / miniAdmin)
const createOrderPublicLink = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid order id'
            });
        }

        const link = await ensurePublicLink(orderId);
        res.status(200).json({
            success: true,
            message: 'Public status link ready',
            link
        });
    } catch (error) {
        return handlePublicLinkError(res, error, 'creating');
    }
};

// Regenerate public status token (Admin only)
const regenerateOrderPublicLink = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid order id'
            });
        }

        const link = await regeneratePublicLink(orderId);
        res.status(200).json({
            success: true,
            message: 'Public status link regenerated',
            link
        });
    } catch (error) {
        return handlePublicLinkError(res, error, 'regenerating');
    }
};

// Revoke public status link (Admin only)
const revokeOrderPublicLink = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid order id'
            });
        }

        const link = await revokePublicLink(orderId);
        res.status(200).json({
            success: true,
            message: 'Public status link revoked',
            link
        });
    } catch (error) {
        return handlePublicLinkError(res, error, 'revoking');
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

// Create worker or miniAdmin user (Admin only) — separate from addNewUser (clients)
const createNewWorker = async (req, res) => {
    let firebaseUser;
    try {
        const { fullName, phoneNumber, password, role: requestedRole } = req.body;

        if (!fullName || !phoneNumber || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: fullName, phoneNumber, password'
            });
        }

        const allowedStaffRoles = ['worker', 'miniAdmin', 'admin'];
        const staffRole = allowedStaffRoles.includes(requestedRole) ? requestedRole : 'worker';

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
            password: '123456aA!',
            role: staffRole,
            isActive: true,
            needToChangePassword: true,
            code: '123456',
            phoneNumber,
            firebaseUid: firebaseUser.uid
        });

        const savedUser = await newUser.save();
        const roleLabels = { worker: 'Worker', miniAdmin: 'Mini admin', admin: 'Admin' };
        const roleLabel = roleLabels[staffRole] || 'Staff';
        res.status(201).json({
            success: true,
            message: `${roleLabel} created successfully`,
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
        console.error('Error creating staff user:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while creating staff user'
        });
    }
};

// Assign or unassign worker on an order (Admin). Body: { workerId } — null/empty to unassign
const assignOrderToWorker = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { workerId } = req.body;
        const actor = resolveActor(req.user);

        if (workerId === undefined || workerId === null || workerId === '') {
            const { order: updated } = await updateOrderWithAudit({
                orderId,
                updateData: { assignedWorkerId: null },
                actor
            });

            const populated = await Order.findById(updated._id)
                .populate('userID', clientUserPopulateFields)
                .populate('organizationId', organizationPopulateFields)
                .populate('assignedWorkerId', workerPopulateFields);

            return res.status(200).json({
                success: true,
                message: 'Worker unassigned from order',
                order: populated
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

        const { order: updated } = await updateOrderWithAudit({
            orderId,
            updateData: { assignedWorkerId: worker._id },
            actor
        });

        const updatedOrder = await Order.findById(updated._id)
            .populate('userID', clientUserPopulateFields)
            .populate('organizationId', organizationPopulateFields)
            .populate('assignedWorkerId', workerPopulateFields);

        res.status(200).json({
            success: true,
            message: 'Order assigned to worker successfully',
            order: updatedOrder
        });
    } catch (error) {
        if (error.status === 404) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        console.error('Error assigning order to worker:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while assigning order'
        });
    }
};

// Update client user (Admin only) — optional org assign clears or cascades to orders
const updateUser = async (req, res) => {
    try {
        if (!['admin', 'superAdmin'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden'
            });
        }

        for (const field of DISALLOWED_USER_UPDATE_FIELDS) {
            if (req.body[field] !== undefined) {
                return res.status(400).json({
                    success: false,
                    error: `${field} is not allowed in the request body`
                });
            }
        }

        const { userId } = req.params;
        const { fullName, phoneNumber } = req.body;
        const hasOrganizationId = Object.prototype.hasOwnProperty.call(req.body, 'organizationId');
        const hasOrganizationCode = Object.prototype.hasOwnProperty.call(req.body, 'organizationCode');
        const organizationId = req.body.organizationId;
        const organizationCode = req.body.organizationCode;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const updateData = {};
        if (fullName !== undefined) updateData.fullName = fullName;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

        let ordersUpdated;
        let shouldCascadeOrders = false;

        if (hasOrganizationId || hasOrganizationCode) {
            const clearById = hasOrganizationId && (organizationId === null || organizationId === '');
            const clearByCode = hasOrganizationCode && organizationCode === '';

            if (clearById || clearByCode) {
                updateData.organizationId = null;
                updateData.organizationCode = null;
            } else if (hasOrganizationId) {
                const resolved = await resolveOrganizationForAssign({ organizationId });
                if (resolved?.error) {
                    return res.status(resolved.status).json({
                        success: false,
                        error: resolved.error
                    });
                }
                updateData.organizationId = resolved.organization._id;
                updateData.organizationCode = resolved.organization.organizationCode;
                shouldCascadeOrders = true;
            } else {
                const resolved = await resolveOrganizationForAssign({ organizationCode });
                if (resolved?.error) {
                    return res.status(resolved.status).json({
                        success: false,
                        error: resolved.error
                    });
                }
                updateData.organizationId = resolved.organization._id;
                updateData.organizationCode = resolved.organization.organizationCode;
                shouldCascadeOrders = true;
            }
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        );

        if (shouldCascadeOrders && updateData.organizationId) {
            const orderUpdateResult = await Order.updateMany(
                { userID: user._id },
                { $set: { organizationId: updateData.organizationId } }
            );
            ordersUpdated = orderUpdateResult.matchedCount;
        }

        const response = {
            success: true,
            message: 'User updated successfully',
            user: formatAdminUserResponse(updatedUser)
        };
        if (ordersUpdated !== undefined) {
            response.ordersUpdated = ordersUpdated;
        }

        res.status(200).json(response);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while updating user'
        });
    }
};

const DELETABLE_USER_ROLES = ['client', 'worker', 'miniAdmin'];

async function deleteFirebaseAuthUser(firebaseUid) {
    if (!firebaseUid) return;
    try {
        await admin.auth().deleteUser(firebaseUid);
    } catch (firebaseError) {
        if (firebaseError.code !== 'auth/user-not-found') {
            throw firebaseError;
        }
    }
}

// Delete client / worker / miniAdmin (Admin only). Orders are preserved.
const deleteUser = async (req, res) => {
    try {
        if (!['admin', 'superAdmin'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden'
            });
        }

        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user id'
            });
        }

        if (userId === req.user.userId.toString()) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete your own account'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (!DELETABLE_USER_ROLES.includes(user.role)) {
            return res.status(400).json({
                success: false,
                error: 'Only client, worker, or miniAdmin users can be deleted'
            });
        }

        const ordersPreserved = await Order.countDocuments({
            $or: [{ userID: user._id }, { assignedWorkerId: user._id }]
        });

        try {
            await deleteFirebaseAuthUser(user.firebaseUid);
        } catch (firebaseError) {
            console.error('Firebase delete error:', firebaseError);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete user authentication account'
            });
        }

        // Detach worker from orders before removing the user
        if (user.role === 'worker' || user.role === 'miniAdmin') {
            await Order.updateMany(
                { assignedWorkerId: user._id },
                { $unset: { assignedWorkerId: 1 } }
            );
        }

        await User.findByIdAndDelete(userId);

        res.status(200).json({
            success: true,
            message: 'User deleted successfully',
            deletedRole: user.role,
            ordersPreserved
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while deleting user'
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

// Delete organization + its client users (Admin only). Orders are preserved.
const deleteOrganization = async (req, res) => {
    try {
        if (!['admin', 'superAdmin'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden'
            });
        }

        const { organizationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(organizationId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid organization id'
            });
        }

        const organization = await Organization.findById(organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }

        const clients = await User.find({
            organizationId: organization._id,
            role: 'client'
        });

        for (const client of clients) {
            try {
                await deleteFirebaseAuthUser(client.firebaseUid);
            } catch (firebaseError) {
                console.error('Firebase delete error for org client:', firebaseError);
                return res.status(500).json({
                    success: false,
                    error: `Failed to delete authentication for client ${client.fullName || client.username}`
                });
            }
        }

        const clientsDeleted = await User.deleteMany({
            organizationId: organization._id,
            role: 'client'
        });

        // Keep historical orders; clear org link so lists stay consistent
        await Order.updateMany(
            { organizationId: organization._id },
            { $unset: { organizationId: 1 } }
        );

        await Organization.findByIdAndDelete(organizationId);

        res.status(200).json({
            success: true,
            message: 'Organization deleted successfully',
            clientsDeleted: clientsDeleted.deletedCount || 0
        });
    } catch (error) {
        console.error('Error deleting organization:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while deleting organization'
        });
    }
};

// Print payload for formal order documents (Admin / miniAdmin)
const getOrderPrint = async (req, res) => {
    try {
        const { orderId, printType } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid order id'
            });
        }

        const payload = await getOrderPrintData(orderId, printType);
        return res.status(200).json({
            success: true,
            print: payload
        });
    } catch (error) {
        if (error.status === 404) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        if (error.status === 400) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
        console.error('Error building order print payload:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while preparing print data'
        });
    }
};

module.exports = {
    getAllOrders,
    getOrderDetails,
    createAdminOrder,
    updateOrder,
    changeOrderStatus,
    getOrderAuditHistory,
    createOrderPublicLink,
    regenerateOrderPublicLink,
    revokeOrderPublicLink,
    getOrderPrint,
    addNewUser,
    updateUser,
    deleteUser,
    createNewWorker,
    assignOrderToWorker,
    blockUser,
    getAllUsers,
    createOrganization,
    getAllOrganizations,
    getOrganizationById,
    deleteOrganization
};
