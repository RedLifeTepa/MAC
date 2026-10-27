import {writeFile} from 'node:fs/promises';
import path from 'node:path';
let credentials;try{credentials=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'null');}catch{throw Error('El secret FIREBASE_SERVICE_ACCOUNT debe contener JSON válido.');}
const owner=process.env.MAC_STORE_OWNER_EMAIL?.trim().toLowerCase();
if(!credentials?.private_key||credentials.project_id!=='mac-store-eba30')throw Error('Configura el secret FIREBASE_SERVICE_ACCOUNT del proyecto correcto.');
if(!owner||!/^[^\s@=]+@[^\s@=]+\.[^\s@=]+$/.test(owner))throw Error('Configura la variable MAC_STORE_OWNER_EMAIL con tu correo real.');
if(!process.env.RUNNER_TEMP)throw Error('Este script es exclusivo del runner de GitHub.');
await writeFile(path.join(process.env.RUNNER_TEMP,'firebase-service-account.json'),JSON.stringify(credentials),{mode:0o600});
await writeFile('functions/.env.mac-store-eba30',`BOOTSTRAP_ADMIN_EMAIL=${owner}\n`,{mode:0o600});
console.log('Configuración temporal preparada.');
