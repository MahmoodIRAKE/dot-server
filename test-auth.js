// Simple test script for authentication endpoints
// Run with: node test-auth.js

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/auth';

// Test data
const testUser = {
    fullName: 'John Doe',
    username: '0501234567',
    password: '123456',
    role: 'client',
    clientId: '33333'
};

async function testAuth() {
    try {
        console.log('🧪 Testing Authentication System...\n');

        // Test 1: Sign Up
        console.log('1️⃣ Testing Sign Up...');
        const signUpResponse = await axios.post(`${BASE_URL}/signUp`, testUser);
        console.log('✅ Sign Up successful:', signUpResponse.data);
        
        const userId = signUpResponse.data.userId;
        console.log('📱 Check console for SMS verification code\n');

        // Test 2: Sign In (should work after verification)
        console.log('2️⃣ Testing Sign In...');
        try {
            const signInResponse = await axios.post(`${BASE_URL}/login`, {
                username: testUser.username,
                password: testUser.password
            });
            console.log('✅ Sign In successful:', signInResponse.data);
        } catch (error) {
            console.log('❌ Sign In failed (expected if not verified):', error.response?.data?.error || error.message);
        }

        // Test 3: Forgot Password
        console.log('\n3️⃣ Testing Forgot Password...');
        const forgotResponse = await axios.post(`${BASE_URL}/forgot-password`, {
            username: testUser.username
        });
        console.log('✅ Forgot Password successful:', forgotResponse.data);
        console.log('📱 Check console for password reset code\n');

        console.log('🎉 All tests completed!');
        console.log('\n📝 Next steps:');
        console.log('1. Check the server console for SMS codes');
        console.log('2. Use the verification code with POST /api/auth/verify');
        console.log('3. Use the reset code with POST /api/auth/reset-password');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testAuth();
}

module.exports = { testAuth }; 