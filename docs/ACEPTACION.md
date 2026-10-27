# Verificación manual

- [ ] Alta de categoría y proveedor; edición y desactivación.
- [ ] Alta de producto con imagen, código inicial con ceros y stock.
- [ ] Recargo 30% sobre $100 => $130; margen 30% => $142.86.
- [ ] Código/SKU duplicado rechazado. Precio cero y margen 100% rechazados.
- [ ] Editar datos no reemplaza stock; ajustar con motivo crea movimiento.
- [ ] Baja con historial desactiva y conserva ventas.
- [ ] Abrir turno con fondo; no se repite caja/cajero.
- [ ] Buscar por nombre, SKU o código exacto + Enter.
- [ ] Lector USB actúa como teclado. Cámara requiere dispositivo compatible y permiso.
- [ ] Vender 2 mouse con total $300 y pago $500 produce cambio $200.
- [ ] Pago insuficiente, producto inactivo y stock insuficiente se rechazan.
- [ ] Recibo no muestra costos internos; impresión permite Guardar PDF.
- [ ] Recargar conserva datos y turno.
- [ ] Reintentar un cobro confirmado no duplica venta ni movimientos.
- [ ] Anular con turno abierto repone stock y descuenta acumulados.
- [ ] Entrada y retiro cambian efectivo esperado; tarjeta/transferencia no lo incrementan.
- [ ] Corte guarda contado, esperado, diferencia y notas; cerrado no admite ventas.
- [ ] Admin ve todas las ventas/cortes; cajero solo los propios.
- [ ] Admin crea y modifica usuarios; no se desactiva último administrador.
- [ ] Un cajero no modifica inventario/usuarios mediante llamadas manuales.
- [ ] Escritura directa de stock, roles o venta por un cajero fuera de la transacción válida es rechazada.
- [ ] Ventas concurrentes de última unidad: solo una confirmación.
- [ ] Venta/cierre concurrentes: la venta entra al corte o se rechaza.
- [ ] CSV respeta periodo; dashboard coincide con ventas no anuladas.
- [ ] Zona America/Mexico_City: operación 02:00 UTC pertenece al día local anterior.
- [ ] Tablet y móvil: navegación, formularios, carrito y botones accesibles.
- [ ] Footer enlaza https://altosfilm.com y el sistema se identifica como MAC Store.

La cámara física, impresora y despliegue en un proyecto real deben verificarse en el equipo final. La validación con emuladores no sustituye la revisión del despliegue y permisos del proyecto real.
