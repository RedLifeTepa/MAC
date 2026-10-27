import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
async function walk(path){const out=[];for(const d of await readdir(path,{withFileTypes:true})){const next=new URL(d.name+(d.isDirectory()?'/':''),path);if(d.isDirectory())out.push(...await walk(next));else out.push(next);}return out;}
for(const file of await walk(new URL('web/',root))){
 const source=await readFile(file,'utf8');
 assert.ok(!/seedDemo|admin@macstore\.demo|caja@macstore\.demo|MacStore2026!|Caja2026!|mac-store-demo-credentials|api\.mode/.test(source),`Datos de demostración en ${file.pathname}`);
 assert.ok(!source.includes('PRIVATE KEY'),`Clave privada en ${file.pathname}`);
}
const config=await import(new URL('web/config.js',root));
assert.equal(config.firebaseConfig.projectId,'mac-store-eba30');
assert.equal(config.useEmulators,false,'La entrega debe apuntar a Firebase real.');
const backend=await readFile(new URL('functions/domain.js',root),'utf8');
assert.equal(backend,await readFile(new URL('web/src/domain.js',root),'utf8'));
const rules=await readFile(new URL('firestore.rules',root),'utf8');
assert.ok(rules.includes('allow read, write: if false;'));
console.log('Entrega verificada: configuración real, sin cuentas de ejemplo ni claves privadas.');
