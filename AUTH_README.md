# 🔐 Authentication System Documentation

This document describes the complete authentication system implementation for the DotGroup backend.

## 📋 Overview

The authentication system includes:
- **Client Registration** with 2FA verification
- **User Login** with JWT tokens
- **Password Reset** via SMS
- **JWT Middleware** for route protection

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file with:
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5000
```

### 3. Start Server
```bash
node server.js
```

### 4. Test Authentication
```bash
node test-auth.js
```

## 📡 API Endpoints

### 🔐 Authentication Routes

#### 1. Client Registration
```http
POST /api/auth/signUp
```

**Request Body:**
```json
{
  "fullName": "John Doe",
  "username": "0501234567",
  "password": "123456",
  "role": "client",
  "clientId": "33333"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent",
  "userId": "65677d3b8992a6ce"
}
```

#### 2. 2FA Verification
```http
POST /api/auth/verify
```

**Request Body:**
```json
{
  "userId": "65677d3b8992a6ce",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "65677d3b8992a6ce",
    "fullName": "John Doe",
    "username": "0501234567",
    "role": "client",
    "clientId": "33333"
  }
}
```

#### 3. User Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "username": "0501234567",
  "password": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "65677d3b8992a6ce",
    "fullName": "John Doe",
    "username": "0501234567",
    "role": "client",
    "clientId": "33333"
  }
}
```

#### 4. Forgot Password
```http
POST /api/auth/forgot-password
```

**Request Body:**
```json
{
  "username": "0501234567"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reset code sent to your phone"
}
```

#### 5. Reset Password
```http
POST /api/auth/reset-password
```

**Request Body:**
```json
{
  "username": "0501234567",
  "code": "123456",
  "newPassword": "newPass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

## 🛡️ Protected Routes

To access protected routes, include the JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Example Protected Route Usage:
```javascript
// In your frontend or API client
const response = await fetch('/api/clients/profile', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## 📱 SMS Service

The system includes a mock SMS service for development. In production, replace it with a real SMS provider like Twilio.

### Current Implementation:
- **Mock SMS**: Logs to console
- **Verification Codes**: 6-digit random numbers
- **Expiration**: 10 minutes

### Production Setup:
1. Install Twilio: `npm install twilio`
2. Update `services/smsService.js`
3. Add Twilio credentials to `.env`

## 🗄️ Database Schema

### User Model
```javascript
{
  username: String,        // Phone number (unique)
  fullName: String,        // User's full name
  password: String,        // Hashed password
  role: String,           // 'client', 'admin', 'superAdmin'
  clientId: String,       // Client identifier
  isActive: Boolean,      // Account status
  createdAt: Date,        // Auto-generated
  updatedAt: Date         // Auto-generated
}
```

## 🔧 Configuration

### JWT Settings
- **Secret**: Set via `JWT_SECRET` environment variable
- **Expiration**: 7 days
- **Algorithm**: HS256

### Password Security
- **Hashing**: bcrypt with salt rounds of 10
- **Validation**: Automatic on save

### Verification Codes
- **Length**: 6 digits
- **Expiration**: 10 minutes
- **Storage**: In-memory cache (use Redis in production)

## 🧪 Testing

### Manual Testing
1. Start the server: `node server.js`
2. Run tests: `node test-auth.js`
3. Check console for SMS codes
4. Use codes to verify accounts

### API Testing with Postman/Insomnia
1. Import the endpoints
2. Set base URL: `http://localhost:5000/api/auth`
3. Follow the flow: signUp → verify → login

## 🚨 Error Handling

### Common Error Responses
```json
{
  "success": false,
  "error": "Error message"
}
```

### Status Codes
- `200`: Success
- `201`: Created (registration)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid credentials/token)
- `404`: Not Found
- `500`: Internal Server Error

## 🔒 Security Features

1. **Password Hashing**: bcrypt with salt
2. **JWT Tokens**: Secure token-based authentication
3. **Input Validation**: All inputs validated
4. **Rate Limiting**: Consider adding for production
5. **CORS**: Configured for cross-origin requests
6. **Account Status**: Active/inactive user management

## 🚀 Production Considerations

1. **SMS Provider**: Replace mock with Twilio/AWS SNS
2. **Cache**: Use Redis instead of in-memory cache
3. **Rate Limiting**: Add rate limiting middleware
4. **Logging**: Implement proper logging
5. **Monitoring**: Add health checks and monitoring
6. **HTTPS**: Use HTTPS in production
7. **Environment Variables**: Secure all secrets

## 📞 Support

For issues or questions:
1. Check the console logs
2. Verify environment variables
3. Ensure MongoDB is running
4. Check network connectivity

---

**Note**: This is a development implementation. For production, ensure all security best practices are followed. 