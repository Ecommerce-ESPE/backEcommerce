Socket events (realtime)

Conexión
- Socket.IO ya está inicializado en index.js
- Evento general: el backend emite en broadcast (io.emit)
- Payload incluye tenantId/branchId para filtrar en frontend

Eventos
1) tickets:update
Payload:
- action: CREATED | CLAIMED | STARTED | CLOSED | SKIPPED
- tenantId, branchId, serviceType?, ticketId, status?, code?, assignedToUserId?

2) workflow:update
Payload:
- action: CLAIMED | STARTED | COMPLETED
- tenantId, branchId, stageKey, orderId, currentStageKey?

3) orders:created
Payload:
- tenantId, branchId, orderId, orderNumber, currentStageKey

4) orders:ready
Payload:
- tenantId, branchId, orderId, orderNumber

Notas
- El frontend debe filtrar por tenantId/branchId.
- Si necesitas rooms por sucursal, se puede agregar join de rooms.
