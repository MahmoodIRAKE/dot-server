# Worker role and order assignment

This document summarizes backend changes for **workers** (field staff) and what the **frontend** should implement or adjust.

---

## Backend changes

### Data model

| Area | Change |
|------|--------|
| **Users** (`models/User.js`) | New allowed `role` value: `worker` (in addition to `client`, `admin`, `superAdmin`). |
| **Orders** (`models/Order.js`) | New optional field `assignedWorkerId` (ObjectId → `Users`). Orders without a worker leave this field unset/null. |

### New and updated HTTP routes

Base URL assumes the same host as today; paths are relative to `/api`.

#### Admin — create worker (new)

| | |
|---|---|
| **Method / path** | `POST /api/admin/createNewWorker` |
| **Auth** | `Authorization: Bearer <admin JWT>` |
| **Role** | `admin` only |

**Request body (JSON):**

| Field | Required | Notes |
|-------|----------|--------|
| `fullName` | Yes | Display name |
| `phoneNumber` | Yes | Same convention as clients (used for login and `+972…` in Firebase) |
| `password` | Yes | Initial password (stored hashed; also used for Firebase user). Must meet Firebase password rules. |

**Behavior:** Creates a Firebase Auth user and a MongoDB user with `role: "worker"`, `username` = `{phoneNumber}@dot.com`, no `clientId`. Does **not** use `POST /api/admin/users` (`addNewUser`).

**Success (201):** `success`, `message`, `user` object with `userId`, `username`, `fullName`, `role`, `phoneNumber`.

---

#### Admin — assign order to worker (new)

| | |
|---|---|
| **Method / path** | `PATCH /api/admin/orders/:orderId/worker` |
| **Auth** | Bearer + `admin` |

**Request body:**

- Assign: `{ "workerId": "<MongoDB _id of the worker user>" }`
- Unassign: `{ "workerId": null }` (or omit / empty string, per API implementation)

**Success:** `order` includes populated `assignedWorkerId` (e.g. `username`, `fullName`, `phoneNumber`, `role`) when set.

---

#### Admin — existing order endpoints (updated responses)

`GET /api/admin/orders`, `GET /api/admin/orders/:orderId`, `PUT /api/admin/orders/:orderId`, and `PATCH /api/admin/orders/:orderId/status` now **populate** `assignedWorkerId` the same way as other user refs, when present.

---

#### Worker — list my orders (new)

| | |
|---|---|
| **Method / path** | `GET /api/workers/orders` |
| **Auth** | Bearer + `worker` |

Returns only orders where `assignedWorkerId` equals the logged-in worker’s id. Each order includes populated `userID` (client fields such as `username`, `fullName`, `clientId`, `phoneNumber`).

---

#### Auth (unchanged contract)

Workers sign in with the same endpoint as clients: `POST /api/auth/login` with `phoneNumber` and `password`. The JWT payload includes `role: "worker"` when applicable.

---

## Frontend: what to add or change

### 1. Role handling and navigation

- Treat **`worker`** as a first-class role wherever you branch on `client` / `admin`.
- After login, if `user.role === "worker"`:
  - Redirect to a **worker home / orders** screen (not the client or admin dashboard).
  - Persist token and role the same way as for other roles; protect worker routes with a guard that requires `role === "worker"`.

### 2. Admin UI

- **Create worker:** New screen or section (e.g. “Add worker”) that calls  
  `POST /api/admin/createNewWorker`  
  with `fullName`, `phoneNumber`, `password`.  
  Do **not** send worker creation to `POST /api/admin/users` unless you are intentionally creating a **client** only.
- **Assign worker to order:** On order detail or order row (admin), add:
  - A worker picker (dropdown/search) populated from your users list **filtered by `role === "worker"`** (e.g. from `GET /api/admin/users` if you expose workers there), or a dedicated endpoint if you add one later.
  - Save via `PATCH /api/admin/orders/:orderId/worker` with `{ workerId }`.
  - Optional “Clear assignment” that sends `workerId: null`.
- **Display:** On admin order list and detail, show **`assignedWorkerId`** (name / phone) when the backend returns it, so admins see who is assigned.

### 3. Worker UI

- New **worker** area of the app:
  - Call `GET /api/workers/orders` with the worker’s Bearer token.
  - Render the list (and optional detail view) using the same order fields you already use elsewhere; client info is under populated `userID`.

### 4. API client / constants

- Add base path for worker APIs, e.g. `/api/workers`.
- Add methods: `createNewWorker`, `assignOrderToWorker`, `getWorkerOrders`.
- Regenerate or extend OpenAPI/Postman/`DotGroup_API_Collection.json` if your team uses them, so QA can hit the new routes.

### 5. Types and forms (if using TypeScript)

- Extend user `role` union with `"worker"`.
- Extend order type with optional `assignedWorkerId: User | string | null` (match your existing populate typing).

### 6. Edge cases

- **403:** If a worker token is used on client-only or admin-only routes, show “not allowed” and keep them on worker screens only.
- **Password:** Initial password for new workers must satisfy Firebase rules (length/complexity); show validation hints on the create-worker form.

---

## Quick reference (paths)

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/admin/createNewWorker` | admin |
| `PATCH` | `/api/admin/orders/:orderId/worker` | admin |
| `GET` | `/api/workers/orders` | worker |
| `POST` | `/api/auth/login` | any (including worker) |

---

## Files touched in the backend (for developers)

- `models/User.js` — `worker` in role enum  
- `models/Order.js` — `assignedWorkerId`  
- `controllers/adminController.js` — `createNewWorker`, `assignOrderToWorker`, order populate updates  
- `controllers/workerController.js` — new  
- `routes/adminRoutes.js` — new routes  
- `routes/workerRoutes.js` — new  
- `server.js` — `app.use('/api/workers', …)`
