/** External customer-facing progress steps (Customer Status Link). */
const CUSTOMER_STATUSES = [
    'order_received',
    'in_production',
    'installation',
    'completed'
];

const CUSTOMER_STATUS_DEFAULT = 'order_received';

function isValidCustomerStatus(value) {
    return typeof value === 'string' && CUSTOMER_STATUSES.includes(value);
}

module.exports = {
    CUSTOMER_STATUSES,
    CUSTOMER_STATUS_DEFAULT,
    isValidCustomerStatus
};
