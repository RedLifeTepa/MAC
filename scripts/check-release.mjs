import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
async function walk(path){const out=[];for(const d of await readdir(path,{withFileTypes:true})){const n=new URL(d.name+(d.isDirectory()?'/':''),path);if(d.isDirectory())out.push(...await walk(n));else out.push(n);}return out;}
for(const file of await walk(new URL('web/',root))){const source=await readFile(file,'utf8');assert.ok(!/seedDemo|admin@macstore\.demo|MacStore2026!|httpsCallable|getFunctions|getStorage|connectFunctionsEmulator|PRIVATE KEY/.test(source),file.pathname);}
const cfg=await import(new URL('web/config.js',root));assert.equal(cfg.firebaseConfig.projectId,'mac-store-eba30');assert.equal(cfg.useEmulators,false);
const settings=JSON.parse(await readFile(new URL('firebase.json',root)));assert.ok(!settings.functions&&!settings.storage);
console.log('Entrega verificada: Auth + Firestore, sin dependencias de Functions/Storage ni usuarios de ejemplo.');

assert.equal(await readFile(new URL('firestore.rules',root),'utf8'),await readFile(new URL('REGLAS_FIRESTORE.txt',root),'utf8'));
