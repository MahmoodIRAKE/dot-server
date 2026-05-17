const User = require('../models/User');
const admin = require('../config/firebase');

const DEFAULT_PASSWORD = '123456aA!';

/**
 * Create a client user in the given organization (Firebase + MongoDB).
 */
async function createClientUser({ fullName, phoneNumber, password, organization }) {
    const username = `${phoneNumber}@dot.com`;
    const existingUser = await User.findOne({ $or: [{ username }, { phoneNumber }] });
    if (existingUser) {
        return {
            success: false,
            status: 400,
            error: 'User with this phone number already exists'
        };
    }

    const userPassword = password || DEFAULT_PASSWORD;
    let firebaseUser;

    try {
        firebaseUser = await admin.auth().createUser({
            email: username,
            password: userPassword,
            displayName: fullName,
            phoneNumber: `+972${phoneNumber.replace(/^0/, '')}`,
            disabled: false
        });
    } catch (firebaseError) {
        console.error('Firebase Auth Error:', firebaseError);
        return {
            success: false,
            status: 400,
            error: 'Failed to create Firebase user',
            message: firebaseError.message
        };
    }

    try {
        const newUser = new User({
            fullName,
            username,
            password: userPassword,
            role: 'client',
            organizationCode: organization.organizationCode,
            organizationId: organization._id,
            isActive: true,
            needToChangePassword: true,
            code: '123456',
            phoneNumber,
            firebaseUid: firebaseUser.uid
        });

        const savedUser = await newUser.save();
        return { success: true, user: savedUser };
    } catch (dbError) {
        try {
            await admin.auth().deleteUser(firebaseUser.uid);
        } catch (cleanupError) {
            console.error('Failed to cleanup Firebase user:', cleanupError);
        }
        console.error('Database Error:', dbError);
        return {
            success: false,
            status: 400,
            error: 'Failed to create user in database',
            message: dbError.message
        };
    }
}

function formatCreatedUser(user) {
    return {
        userId: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        organizationCode: user.organizationCode,
        organizationId: user.organizationId
    };
}

module.exports = { createClientUser, formatCreatedUser };
