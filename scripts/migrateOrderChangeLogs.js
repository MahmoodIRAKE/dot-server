/**
 * Ensure order_change_logs collection and indexes exist.
 * Run: node scripts/migrateOrderChangeLogs.js
 *
 * Requires MONGO_URI (or MONGODB_URI) in .env — same as the main app.
 * Note: Transactional order+audit writes need a MongoDB replica set (Atlas default).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const OrderChangeLog = require('../models/OrderChangeLog');

async function main() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error('Missing MONGO_URI or MONGODB_URI');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected.');

    await OrderChangeLog.createCollection();
    await OrderChangeLog.syncIndexes();

    const indexes = await OrderChangeLog.collection.indexes();
    console.log('order_change_logs indexes:', indexes.map((i) => i.name).join(', '));
    console.log('Migration complete.');
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    try {
        await mongoose.disconnect();
    } catch (_) {
        /* ignore */
    }
    process.exit(1);
});
