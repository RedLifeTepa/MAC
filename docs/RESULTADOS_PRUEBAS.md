# Validación de MAC Store 1.2.0

Fecha: 27 de octubre de 2026.

## Aprobado

- 30 pruebas de dominio: precios/margen, importes, inventario, permisos, idempotencia, turnos y anulación.
- Validación del frontend: Auth + Firestore, sin SDK de Functions/Storage ni credenciales de ejemplo.
- Cuenta Auth sin perfil: devuelve instrucción con el UID. Un usuario no puede crearse un perfil admin por API.
- Perfil admin habilitado desde consola: inicializa cajas y tienda vacía.
- Cajero sin claims: abre turno, vende, registra entradas/retiros y cierra corte.
- Venta de 8 productos en la misma transacción: aprobada dentro de los límites de Rules.
- Manipulación de precios en una transacción completa: rechazada por las reglas, sin guardar venta.
- Escritura directa de stock/rol/totales y cierre incompleto por cajero: rechazada.
- Última unidad en dos compras concurrentes: una confirmada y una rechazada; stock cero.
- Reintento de venta: una venta y un único descuento.
- Anulación por admin: venta conservada con estado voided, stock repuesto.
- Imagen en Firestore: admin puede crear; cajero puede leer y tiene prohibido crear.
- Navegador Chromium: admin crea cajero sin perder sesión; crea producto con imagen comprimida en Firestore; el cajero inicia sesión, abre caja, cobra, ve cambio y conserva datos al recargar.
- Tablet y móvil: sin desbordamiento horizontal en el escenario probado.

Pruebas con Auth y Firestore emulados, sin Cloud Functions ni Storage. Los errores PERMISSION_DENIED que aparecen en la salida corresponden a los intentos maliciosos que la prueba espera rechazar.

## A verificar por el propietario

Publicar reglas, habilitar el perfil de su cuenta y publicar el sitio real. No se accedió ni modificó el proyecto mac-store-eba30. Verificar correo de recuperación, cámara y papel/impresora del equipo final. Vigilar cuotas y latencia con el volumen esperado.
