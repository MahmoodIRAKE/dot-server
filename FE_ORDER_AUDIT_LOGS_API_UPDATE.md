# CURSOR AGENT TASK: DotGroup React — Order Audit / Change Logs

## START HERE (copy into Cursor chat in the React repo)

```
@FE_ORDER_AUDIT_LOGS_API_UPDATE.md

Implement admin-only Order Audit / Change Log UI for this React app.
Follow every step and checklist in that file.

CRITICAL ACCESS RULE:
- ONLY users with role "admin" may see the change/audit log.
- Clients, workers, and any other roles must NEVER see this UI or call the audit API.
- Do not add audit history to client or worker order detail pages.

Backend already records logs — frontend is read-only (fetch + display) for admin.
Do not change how orders are created/updated (no extra audit payload).
When finished, report the ACCEPTANCE CHECKLIST with done/not-done per item.
```

| Setting | Value |
|---------|--------|
| Base URL | `{VITE_API_URL}/api` or `http://localhost:5000/api` |
| Auth header | `Authorization: Bearer <admin JWT>` |
| Who can view logs | **Admin only** (`role === "admin"`). Not client. Not worker. Not other roles. |
| Endpoint | `GET /api/admin/orders/:orderId/audit-logs` |

---

## ACCESS CONTROL (NON-NEGOTIABLE)

| Role | Can view change logs? |
|------|------------------------|
| `admin` | Yes |
| `client` | No |
| `worker` | No |
| `superAdmin` / others | No (unless your app already treats them as admin elsewhere; default = admin route only) |

Backend already enforces this: the endpoint is under `/api/admin/...` with `authorizeRole("admin")`. Non-admin tokens get **403**.

Frontend must mirror that:

1. Render **Change history / Audit log** only inside **admin** order screens.
2. Guard the route/component with the same admin role check used for other admin pages.
3. Never mount the audit component on client/worker order detail.
4. Never add a public or client API wrapper for audit logs.

---

## AGENT MISSION

The backend now writes an **audit log** every time an order is created or meaningfully changed (field-level). Your job is **admin UI only** (admin can see logs; no other users):

1. Add TypeScript types for audit log entries.
2. Add an API client method to fetch logs for one order (**admin API module only**).
3. On the **admin order detail** page, show a **Change history / Audit log** section (timeline or list).
4. Display each log’s `fieldName`, `oldValue`, `newValue`, `userName`, and `createdAt` clearly.
5. Do **not** send user/audit fields when creating or updating orders — the backend gets the actor from the JWT.

---

## HARD RULES (MUST / MUST NOT)

### MUST
- Call `GET /api/admin/orders/{orderId}/audit-logs` with the **admin** Bearer token only.
- Show the audit UI **only** when the logged-in user is an admin.
- Show logs ordered as returned (already newest first).
- Handle empty history (`logs: []`) with a friendly empty state.
- Handle 404 (order not found) and 403 (non-admin).
- Render each log row using `fieldName`, `oldValue`, `newValue` (plus who/when). Do not parse `text`.

### MUST NOT
- Do **not** let clients, workers, or other non-admin roles see change logs.
- Do **not** add audit history to client or worker pages/routes.
- Do not invent POST/PUT audit endpoints — logging is automatic on the backend.
- Do not put `userId` / `userName` in create/update order request bodies for auditing.
- Do not change private-order or organization flows beyond linking audit history on the **admin** order detail view.
- Do not call `/clients/...` or `/workers/...` for logs.
- Do not create a shared “order history” component used outside admin without an admin role guard.
---

## API CONTRACT

### Retrieve audit history

| | |
|---|---|
| **Method / path** | `GET /api/admin/orders/:orderId/audit-logs` |
| **Auth** | `Authorization: Bearer <admin token>` |
| **Role** | `admin` |

**Success (200):**

```json
{
  "success": true,
  "orderId": "507f1f77bcf86cd799439011",
  "orderNumber": 1052,
  "logs": [
    {
      "id": "687f1f77bcf86cd7994390aa",
      "userId": "507f1f77bcf86cd799439045",
      "userName": "John Smith",
      "fieldName": "width",
      "oldValue": "12",
      "newValue": "112",
      "createdAt": "2026-07-29T10:35:00.000Z"
    },
    {
      "id": "687f1f77bcf86cd7994390ab",
      "userId": "507f1f77bcf86cd799439045",
      "userName": "John Smith",
      "fieldName": "status",
      "oldValue": "new",
      "newValue": "waiting for approval",
      "createdAt": "2026-07-29T10:30:00.000Z"
    }
  ]
}
```

**Errors:**
- `401` — missing/invalid token  
- `403` — not admin  
- `404` — order not found  
- `400` — invalid order id  

### Important behavior notes for UI

- One API request returns **all** logs for that order; newest first.
- **Each changed field = one log row** with `fieldName`, `oldValue`, `newValue`, `userName`, `createdAt`.
- Saving a form that includes unchanged fields (e.g. status) does **not** create log rows for those fields.
- `oldValue` / `newValue` are `null` when empty; show as “—” or “(empty)” in the UI.
- Editing width from `12` → `112` produces exactly one row: `fieldName: "width"`.

---

## TYPESCRIPT TYPES

```typescript
export interface OrderAuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  text?: string | null; // legacy rows only
  createdAt: string; // ISO
}

export interface OrderAuditLogsResponse {
  success: boolean;
  orderId: string;
  orderNumber: number | string;
  logs: OrderAuditLogEntry[];
}
```

---

## API SERVICE LAYER

Add a helper matching existing project conventions (axios/fetch/services folder):

```typescript
export async function getOrderAuditLogs(
  orderId: string,
  token: string
): Promise<OrderAuditLogsResponse> {
  const res = await fetch(`${API_BASE}/admin/orders/${orderId}/audit-logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Failed to load audit logs');
  }
  return data;
}
```

---

## UI IMPLEMENTATION GUIDE

### Where to put it
- **Admin order detail page** (preferred): section titled **Change history** or **Audit log**, below order details / next to activity.
- Optional: small “History” tab or accordion if the detail page is crowded.
- Optional entry from admin order list: link/icon → order detail with history focused (not required).

### What each row should show
For every log entry, display:

| UI label | Source |
|----------|--------|
| When | `createdAt` |
| Who | `userName` |
| Field | `fieldName` |
| Old | `oldValue` |
| New | `newValue` |

Example:

> **John Smith** — Jul 29, 2026, 10:35  
> width: `12` → `112`

### Loading / empty / error
- Loading skeleton or spinner while fetching.
- Empty: “No changes recorded for this order yet.”
- Error: show API message; keep order detail usable.

### UX polish (do these)
- Sort is already newest-first — do not re-sort.
- Keep layout consistent with existing admin design system (do not invent a totally different theme).

### Do not rebuild these backends behaviors
Creating/updating/status/worker-assign already generate logs automatically. After an admin saves an order or changes status, refresh the audit section (refetch) so new rows appear.

---

## IMPLEMENTATION ORDER

```
Step 1  → Add OrderAuditLogEntry / OrderAuditLogsResponse types
Step 2  → Add getOrderAuditLogs API helper
Step 3  → Build OrderAuditLogList (or ChangeHistory) presentational component
Step 4  → Mount it on admin order detail; fetch by route orderId
Step 5  → Date format + show `text` / `userName` cleanly
Step 6  → Refetch history after successful order update / status / worker assign on that page
Step 7  → Grep FE — ensure no audit UI on client/worker routes
Step 8  → Manual test checklist below
```

---

## ACCEPTANCE CHECKLIST

Report each item as **done** or **not done**:

- [ ] Types added for audit log entry + response
- [ ] `getOrderAuditLogs(orderId, token)` calls `GET /admin/orders/:orderId/audit-logs`
- [ ] Admin order detail shows Change history / Audit log section
- [ ] **Only admin** can see the change log UI (role-gated)
- [ ] Client order detail has **no** audit/change history section
- [ ] Worker screens have **no** audit/change history section
- [ ] Newest logs appear first
- [ ] Empty state when `logs` is `[]`
- [ ] Each row shows `userName`, `fieldName`, `oldValue`, `newValue`, and `createdAt`
- [ ] 403/404/error handling works
- [ ] History refreshes after an admin edit/status/worker change on the same page
- [ ] No fake audit fields sent on order create/update payloads

---

## MANUAL TEST PLAN (agent or QA)

1. As **admin**, open an existing order → history loads (or empty state).
2. Change **width** only → refresh → one new row with `fieldName: "width"`, correct old/new (status must NOT appear).
3. Edit **notes** + **description** in one save → two rows (one per field).
4. Create a **private order** → open it → see create rows (one per initial field).
5. As **client**, confirm order detail has **no** change-log section, and calling the admin audit URL returns **403**.
6. As **worker**, confirm there is **no** change-log UI anywhere.

---

## QUICK REFERENCE

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/orders/:orderId/audit-logs` | admin | List change history for one order |

Logging is automatic on:

- `POST /api/admin/orders` (private create)
- `POST /api/clients/orders` / open API create
- `PUT /api/admin/orders/:orderId`
- `PUT /api/clients/orders/:orderId`
- `PATCH /api/admin/orders/:orderId/status` (and client status route)
- `PATCH /api/admin/orders/:orderId/worker`

Frontend only **reads** the audit endpoint.

---

## OUT OF SCOPE

- Worker app / client “my order history” UI
- Editing or deleting audit logs
- Pagination (not provided by API yet — render full list; add client pagination only if the list becomes huge)
- Charts / analytics dashboards
