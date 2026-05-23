const {
    authenticateClientByCredentials,
    resolveOpenApiClient,
    generateClientToken,
    formatOpenApiUser
} = require('../services/openApiAuth');
const { createClientOrder, formatOpenOrder, pickOrderFields } = require('../services/createClientOrder');

/**
 * POST /api/open/auth
 * Issue a JWT for registered client users (Postman / integrations).
 */
const openApiAuth = async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;
        const authResult = await authenticateClientByCredentials(phoneNumber, password);
        if (authResult.error) {
            return res.status(authResult.status).json({
                success: false,
                error: authResult.error
            });
        }

        const { user } = authResult;
        const token = generateClientToken(user);

        res.status(200).json({
            success: true,
            message: 'Authentication successful',
            token,
            expiresIn: '7d',
            user: formatOpenApiUser(user)
        });
    } catch (error) {
        console.error('Open API auth error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during authentication'
        });
    }
};

/**
 * POST /api/open/orders
 * Create an order with auth in the same request (credentials or Bearer token).
 */
const openApiCreateOrder = async (req, res) => {
    try {
        const authResult = await resolveOpenApiClient(req);
        if (authResult.error) {
            return res.status(authResult.status).json({
                success: false,
                error: authResult.error
            });
        }

        const { user } = authResult;
        const orderBody = req.body.order && typeof req.body.order === 'object'
            ? { ...req.body.order }
            : pickOrderFields(req.body);

        const result = await createClientOrder(user, orderBody);
        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                error: result.error
            });
        }

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: formatOpenOrder(result.order),
            user: formatOpenApiUser(user)
        });
    } catch (error) {
        console.error('Open API create order error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while creating order'
        });
    }
};

module.exports = {
    openApiAuth,
    openApiCreateOrder
};
