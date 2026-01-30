# backEcommerce

Backend eCommerce (Node.js + Express + MongoDB + Mongoose) con soporte multi-negocio y módulo operativo (tickets, workflows, staff) + IVA Ecuador con snapshots de facturación.

## Tenancy en desarrollo
- `X-Tenant-Id`: define el tenant activo si no hay tenantId en el JWT.
- `X-Branch-Id`: define la sucursal activa si no hay branchId en el JWT.

## IVA Ecuador (ejemplo)
Configuración con IVA efectivo por fecha y `priceIncludesTax`:
```json
{
  "tax": {
    "strategy": "ecuador_iva",
    "priceIncludesTax": true,
    "iva": {
      "defaultRate": 0.15,
      "effectiveRates": [
        { "from": "2024-04-01T00:00:00.000Z", "rate": 0.15 }
      ],
      "productTaxRules": [
        { "match": { "categoryId": "66d0f0aa8b8f1b1aa0000001" }, "rate": 0.0 }
      ]
    }
  }
}
```

## Facturación con snapshots (inmutable)
La factura guarda:
- `tenantSnapshot`, `branchSnapshot`, `customerSnapshot`
- `taxBreakdown` calculado en el momento de la venta
Esto evita recalcular IVA con tasas actuales.

## Flujo tickets -> POS -> órdenes -> stages
1) Crear ticket: `POST /api/tickets`
2) Reclamar ticket: `POST /api/tickets/next`
3) Crear orden POS y cerrar ticket: `POST /api/pos/orders`
4) Trabajo por etapas:  
   - `GET /api/work/stage/:stageKey`  
   - `POST /api/work/stage/:stageKey/next`  
   - `POST /api/orders/:id/stage/:stageKey/start`  
   - `POST /api/orders/:id/stage/:stageKey/complete`

## Membresías (roles operativos)
Ejemplo asignación:
```json
{
  "userId": "66d0f0aa8b8f1b1aa0000002",
  "roles": ["BRANCH_ADMIN", "CASHIER"],
  "branchIds": ["DEFAULT"],
  "active": true
}
```

## Documentación de referencia
- `docs/tenant-config.example.json`
- `docs/branch.example.json`
- `docs/workflow.examples.json`
- `docs/roles-and-scope.md`
