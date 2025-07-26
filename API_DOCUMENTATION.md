# DotGroup Backend API Documentation

## Table of Contents
- [Authentication](#authentication)
- [Client Operations](#client-operations)
- [Admin Operations](#admin-operations)
- [Error Responses](#error-responses)
- [Data Models](#data-models)

---

## Authentication

### Base URL
```
http://localhost:5000/api
```

### JWT Token Format
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Authentication Endpoints

### 1. User Login
**Endpoint:** `POST /api/auth/login`

**Description:** Authenticate user and receive JWT token

**Request Body:**
```json
{
  "username": "client123",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "65677d3b8992a6ce",
    "username": "client123",
    "fullName": "John Doe",
    "role": "client",
    "clientId": "CL001"
  }
}
```

### 2. User Registration
**Endpoint:** `POST /api/auth/register`

**Description:** Register a new client user

**Request Body:**
```json
{
  "username": "newclient",
  "fullName": "Jane Smith",
  "password": "password123",
  "clientId": "CL002"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "userId": "65677d3b8992a6cf",
    "username": "newclient",
    "fullName": "Jane Smith",
    "role": "client",
    "clientId": "CL002"
  }
}
```

---

## Client Operations

### 1. Create New Order
**Endpoint:** `POST /api/clients/orders`

**Authorization:** Requires JWT token (role: client)

**Description:** Create a new order for the authenticated client

**Request Body:**
```json
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

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "order": {
    "_id": "65fe7a2b1e0cc4a903e5f1c0",
    "orderNumber": 1003,
    "status": "new",
    "userID": "65677d3b8992a6ce",
    "customerFullName": "John Doe",
    "customerPhoneNumber": "0501234567",
    "customerAddress": "Herzl 12, Tel Aviv",
    "description": "Large red logo sign with backlight",
    "height": "200",
    "width": "100",
    "notes": "Urgent project, please deliver ASAP",
    "createdAt": "2025-08-30T12:31:45.000Z"
  }
}
```

### 2. Get Client Orders
**Endpoint:** `GET /api/clients/orders`

**Authorization:** Requires JWT token (role: client)

**Description:** Get all orders for the authenticated client

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "_id": "65fe7a2b1e0cc4a903e5f1c0",
      "orderNumber": 1003,
      "status": "new",
      "userID": "65677d3b8992a6ce",
      "customerFullName": "John Doe",
      "customerPhoneNumber": "0501234567",
      "customerAddress": "Herzl 12, Tel Aviv",
      "description": "Large red logo sign with backlight",
      "height": "200",
      "width": "100",
      "notes": "Urgent project, please deliver ASAP",
      "createdAt": "2025-08-30T12:31:45.000Z"
    }
  ]
}
```

### 3. Update Order
**Endpoint:** `PUT /api/clients/orders/:orderId`

**Authorization:** Requires JWT token (role: client)

**Description:** Update an order (clients can only update their own orders)

**Request Body:**
```json
{
  "customerFullName": "John Doe Updated",
  "customerPhoneNumber": "0501234568",
  "customerAddress": "Herzl 15, Tel Aviv",
  "requiredDeliveryDate": "2025-10-15",
  "description": "Updated description",
  "height": "250",
  "width": "150",
  "notes": "Updated notes"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order updated successfully",
  "order": {
    "_id": "65fe7a2b1e0cc4a903e5f1c0",
    "orderNumber": 1003,
    "status": "new",
    "userID": "65677d3b8992a6ce",
    "customerFullName": "John Doe Updated",
    "customerPhoneNumber": "0501234568",
    "customerAddress": "Herzl 15, Tel Aviv",
    "description": "Updated description",
    "height": "250",
    "width": "150",
    "notes": "Updated notes",
    "updatedAt": "2025-08-30T13:45:30.000Z"
  }
}
```

### 4. Update Client Profile
**Endpoint:** `PUT /api/clients/users/:userId`

**Authorization:** Requires JWT token (role: client)

**Description:** Update client's own profile information

**Request Body:**
```json
{
  "fullName": "John Doe Updated",
  "username": "johndoe_updated"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "userId": "65677d3b8992a6ce",
    "username": "johndoe_updated",
    "fullName": "John Doe Updated",
    "role": "client"
  }
}
```

---

## Admin Operations

### 1. Get All Orders
**Endpoint:** `GET /api/admin/orders`

**Authorization:** Requires JWT token (role: admin/superAdmin)

**Description:** Get all orders with user information

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "_id": "65fe7a2b1e0cc4a903e5f1c0",
      "orderNumber": 1003,
      "status": "new",
      "userID": {
        "_id": "65677d3b8992a6ce",
        "username": "client123",
        "fullName": "John Doe",
        "clientId": "CL001"
      },
      "customerFullName": "John Doe",
      "customerPhoneNumber": "0501234567",
      "customerAddress": "Herzl 12, Tel Aviv",
      "description": "Large red logo sign with backlight",
      "height": "200",
      "width": "100",
      "notes": "Urgent project, please deliver ASAP",
      "totalPrice": "1500",
      "createdAt": "2025-08-30T12:31:45.000Z"
    }
  ]
}
```

### 2. Get Order Details
**Endpoint:** `GET /api/admin/orders/:orderId`

**Authorization:** Requires JWT token (role: admin/superAdmin)

**Description:** Get detailed information about a specific order including associated files

**Response:**
```json
{
  "success": true,
  "order": {
    "_id": "65fe7a2b1e0cc4a903e5f1c0",
    "orderNumber": 1003,
    "status": "new",
    "userID": {
      "_id": "65677d3b8992a6ce",
      "username": "client123",
      "fullName": "John Doe",
      "clientId": "CL001"
    },
    "customerFullName": "John Doe",
    "customerPhoneNumber": "0501234567",
    "customerAddress": "Herzl 12, Tel Aviv",
    "description": "Large red logo sign with backlight",
    "height": "200",
    "width": "100",
    "notes": "Urgent project, please deliver ASAP",
    "totalPrice": "1500",
    "createdAt": "2025-08-30T12:31:45.000Z"
  },
  "files": [
    {
      "_id": "65fe7a2b1e0cc4a903e5f1c1",
      "userId": "65677d3b8992a6ce",
      "orderId": "65fe7a2b1e0cc4a903e5f1c0",
      "customerFullName": "John Doe",
      "filePath": "https://firebase-storage-url.com/orders/...",
      "fileCategory": "payment",
      "notes": "Payment receipt",
      "createdAt": "2025-08-30T14:30:00.000Z"
    }
  ]
}
```

### 3. Update Order Details
**Endpoint:** `PUT /api/admin/orders/:orderId`

**Authorization:** Requires JWT token (role: admin/superAdmin)

**Description:** Update order details including status and pricing

**Request Body:**
```json
{
  "customerFullName": "John Doe Updated",
  "customerPhoneNumber": "0501234568",
  "customerAddress": "Herzl 15, Tel Aviv",
  "requiredDeliveryDate": "2025-10-15",
  "description": "Updated description",
  "height": "250",
  "width": "150",
  "notes": "Updated notes",
  "totalPrice": "2000",
  "status": "in progress"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order updated successfully",
  "order": {
    "_id": "65fe7a2b1e0cc4a903e5f1c0",
    "orderNumber": 1003,
    "status": "in progress",
    "userID": {
      "_id": "65677d3b8992a6ce",
      "username": "client123",
      "fullName": "John Doe",
      "clientId": "CL001"
    },
    "customerFullName": "John Doe Updated",
    "customerPhoneNumber": "0501234568",
    "customerAddress": "Herzl 15, Tel Aviv",
    "description": "Updated description",
    "height": "250",
    "width": "150",
    "notes": "Updated notes",
    "totalPrice": "2000",
    "updatedAt": "2025-08-30T14:30:00.000Z"
  }
}
```

### 4. Change Order Status
**Endpoint:** `PATCH /api/admin/orders/:orderId/status`

**Authorization:** Requires JWT token (role: admin/superAdmin)

**Description:** Manually change the status of an order

**Request Body:**
```json
{
  "status": "in progress"
}
```

**Valid Status Values:**
- `new`
- `waiting for approval`
- `in progress`
- `paymentR`
- `DONE`
- `delayed`
- `declined`

**Response:**
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "order": {
    "_id": "65fe7a2b1e0cc4a903e5f1c0",
    "orderNumber": 1003,
    "status": "in progress",
    "userID": {
      "_id": "65677d3b8992a6ce",
      "username": "client123",
      "fullName": "John Doe",
      "clientId": "CL001"
    },
    "customerFullName": "John Doe",
    "customerPhoneNumber": "0501234567",
    "customerAddress": "Herzl 12, Tel Aviv",
    "description": "Large red logo sign with backlight",
    "height": "200",
    "width": "100",
    "notes": "Urgent project, please deliver ASAP",
    "totalPrice": "1500",
    "updatedAt": "2025-08-30T14:30:00.000Z"
  }
}
```

### 5. Upload Files to Order
**Endpoint:** `POST /api/admin/orders/:orderId/files`

**Authorization:** Requires JWT token (role: admin/superAdmin)

**Description:** Upload files (images, documents) to an order

**Request:** Multipart form data
- `file`: The file to upload (required)
- `fileCategory`: "payment" or "work" (required)
- `notes`: Optional notes about the file

**Supported File Types:**
- Images: JPEG, PNG, GIF
- Documents: PDF, DOC, DOCX
- Maximum file size: 10MB

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "file": {
    "_id": "65fe7a2b1e0cc4a903e5f1c1",
    "userId": "65677d3b8992a6ce",
    "orderId": "65fe7a2b1e0cc4a903e5f1c0",
    "customerFullName": "John Doe",
    "filePath": "https://firebase-storage-url.com/orders/65fe7a2b1e0cc4a903e5f1c0/payment_1234567890_receipt.pdf",
    "fileCategory": "payment",
    "notes": "Payment receipt for order #1003",
    "createdAt": "2025-08-30T14:30:00.000Z"
  }
}
```

### 6. Add New User
**Endpoint:** `POST /api/admin/users`

**Authorization:** Requires JWT token (role: admin/superAdmin)

**Description:** Create a new user (client or admin)

**Request Body:**
```json
{
  "username": "newclient",
  "fullName": "Jane Smith",
  "password": "password123",
  "role": "client",
  "clientId": "CL002"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "userId": "65677d3b8992a6cf",
    "username": "newclient",
    "fullName": "Jane Smith",
    "role": "client",
    "clientId": "CL002"
  }
}
```

### 7. Block/Unblock User
**Endpoint:** `PUT /api/admin/users/:userId/status`

**Authorization:** Requires JWT token (role: admin/superAdmin)

**Description:** Block or unblock a user account

**Request Body:**
```json
{
  "isActive": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "User blocked successfully",
  "user": {
    "userId": "65677d3b8992a6ce",
    "username": "client123",
    "fullName": "John Doe",
    "role": "client",
    "isActive": false
  }
}
```

---

## Error Responses

### Common Error Formats

**Authentication Error (401):**
```json
{
  "success": false,
  "error": "Access denied. No token provided or invalid format."
}
```

**Authorization Error (403):**
```json
{
  "success": false,
  "error": "Access denied. Admin privileges required."
}
```

**Validation Error (400):**
```json
{
  "success": false,
  "error": "Missing required fields: customerFullName, customerPhoneNumber, customerAddress"
}
```

**Not Found Error (404):**
```json
{
  "success": false,
  "error": "Order not found"
}
```

**Server Error (500):**
```json
{
  "success": false,
  "error": "Internal server error while creating order"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (Validation Error) |
| 401 | Unauthorized (Authentication Error) |
| 403 | Forbidden (Authorization Error) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Data Models

### Order Model
```json
{
  "_id": "ObjectId",
  "orderNumber": "Number (Auto-increment)",
  "userID": "ObjectId (Reference to User)",
  "orderId": "String",
  "customerFullName": "String",
  "totalPrice": "String",
  "status": "String (Enum: new, waiting for approval, in progress, paymentR, DONE, delayed, declined)",
  "requiredDeliveryDate": "String",
  "customerAddress": "String (Required)",
  "customerPhoneNumber": "String (Required)",
  "description": "String",
  "height": "String",
  "width": "String",
  "notes": "String",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### User Model
```json
{
  "_id": "ObjectId",
  "username": "String (Required, Unique)",
  "fullName": "String (Required)",
  "password": "String (Required, Hashed)",
  "role": "String (Enum: client, admin, superAdmin)",
  "clientId": "String (Required)",
  "isActive": "Boolean (Default: true)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Files Model
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId (Reference to User)",
  "orderId": "ObjectId (Reference to Order)",
  "customerFullName": "String",
  "filePath": "String (Required, Firebase URL)",
  "fileCategory": "String (Enum: payment, work)",
  "notes": "String",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

---

## Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/dotgroup_db

# JWT Configuration
JWT_SECRET=your-secret-key-here

# Firebase Configuration
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=your-app-id
```

---

## Testing Examples

### Using cURL

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "client123", "password": "password123"}'
```

**Create Order (with token):**
```bash
curl -X POST http://localhost:5000/api/clients/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "customerFullName": "John Doe",
    "customerPhoneNumber": "0501234567",
    "customerAddress": "Herzl 12, Tel Aviv",
    "description": "Large red logo sign",
    "height": "200",
    "width": "100"
  }'
```

**Upload File (with token):**
```bash
curl -X POST http://localhost:5000/api/admin/orders/ORDER_ID/files \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/file.pdf" \
  -F "fileCategory=payment" \
  -F "notes=Payment receipt"
```

### Using Postman

1. **Set up environment variables:**
   - `base_url`: `http://localhost:5000/api`
   - `token`: Your JWT token after login

2. **Use the token in Authorization header:**
   - Type: Bearer Token
   - Token: `{{token}}`

3. **For file uploads:**
   - Use form-data
   - Add file field with type "File"
   - Add other fields as text

---

## Rate Limiting & Security

- JWT tokens expire after 24 hours
- File uploads limited to 10MB
- Supported file types: JPEG, PNG, GIF, PDF, DOC, DOCX
- All passwords are hashed using bcrypt
- Role-based access control implemented
- Input validation on all endpoints

---

## Support

For technical support or questions about the API, please contact the development team. 