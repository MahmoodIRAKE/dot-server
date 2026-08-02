# CURSOR AGENT TASK: DotGroup React — Organization Feature Migration

## START HERE (copy into Cursor chat in the React repo)

```
@FE_CURSOR_ORGANIZATION_TASK.txt

Execute the organization migration for this React app.
Follow every step and checklist in that file.
Do not change worker features.
When finished, report the ACCEPTANCE CHECKLIST with done/not-done per item.
```

**Primary agent file (plain text, optimized for Cursor):** `FE_CURSOR_ORGANIZATION_TASK.txt`  
**Extended reference (this file):** full TypeScript types, JSON examples, page matrix

| Setting | Value |
|---------|--------|
| Base URL | `{VITE_API_URL}/api` or `http://localhost:5000/api` |
| Auth header | `Authorization: Bearer <token>` |

---

## AGENT MISSION

Update the React frontend to match the backend **Organization** feature:

1. Replace all `clientId` usage with `organizationCode` (and add `organizationId` where needed).
2. Extend auth state to persist `organizationId` + `organizationCode`.
3. Build **admin** organization management UI + update admin add-user flow.
4. Build **client** team/members page (list + invite users to same org).
5. Update client orders UX: orders are **shared per organization**, not per user.
6. Do **not** change worker flows.

---

## HARD RULES (MUST / MUST NOT)

### MUST
- Store `organizationId` and `organizationCode` on the logged-in user after login/verify.
- Use field name `organizationCode` in all **new** API request bodies (not `clientId`).
- Use `phoneNumber` for login (not `username`).
- Admin creates organizations **before** clients can sign up with that code.
- Client `POST /clients/users` adds users only to the **caller's** org (no org picker on client side).
- Block client order creation when `!user.organizationId` and show admin-contact message.

### MUST NOT
- Do not let clients edit `organizationCode` on profile (read-only; admin-managed).
- Do not send `role` or `username` when admin creates a client user (`POST /admin/users`).
- Do not scope client order list to “only my userId” — backend returns **all org orders**.
- Do not add organization fields to worker pages/API calls.
- Do not rename `organizationId` to mean the string code — that field is always the MongoDB ObjectId.

### FIELD RENAME (global find-replace in FE)
| Remove / replace | With |
|------------------|------|
| `clientId` (user/org context) | `organizationCode` |
| (new) | `organizationId` on User, Order, auth state |

---

## IMPLEMENTATION ORDER (follow this sequence)

```
Step 1  → Update TypeScript interfaces (User, Order, Organization)
Step 2  → Update auth context / Redux / Zustand: add organizationId, organizationCode
Step 3  → Update login + verify handlers to persist new user fields
Step 4  → Update sign-up form: organizationCode instead of clientId
Step 5  → Update API service layer (axios/fetch functions below)
Step 6  → Admin: Organizations list + create + detail pages
Step 7  → Admin: Fix “Add user” form payload
Step 8  → Client: Team members page (GET + POST /clients/users)
Step 9  → Client: Orders list/detail — org-wide behavior, show creator if useful
Step 10 → Client: Profile form — remove clientId/organizationCode inputs
Step 11 → Grep FE for leftover "clientId" and fix
Step 12 → Manual test flows in ACCEPTANCE CRITERIA section
```

---

## STEP 1 — TYPES (create or update)

**File hint:** `types/user.ts`, `types/order.ts`, `types/organization.ts`, or equivalent.

```typescript
// ADD new file or type
export interface Organization {
  _id: string;
  name: string;
  organizationCode: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// UPDATE User type
export interface User {
  _id: string;
  fullName: string;
  username: string;
  phoneNumber: string;
  role: 'client' | 'admin' | 'superAdmin' | 'worker';
  organizationCode?: string;   // was clientId — string business code e.g. "CL001"
  organizationId?: string;       // Mongo ObjectId — required for client order features
  isActive: boolean;
  needToChangePassword?: boolean;
  firebaseUid?: string;
}

// UPDATE Order type — add field
export interface Order {
  _id: string;
  userID: string | User;         // populated: creator
  organizationId?: string | Organization;  // ADD — org scope
  assignedWorkerId?: string | User;
  customerFullName: string;
  customerPhoneNumber: string;
  customerAddress: string;
  status: string;
  orderNumber?: number;
  totalPrice?: string;
  requiredDeliveryDate?: string;
  description?: string;
  height?: string;
  width?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// UPDATE AuthContext state shape
export interface AuthState {
  token: string | null;
  user: User | null;
  // ensure user.organizationId and user.organizationCode are available when role === 'client'
}
```

---

## STEP 2 — CODEBASE SEARCH (agent: run ripgrep in FE repo)

```bash
# Find all breaking references to fix
rg "clientId" --type ts --type tsx
rg "client_id" --type ts --type tsx
rg "signUp|signup|register" --type ts --type tsx -i
rg "/admin/users" --type ts --type tsx
rg "/clients/orders" --type ts --type tsx
rg "AuthContext|useAuth" --type ts --type tsx
```

---

## STEP 3 — API SERVICE LAYER (implement or update these functions)

**File hint:** `services/api.ts`, `api/admin.ts`, `api/client.ts`, `api/auth.ts`

### Auth (UPDATE existing)

```typescript
// POST /api/auth/login
login(body: { phoneNumber: string; password: string })
// Response: { success, token, user: User } — user now has organizationCode, organizationId

// POST /api/auth/signUp
signUp(body: {
  fullName: string;
  phoneNumber: string;
  password: string;
  organizationCode: string;  // REQUIRED — org must exist on server
})
// Response 201: { success, userId, phoneNumber, code }

// POST /api/auth/verify
verify(body: { userId: string; code: string })
// Response: { success, token, user: User }
```

### Admin — NEW organization endpoints

```typescript
// POST /api/admin/organizations
createOrganization(body: { name: string; organizationCode: string }, token: string)

// GET /api/admin/organizations
listOrganizations(token: string)
// → { success, organizations: Organization[] }

// GET /api/admin/organizations/:organizationId
getOrganizationById(organizationId: string, token: string)
// → { success, organization: Organization, users: User[] }
```

### Admin — UPDATE add user

```typescript
// POST /api/admin/users
addClientUser(body: {
  fullName: string;
  phoneNumber: string;           // REQUIRED
  password?: string;
  organizationCode?: string;     // provide this OR organizationId
  organizationId?: string;
}, token: string)
// REMOVE from body: role, username, clientId
// → { success, user: { userId, username, fullName, role, organizationCode, organizationId } }
```

### Client — NEW team endpoints

```typescript
// GET /api/clients/users
listOrganizationMembers(token: string)
// → { success, users: User[] }

// POST /api/clients/users
addOrganizationMember(body: {
  fullName: string;
  phoneNumber: string;
  password?: string;
}, token: string)
// No organizationCode in body — server uses caller's org
// → { success, message, user }
```

### Client — behavior changes (no new routes)

```typescript
// GET /api/clients/orders — returns ALL orders for user's organization
getClientOrders(token: string)

// POST /api/clients/orders — fails 400 if user has no organizationId
createOrder(body: OrderCreatePayload, token: string)

// PUT /api/clients/orders/:orderId — can edit any order in same org
updateOrder(orderId: string, body: Partial<Order>, token: string)

// PUT /api/clients/users/:userId — only fullName, phoneNumber (NO organizationCode)
updateProfile(userId: string, body: { fullName?: string; phoneNumber?: string }, token: string)
```

---

## STEP 4 — UI PAGES TO CREATE OR UPDATE

### ADMIN PAGES

| Page | Action | API |
|------|--------|-----|
| **OrganizationsList** (NEW) | Table of orgs | `GET /admin/organizations` |
| **CreateOrganization** (NEW) | Form: name, organizationCode | `POST /admin/organizations` |
| **OrganizationDetail** (NEW) | Show org + member list | `GET /admin/organizations/:id` |
| **AddUser** (UPDATE) | Remove role/username fields; add org selector (code or id) | `POST /admin/users` |
| **UsersList** (UPDATE) | Show organizationCode / org name column | `GET /admin/users` |
| **OrdersList** (UPDATE) | Show org name/code on order rows | `GET /admin/orders` |

### CLIENT PAGES

| Page | Action | API |
|------|--------|-----|
| **SignUp** (UPDATE) | Label field "Organization code"; send `organizationCode` | `POST /auth/signUp` |
| **TeamMembers** (NEW) | List members + invite form | `GET/POST /clients/users` |
| **OrdersList** (UPDATE) | Show all org orders; optional column "Created by" from `order.userID.fullName` | `GET /clients/orders` |
| **CreateOrder** (UPDATE) | Guard: require `user.organizationId` | `POST /clients/orders` |
| **Profile** (UPDATE) | Remove clientId/organizationCode edit fields | `PUT /clients/users/:id` |

### WORKER PAGES
**No changes.**

---

## STEP 5 — FULL API SPECIFICATION

### Common error shape
```json
{ "success": false, "error": "message", "message": "optional detail" }
```

---

### AUTH

#### `POST /api/auth/login`
```json
// REQUEST
{ "phoneNumber": "0501234567", "password": "password123" }

// RESPONSE 200
{
  "success": true,
  "token": "eyJ...",
  "user": {
    "_id": "665a...",
    "fullName": "Alice",
    "username": "0501234567@dot.com",
    "phoneNumber": "0501234567",
    "role": "client",
    "organizationCode": "CL001",
    "organizationId": "665b...",
    "isActive": true,
    "needToChangePassword": false
  }
}
```

#### `POST /api/auth/signUp`
```json
// REQUEST
{
  "fullName": "Jane Smith",
  "phoneNumber": "0509876543",
  "password": "password123",
  "organizationCode": "CL001"
}

// RESPONSE 201
{ "success": true, "message": "Verification code sent", "phoneNumber": "0509876543", "userId": "665c...", "code": "123456" }

// ERROR 400 — org does not exist
{ "success": false, "error": "Organization not found for this code. Contact your administrator." }
```

#### `POST /api/auth/verify`
```json
// REQUEST
{ "userId": "665c...", "code": "123456" }

// RESPONSE 200 — same user shape as login (includes organizationId, organizationCode)
{ "success": true, "token": "...", "user": { } }
```

---

### ADMIN (role: admin)

#### `POST /api/admin/organizations` — NEW
```json
// REQUEST
{ "name": "Acme Ltd", "organizationCode": "CL001" }

// RESPONSE 201
{
  "success": true,
  "message": "Organization created successfully",
  "organization": { "_id": "...", "name": "Acme Ltd", "organizationCode": "CL001", "isActive": true }
}
```

#### `GET /api/admin/organizations` — NEW
```json
// RESPONSE 200
{ "success": true, "organizations": [ { "_id", "name", "organizationCode", "isActive" } ] }
```

#### `GET /api/admin/organizations/:organizationId` — NEW
```json
// RESPONSE 200
{
  "success": true,
  "organization": { "_id", "name", "organizationCode", "isActive" },
  "users": [ { "_id", "username", "fullName", "phoneNumber", "isActive", "createdAt" } ]
}
```

#### `POST /api/admin/users` — UPDATED
```json
// REQUEST (option A — by code)
{
  "fullName": "Jane Smith",
  "phoneNumber": "0501112233",
  "password": "password123",
  "organizationCode": "CL001"
}

// REQUEST (option B — by id)
{
  "fullName": "Jane Smith",
  "phoneNumber": "0501112233",
  "organizationId": "665b..."
}

// RESPONSE 201
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "userId": "...",
    "username": "0501112233@dot.com",
    "fullName": "Jane Smith",
    "role": "client",
    "organizationCode": "CL001",
    "organizationId": "665b..."
  }
}
```

#### `GET /api/admin/users` — UPDATED response
Users may have populated `organizationId`:
```json
{
  "organizationId": {
    "_id": "665b...",
    "name": "Acme Ltd",
    "organizationCode": "CL001",
    "isActive": true
  }
}
```

#### `GET /api/admin/orders` — UPDATED response
Each order may include:
```json
{
  "organizationId": { "_id", "name", "organizationCode", "isActive" },
  "userID": { "_id", "fullName", "phoneNumber", "organizationCode", "organizationId" }
}
```

---

### CLIENT (role: client)

#### `GET /api/clients/users` — NEW
```json
// RESPONSE 200
{
  "success": true,
  "users": [
    {
      "_id": "...",
      "username": "0501111111@dot.com",
      "fullName": "Alice",
      "phoneNumber": "0501111111",
      "isActive": true,
      "organizationCode": "CL001",
      "createdAt": "..."
    }
  ]
}
```

#### `POST /api/clients/users` — NEW
```json
// REQUEST
{ "fullName": "Bob Cohen", "phoneNumber": "0502223344", "password": "password123" }

// RESPONSE 201
{
  "success": true,
  "message": "User added to your organization successfully",
  "user": {
    "userId": "...",
    "username": "0502223344@dot.com",
    "fullName": "Bob Cohen",
    "role": "client",
    "phoneNumber": "0502223344",
    "organizationCode": "CL001",
    "organizationId": "665b..."
  }
}

// ERROR 400
{ "success": false, "error": "Your account is not linked to an organization." }
```

#### `GET /api/clients/orders` — BEHAVIOR CHANGE
Returns **all orders for the organization**, not only current user's orders.

#### `POST /api/clients/orders` — BEHAVIOR CHANGE
```json
// ERROR 400 if no organizationId on user
{ "success": false, "error": "Your account is not linked to an organization. Contact your administrator." }
```

#### `PUT /api/clients/orders/:orderId` — BEHAVIOR CHANGE
Can update any order belonging to the same organization.

#### `PUT /api/clients/users/:userId` — UPDATED
```json
// REQUEST — only these fields
{ "fullName": "New Name", "phoneNumber": "0509998877" }

// RESPONSE includes read-only org info
{
  "success": true,
  "user": {
    "organizationCode": "CL001",
    "organizationId": "665b...",
    "organization": { "_id", "name", "Acme Ltd", "organizationCode": "CL001" }
  }
}
```

---

### UNCHANGED (do not modify FE worker integration)

- `POST /api/admin/createNewWorker`
- `GET /api/workers/orders`
- File routes under `/api/files`

---

## STEP 6 — ROUTING SUGGESTIONS (React Router)

```text
ADMIN (add)
  /admin/organizations          → OrganizationsList
  /admin/organizations/new      → CreateOrganization
  /admin/organizations/:id      → OrganizationDetail

CLIENT (add)
  /client/team                  → TeamMembers (list + invite)

CLIENT (update guards)
  /client/orders/new            → require user.organizationId
```

---

## ACCEPTANCE CRITERIA (agent: verify before finishing)

- [ ] `rg clientId` in FE returns zero hits in TS/TSX (except comments/docs if any)
- [ ] Login stores `organizationId` + `organizationCode` in auth state
- [ ] Sign-up sends `organizationCode`, not `clientId`
- [ ] Admin can create org, list orgs, view org detail with members
- [ ] Admin add-user works with `phoneNumber` + `organizationCode` (no role/username in payload)
- [ ] Client team page lists members and can add a new member
- [ ] Two clients in same org see the same orders list
- [ ] Client without `organizationId` cannot create orders (UI blocked + API error handled)
- [ ] Worker screens unchanged
- [ ] Profile edit does not expose editable organization code field

---

## BUSINESS FLOW (reference)

```text
1. Admin: POST /admin/organizations { name, organizationCode: "CL001" }
2. Admin: POST /admin/users { fullName, phoneNumber, organizationCode: "CL001" }
   OR Client signs up: POST /auth/signUp { ..., organizationCode: "CL001" }
3. Client member: POST /clients/users { fullName, phoneNumber } → adds colleague to same org
4. All org clients: GET /clients/orders → shared order list
```

---

## BACKEND OPS (not FE — for reference only)

Existing DB with old `clientId` data: backend runs `node scripts/migrateOrganizations.js` once.

---

## API QUICK INDEX

| Status | Method | Path | Role |
|--------|--------|------|------|
| UPDATED | POST | `/auth/signUp` | public |
| UPDATED | POST | `/auth/login` | public |
| NEW | POST | `/admin/organizations` | admin |
| NEW | GET | `/admin/organizations` | admin |
| NEW | GET | `/admin/organizations/:organizationId` | admin |
| UPDATED | POST | `/admin/users` | admin |
| UPDATED | GET | `/admin/users` | admin |
| UPDATED | GET | `/admin/orders` | admin |
| NEW | GET | `/clients/users` | client |
| NEW | POST | `/clients/users` | client |
| UPDATED | GET | `/clients/orders` | client |
| UPDATED | POST | `/clients/orders` | client |
| UPDATED | PUT | `/clients/orders/:orderId` | client |
| UPDATED | PUT | `/clients/users/:userId` | client |

---

*End of Cursor agent instructions — DotGroup organization backend sync.*
