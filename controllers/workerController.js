const mongoose = require('mongoose');
const Order = require('../models/Order');
const Files = require('../models/files');

const getWorkerOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            assignedWorkerId: req.user.userId,
            $or: [{ isArchived: false }, { isArchived: { $exists: false } }]
        })
            .populate('userID', 'username fullName organizationCode phoneNumber')
            .populate('organizationId', 'name organizationCode isActive')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            orders
        });
    } catch (error) {
        console.error('Error fetching worker orders:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching orders'
        });
    }
};

const getWorkerOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid order ID format'
            });
        }

        const order = await Order.findOne({
            _id: orderId,
            assignedWorkerId: req.user.userId,
            $or: [{ isArchived: false }, { isArchived: { $exists: false } }]
        })
            .populate('userID', 'username fullName organizationCode phoneNumber')
            .populate('organizationId', 'name organizationCode isActive');

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        const files = await Files.find({
            orderId: order._id,
            fileCategory: 'work'
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            order,
            files
        });
    } catch (error) {
        console.error('Error fetching worker order details:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching order details'
        });
    }
};

module.exports = {
    getWorkerOrders,
    getWorkerOrderDetails
};
