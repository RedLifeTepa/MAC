import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {COLLECTIONS} from '../web/src/domain.js';
import {testState as seedDemo} from './fixtures.js';
process.env.BOOTSTRAP_ADMIN_EMAIL='owner@example.com';
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp}=require('firebase-admin/app'),{getAuth}=require('firebase-admin/auth'),{getFirestore}=require('firebase-admin/firestore');
assert.ok(process.env.FIRESTORE_EMULATOR_HOST&&process.env.FIREBASE_AUTH_EMULATOR_HOST,'Solo se permite ejecutar con emuladores.');
const project='demo-mac-store';initializeApp({projectId:project});
// Callables reales sobre TCP, con Auth y Firestore emulados.
const express=require('express'),handlers=await import('../functions/index.js');
const http=express();http.use(express.json());
http.post('/demo-mac-store/us-central1/getState',handlers.getState);
http.post('/demo-mac-store/us-central1/mutate',handlers.mutate);
http.post('/demo-mac-store/us-central1/claimFirstAdmin',handlers.claimFirstAdmin);
const server=await new Promise(resolve=>{const server=http.listen(5001,'127.0.0.1',()=>resolve(server));});
const db=getFirestore(),auth=getAuth();
await auth.createUser({uid:'owner',email:'owner@example.com',password:'Owner2026!'});
let ownerToken=await signin('owner@example.com','Owner2026!');
await assert.rejects(()=>call('claimFirstAdmin',{name:'Propietario'},ownerToken),/Verifica/);
await auth.updateUser('owner',{emailVerified:true});
ownerToken=await signin('owner@example.com','Owner2026!');
await call('claimFirstAdmin',{name:'Propietario'},ownerToken);
ownerToken=await signin('owner@example.com','Owner2026!');
const fresh=await call('getState',{},ownerToken);
assert.equal(fresh.products.length,0);assert.equal(fresh.sales.length,0);assert.equal(fresh.registers.length,2);
assert.equal(fresh.users[0].role,'admin');
await call('claimFirstAdmin',{name:'Propietario'},ownerToken);
assert.equal((await call('getState',{},ownerToken)).users.length,1);
await auth.createUser({uid:'other-owner',email:'otro@example.com',password:'Other2026!',emailVerified:true});
const otherToken=await signin('otro@example.com','Other2026!');
await assert.rejects(()=>call('claimFirstAdmin',{name:'Otro'},otherToken),/propietario/);
// Preparar el escenario operativo de prueba desde cero, sin tocar el frontend.
for(const c of [...COLLECTIONS,'settings','control']){const docs=await db.collection(c).get();for(const d of docs.docs)await d.ref.delete();}
const s=seedDemo();s.products[0].stock=1;s.inventoryMovements[0].qtyDelta=1;s.inventoryMovements[0].stockAfter=1;
const batch=db.batch();for(const c of COLLECTIONS)for(const doc of s[c]){const {id,...value}=doc;batch.set(db.doc(`${c}/${id}`),value);}batch.set(db.doc('settings/store'),s.settings);await batch.commit();
for(const u of s.users){await auth.createUser({uid:u.id,email:u.email,password:'Testing2026!'});await auth.setCustomUserClaims(u.id,{role:u.role});}
async function signin(email,password='Testing2026!'){const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});const b=await r.json();assert.ok(b.idToken,JSON.stringify(b));return b.idToken;}
const admin=await signin('admin@macstore.demo'),cashier=await signin('caja@macstore.demo');
async function call(name,data,token=admin){const r=await fetch(`http://127.0.0.1:5001/${project}/us-central1/${name}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({data})});const b=await r.json();if(!r.ok||b.error)throw Error(b.error?.message||JSON.stringify(b));return b.result;}
const mutate=(action,data,token)=>call('mutate',{action,data},token);
assert.equal((await call('getState',{})).products.length,8);
await assert.rejects(()=>mutate('user.save',{name:'Intruso',email:'evil@example.com',role:'admin',active:true,password:'Intruso2026!'},cashier),/administrador/);
const {id:shiftId}=await mutate('shift.open',{registerId:'caja-1',openingCashCents:100000});
const order=id=>({requestId:id,shiftId,items:[{productId:'prod-1',qty:1}],expectedTotalCents:15000,paymentMethod:'cash',paymentReceivedCents:20000});
const attempts=await Promise.allSettled([mutate('sale.create',order('concurrent-a')),mutate('sale.create',order('concurrent-b'))]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1,'Solo una venta obtiene la última unidad');
let current=await call('getState',{});assert.equal(current.products.find(x=>x.id==='prod-1').stock,0);assert.equal(current.sales.length,1);assert.equal(current.sales[0].changeCents,5000);const successful=attempts[0].status==='fulfilled'?'concurrent-a':'concurrent-b';await mutate('sale.create',order(successful));assert.equal((await call('getState',{})).sales.length,1);
const cashierState=await call('getState',{},cashier);assert.equal(cashierState.sales.length,0);assert.equal(cashierState.users.length,1);assert.equal(cashierState.logs.length,0);
for(const token of [admin,cashier]){const r=await fetch(`http://127.0.0.1:8081/v1/projects/${project}/databases/(default)/documents/products/prod-1`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({fields:{stock:{integerValue:'999'}}})});assert.equal(r.status,403);}
const created=await mutate('user.save',{name:'Cajero Firebase',email:'nuevo@example.com',role:'cashier',active:true,password:'Nuevo2026!'});assert.ok(created.id);const newToken=await signin('nuevo@example.com','Nuevo2026!');assert.equal((await call('getState',{},newToken)).users[0].role,'cashier');
const race=await Promise.allSettled([mutate('sale.create',{...order('close-race'),items:[{productId:'prod-2',qty:1}],expectedTotalCents:49000,paymentReceivedCents:50000}),mutate('shift.close',{shiftId,closingCashCents:115000,notes:'Prueba concurrente'})]);assert.equal(race[1].status,'fulfilled');current=await call('getState',{});const shift=current.shifts.find(x=>x.id===shiftId);assert.equal(shift.status,'closed');assert.equal(shift.totalSalesCents,current.sales.filter(x=>x.status==='completed').reduce((n,x)=>n+x.totalSaleCents,0));assert.equal(current.users.find(u=>u.id==='admin-demo').openShiftId,null);
await mutate('user.save',{id:created.id,name:'Cajero Firebase',email:'nuevo@example.com',role:'cashier',active:false});await assert.rejects(()=>call('getState',{},newToken),/inactivo|Unauthenticated/);
if(process.env.FIREBASE_STORAGE_EMULATOR_HOST){
 const url='http://127.0.0.1:9199/v0/b/demo-mac-store.appspot.com/o?uploadType=media&name=products%2Fprod-1%2Ftest.png';
 for(const [token,type,status] of [[admin,'text/plain',403],[cashier,'image/png',403],[admin,'image/png',200]]){
  const boundary='mac-test-boundary';const body=`--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${JSON.stringify({name:'products/prod-1/test.png',contentType:type})}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\nimage-test\r\n--${boundary}--\r\n`;
  const r=await fetch(url,{method:'POST',headers:{Authorization:`Firebase ${token}`,'x-goog-upload-protocol':'multipart','Content-Type':`multipart/related; boundary=${boundary}`},body});assert.equal(r.status,status,await r.text());
 }
}
if(process.env.MAC_TEST_UI==='1'){
 const {chromium}=await import('playwright');const {spawn}=await import('node:child_process');
 const child=spawn(process.execPath,['scripts/serve.js'],{cwd:process.cwd()});
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:`export const firebaseConfig={apiKey:'demo-key',projectId:'demo-mac-store',authDomain:'demo-mac-store.firebaseapp.com',storageBucket:'demo-mac-store.appspot.com',appId:'demo-app'};export const functionsRegion='us-central1';export const useEmulators=true;`}));
 await page.goto('http://localhost:8080');assert.equal(await page.locator('#mode').count(),0);assert.equal(await page.locator('#email').inputValue(),'');await page.locator('#email').fill('admin@macstore.demo');await page.locator('#password').fill('Testing2026!');await page.locator('#login-form button').click();
 try{await page.waitForSelector('h1:has-text("Tu negocio")',{timeout:15000});}catch(e){throw new Error('Login Firebase UI: '+await page.locator('body').innerText()+' '+JSON.stringify(errors));}
 await page.locator('a[href="#/shifts"]').click();
 await page.locator('[data-action="shift-open"]').click();
 await page.locator('#f-openingCashCents').fill('1000');
 await page.locator('#modal-form button[type="submit"]').click();
 await page.waitForSelector('dialog:not([open])',{state:'attached'});
 await page.locator('a[href="#/pos"]').click();
 await page.locator('.product-card[data-id="prod-3"]').click();
 await page.locator('[data-action="pay"]').click();
 await page.locator('#f-paymentReceivedCents').fill('1000');
 await page.locator('#modal-form button[type="submit"]').click();
 await page.waitForSelector('.receipt');assert.match(await page.locator('.receipt').innerText(),/310\.00/);
 await page.locator('[data-action="close"]').first().click();
 await page.reload();await page.waitForSelector('h1:has-text("Punto de venta")');
 for(const [width,height]of [[768,1024],[390,844]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 assert.equal(errors.length,0,errors.join('; '));
 console.log('FIREBASE UI OK: login sin demo, apertura, venta, cambio, persistencia y tablet/móvil.');
 }finally{await browser.close();child.kill();}
}
console.log('FIREBASE OK: bootstrap verificado, Auth, claims, permisos, Storage, concurrencia, idempotencia, alta y cierre.');process.exit(0);
