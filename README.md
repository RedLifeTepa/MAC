# MAC Store — Sistema Web POS, Almacén y Corte Diario

Sistema completo desarrollado para **MAC Store**.
**Creado por Altos Film — [https://altosfilm.com](https://altosfilm.com)**

## Conexión Directa con Firebase (NPM / Cloud)
1. Instala las dependencias NPM si usas empaquetador local:
   ```bash
   npm install
   ```
2. O abre la aplicación directamente (`npm start` o abriendo `index.html`), entra a la pestaña **⚙️ Firebase NPM & Config**, pega tu bloque `firebaseConfig` y pulsa **⚡ Conectar y Sincronizar con Firebase Cloud**.
3. Para desplegar en Firebase Hosting:
   ```bash
   firebase login
   firebase init
   firebase deploy --only firestore:rules,hosting
   ```
