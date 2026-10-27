# MAC Store 1.1.0 · Firebase / GitHub

Sistema web de inventario, punto de venta, caja, cortes, reportes y usuarios.

**Esta entrega utiliza únicamente Firebase. No tiene modo demo, cuentas compartidas, productos precargados ni una base operativa en el navegador.** La configuración pública ya apunta a `mac-store-eba30`.

El código está preparado para subirlo a GitHub. La aplicación se publica en Firebase Hosting y guarda sus datos en Firebase. GitHub conserva el código y puede ejecutar el despliegue. Un push de archivos no crea ni activa por sí solo Auth, Firestore, Storage o Functions.

## Lo que incluye

- Productos, categorías y proveedores con alta, edición y baja lógica.
- Código de barras/SKU únicos, imágenes, costo, costo real, recargo, margen o precio manual.
- Inventario con movimientos y auditoría.
- POS por nombre/código/lector USB y cámara compatible.
- Efectivo, tarjeta y transferencia; cambio; stock validado en servidor.
- Ventas transaccionales e idempotentes, sin stock negativo.
- Recibos imprimibles y PDF mediante Guardar como PDF del navegador.
- Apertura por caja/cajero, entradas, retiros, cierre, diferencias e historial.
- Anulación completa con motivo y reversión de stock durante turno abierto.
- Dashboard, reportes por periodo, CSV y exportación JSON de consulta.
- Roles administrador/cajero y administración de usuarios.
- Activación segura del primer administrador con correo propietario verificado.
- Interfaz adaptable y SDK Firebase incluido localmente.
- Reglas de Firestore/Storage y workflows de GitHub.

## 1. Preparar Firebase (una vez)

Entra al proyecto **mac-store-eba30** de Firebase Console y comprueba:

1. **Authentication > Sign-in method:** habilita Email/Password.
2. **Firestore Database:** crea la base `(default)` si aún no existe. No uses reglas abiertas.
3. **Storage:** inicializa el bucket `mac-store-eba30.firebasestorage.app`.
4. Activa la facturación **Blaze**, necesaria para los servicios de esta arquitectura. Configura alertas de presupuesto.
5. En **Authentication > Settings > Authorized domains**, autoriza `mac-store-eba30.web.app`, `mac-store-eba30.firebaseapp.com` y `localhost` si probarás localmente. Si utilizas otro dominio, agrégalo.

No se incluyen credenciales administrativas. El API key del archivo web/config.js es configuración pública; los permisos los aplican reglas y funciones.

## 2. Subir el proyecto a GitHub

1. Crea un repositorio, por ejemplo `mac-store`.
2. Descomprime el ZIP.
3. Sube **el contenido completo de la carpeta MAC-Store-v1.1.0-GitHub**, incluyendo `.github`, `.firebaserc` y `.gitignore`, a la raíz del repositorio.
4. En la raíz deben verse `README.md`, `package.json`, `firebase.json`, `web/` y `functions/`. No subas el ZIP como único archivo.

Con Git desde la carpeta del proyecto:

```bash
git init
git add .
git commit -m "feat: MAC Store 1.1.0 conectado a Firebase"
git branch -M main
git remote add origin URL_DE_TU_REPOSITORIO
git push -u origin main
```

Elige una de las siguientes opciones para publicar. No necesitas ejecutar ambas.

## 3A. Publicar desde tu computadora (ruta más directa)

Instala Node.js 22 LTS y Firebase CLI. Usa una cuenta de Google con permisos de administración/despliegue en el proyecto.

```bash
npm install -g firebase-tools
firebase login
npm --prefix functions ci
npm run sync
firebase deploy --project mac-store-eba30 --only firestore,storage,functions,hosting
```

**Durante el primer despliegue, Firebase pide `BOOTSTRAP_ADMIN_EMAIL`: escribe tu correo real de propietario.** No uses un correo de ejemplo. Firebase guarda este parámetro en un `.env` local dentro de functions; está excluido de Git. Si cambias ese parámetro, vuelve a desplegar Functions.

El comando publica la interfaz, las reglas y las tres funciones `getState`, `mutate` y `claimFirstAdmin` en `us-central1`. Acepta las habilitaciones de APIs y de acceso Storage Rules → Firestore cuando Firebase las solicite.

Al terminar, abre:

**https://mac-store-eba30.web.app**

Para imágenes, configura el CORS del bucket, usando Google Cloud CLI con la misma cuenta administradora:

```bash
gcloud auth login
gcloud storage buckets update gs://mac-store-eba30.firebasestorage.app --cors-file=storage-cors.json
```

Alternativamente, una identidad con credenciales ADC y permiso para actualizar el bucket puede ejecutar `node functions/configure-storage.js`. No se necesita configurar CORS para registrar productos sin imagen.

## 3B. Publicar desde GitHub Actions

Esta opción evita tener que desplegar desde tu computadora después de configurarla.

1. En GitHub > Settings > Environments crea **firebase-production**.
2. En ese entorno agrega el **secret** `FIREBASE_SERVICE_ACCOUNT`: pega el JSON de una cuenta de servicio del proyecto con permisos suficientes para desplegar Functions, reglas y Hosting, usar la identidad de ejecución y configurar el bucket.
3. En el mismo entorno agrega la **variable** `MAC_STORE_OWNER_EMAIL` con tu correo real.
4. Abre Actions > **Publicar MAC Store en Firebase** > Run workflow.
5. Al finalizar en verde, abre https://mac-store-eba30.web.app.

La cuenta del secret debe ser una identidad de despliegue autorizada. Una clave de Firebase Admin SDK por sí sola no garantiza permisos para desplegar Cloud Functions. Los requisitos IAM dependen de las APIs ya habilitadas y de la identidad de ejecución: consulta la documentación de Functions/IAM o realiza el primer despliegue con la opción 3A. No uses ni publiques claves de una cuenta personal.

El workflow instala dependencias, verifica el proyecto, prepara el correo propietario, despliega interfaz/backend/reglas y configura CORS de imágenes. La clave se escribe solo en un archivo temporal privado del runner y se elimina al terminar.

Para desplegar automáticamente después de cada push a main, agrega una variable de repositorio `MAC_STORE_AUTO_DEPLOY` con valor `true`. Hasta que lo actives, el despliegue se inicia manualmente desde Actions. Los pull requests no reciben las credenciales de producción.

**Nunca subas el JSON de la cuenta de servicio al repositorio.** Solo va en GitHub Secrets.

## 4. Activar el primer administrador

1. Abre la aplicación publicada.
2. Pulsa **Configurar primer administrador**.
3. Captura tu nombre, el mismo correo configurado en `BOOTSTRAP_ADMIN_EMAIL` y una contraseña propia de al menos 10 caracteres.
4. Abre el enlace de verificación que recibirás por correo. Revisa spam si es necesario.
5. Regresa a la aplicación y pulsa **Ya verifiqué mi correo**.
6. Se activará el rol administrador. La tienda tendrá dos cajas disponibles y ningún producto ni venta de ejemplo.

Si ya creaste la cuenta, utiliza el mismo correo y contraseña. El flujo también puede continuar después de cerrar/reabrir la página. Una vez existe un administrador inicial, otra cuenta no puede apropiarse de la tienda. Las cuentas sin perfil autorizado no acceden a los datos.

Después crea categorías, proveedores, productos y cajeros. No hay una contraseña predeterminada.

## 5. Primera prueba real

1. Crea una categoría y un proveedor.
2. Crea un producto de prueba: costo real $100, recargo 50%, precio $150, stock inicial 5.
3. Abre un turno con $1,000.
4. Vende dos unidades y captura recibido $500: total $300, cambio $200, stock restante 3.
5. Recarga la página: debe conservarse la venta en Firebase.
6. Cierra el turno con $1,300: diferencia $0.
7. Crea un cajero y comprueba que no pueda acceder a administración.

Estos registros serán reales dentro de tu proyecto. No existe un botón que borre toda la tienda. Si pruebas con operaciones, consérvalas identificadas en observaciones y sigue el procedimiento de anulación antes de cerrar turno si deseas revertir una venta.

## GitHub Pages: opción de vista previa

Se incluye el workflow manual **Vista previa en GitHub Pages (opcional)**. En Settings > Pages selecciona GitHub Actions; ejecútalo desde Actions. Publica únicamente la carpeta web, nunca Functions ni tests.

La interfaz funciona en rutas de repositorio porque usa rutas relativas y hash. **Sigue necesitando el backend Firebase desplegado.** Para autenticar, agrega `TU-USUARIO.github.io` a Authorized domains. Para imágenes, agrega el origen HTTPS de Pages al CORS del bucket. Para la operación de la tienda se recomienda la publicación completa en Firebase Hosting descrita arriba.

## Ejecutar localmente contra Firebase real

```bash
npm start
```

Abre http://localhost:8080. No se requieren paquetes para el servidor local. Se conecta al mismo proyecto configurado y **los datos que registres son reales**. No abras index.html directamente con doble clic.

`INICIAR_WINDOWS.bat` abre el servidor en Windows. Mac/Linux puede usar `INICIAR_MAC_LINUX.sh`. El registro de ventas requiere conexión a Internet y los servicios ya desplegados.

## Pruebas automatizadas

```bash
npm ci
npm run check
```

Comprueba configuración, ausencia de cuentas de ejemplo en el frontend, sintaxis y las 30 pruebas del dominio.

Para integración y navegador necesitas Firebase CLI, Java 21+ recomendado y Chromium:

```bash
npm --prefix functions ci
npx playwright install chromium
MAC_TEST_UI=1 firebase emulators:exec --project demo-mac-store --only auth,firestore,storage "node tests/firebase.emulator.mjs"
```

En PowerShell establece primero `$env:MAC_TEST_UI="1"` y ejecuta el comando sin el prefijo `MAC_TEST_UI=1`. El escenario usa un proyecto de emulador aislado; no apunta al proyecto real. Comprueba la primera activación, correo verificado, roles, ventas concurrentes, idempotencia, cierre, reglas de imágenes y el frontend conectado.

Los datos exclusivos de pruebas están en tests/fixtures.js, no en web ni en Functions. El SDK ya viene compilado en web/vendor; se regenera con `npm run build:sdk`. Después de cambiar el dominio compartido, ejecuta `npm run sync`.

## Estructura y seguridad

- `web/`: única carpeta que se publica como interfaz.
- `functions/`: backend Firebase; `domain.js` refleja el dominio compartido.
- `firestore.rules` / `storage.rules`: permisos por rol; escrituras operativas directas bloqueadas.
- `.github/workflows/`: publicación y validación.
- `tests/`: escenarios no publicados.
- `docs/`: esquema, aceptación y resultados.
- `.firebaserc`: proyecto público seleccionado.

El navegador conserva la sesión de Firebase y el ID de un cobro pendiente para reintentos; **no conserva una base de ventas/inventario operativa**. Las confirmaciones se reciben del servidor. El cajero puede ver costos conforme a los requisitos originales; el recibo del cliente no los incluye.

## Alcance de esta versión

Una tienda, cantidades enteras y precios finales MXN. Tarjeta y transferencia se registran después de confirmar externamente el pago; no integra una terminal bancaria. Los recibos no son facturas fiscales. La cámara depende de soporte BarcodeDetector, HTTPS y permiso; siempre existe captura manual o lector USB.

Las mutaciones mantienen la estrategia transaccional de la versión anterior: leen el conjunto operativo y coordinan cambios mediante control/revision. Los listados se filtran/paginan en el cliente. Está destinada a una tienda de volumen pequeño; costo y latencia crecen con el historial. Para gran volumen se requieren consultas selectivas y paginación de servidor. Las anulaciones completas solo se permiten en turnos abiertos. La exportación JSON es de consulta; no restaura Authentication.

No se desplegó ni se validó en una cuenta real desde este paquete: no se proporcionó acceso administrativo a Firebase/GitHub. Las pruebas incluidas usan emuladores y la primera conexión real debe verificarse después del despliegue. No promete funcionamiento con servicios desactivados o permisos externos sin configurar.

## Documentación oficial

- https://firebase.google.com/docs/functions/config-env
- https://firebase.google.com/docs/auth/admin/custom-claims
- https://firebase.google.com/docs/functions/get-started
- https://firebase.google.com/docs/hosting/quickstart
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

Creado por Altos Film — https://altosfilm.com
