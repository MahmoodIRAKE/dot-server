# DotGroup API - Postman Collection Setup Guide

## Overview
This guide will help you set up and use the Postman collection for testing the DotGroup API endpoints. The collection includes all authentication, client operations, and admin operations.

## Files Included
- `DotGroup_API_Collection.json` - Main Postman collection
- `DotGroup_API_Environment.json` - Environment variables
- `POSTMAN_SETUP_GUIDE.md` - This setup guide

## Setup Instructions

### 1. Import the Collection and Environment

1. **Open Postman**
2. **Import the Collection:**
   - Click "Import" button
   - Select `DotGroup_API_Collection.json`
   - The collection will be imported with all endpoints

3. **Import the Environment:**
   - Click "Import" button again
   - Select `DotGroup_API_Environment.json`
   - Select the environment from the dropdown in the top-right corner

### 2. Configure Environment Variables

The environment includes the following variables:

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `base_url` | API base URL | `http://localhost:5000/api` |
| `auth_token` | JWT authentication token | (empty) |
| `last_order_id` | ID of the last created order | (empty) |
| `user_id` | User ID for profile operations | (empty) |
| `admin_token` | Admin JWT token | (empty) |
| `client_token` | Client JWT token | (empty) |

### 3. Start Your Server

Make sure your DotGroup server is running:
```bash
npm start
# or
node server.js
```

The server should be running on `http://localhost:5000`

## Testing Workflow

### Step 1: Authentication

1. **User Login** (Authentication folder)
   - Use the "User Login" request
   - Update the request body with valid credentials:
   ```json
   {
     "username": "client123",
     "password": "password123"
   }
   ```
   - Send the request
   - The JWT token will be automatically saved to the `auth_token` variable

2. **User Registration** (Optional)
   - Use the "User Registration" request
   - Update the request body with new user details

### Step 2: Client Operations

1. **Create New Order**
   - Use the "Create New Order" request
   - The order ID will be automatically saved to `last_order_id`
   - Update the request body as needed

2. **Get Client Orders**
   - Use the "Get Client Orders" request to view all orders

3. **Update Order**
   - Use the "Update Order" request
   - It will use the `last_order_id` variable automatically

4. **Update Client Profile**
   - Use the "Update Client Profile" request
   - Set the `user_id` variable manually or update the URL

### Step 3: Admin Operations

1. **Get All Orders**
   - Use the "Get All Orders" request to view all orders in the system

2. **Get Order Details**
   - Use the "Get Order Details" request
   - It will use the `last_order_id` variable automatically

3. **Update Order Details**
   - Use the "Update Order Details" request
   - Includes admin-specific fields like `totalPrice` and `status`

4. **Change Order Status**
   - Use the "Change Order Status" request
   - Valid statuses: `new`, `waiting for approval`, `in progress`, `paymentR`, `DONE`, `delayed`, `declined`

5. **Upload Files to Order**
   - Use the "Upload Files to Order" request
   - Select a file in the form-data
   - Set `fileCategory` to "payment" or "work"
   - Add optional notes

6. **Add New User**
   - Use the "Add New User" request
   - Can create clients or admins

7. **Block/Unblock User**
   - Use the "Block/Unblock User" request
   - Set `isActive` to `false` to block, `true` to unblock

## Request Examples

### Authentication Examples

**Login Request:**
```json
POST {{base_url}}/auth/login
Content-Type: application/json

{
  "username": "client123",
  "password": "password123"
}
```

**Registration Request:**
```json
POST {{base_url}}/auth/signUp
Content-Type: application/json

{
  "username": "newclient",
  "fullName": "Jane Smith",
  "password": "password123",
  "clientId": "CL002"
}
```

### Order Examples

**Create Order Request:**
```json
POST {{base_url}}/clients/orders
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "customerFullName": "John Doe",
  "customerPhoneNumber": "0501234567",
  "customerAddress": "Herzl 12, Tel Aviv",
  "requiredDeliveryDate": "2025-09-30",
  "description": "Large red logo sign with backlight",
  "height": "200",
  "width": "100",
  "notes": "Urgent project, please deliver ASAP"
}
```

**Update Order Status Request:**
```json
PATCH {{base_url}}/admin/orders/{{last_order_id}}/status
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "status": "in progress"
}
```

## File Upload Testing

For file uploads (Admin Operations > Upload Files to Order):

1. Select the request
2. In the Body tab, select "form-data"
3. Add a key named "file" and change the type to "File"
4. Click "Select Files" and choose your file
5. Add other fields:
   - `fileCategory`: "payment" or "work"
   - `notes`: Optional description

## Error Handling

The collection includes automatic token saving for successful login responses. Common error responses:

- **401 Unauthorized**: Invalid or missing JWT token
- **403 Forbidden**: Insufficient permissions
- **400 Bad Request**: Invalid request data
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

## Tips for Testing

1. **Start with Authentication**: Always login first to get a valid token
2. **Use Environment Variables**: The collection automatically saves tokens and IDs
3. **Test Different Roles**: Try both client and admin operations
4. **File Uploads**: Test with different file types (PDF, images, etc.)
5. **Error Scenarios**: Test with invalid data to verify error handling

## Troubleshooting

### Common Issues

1. **"Connection refused"**
   - Make sure your server is running on port 5000
   - Check if the `base_url` variable is correct

2. **"401 Unauthorized"**
   - Login again to get a fresh token
   - Check if the token is properly set in the Authorization header

3. **"403 Forbidden"**
   - Make sure you're using the correct role (client vs admin)
   - Verify the user has the required permissions

4. **File upload fails**
   - Check file size (max 10MB)
   - Verify file type is supported
   - Ensure `fileCategory` is set correctly

### Environment Variable Issues

If variables aren't being saved automatically:

1. Check the "Tests" tab in the login request
2. Verify the environment is selected in the top-right corner
3. Manually set variables in the environment settings

## API Endpoints Summary

### Authentication
- `POST /auth/login` - User login
- `POST /auth/signUp` - User registration
- `POST /auth/verify` - 2FA verification
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password

### Client Operations
- `GET /clients/orders` - Get client orders
- `POST /clients/orders` - Create new order
- `PUT /clients/orders/:orderId` - Update order
- `PUT /clients/users/:userId` - Update profile

### Admin Operations
- `GET /admin/orders` - Get all orders
- `GET /admin/orders/:orderId` - Get order details
- `PUT /admin/orders/:orderId` - Update order details
- `PATCH /admin/orders/:orderId/status` - Change order status
- `POST /admin/orders/:orderId/files` - Upload files
- `POST /admin/users` - Add new user
- `PUT /admin/users/:userId/status` - Block/unblock user

## Support

If you encounter any issues with the Postman collection or API testing, please refer to the main API documentation or contact the development team. 