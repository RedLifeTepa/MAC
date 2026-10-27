# Cambios 1.2.0

- Eliminadas dependencias de Cloud Functions y Cloud Storage.
- Operaciones directas con el SDK de Firestore y transacciones.
- Reglas para validar precios, existencias, turnos, pagos, auditoría y roles.
- Roles desde users/{uid}, sin custom claims.
- Primer administrador habilitado desde consola.
- Creación de cajeros en Auth secundario sin perder la sesión principal.
- Contraseñas existentes se recuperan por correo; cambios de correo y cuenta Auth se administran en consola.
- Imágenes comprimidas guardadas en Firestore.
- Publicación estática en GitHub Pages, sin Secrets ni despliegue de backend.
- Máximo 8 productos distintos por recibo para respetar los límites de Rules.

No se borran datos existentes. Los datos de una demo local no se importan automáticamente. Imágenes antiguas de Storage requieren nueva carga. Productos anteriores sin reservas de código deben abrirse y guardarse para crear sus índices antes de ajustes administrativos.
