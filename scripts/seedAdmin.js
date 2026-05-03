const admin = require("../config/firebase");  // use the initialized instance

const Admins = require('../models/User');
const Client = require('../models/User');
const Orders = require('../models/Order');

const seedAdmin = async () => {
    try {
        console.log('🌱 Starting to seed admin user...');

        // Delete existing admin and recreate
        // await Admins.deleteOne({ username: 'admin' });
        // console.log('Deleted existing admin user');

        let firebaseUser = await admin.auth().createUser({
            email: `0503952222@dot.com`, // Create email from phone number
            password: 'admin123',
            displayName: 'muslah jaber' ,
            phoneNumber: `+972503952222`, // Format for Firebase (assuming Israeli numbers)
            disabled: false,

        });
        // Create admin user with plain password (let pre-save hook hash it)
        const admins = await Admins.create({
            username: 'muslah.jaber1@gmail.com',
            password: 'admin123',
            phoneNumber: '0503952222',
            role: 'admin',
            fullName: 'muslah',
            needToChangePassword: false,
            firebaseUid: firebaseUser.uid
        });
        //
        // const SuperAdmin = await Admin.create({
        //     username: 'majd@gmail.com',
        //     password: 'admin123',
        //     role: 'superAdmin',
        //     fullName: 'majd'
        //
        // });
    } catch (error) {
        console.error('❌ Error seeding admin user:', error);
        throw error;
    }
};
const seedClient = async () => {
    try {
        console.log('🌱 Starting to seed  user...');
        const admin = await Client.create({
            username: 'oz@gmail.com',
            password: 'oz123456',
            role: 'client',
            fullName: 'Oz cohen',
            phoneNumber: '0502203908'
        });
        // Test password comparison
    } catch (error) {
        console.error('❌ Error seeding  user:', error);
        throw error;
    }
};
const deleteDB = async () => {
    try {
        await Client.deleteMany({role:'client'})
        // await Admins.deleteMany({})
        await Orders.deleteMany({})
    } catch (error) {
        console.error('❌ Error seeding  user:', error);
        throw error;
    }
};
module.exports={
    seedAdmin,
    deleteDB,
    seedClient
}