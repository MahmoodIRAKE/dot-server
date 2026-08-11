const User = require('../models/User');
const admin = require('../config/firebase');

function toE164Il(phoneNumber) {
    const digits = String(phoneNumber || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('972')) return `+${digits}`;
    if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
    return `+972${digits}`;
}

function formatProfileUser(user) {
    const org = user.organizationId;
    const orgId =
        org && typeof org === 'object' && org._id ? org._id : org || null;
    return {
        _id: user._id,
        userId: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        organizationCode: user.organizationCode,
        organizationId: orgId,
        organization: org && typeof org === 'object' && org.name ? org : undefined,
        firebaseUid: user.firebaseUid,
        isActive: user.isActive,
        needToChangePassword: user.needToChangePassword
    };
}

/**
 * Update the authenticated user's own fullName / phoneNumber.
 * Syncs Mongo username + Firebase email/phone/displayName when phone changes.
 */
async function updateOwnProfile(userId, { fullName, phoneNumber }) {
    if (!userId) {
        const err = new Error('Unauthorized');
        err.status = 401;
        throw err;
    }

    const nextName =
        fullName !== undefined && fullName !== null
            ? String(fullName).trim()
            : undefined;
    const nextPhone =
        phoneNumber !== undefined && phoneNumber !== null
            ? String(phoneNumber).trim()
            : undefined;

    if (nextName === undefined && nextPhone === undefined) {
        const err = new Error('fullName or phoneNumber is required');
        err.status = 400;
        throw err;
    }

    if (nextName !== undefined && !nextName) {
        const err = new Error('fullName cannot be empty');
        err.status = 400;
        throw err;
    }

    if (nextPhone !== undefined && !nextPhone) {
        const err = new Error('phoneNumber cannot be empty');
        err.status = 400;
        throw err;
    }

    const user = await User.findById(userId);
    if (!user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }

    const phoneChanged =
        nextPhone !== undefined && nextPhone !== user.phoneNumber;
    const nameChanged =
        nextName !== undefined && nextName !== user.fullName;

    if (!phoneChanged && !nameChanged) {
        const populated = await User.findById(userId).populate(
            'organizationId',
            'name organizationCode'
        );
        return formatProfileUser(populated);
    }

    if (phoneChanged) {
        const username = `${nextPhone}@dot.com`;
        const conflict = await User.findOne({
            _id: { $ne: user._id },
            $or: [{ phoneNumber: nextPhone }, { username }]
        });
        if (conflict) {
            const err = new Error('Phone number is already in use');
            err.status = 400;
            throw err;
        }
        user.phoneNumber = nextPhone;
        user.username = username;
    }

    if (nameChanged) {
        user.fullName = nextName;
    }

    if (user.firebaseUid && (phoneChanged || nameChanged)) {
        const firebaseUpdate = {};
        if (nameChanged) firebaseUpdate.displayName = user.fullName;
        if (phoneChanged) {
            firebaseUpdate.email = user.username;
            const e164 = toE164Il(user.phoneNumber);
            if (e164) firebaseUpdate.phoneNumber = e164;
        }
        try {
            await admin.auth().updateUser(user.firebaseUid, firebaseUpdate);
        } catch (firebaseError) {
            // Phone already on another Firebase user — still allow Mongo update if email works
            if (
                firebaseError.code === 'auth/phone-number-already-exists' &&
                firebaseUpdate.email
            ) {
                const { phoneNumber: _p, ...withoutPhone } = firebaseUpdate;
                if (Object.keys(withoutPhone).length) {
                    await admin.auth().updateUser(user.firebaseUid, withoutPhone);
                }
            } else if (firebaseError.code !== 'auth/user-not-found') {
                const err = new Error(
                    firebaseError.message || 'Failed to sync authentication profile'
                );
                err.status = 400;
                throw err;
            }
        }
    }

    await user.save();

    const populated = await User.findById(user._id).populate(
        'organizationId',
        'name organizationCode'
    );
    return formatProfileUser(populated);
}

module.exports = {
    updateOwnProfile,
    formatProfileUser,
    toE164Il
};
