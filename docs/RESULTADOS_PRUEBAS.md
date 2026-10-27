# Validación · MAC Store 1.1.0

Fecha: 27 de octubre de 2026.

## Resultado

- 30 pruebas de dominio aprobadas: importes, recargo/margen, stock, roles, venta, idempotencia, caja, cierre y anulación.
- Validador de entrega aprobado: proyecto Firebase real configurado, emuladores desactivados en entrega, sin cuentas/contraseñas de ejemplo ni claves privadas en web.
- Sintaxis JavaScript y YAML de workflows comprobada. Manifiestos y lockfiles en versión 1.1.0.
- Generación de carpeta para Pages comprobada; solo copia el frontend.
- Primera activación sobre base vacía: cuenta sin correo verificado rechazada, propietario autorizado verificado aceptado, otro correo rechazado, reintento sin duplicar perfil ni cajas y catálogo inicial vacío.
- Auth, custom claims, creación/desactivación de usuarios y consultas por rol comprobadas con emuladores.
- Ventas concurrentes de última unidad: solo una confirmada, stock final cero.
- Reintento de venta confirmada: no duplica venta ni movimientos.
- Carrera venta/cierre: total de corte coincide con ventas confirmadas.
- Firestore Rules: tanto cajero como admin tienen denegado escribir stock directamente.
- Storage Rules: tipo no permitido y escritura del cajero denegados; imagen del admin aceptada.
- Navegador Chromium contra backend emulado: login sin selector demo, apertura, venta, cambio, recarga/persistencia y adaptación sin desbordamiento en tablet y móvil.

Las pruebas usan Auth, Firestore y Storage emulados, y sirven las callables reales exportadas sobre HTTP/TCP. No se ejecutaron contra el proyecto real mac-store-eba30.

## Verificación que requiere acceso del propietario

- Activar servicios y realizar el despliegue real de Functions, reglas y Hosting.
- Configurar propietario, permisos IAM, email y CORS del bucket.
- Ejecutar workflows con credenciales autorizadas en GitHub.
- Comprobar entrega del correo de verificación y recuperación.
- Probar cámara, códigos físicos y la impresora del negocio.
- Medir costo y latencia con el historial esperado antes de operación de volumen alto.
