const Admin = require('../models/User');
const Client = require('../models/User');

const seedAdmin = async () => {
    try {
        console.log('🌱 Starting to seed admin user...');

        // Delete existing admin and recreate
        await Admin.deleteOne({ username: 'admin' });
        console.log('Deleted existing admin user');

        // Create admin user with plain password (let pre-save hook hash it)
        const admin = await Admin.create({
            username: 'muslah.jaber@gmail.com',
            password: 'admin123',
            role: 'admin',
            fullName: 'muslah'
        });
        const SuperAdmin = await Admin.create({
            username: 'majd@gmail.com',
            password: 'admin123',
            role: 'superAdmin',
            fullName: 'majd'

        });
        // Test password comparison
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
module.exports={
    seedAdmin,
    seedClient
}