# DotGroup Open API Documentation

Public HTTP API for **registered client users** to authenticate and create orders from Postman, scripts, or third-party systems.

No admin token is required. Only users with `role: "client"` who were created by an administrator (and linked to an organization) can use these endpoints.

---

## Base URL

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:5000/api/open` |
| Production | `https://<your-server-host>/api/open` |

All requests use `Content-Type: application/json`.

---

## Overview

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth` | Get a JWT token (optional; for multi-step Postman flows) |
| `POST` | `/orders` | **Authenticate + create order** in one call |

---

## Authentication options

You can authenticate in **two ways** on `POST /orders`:

### Option A — Credentials in the same request (recommended for Postman)

Send `phoneNumber` and `password` together with order fields in one JSON body.

### Option B — Bearer token

1. Call `POST /open/auth` (or `POST /api/auth/login`) to get a `token`.
2. Call `POST /open/orders` with header:

```
Authorization: Bearer <token>
```

Send only order fields in the body (no password).

---

## 1. Authenticate (optional)

**`POST /api/open/auth`**

### Request

```json
{
  "phoneNumber": "0501112233",
  "password": "123456aA!"
}
```

- `phoneNumber` — same number used when the admin created the user (not the email username).
- `password` — the client’s account password.

### Success `200`

```json
{
  "success": true,
  "message": "Authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d",
  "user": {
    "userId": "665b0f1e2c8a4a0012345678",
    "username": "0501112233@dot.com",
    "fullName": "Jane Client",
    "phoneNumber": "0501112233",
    "role": "client",
    "organizationCode": "CL001",
    "organizationId": "665a00000000000000000001"
  }
}
```

### Errors

| Status | When |
|--------|------|
| `400` | Missing `phoneNumber` or `password` |
| `401` | Wrong credentials or deactivated account |
| `403` | User is not a `client` |

---

## 2. Create order (auth + order in one API)

**`POST /api/open/orders`**

Creates a new order for the authenticated client. The order is stored with:

- `userID` = the client’s MongoDB `_id`
- `organizationId` = the client’s organization (from admin assignment)
- `status` = `"new"`

### Required order fields

| Field | Type | Description |
|-------|------|-------------|
| `customerAddress` | string | Delivery / job address |
| `customerPhoneNumber` | string | End-customer phone |

### Optional order fields

| Field | Type |
|-------|------|
| `customerFullName` | string |
| `requiredDeliveryDate` | string |
| `description` | string |
| `height` | string |
| `width` | string |
| `jobRef` | string |
| `notes` | string |

---

### Example A — Single request (phone + password + order)

Best for Postman: one call, no separate auth step.

```http
POST /api/open/orders
Content-Type: application/json
```

```json
{
  "phoneNumber": "0501112233",
  "password": "123456aA!",
  "customerFullName": "דוד כהן",
  "customerPhoneNumber": "0509988776",
  "customerAddress": "רחוב הרצל 10, תל אביב",
  "requiredDeliveryDate": "2026-06-01",
  "description": "הדפסה על ויניל",
  "height": "100",
  "width": "200",
  "jobRef": "EXT-2026-001",
  "notes": "דחוף"
}
```

### Example B — Nested `order` object

Same as Example A, but order fields grouped under `order`:

```json
{
  "phoneNumber": "0501112233",
  "password": "123456aA!",
  "order": {
    "customerFullName": "דוד כהן",
    "customerPhoneNumber": "0509988776",
    "customerAddress": "רחוב הרצל 10, תל אביב",
    "description": "הדפסה על ויניל"
  }
}
```

### Example C — Bearer token (after `/open/auth`)

```http
POST /api/open/orders
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

```json
{
  "customerFullName": "דוד כהן",
  "customerPhoneNumber": "0509988776",
  "customerAddress": "רחוב הרצל 10, תל אביב",
  "description": "הדפסה על ויניל"
}
```

### Success `201`

```json
{
  "success": true,
  "message": "Order created successfully",
  "order": {
    "orderId": "674abc1234567890abcdef12",
    "orderNumber": 1042,
    "organizationId": "665a00000000000000000001",
    "customerFullName": "דוד כהן",
    "customerPhoneNumber": "0509988776",
    "customerAddress": "רחוב הרצל 10, תל אביב",
    "requiredDeliveryDate": "2026-06-01",
    "description": "הדפסה על ויניל",
    "height": "100",
    "width": "200",
    "jobRef": "EXT-2026-001",
    "notes": "דחוף",
    "status": "new",
    "createdAt": "2026-05-19T10:30:00.000Z",
    "updatedAt": "2026-05-19T10:30:00.000Z"
  },
  "user": {
    "userId": "665b0f1e2c8a4a0012345678",
    "username": "0501112233@dot.com",
    "fullName": "Jane Client",
    "phoneNumber": "0501112233",
    "role": "client",
    "organizationCode": "CL001",
    "organizationId": "665a00000000000000000001"
  }
}
```

### Errors

| Status | Body `error` | When |
|--------|----------------|------|
| `400` | `Missing required fields: ...` | Order validation failed |
| `400` | `Your account is not linked to an organization...` | Client has no `organizationId` |
| `401` | `Invalid credentials` | Wrong phone/password |
| `401` | `Authentication required: ...` | No Bearer token and no credentials in body |
| `401` | `Token expired` / `Invalid token` | Bad JWT |
| `403` | `Only client accounts can use the Open API` | Admin/worker token or account |
| `500` | `Internal server error while creating order` | Server error |

---

## Postman quick setup

### Collection variables

| Variable | Example |
|----------|---------|
| `base_url` | `http://localhost:5000` |
| `phoneNumber` | `0501112233` |
| `password` | `123456aA!` |
| `token` | *(set from auth response)* |

### Request 1 — Create order (one step)

- **Method:** `POST`
- **URL:** `{{base_url}}/api/open/orders`
- **Body → raw → JSON:** use [Example A](#example-a--single-request-phone--password--order) above.

### Request 2 — Two-step flow

1. `POST {{base_url}}/api/open/auth` → copy `token` to collection variable.
2. `POST {{base_url}}/api/open/orders`  
   - Header: `Authorization: Bearer {{token}}`  
   - Body: order fields only.

---

## Prerequisites (admin)

Before a client can use the Open API:

1. Admin creates an organization (`POST /api/admin/organizations`).
2. Admin creates a client user with `POST /api/admin/users` (`phoneNumber`, `fullName`, `organizationCode` or `organizationId`).
3. Client receives / knows their password (default is often `123456aA!` unless changed).

If the user has no organization, order creation returns `400`.

---

## Related internal endpoints

| Endpoint | Notes |
|----------|--------|
| `POST /api/auth/login` | Same JWT format; also accepts `phoneNumber` + `password` |
| `POST /api/clients/orders` | Same order creation logic; requires `Authorization: Bearer` from app login |

The Open API reuses the same JWT secret and order creation rules as the main client API.

---

## Security notes

- Use **HTTPS** in production.
- Do not commit real passwords to source control.
- Tokens expire after **7 days** (same as app login).
- Only `client` role users are accepted; admin/worker credentials are rejected with `403`.
