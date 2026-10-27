# Datos y operaciones

Moneda: enteros en centavos. Cantidades enteras. Las fechas se manejan como ISO en el dominio y como Timestamp en los documentos operativos escritos por Functions. `businessDate` es la fecha local de cada venta. Los IDs de relación son strings; el código de barras conserva ceros iniciales.

| Colección | Campos |
|---|---|
| users | name:string, email:string, role:admin/cashier, active:boolean, openShiftId:string/null, authSyncStatus:ready/pending, createdAt, updatedAt |
| products | name, nameSearch, barcode, sku, categoryId, supplierId, costCents:int, realCostCents:int, pricingMode:markup/margin/manual, profitPercent:number, priceCents:int, stock:int, minStock:int, lowStock:boolean, imagePath:string/null, active:boolean, createdAt, updatedAt |
| categories | name, description, active, createdAt, updatedAt |
| suppliers | name, contact, phone, email, notes, active, createdAt, updatedAt |
| registers | name, active, openShiftId |
| sales | cashierId, shiftId, registerId, items:array, totalSaleCents, totalCostCents, paymentMethod:cash/card/transfer, paymentReceivedCents, changeCents, status:completed/voided, businessDate, currency, createdAt, fingerprint, voidReason?, voidedAt?, voidedBy? |
| shifts | cashierId, registerId, status:open/closed, openedAt, closedAt, openingCashCents, payments:{cash,card,transfer}, totalSalesCents, totalCostCents, saleCount, cashInCents, cashOutCents, expectedCashCents, closingCashCents, differenceCents, notes |
| inventoryMovements | productId, type:initial/adjustment/sale/void, qtyDelta, stockBefore, stockAfter, saleId, reason, actorId, createdAt |
| cashMovements | shiftId, cashierId, type:in/out, amountCents, reason, actorId, createdAt |
| logs | action, actorId, entityId, details:map, createdAt |
| settings/store | name, currency, timezone, logoPath, receiptMessage |
| control/revision | version:int, updatedAt |

`items` conserva productId, name, barcode, qty, unitPriceCents, unitCostCents, subtotalCents. El identificador de venta es uid + requestId. El fingerprint normaliza turno, líneas, pago y total esperado, por lo que el mismo ID con un contenido distinto se rechaza.

## Operaciones callable

`getState({})`: devuelve únicamente el conjunto autorizado. El admin consulta todo y el cajero solo su perfil, ventas, turnos y movimientos de efectivo, junto con productos, categorías y cajas.

`mutate({action, data})` soporta:

- product.save / product.delete
- inventory.adjust
- catalog.save (categories o suppliers)
- user.save
- shift.open / shift.close
- cash.move
- sale.create / sale.void
- settings.save

La función comprueba Auth, perfil activo y coincidencia del claim role. El dominio aplica las reglas del rol. No acepta como confiables precios ni costos enviados por el cliente. Los cambios se guardan en una transacción de Firestore y se registra auditoría. Las contraseñas únicamente se envían al endpoint autenticado que usa Firebase Auth; no se almacenan en Firestore ni en los logs.

## Consistencia y límites

Esta primera versión carga el conjunto operativo dentro de las mutaciones y coordina transacciones mediante control/revision. Las búsquedas y agregaciones se hacen en memoria, con paginación visual. Esto simplifica la consistencia entre módulos para una tienda pequeña, a cambio de más lecturas y menor escalabilidad. Para alto volumen deben reemplazarse esas consultas por repositorios selectivos, paginación de servidor y estadísticas agregadas.

No hay índices compuestos requeridos por esta implementación: solo las consultas simples por cashierId en getState, cuyos índices automáticos se conservan. Los índices del plan original serán necesarios cuando se trasladen los filtros y el ordenamiento al servidor.

Las reservas barcode/SKU se implementan mediante unicidad dentro de la transacción serializada; no se crean colecciones barcodes ni skus. La auditoría de anulación se conserva en sales, inventoryMovements y logs, sin una colección saleVoids adicional.

## Primera instalación (1.1.0)

`claimFirstAdmin({name})` exige sesión Auth, email verificado y coincidencia con el parámetro BOOTSTRAP_ADMIN_EMAIL. La transacción reserva `control/first-admin` con uid/email, crea únicamente el perfil admin y las cajas si no existen, y conserva la tienda vacía. El claim se asigna mediante Admin SDK y el cliente refresca su token. No hay semillas ni adaptador de almacenamiento local en el frontend.

El bootstrap manual por ADC sigue disponible como herramienta administrativa en functions/bootstrap.js; el flujo recomendado para nuevos usuarios es la activación verificada desde la interfaz.
