const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Users = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    fullName:{
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: false
    },
    role: {
        type: String,
        enum: ['client', 'admin', 'superAdmin'],
        required: true
    },
    clientId:{
        type: String,
        required: false,
    },
    isActive: {
        type: Boolean,
        default: true
    },
    code: {
        type: String,
        required: false,

    },
    needToChangePassword: {
        type: Boolean,
        default: false
    },
    firebaseUid: {
        type: String,
        unique: true,
        sparse: true
    }
    , // Optional field for Firebase Auth UID

}, {
    timestamps: true
});

// Hash password before saving
Users.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
Users.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};
Users.methods.checkPassword = async function (password) {
    return bcrypt.compare(password, this.password);
};
module.exports = mongoose.model('Users', Users);