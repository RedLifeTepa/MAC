// Ejecutar con credenciales administrativas, nunca desde el navegador.
import {initializeApp} from 'firebase-admin/app';
import {getStorage} from 'firebase-admin/storage';
initializeApp({projectId:'mac-store-eba30',storageBucket:'mac-store-eba30.firebasestorage.app'});
const origins=['https://mac-store-eba30.web.app','https://mac-store-eba30.firebaseapp.com','http://localhost:8080'];
if(process.env.GITHUB_REPOSITORY_OWNER)origins.push(`https://${process.env.GITHUB_REPOSITORY_OWNER.toLowerCase()}.github.io`);
for(const origin of (process.env.EXTRA_STORAGE_ORIGINS||'').split(',').filter(Boolean)){
 const url=new URL(origin.trim());if(url.protocol!=='https:')throw Error('Usa orígenes HTTPS.');origins.push(url.origin);
}
await getStorage().bucket().setCorsConfiguration([{origin:[...new Set(origins)],method:['GET'],maxAgeSeconds:3600}]);
console.log('CORS de imágenes configurado para los dominios de la tienda.');
