const Order = require('../models/Order');

const getWorkerOrders = async (req, res) => {
    try {
        const orders = await Order.find({ assignedWorkerId: req.user.userId })
            .populate('userID', 'username fullName organizationCode phoneNumber')
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

module.exports = {
    getWorkerOrders
};
