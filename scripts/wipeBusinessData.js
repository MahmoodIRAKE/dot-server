/**
 * Delete all business data; keep only admin + superAdmin users.
 *
 * Dry-run (default — shows what would be deleted):
 *   node scripts/wipeBusinessData.js
 *
 * Actually delete:
 *   node scripts/wipeBusinessData.js --confirm
 *
 * Also removes matching Firebase Auth users when FIREBASE_SERVICE_ACCOUNT is set
 * (skipped for kept admins).
 */
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Order = require('../models/Order');
const Organization = require('../models/Organization');
const Files = require('../models/files');
const OrderChangeLog = require('../models/OrderChangeLog');

const KEEP_ROLES = ['admin', 'superAdmin'];

async function tryDeleteFirebaseUsers(users) {
    let admin;
    try {
        admin = require('../config/firebase');
    } catch (err) {
        console.warn('Firebase not available — skipping Auth user cleanup:', err.message);
        return { deleted: 0, skipped: users.length, errors: 0 };
    }

    let deleted = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
        if (!user.firebaseUid) {
            skipped += 1;
            continue;
        }
        try {
            await admin.auth().deleteUser(user.firebaseUid);
            deleted += 1;
        } catch (err) {
            errors += 1;
            console.warn(
                `  Firebase delete failed for ${user.username} (${user.firebaseUid}): ${err.message}`
            );
        }
    }

    return { deleted, skipped, errors };
}

async function resetOrderCounter() {
    const db = mongoose.connection.db;
    if (!db) return 0;

    // mongoose-sequence stores counters in the "counters" collection
    const result = await db.collection('counters').deleteMany({
        $or: [{ id: 'orderNumber' }, { _id: 'orderNumber' }],
    });
    return result.deletedCount || 0;
}

async function main() {
    const confirm = process.argv.includes('--confirm');
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error('Missing MONGO_URI or MONGODB_URI in .env');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB.\n');

    const keepUsers = await User.find({ role: { $in: KEEP_ROLES } })
        .select('_id username fullName role firebaseUid')
        .lean();
    const deleteUsers = await User.find({ role: { $nin: KEEP_ROLES } })
        .select('_id username fullName role firebaseUid')
        .lean();

    const [orderCount, orgCount, fileCount, logCount] = await Promise.all([
        Order.countDocuments(),
        Organization.countDocuments(),
        Files.countDocuments(),
        OrderChangeLog.countDocuments(),
    ]);

    console.log('Will KEEP these admins:');
    if (!keepUsers.length) {
        console.log('  (none found — aborting for safety)');
        await mongoose.disconnect();
        process.exit(1);
    }
    keepUsers.forEach((u) => {
        console.log(`  - ${u.fullName || u.username} [${u.role}] (${u.username})`);
    });

    console.log('\nWill DELETE:');
    console.log(`  Users (clients / workers / miniAdmin / …): ${deleteUsers.length}`);
    deleteUsers.slice(0, 20).forEach((u) => {
        console.log(`    - ${u.fullName || u.username} [${u.role}]`);
    });
    if (deleteUsers.length > 20) {
        console.log(`    … and ${deleteUsers.length - 20} more`);
    }
    console.log(`  Organizations: ${orgCount}`);
    console.log(`  Orders: ${orderCount}`);
    console.log(`  Files: ${fileCount}`);
    console.log(`  Order change logs: ${logCount}`);
    console.log('  Order number counter: reset');

    if (!confirm) {
        console.log('\nDry-run only. Re-run with --confirm to delete:');
        console.log('  node scripts/wipeBusinessData.js --confirm');
        await mongoose.disconnect();
        return;
    }

    console.log('\nDeleting…');

    const firebaseStats = await tryDeleteFirebaseUsers(deleteUsers);
    console.log(
        `  Firebase Auth: deleted=${firebaseStats.deleted}, skipped=${firebaseStats.skipped}, errors=${firebaseStats.errors}`
    );

    const [filesRes, logsRes, ordersRes, orgsRes, usersRes] = await Promise.all([
        Files.deleteMany({}),
        OrderChangeLog.deleteMany({}),
        Order.deleteMany({}),
        Organization.deleteMany({}),
        User.deleteMany({ role: { $nin: KEEP_ROLES } }),
    ]);

    const counterDeleted = await resetOrderCounter();

    console.log('\nDone.');
    console.log(`  Files removed: ${filesRes.deletedCount}`);
    console.log(`  Order logs removed: ${logsRes.deletedCount}`);
    console.log(`  Orders removed: ${ordersRes.deletedCount}`);
    console.log(`  Organizations removed: ${orgsRes.deletedCount}`);
    console.log(`  Users removed: ${usersRes.deletedCount}`);
    console.log(`  Counters removed: ${counterDeleted}`);
    console.log(`  Admins kept: ${keepUsers.length}`);

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
