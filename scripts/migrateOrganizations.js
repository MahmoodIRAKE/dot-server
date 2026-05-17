/**
 * Backfill Organizations from existing client users and orders.
 * Renames legacy clientId fields to organizationCode when present.
 * Run once: node scripts/migrateOrganizations.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Organization = require('../models/Organization');

async function renameLegacyFields() {
    const orgs = await Organization.collection.find({ clientId: { $exists: true } }).toArray();
    for (const org of orgs) {
        await Organization.collection.updateOne(
            { _id: org._id },
            {
                $set: { organizationCode: org.organizationCode || org.clientId },
                $unset: { clientId: '' }
            }
        );
    }

    const users = await User.collection.find({ clientId: { $exists: true } }).toArray();
    for (const user of users) {
        await User.collection.updateOne(
            { _id: user._id },
            {
                $set: { organizationCode: user.organizationCode || user.clientId },
                $unset: { clientId: '' }
            }
        );
    }
}

async function migrate() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    await renameLegacyFields();

    const clients = await User.find({ role: 'client' });
    const codes = [...new Set(clients.map((u) => u.organizationCode).filter(Boolean))];

    let orgsCreated = 0;
    let usersLinked = 0;
    let ordersLinked = 0;

    for (const organizationCode of codes) {
        let organization = await Organization.findOne({ organizationCode });
        if (!organization) {
            const sampleUser = clients.find((u) => u.organizationCode === organizationCode);
            organization = await Organization.create({
                name: sampleUser?.fullName ? `${sampleUser.fullName} (migrated)` : `Organization ${organizationCode}`,
                organizationCode
            });
            orgsCreated++;
            console.log(`Created organization for organizationCode: ${organizationCode}`);
        }

        const linkResult = await User.updateMany(
            {
                role: 'client',
                organizationCode,
                $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
            },
            { $set: { organizationId: organization._id } }
        );
        usersLinked += linkResult.modifiedCount;

        const orderResult = await Order.updateMany(
            {
                organizationId: null,
                userID: { $in: clients.filter((u) => u.organizationCode === organizationCode).map((u) => u._id) }
            },
            { $set: { organizationId: organization._id } }
        );
        ordersLinked += orderResult.modifiedCount;
    }

    console.log(`Done. Organizations created: ${orgsCreated}, users linked: ${usersLinked}, orders linked: ${ordersLinked}`);
    await mongoose.disconnect();
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
