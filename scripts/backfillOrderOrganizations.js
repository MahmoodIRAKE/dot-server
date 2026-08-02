/**
 * One-time backfill: set organizationId on orders that belong to users with an org
 * but orders still missing or null organizationId.
 * Run once after deploy: node scripts/backfillOrderOrganizations.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');

async function backfill() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({ organizationId: { $ne: null } });
    let totalMatched = 0;

    for (const user of users) {
        const result = await Order.updateMany(
            {
                userID: user._id,
                $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
            },
            { $set: { organizationId: user.organizationId } }
        );
        if (result.matchedCount > 0) {
            console.log(
                `User ${user._id}: backfilled ${result.modifiedCount}/${result.matchedCount} order(s)`
            );
        }
        totalMatched += result.modifiedCount;
    }

    console.log(`Done. Modified ${totalMatched} order(s) across ${users.length} user(s).`);
    await mongoose.disconnect();
}

backfill().catch((err) => {
    console.error(err);
    process.exit(1);
});
