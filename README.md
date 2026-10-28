# MAC Store 1.3.0 · Interfaz clásica + Firestore directo

Inventario, POS, cortes, usuarios, reportes e imágenes con **Firebase Authentication + Cloud Firestore**, sin Cloud Functions, Cloud Storage ni backend propio. Esta edición recupera la interfaz clásica azul, la navegación horizontal, el logotipo y el flujo visual del prototipo anterior, conservando la capa segura y funcional de la versión 1.2.0.

La configuración pública apunta a **mac-store-eba30**. Conserva tu cuenta de Authentication. Para entrar debes publicar las nuevas reglas y crear el perfil inicial: Authentication valida la contraseña; Firestore determina el rol.

No hay demo, catálogo de ejemplo ni una base operativa local. El SDK está incluido en web/vendor y no necesita compilarse para publicar.

## Activar el acceso sin terminal

Sigue LEEME_PRIMERO.txt:

1. En Authentication habilita Email/Password y conserva o crea tu usuario.
2. Crea la base Firestore **(default)** en modo nativo si aún no existe.
3. En Firestore > Reglas reemplaza el contenido por **REGLAS_FIRESTORE.txt** y pulsa **Publicar**. Es idéntico a firestore.rules.
4. Copia el **UID** de tu cuenta en Authentication > Users.
5. En Firestore > Datos crea **users/{ese UID}**:

| Campo | Tipo | Valor |
|---|---|---|
| name | string | Bryan Delgadillo |
| email | string | redlifetepa@gmail.com |
| role | string | admin |
| active | boolean | true |
| openShiftId | null | null |

El ID es el UID, no el correo ni un ID automático. active es boolean, no texto. No guardes contraseñas. Para otra cuenta, sustituye UID, nombre y correo.

Al entrar como administrador se crean la configuración y dos cajas. El catálogo empieza vacío. La primera autorización se hace desde consola con la cuenta de Google administradora del proyecto; nadie puede registrarse como admin desde el sitio.

**No se necesitan Functions, Storage, BOOTSTRAP_ADMIN_EMAIL, custom claims, claves privadas ni cuenta de servicio.** Puede utilizar las cuotas de Spark; no es uso ilimitado. Revisa Uso en Firestore.

## Publicar en GitHub Pages

1. Sube TODO el contenido de MAC-Store-v1.3.0-Classic-UI a la raíz del repositorio, incluyendo .github, .gitignore y .firebaserc.
2. En Settings > Pages > Source selecciona **GitHub Actions**.
3. Usa la rama main. El workflow Publicar MAC Store en GitHub Pages publica al hacer push; también permite ejecución manual.
4. Espera a que termine en verde y abre la URL que muestra Pages.
5. Autoriza `TU-USUARIO.github.io` en Authentication > Settings > Authorized domains, sin https ni ruta. Autoriza también tu dominio propio si lo usas.
6. Recarga con **Ctrl+F5** después de reemplazar la versión anterior.

El workflow publica solo web/, sin pruebas ni herramientas. Las rutas relativas permiten usar una URL de repositorio. Publicar la web no publica las reglas: debes completar Firestore > Reglas. Esta modalidad no necesita GitHub Secrets.

Ajusta el alojamiento a los términos del proveedor elegido. También puedes publicar web/ en un servidor HTTPS propio o Firebase Hosting.

## Prueba de funcionamiento

1. Crea una categoría y un proveedor.
2. Crea un producto: costo real $100, recargo 50%, stock 5. Precio $150.
3. Abre turno con $1,000.
4. Vende dos unidades, recibido $500: total $300, cambio $200, stock restante 3.
5. Recarga: la venta y las existencias deben conservarse en Firestore.
6. Cierra con $1,300: diferencia $0.
7. Crea un cajero desde Usuarios y comprueba sus restricciones.

Estas operaciones son reales en tu proyecto. No existe borrado completo de tienda. Las bajas son lógicas y las ventas se anulan con motivo durante un turno abierto.

## Ventas y seguridad

Las ventas, stock, movimientos, turno y auditoría se guardan en transacciones. El cliente prepara la operación y Firestore Rules valida las escrituras: precios y costos del catálogo, cantidades, totales, pago, cambio, stock no negativo y turno abierto. Las fechas de los documentos se asignan mediante serverTimestamp.

Se admiten **8 productos distintos por recibo**, con cantidades repetidas. Para más tipos genera otro recibo. Es un límite explícito para respetar los límites de evaluación y acceso de Rules. No se divide un cobro en escrituras parciales.

Los reintentos usan el mismo requestId, evitando duplicar ventas o descuentos. El mismo ID con otro contenido se rechaza. Solo se confirma una venta con conexión; no existe cola de ventas offline.

control/revision coordina los cambios. Los catálogos y reportes administrativos se leen completos y se filtran/paginan en cliente. Esta versión es para una tienda de volumen pequeño: las lecturas crecen con el historial y cuentan en las cuotas. Para alto volumen se necesita paginación y consultas selectivas.

## Usuarios sin backend privilegiado

Los roles admin/cashier se leen de users/{uid}, sin custom claims.

- Crear cajero usa una instancia secundaria de Auth en memoria, conservando la sesión del administrador.
- Puede vincular una cuenta Auth existente sin perfil si se conoce su contraseña actual.
- Admin modifica nombre, rol y estado del perfil. Desactivarlo bloquea los datos aunque Auth conserve la cuenta.
- No puedes desactivarte ni degradar tu propio rol; otro administrador debe hacerlo.
- Cierra el turno antes de desactivar o cambiar el rol de un usuario.
- Contraseñas existentes se recuperan por correo. Cambiar correo o deshabilitar/eliminar la cuenta Auth se hace desde Firebase Console. No se simulan permisos administrativos de Authentication en el navegador.

## Imágenes en Firestore

JPG/PNG/WebP de hasta 5 MB se reducen a 480 px y comprimen en el navegador. Se guardan en images con máximo **150,000 caracteres de data URL**, aproximadamente 110 KB binarios. Una imagen que no pueda reducirse suficientemente se rechaza.

Se leen autenticadas desde Firestore, sin bucket ni CORS. Al reemplazarlas se crea un documento nuevo; los antiguos pueden limpiarse desde consola cuando ya no estén referenciados. Sus lecturas y almacenamiento consumen cuota. Imágenes antiguas alojadas en Storage deben cargarse nuevamente.

## Otros módulos

Productos, categorías, proveedores y ajustes de inventario con motivo; recargo, margen o precio manual; costos e historial; códigos de barras/SKU únicos; POS por nombre, código, teclado/lector USB o cámara compatible; recibos imprimibles/PDF vía impresión; efectivo, tarjeta y transferencia; entradas, retiros, cortes, diferencias; dashboard, reportes, CSV y auditoría.

Los códigos de barras/SKU permiten letras, números, guion y guion bajo. Los códigos históricos permanecen reservados al producto. El cajero puede ver costos; el recibo del cliente no los muestra.

Tarjeta/transferencia se confirman externamente. No integra terminal bancaria ni facturación fiscal. Moneda MXN, precios finales y cantidades enteras. La cámara requiere soporte BarcodeDetector, HTTPS/localhost y permiso; siempre hay captura manual.

## Ejecutar localmente

Node.js 22 LTS recomendado:

```bash
npm start
```

Abre http://localhost:8080. No hacen falta dependencias para el servidor. Windows puede usar INICIAR_WINDOWS.bat; Mac/Linux, INICIAR_MAC_LINUX.sh. No abras index.html directamente. Las operaciones se guardan en el mismo proyecto real.

## Firebase Hosting opcional

```bash
npm install -g firebase-tools
firebase login
firebase deploy --project mac-store-eba30 --only firestore,hosting
```

No inicialices Functions ni Storage. Puedes utilizar las cuotas de los servicios de tu plan.

## Desarrollo y pruebas

```bash
npm ci
npm run check
```

Para integración necesitas Firebase CLI y Java (21+ recomendado):

```bash
npm run test:firebase
```

Para navegador:

```bash
npx playwright install chromium
npm run test:ui
```

Las pruebas exigen emuladores y el proyecto aislado demo-mac-store. No modifican el proyecto real. firebase-admin es una dependencia exclusiva de pruebas para preparar documentos equivalentes a los creados desde consola: no forma parte del sitio ni se despliega como backend.

build:sdk reconstruye el SDK Auth + Firestore. prepare:pages genera site/ con los archivos publicables. Los fixtures están únicamente en tests/.

## Diagnóstico

- **Falta tu perfil users/UID**: la contraseña fue aceptada; crea ese documento con role y active.
- **Firestore rechazó la operación**: publica las reglas nuevas y verifica role/active.
- **Credenciales incorrectas**: revisa Authentication o usa Recuperar contraseña.
- **Cuota alcanzada**: revisa Uso. La operación fallida no se informa como confirmada.
- Si sigue apareciendo el error genérico de la versión anterior, comprueba que publicaste todo el frontend y recarga sin caché.

No se modificó ni publicó el proyecto real desde esta entrega. Se verificó con emuladores; la primera conexión a tu cuenta depende de que publiques reglas y habilites el perfil.

## Fuentes oficiales

- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/quotas
- https://firebase.google.com/docs/auth/web/manage-users

Creado por Altos Film — https://altosfilm.com
