const { getPublicStatusByToken } = require('../services/publicOrderStatus');

/**
 * Public order status by token (no auth). Private orders only.
 */
const getPublicOrderStatus = async (req, res) => {
    try {
        const { token } = req.params;
        const order = await getPublicStatusByToken(token);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order status not found'
            });
        }

        res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        console.error('Error fetching public order status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching order status'
        });
    }
};

module.exports = {
    getPublicOrderStatus
};
