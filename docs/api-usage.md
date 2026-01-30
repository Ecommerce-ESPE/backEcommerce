Guia rapida de APIs (Postman)

Base URL (dev): http://localhost:3000/api

Headers en desarrollo
- x-token: <JWT>
- X-Tenant-Id: DEFAULT
- X-Branch-Id: DEFAULT

1) Auth (login)
POST /auth/login
Body:
{
  "email": "admin@demo.com",
  "password": "Admin1234"
}

2) Crear usuario (admin)
POST /admin/users
Body:
{
  "name": "Caja 1",
  "email": "caja1@demo.com",
  "password": "Temp1234",
  "phone": "0999999999"
}

3) Crear membership
POST /admin/memberships
Body:
{
  "userId": "66d0f0aa8b8f1b1aa0000002",
  "roles": ["CASHIER"],
  "branchIds": ["DEFAULT"],
  "active": true
}

4) Heartbeat staff (disponible)
POST /staff/heartbeat
Body:
{
  "role": "CASHIER"
}

5) Crear ticket
POST /tickets
Body:
{
  "serviceType": "checkout",
  "meta": { "customerName": "Juan", "phone": "0999999999" }
}

6) Claim siguiente ticket
POST /tickets/next
Body:
{
  "serviceType": "checkout"
}

7) Crear orden POS (cierra ticket)
POST /pos/orders
Body:
{
  "items": [
    { "productId": "66d0f0aa8b8f1b1aa0000001", "variantId": "66d0f0aa8b8f1b1aa0000101", "quantity": 2 }
  ],
  "customer": {
    "userId": "66d0f0aa8b8f1b1aa0000002",
    "name": "Cliente POS",
    "email": "cliente@demo.com",
    "phone": "0999999999"
  },
  "payment": { "method": "cash" },
  "ticketId": "66d0f0aa8b8f1b1aa0000999"
}

8) Generar factura (admin)
POST /admin/orders/:id/invoice

9) Ver factura (admin)
GET /admin/invoices/:id

10) Ver factura (cliente)
GET /customer/invoices/:id

Notas
- En produccion el JWT debe incluir tenantId/branchId y no necesitas headers.
- Si no usas tickets, puedes llamar POS sin ticketId.
