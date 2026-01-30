# Roles y alcance

## User (global)
- El modelo `User` se mantiene sin cambios.
- Roles globales: `ADMIN`, `DEV`, `USER`.
- No se usa para roles operativos por sucursal.

## Membership (por tenant/sucursal)
- Define roles operativos por tenant y sucursal.
- Roles: `TENANT_ADMIN`, `BRANCH_ADMIN`, `CASHIER`, `KITCHEN`, `DISPATCH`, `COURIER`, `CUSTOMER`.
- `branchIds` puede ser `["*"]` para cubrir todas las sucursales del tenant.

## StaffSession (presencia/estado)
- Estado operativo en tiempo real por usuario/rol/sucursal.
- Estados: `AVAILABLE`, `BUSY`, `PAUSED`, `OFFLINE`.
- `activeTask` se actualiza al asignar tickets o etapas de workflow.

## Alcance (Scope)
- `TENANT_ADMIN` ve todo el tenant.
- `BRANCH_ADMIN` y roles operativos solo la sucursal asociada.
