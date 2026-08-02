# CURSOR AGENT TASK: DotGroup React — Admin Private Orders

## START HERE (copy into Cursor chat in the React repo)

```
@FE_PRIVATE_ORDERS_API_UPDATE.md

Implement admin private-order support in this React app.
Follow every step and checklist in this file.
Do not change worker or client order-creation flows.
When finished, report the ACCEPTANCE CHECKLIST with done/not-done per item.
```

| Setting | Value |
|---------|--------|
| Base URL | `{VITE_API_URL}/api` or `http://localhost:5000/api` |
| Auth header | `Authorization: Bearer <admin JWT>` |
| Role required | `admin` |

---

## AGENT MISSION

Add **admin private orders** — orders for walk-in / unregistered customers that are **not** linked to a user account or organization.

1. Add a new admin UI flow to create private orders (form with all customer/order fields).
2. Extend the `Order` TypeScript type with `isPrivateClient`.
3. Update admin order list and detail views to display private orders correctly (no org, no registered user).
4. Reuse existing admin order actions where possible (status, worker assign, update, files).

---

## WHAT IS A PRIVATE ORDER?

| | Registered client order | Private order |
|---|-------------------------|---------------|
| Created by | Client (`POST /clients/orders`) | Admin (`POST /admin/orders`) |
| `userID` | Set (registered client) | `null` / absent |
| `organizationId` | Set (client's org) | `null` / absent |
| `isPrivateClient` | `false` | `true` |
| Visible to clients | Yes (same org) | **No** |
| Visible to admin | Yes | Yes |
| Customer identity | From user account + order fields | Admin fills name, phone, and order details only |

Private orders are for **one-off / walk-in customers** who do not have (and do not need) a DotGroup account.

---

## NEW API ENDPOINT

### Create private order (admin)

| | |
|---|---|
| **Method / path** | `POST /api/admin/orders` |
| **Auth** | `Authorization: Bearer <token>` |
| **Role** | `admin` |

**Request body (JSON) — all fields required:**

| Field | Type | Notes |
|-------|------|--------|
| `customerFullName` | string | Walk-in customer name |
| `customerPhoneNumber` | string | Walk-in customer phone |
| `customerAddress` | string | Delivery / job address |
| `requiredDeliveryDate` | string | e.g. `"2026-07-01"` |
| `description` | string | Job description |
| `height` | string | |
| `width` | string | |
| `jobRef` | string | Reference / job number |
| `notes` | string | Free-text notes |

**Do not send:** `userID`, `organizationId`, `organizationCode`, `status`, `isPrivateClient` — the backend sets `status: "new"` and `isPrivateClient: true`.

**Success (201):**

```json
{
  "success": true,
  "message": "Private order created successfully",
  "order": {
    "_id": "507f1f77bcf86cd799439011",
    "orderNumber": 42,
    "isPrivateClient": true,
    "userID": null,
    "organizationId": null,
    "assignedWorkerId": null,
    "customerFullName": "John Doe",
    "customerPhoneNumber": "0501234567",
    "customerAddress": "123 Main St, Tel Aviv",
    "requiredDeliveryDate": "2026-07-01",
    "description": "Kitchen cabinets",
    "height": "240",
    "width": "120",
    "jobRef": "JOB-001",
    "notes": "Call before delivery",
    "status": "new",
    "totalPrice": null,
    "createdAt": "2026-06-09T10:00:00.000Z",
    "updatedAt": "2026-06-09T10:00:00.000Z"
  }
}
```

**Error (400) — missing fields:**

```json
{
  "success": false,
  "error": "Missing required fields: customerFullName, notes"
}
```

**Error (401 / 403):** Invalid or non-admin token.

---

## EXISTING ADMIN ENDPOINTS (unchanged, work with private orders)

These already support private orders returned from the list/detail APIs:

| Method | Path | Use for private orders |
|--------|------|------------------------|
| `GET` | `/api/admin/orders` | List includes private orders (`isPrivateClient: true`) |
| `GET` | `/api/admin/orders/:orderId` | Detail + files |
| `PUT` | `/api/admin/orders/:orderId` | Update customer fields, `totalPrice`, `status` |
| `PATCH` | `/api/admin/orders/:orderId/status` | Change status |
| `PATCH` | `/api/admin/orders/:orderId/worker` | Assign / unassign worker |

**Private order in list response:** `userID` and `organizationId` are `null`. Use `customerFullName` and `customerPhoneNumber` for display. Show a badge or label such as **Private client** when `isPrivateClient === true`.

---

## TYPESCRIPT — UPDATE ORDER TYPE

```typescript
export interface Order {
  _id: string;
  orderNumber?: number;
  isPrivateClient?: boolean; // true for admin-created walk-in orders
  userID?: string | User | null;
  organizationId?: string | Organization | null;
  assignedWorkerId?: string | User | null;
  customerFullName?: string;
  customerPhoneNumber: string;
  customerAddress?: string;
  requiredDeliveryDate?: string;
  description?: string;
  height?: string;
  width?: string;
  jobRef?: string;
  notes?: string;
  status: OrderStatus;
  totalPrice?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
```

---

## API SERVICE LAYER

Add a function (name to match your project conventions):

```typescript
export interface PrivateOrderCreatePayload {
  customerFullName: string;
  customerPhoneNumber: string;
  customerAddress: string;
  requiredDeliveryDate: string;
  description: string;
  height: string;
  width: string;
  jobRef: string;
  notes: string;
}

export async function createPrivateOrder(
  body: PrivateOrderCreatePayload,
  token: string
): Promise<{ success: boolean; order: Order; message?: string }> {
  const res = await fetch(`${API_BASE}/admin/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create private order');
  return data;
}
```

**Important:** This is `POST /admin/orders` — the same path prefix as `GET /admin/orders`, but **POST** creates a private order only. Do not use this endpoint for registered client orders (those remain `POST /clients/orders`).

---

## ADMIN UI — IMPLEMENTATION GUIDE

### 1. New page or modal: “Create private order”

- Route suggestion: `/admin/orders/new-private` or a modal from the admin orders page.
- Form fields (all required, validate before submit):
  - Customer: full name, phone, address
  - Job: description, height, width, job ref, required delivery date, notes
- On success: redirect to order detail or refresh orders list.
- On 400: show `error` message from API (missing fields list).

### 2. Admin orders list

- Include private orders from `GET /admin/orders` (no separate endpoint).
- When `order.isPrivateClient`:
  - Show customer name + phone from order fields (not from `userID`).
  - Do not show organization name (none attached).
  - Optional visual: “Private” badge.

### 3. Admin order detail

- If `isPrivateClient`, hide or disable “registered client” / organization sections.
- Show all customer and job fields from the order document.
- Worker assignment and status changes work the same as other orders.

### 4. Do not change

- Client order creation (`POST /clients/orders`) — still requires logged-in client with `organizationId`.
- Worker screens and APIs.
- Client order list scoping (org-wide only; private orders never appear there).

---

## HARD RULES (MUST / MUST NOT)

### MUST

- Send **all nine** body fields when creating a private order (backend validates every field).
- Use admin JWT on `POST /admin/orders`.
- Treat `isPrivateClient` as the source of truth for UI branching.
- Display walk-in customer info from order fields when `userID` is null.

### MUST NOT

- Do not send `organizationId` or `organizationCode` on private order create.
- Do not expect private orders on client dashboards.
- Do not call `POST /clients/orders` for walk-in customers.
- Do not require a user picker or organization picker on the private-order form.

---

## ACCEPTANCE CHECKLIST

Report each item as **done** or **not done** when finished:

- [ ] `Order` type includes `isPrivateClient`, optional `userID` / `organizationId`
- [ ] API helper `createPrivateOrder` → `POST /admin/orders`
- [ ] Admin form with all 9 required fields and client-side validation
- [ ] Successful create shows new order in admin list
- [ ] Private orders show “Private” (or equivalent) in list; no org / no user shown
- [ ] Order detail works for private orders (fields, status, worker assign)
- [ ] Client app unchanged; private orders not visible to clients
- [ ] Worker app unchanged

---

## QUICK REFERENCE

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| `POST` | `/api/admin/orders` | admin | **Create private order** |
| `GET` | `/api/admin/orders` | admin | List all orders (includes private) |
| `GET` | `/api/admin/orders/:orderId` | admin | Order detail |
| `PUT` | `/api/admin/orders/:orderId` | admin | Update order |
| `PATCH` | `/api/admin/orders/:orderId/status` | admin | Change status |
| `PATCH` | `/api/admin/orders/:orderId/worker` | admin | Assign worker |

---

## BACKEND FILES (reference only)

- `routes/adminRoutes.js` — `POST /orders` → `createAdminOrder`
- `controllers/adminController.js` — `createAdminOrder`
- `services/createClientOrder.js` — `createPrivateOrder`
- `models/Order.js` — `isPrivateClient`, optional `userID`
