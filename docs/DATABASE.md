# Modelo Firestore directo · 1.2.0

Se conservan users, products, categories, suppliers, registers, sales, shifts, inventoryMovements, cashMovements, logs y settings/store. El documento control/revision coordina las transacciones del cliente.

## Cambios de infraestructura

- Auth identifica UID y contraseña; el documento users/{uid} determina role y active.
- No hay custom claims, funciones callable ni lecturas/escrituras desde Admin SDK en producción.
- El primer admin se autoriza manualmente en Firebase Console.
- Las consultas de cajero a ventas/cortes/movimientos incluyen cashierId == UID. Firestore Rules verifica permisos; no filtra resultados automáticamente.
- Las escrituras de negocio usan runTransaction, con todas las lecturas antes de escribir. Se usa serverTimestamp para las fechas nuevas y se conservan íntegramente los timestamps anteriores.

## Productos e índices de unicidad

products conserva name, barcode, sku, categoryId, supplierId, costCents, realCostCents, pricingMode, profitPercent, priceCents, stock, minStock, lowStock, imagePath, active, createdAt y updatedAt.

barcodes/{barcode} y skus/{sku} contienen productId. El índice se reserva transaccionalmente al guardar un producto. Los códigos históricos no se reasignan. Baja = active:false, sin eliminación física.

Para vincular venta/movimientos sin que un cajero modifique otros datos, el producto también conserva lastSaleId, lastSaleIndex y lastMovementId. Las reglas restringen esas modificaciones a la venta atómica correspondiente.

## Ventas

El ID es UID_requestId. Se conservan cashierId, shiftId, registerId, items, totalSaleCents, totalCostCents, paymentMethod, paymentReceivedCents, changeCents, status, currency, businessDate, fingerprint, createdAt. Se añade operationId para asociar auditoría y movimientos.

Cada item conserva productId, name, barcode, qty, unitPriceCents, unitCostCents, subtotalCents y dos acumulados runningSaleCents/runningCostCents. Las reglas verifican que los acumulados correspondan a los precios del producto y que el total final coincida. Los enlaces a los productos exigen una única línea por producto.

Máximo 8 productos distintos por transacción. La transacción incluye venta, productos, movimientos de inventario, acumulados del turno y log. getAfter valida el estado resultante; un conjunto incompleto es rechazado.

createdAt es una marca de tiempo del servidor. Para los reportes, businessDate se recalcula desde ese timestamp y la zona de la tienda, evitando depender del reloj del dispositivo para la fecha mostrada.

## Turnos y efectivo

shifts conserva cashierId, registerId, status, openedAt, closedAt, openingCashCents, payments, totalSalesCents, totalCostCents, saleCount, cashInCents, cashOutCents, expectedCashCents, closingCashCents, differenceCents y notes. lastSaleId y lastCashMovementId vinculan los cambios de acumulados con los registros atómicos.

Apertura enlaza el turno en users y registers. Cierre libera ambos y guarda esperado, contado y diferencia. Un corte cerrado no acepta actualizaciones.

## Imágenes

images/{id}: dataUrl (JPG/PNG/WebP base64, máximo 150000 caracteres), createdBy y createdAt. products.imagePath o settings.logoPath utiliza firestore:{id}. Solo admin crea imágenes; el personal activo puede leerlas. Las imágenes anteriores permanecen como documentos hasta limpiarlas desde consola.

## Lecturas y volumen

El administrador carga el conjunto operativo; la transacción vuelve a leer las referencias conocidas y verifica la revisión antes de guardar. Si el conjunto cambió se obtiene nuevamente. Cajeros leen solo los documentos necesarios para su operación.

Se conservan filtros/reportes en cliente y el enfoque de una tienda pequeña. Las imágenes, lecturas e historial consumen las cuotas de Firestore. No representa una solución de alto tráfico ni multi-sucursal.

Firestore Admin SDK aparece únicamente en pruebas protegidas por variables de emulador, nunca en el sitio publicado.
