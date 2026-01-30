Flujo de Workflow (KDS/Dispatch)

Base URL (dev): http://localhost:3000/api

Headers requeridos (dev)
- x-token: <JWT del staff>
- X-Tenant-Id: DEFAULT
- X-Branch-Id: DEFAULT

Roles
- El usuario debe tener Membership con el rol correspondiente a la etapa (KITCHEN/DISPATCH/CASHIER).

Stage keys
- Se definen en TenantConfig.operations.workflow.stages
- Ejemplo: created -> preparing -> ready

1) Listar ordenes por etapa
GET /work/stage/:stageKey

Params:
- stageKey: string (ej: created, preparing, ready)

Respuesta:
{
  "ok": true,
  "data": [ ...orders ],
  "message": "OK"
}

2) Claim siguiente orden (asignacion)
POST /work/stage/:stageKey/next

Params:
- stageKey: string

Respuesta:
- Asigna la orden al usuario actual en stageHistory y retorna la orden.

3) Iniciar etapa
POST /work/orders/:id/stage/:stageKey/start

Params:
- id: orderId
- stageKey: string

Reglas:
- La orden debe estar en currentStageKey = stageKey
- Debe estar asignada al usuario (claim previo)

4) Completar etapa
POST /work/orders/:id/stage/:stageKey/complete

Params:
- id: orderId
- stageKey: string

Reglas:
- Marca la etapa como COMPLETED
- Avanza currentStageKey al siguiente stage configurado

Flujo recomendado
1) GET /work/stage/created
2) POST /work/stage/created/next
3) POST /work/orders/:id/stage/created/start
4) POST /work/orders/:id/stage/created/complete
5) GET /work/stage/preparing
6) Repetir claim/start/complete
7) GET /api/public/orders/ready (pantalla cliente)

Notas
- Si recibes "Orden no encontrada o no asignada", falta hacer claim.
- El modulo kdsKitchen/dispatch debe estar habilitado en TenantConfig.modules.
