# CURSOR AGENT TASK: DotGroup React — Public Order Status Link

## START HERE (copy into Cursor chat in the React repo)

```
@FE_PUBLIC_ORDER_STATUS_LINK.md

Implement admin “public status link” for private orders, plus a public (no-login) status page.
Follow every step and checklist in this file.
When finished, report the ACCEPTANCE CHECKLIST with done/not-done per item.
```

| Setting | Value |
|---------|--------|
| API base | `{VITE_API_URL}/api` or `http://localhost:5000/api` |
| Admin auth | `Authorization: Bearer <admin JWT>` |
| Public page route (FE) | `/order-status/:token` |
| Who can create/revoke links | **Admin only**, and **private orders only** |

---

## AGENT MISSION

1. On **admin private order detail**, add **Copy / Export public status link**, **Regenerate**, and **Revoke**.
2. Add a **public** page at `/order-status/:token` (no login) that loads status from the public API.
3. Compose the shareable URL as `{PUBLIC_APP_URL}/order-status/{token}` using `link.publicPath` from the admin API (`publicPath` is `/order-status/{token}`).

---

## HARD RULES

### MUST
- Show link controls **only** when `order.isPrivateClient === true`.
- Call admin link endpoints with the **admin** Bearer token only.
- Public page must call `GET /api/public/orders/status/:token` **without** Authorization.
- Display only fields returned by the public API (do not invent fields).

### MUST NOT
- Do not expose public links for registered-client orders.
- Do not put tokens in admin JWT or query strings beyond the path param.
- Do not show price, phone, address, notes, worker, org, or audit logs on the public page.

---

## API CONTRACT

### Create or get public link (admin)

| | |
|---|---|
| **Method / path** | `POST /api/admin/orders/:orderId/public-link` |
| **Auth** | Admin Bearer token |
| **Role** | `admin` |

**Success (200):**

```json
{
  "success": true,
  "message": "Public status link ready",
  "link": {
    "orderId": "507f1f77bcf86cd799439011",
    "orderNumber": 42,
    "token": "a1b2c3…",
    "publicPath": "/order-status/a1b2c3…",
    "enabled": true
  }
}
```

Shareable URL: `{origin}{link.publicPath}`  
Example: `https://app.example.com/order-status/a1b2c3…`

**Errors:**
- `400` — not a private order (`Public status links are only available for private orders`)
- `404` — order not found
- `401` / `403` — auth

### Regenerate link (admin)

| | |
|---|---|
| **Method / path** | `POST /api/admin/orders/:orderId/public-link/regenerate` |
| **Auth** | Admin Bearer |

Returns same `link` shape with a **new** `token` (old URL stops working).

### Revoke link (admin)

| | |
|---|---|
| **Method / path** | `DELETE /api/admin/orders/:orderId/public-link` |
| **Auth** | Admin Bearer |

**Success (200):**

```json
{
  "success": true,
  "message": "Public status link revoked",
  "link": {
    "orderId": "507f1f77bcf86cd799439011",
    "orderNumber": 42,
    "token": null,
    "publicPath": null,
    "enabled": false
  }
}
```

### Public status (no auth)

| | |
|---|---|
| **Method / path** | `GET /api/public/orders/status/:token` |
| **Auth** | None |

**Success (200):**

```json
{
  "success": true,
  "order": {
    "orderNumber": 42,
    "status": "in progress",
    "customerFullName": "John Doe",
    "requiredDeliveryDate": "2026-07-01",
    "updatedAt": "2026-08-02T10:00:00.000Z"
  }
}
```

**Error (404):** invalid, revoked, or unknown token (generic message — do not leak existence).

---

## TYPESCRIPT TYPES

```typescript
export interface PublicOrderStatusLink {
  orderId: string;
  orderNumber: number | string;
  token: string | null;
  publicPath: string | null;
  enabled: boolean;
}

export interface PublicOrderStatus {
  orderNumber: number | string;
  status: string;
  customerFullName: string | null;
  requiredDeliveryDate: string | null;
  updatedAt: string;
}
```

---

## UI GUIDE

### Admin — private order detail
- Button: **Copy public status link** → `POST .../public-link` → copy `{origin}{link.publicPath}` to clipboard.
- Optional: **Regenerate** (confirm) and **Revoke** (confirm).
- Hide these controls when `!isPrivateClient`.

### Public page `/order-status/:token`
- Fetch public status on mount.
- Show: order number, status, customer name, required delivery date, last updated.
- Loading / 404 empty states.
- No login chrome / no admin nav.

---

## ACCEPTANCE CHECKLIST

- [ ] Admin private order detail has Copy / Regenerate / Revoke public link
- [ ] Registered-client orders do **not** show these controls
- [ ] Copied URL opens public page without login
- [ ] Public page shows only safe fields from the API
- [ ] Revoke → public page shows not found
- [ ] Regenerate → old URL fails; new URL works
- [ ] Non-admin cannot call admin public-link endpoints (403)

---

## QUICK REFERENCE

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/admin/orders/:orderId/public-link` | admin | Get or create link |
| `POST` | `/api/admin/orders/:orderId/public-link/regenerate` | admin | New token |
| `DELETE` | `/api/admin/orders/:orderId/public-link` | admin | Revoke |
| `GET` | `/api/public/orders/status/:token` | none | Public status payload |
