# Cambios desde 1.0.0

- Se eliminó el adaptador demo del frontend y las semillas del código publicado.
- Se retiraron los accesos y contraseñas de ejemplo del login.
- La configuración pública apunta a mac-store-eba30; no se incluyen claves privadas.
- El inicio restaura la sesión real de Firebase y traduce errores frecuentes al español.
- Se agregó claimFirstAdmin con allowlist de correo, verificación y reserva transaccional del propietario.
- Se añadieron workflows de despliegue, validación y vista previa de Pages.
- Se agregó configuración CORS por identidad de despliegue.
- Las actualizaciones de claims conservan otros claims de la cuenta.
- Cambiar el perfil propio obliga a renovar la sesión.
- Se corrigió el encabezado en móvil y se separaron los fixtures de prueba del sitio publicado.
- Se actualizaron las instrucciones para subir el proyecto completo y publicar el backend.

## Compatibilidad

No se modificó el esquema de productos, ventas o cortes de la versión anterior. No se borran datos existentes de Firebase. Los datos guardados únicamente en la demo del navegador no se migran automáticamente ni se toman como registros operativos.
