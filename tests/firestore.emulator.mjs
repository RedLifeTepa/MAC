import assert from 'node:assert/strict';
import {initializeApp as adminApp} from 'firebase-admin/app';
import {getAuth as adminAuth} from 'firebase-admin/auth';
import {getFirestore as adminDb,Timestamp as AdminTimestamp} from 'firebase-admin/firestore';
import * as appSDK from 'firebase/app';
import * as authSDK from 'firebase/auth';
import * as firestoreSDK from 'firebase/firestore';
import {loadState,performAction,initializeStore} from '../web/src/firestore-store.js';
import {testState} from './fixtures.js';
import {COLLECTIONS} from '../web/src/domain.js';
assert.ok(process.env.FIRESTORE_EMULATOR_HOST&&process.env.FIREBASE_AUTH_EMULATOR_HOST,'Solo se permite ejecutar en emuladores.');
const project='demo-mac-store',sdk={...appSDK,...authSDK,...firestoreSDK};
adminApp({projectId:project});const adb=adminDb(),aa=adminAuth();
const settings={apiKey:'demo-key',projectId:project,authDomain:project+'.firebaseapp.com',appId:'demo-app'};
async function connection(uid,email){
 await aa.createUser({uid,email,password:'Testing2026!'});
 const app=sdk.initializeApp(settings,uid),auth=sdk.getAuth(app),db=sdk.getFirestore(app);
 sdk.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});sdk.connectFirestoreEmulator(db,'127.0.0.1',8081);
 await sdk.signInWithEmailAndPassword(auth,email,'Testing2026!');return {app,auth,db,uid};
}
const admin=await connection('admin-demo','admin@macstore.demo'),cashier=await connection('cashier-demo','caja@macstore.demo');
await assert.rejects(()=>loadState(sdk,admin.db,admin.uid),/falta tu perfil/);
await assert.rejects(()=>sdk.setDoc(sdk.doc(cashier.db,'users',cashier.uid),{name:'Escalamiento',email:'caja@macstore.demo',role:'admin',active:true,openShiftId:null}));
// Perfil inicial habilitado desde consola (SDK Admin aquí es exclusivo de pruebas).
await adb.doc('users/admin-demo').set({name:'Administrador real',email:'admin@macstore.demo',role:'admin',active:true,openShiftId:null});
await initializeStore(sdk,admin.db,admin.uid);
let initial=await loadState(sdk,admin.db,admin.uid);assert.equal(initial.products.length,0);assert.equal(initial.registers.length,2);
const seed=testState();
function timestamp(v,k=''){if(v===null)return v;if(typeof v==='string'&&k.endsWith('At'))return AdminTimestamp.fromDate(new Date(v));if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([key])=>key!=='id').map(([key,x])=>[key,timestamp(x,key)]));return v;}
for(const c of COLLECTIONS){if(c==='registers')continue;for(const item of seed[c])await adb.doc(`${c}/${item.id}`).set(timestamp(item));}
for(const p of seed.products){if(p.barcode)await adb.doc(`barcodes/${p.barcode}`).set({productId:p.id});if(p.sku)await adb.doc(`skus/${p.sku}`).set({productId:p.id});}
await assert.rejects(()=>performAction(sdk,cashier.db,cashier.uid,'inventory.adjust',{productId:'prod-1',qtyDelta:10,reason:'Intrusión'}));
await assert.rejects(()=>sdk.updateDoc(sdk.doc(cashier.db,'products','prod-1'),{stock:999,updatedAt:sdk.serverTimestamp()}));
await assert.rejects(()=>sdk.updateDoc(sdk.doc(cashier.db,'users',cashier.uid),{role:'admin'}));
await assert.rejects(()=>sdk.getDocs(sdk.collection(cashier.db,'sales')));
const opened=await performAction(sdk,cashier.db,cashier.uid,'shift.open',{registerId:'caja-1',openingCashCents:100000});
const shiftId=opened.id;assert.ok(shiftId);
let state=await loadState(sdk,cashier.db,cashier.uid);assert.equal(state.users.length,1);assert.equal(state.shifts[0].status,'open');
function order(requestId,items=[{productId:'prod-1',qty:2}],total=30000){return {requestId,shiftId,items,expectedTotalCents:total,paymentMethod:'cash',paymentReceivedCents:total+20000};}
const first=await performAction(sdk,cashier.db,cashier.uid,'sale.create',order('first-sale'));
state=await loadState(sdk,cashier.db,cashier.uid);assert.equal(state.sales.length,1);assert.equal(state.products.find(p=>p.id==='prod-1').stock,18);assert.equal(state.sales[0].changeCents,20000);
await performAction(sdk,cashier.db,cashier.uid,'sale.create',order('first-sale'));
assert.equal((await loadState(sdk,cashier.db,cashier.uid)).sales.length,1);
await assert.rejects(()=>performAction(sdk,cashier.db,cashier.uid,'sale.create',{...order('first-sale'),paymentReceivedCents:99999}),/otros datos/);
// Transacción completa manipulada después del cálculo del cliente.
const baseShift=state.shifts.find(x=>x.id===shiftId);
const malicious={...sdk,runTransaction:(db,callback)=>sdk.runTransaction(db,tx=>callback({
 get:ref=>tx.get(ref),
 set:(ref,value)=>{
  if(ref.path.startsWith('sales/'))value={...value,totalSaleCents:2,totalCostCents:2,changeCents:value.paymentReceivedCents-2,items:value.items.map(x=>({...x,unitPriceCents:1,unitCostCents:1,subtotalCents:2,runningSaleCents:2,runningCostCents:2}))};
  if(ref.path===`shifts/${shiftId}`)value={...value,totalSalesCents:baseShift.totalSalesCents+2,totalCostCents:baseShift.totalCostCents+2,payments:{...baseShift.payments,cash:baseShift.payments.cash+2}};
  tx.set(ref,value);
 }
}))};
await assert.rejects(()=>performAction(malicious,cashier.db,cashier.uid,'sale.create',order('tampered-price')));
assert.equal((await loadState(sdk,cashier.db,cashier.uid)).sales.length,1);
// Ocho productos en una venta: comprueba los límites reales de evaluación de Rules.
const maxItems=seed.products.map(p=>({productId:p.id,qty:1}));const maxTotal=seed.products.reduce((n,p)=>n+p.priceCents,0);
await performAction(sdk,cashier.db,cashier.uid,'sale.create',order('eight-products',maxItems,maxTotal));
state=await loadState(sdk,cashier.db,cashier.uid);assert.equal(state.sales.length,2);
await performAction(sdk,cashier.db,cashier.uid,'cash.move',{shiftId,type:'in',amountCents:10000,reason:'Cambio de prueba'});
await performAction(sdk,cashier.db,cashier.uid,'cash.move',{shiftId,type:'out',amountCents:20000,reason:'Resguardo de prueba'});
// Intentos directos: falsificar precio, omitir movimientos y alterar totales.
const sale=(await sdk.getDocFromServer(sdk.doc(cashier.db,'sales',first.id))).data();
const fake={...sale,requestId:'fake',operationId:'fake-op',items:sale.items.map(x=>({...x,unitPriceCents:1,subtotalCents:x.qty})),totalSaleCents:2,createdAt:sdk.serverTimestamp()};
await assert.rejects(()=>sdk.setDoc(sdk.doc(cashier.db,'sales',cashier.uid+'_fake'),fake));
await assert.rejects(()=>sdk.updateDoc(sdk.doc(cashier.db,'shifts',shiftId),{totalSalesCents:0}));
await assert.rejects(()=>sdk.updateDoc(sdk.doc(cashier.db,'shifts',shiftId),{status:'closed',closedAt:sdk.serverTimestamp(),closingCashCents:0,differenceCents:0,expectedCashCents:0}));
// Concurrencia de última unidad en dos transacciones desde el mismo perfil.
await performAction(sdk,admin.db,admin.uid,'inventory.adjust',{productId:'prod-1',qtyDelta:1-(await loadState(sdk,admin.db,admin.uid)).products.find(p=>p.id==='prod-1').stock,reason:'Última unidad para prueba'});
const concurrency=await Promise.allSettled([performAction(sdk,cashier.db,cashier.uid,'sale.create',order('last-a',[{productId:'prod-1',qty:1}],15000)),performAction(sdk,cashier.db,cashier.uid,'sale.create',order('last-b',[{productId:'prod-1',qty:1}],15000))]);
assert.equal(concurrency.filter(x=>x.status==='fulfilled').length,1,JSON.stringify(concurrency));
state=await loadState(sdk,cashier.db,cashier.uid);assert.equal(state.products.find(p=>p.id==='prod-1').stock,0);
const expected=state.shifts[0].openingCashCents+state.shifts[0].payments.cash+state.shifts[0].cashInCents-state.shifts[0].cashOutCents;
await performAction(sdk,cashier.db,cashier.uid,'shift.close',{shiftId,closingCashCents:expected,notes:'Cuadrado'});
state=await loadState(sdk,cashier.db,cashier.uid);assert.equal(state.shifts[0].differenceCents,0);assert.equal(state.users[0].openShiftId,null);
await assert.rejects(()=>performAction(sdk,cashier.db,cashier.uid,'sale.create',order('after-close')),/turno/);
// Anulación administrativa conserva el historial y repone stock.
const adminTurn=await performAction(sdk,admin.db,admin.uid,'shift.open',{registerId:'caja-2',openingCashCents:100000});
let adminState=await loadState(sdk,admin.db,admin.uid);const priorStock=adminState.products.find(p=>p.id==='prod-4').stock;
const adminSale=await performAction(sdk,admin.db,admin.uid,'sale.create',{requestId:'admin-void',shiftId:adminTurn.id,items:[{productId:'prod-4',qty:1}],expectedTotalCents:89000,paymentMethod:'cash',paymentReceivedCents:100000});
await performAction(sdk,admin.db,admin.uid,'sale.void',{id:adminSale.id,reason:'Prueba de devolución'});
adminState=await loadState(sdk,admin.db,admin.uid);assert.equal(adminState.products.find(p=>p.id==='prod-4').stock,priorStock);assert.equal(adminState.sales.find(x=>x.id===adminSale.id).status,'voided');
await performAction(sdk,admin.db,admin.uid,'shift.close',{shiftId:adminTurn.id,closingCashCents:100000,notes:'Prueba'});
// Imagen comprimida en Firestore, sin Storage.
await sdk.setDoc(sdk.doc(admin.db,'images','test-image'),{dataUrl:'data:image/webp;base64,UklGRg==',createdBy:admin.uid,createdAt:sdk.serverTimestamp()});
assert.ok((await sdk.getDocFromServer(sdk.doc(cashier.db,'images','test-image'))).exists());
await assert.rejects(()=>sdk.setDoc(sdk.doc(cashier.db,'images','forbidden'),{dataUrl:'data:image/webp;base64,UklGRg==',createdBy:cashier.uid,createdAt:sdk.serverTimestamp()}));
if(process.env.MAC_TEST_UI==='1'){
 const {chromium}=await import('playwright');const {spawn}=await import('node:child_process');
 const child=spawn(process.execPath,['scripts/serve.js'],{cwd:process.cwd()});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:`export const firebaseConfig=${JSON.stringify(settings)};export const useEmulators=true;`}));
  await page.goto('http://localhost:8080');await page.locator('#email').fill('admin@macstore.demo');await page.locator('#password').fill('Testing2026!');await page.locator('#login-form button').click();
  await page.waitForSelector('h1:has-text("Tu negocio")',{timeout:15000});
  await page.locator('a[href="#/users"]').click();await page.locator('[data-action="user-new"]').click();
  await page.locator('#f-name').fill('Cajero Firestore');await page.locator('#f-email').fill('nuevo@example.com');await page.locator('#f-password').fill('Nuevo2026!');await page.locator('#modal-form button[type="submit"]').click();
  await page.waitForSelector('dialog:not([open])',{state:'attached'});assert.equal((await sdk.getDocFromServer(sdk.doc(admin.db,'users',admin.uid))).data().role,'admin');
  await page.locator('a[href="#/products"]').click();await page.locator('[data-action="product-new"]').click();
  await page.locator('#f-name').fill('Producto Firestore');await page.locator('#f-barcode').fill('00123456');await page.locator('#f-costCents').fill('80');await page.locator('#f-realCostCents').fill('100');await page.locator('#f-profitPercent').fill('50');await page.locator('#f-initialStock').fill('10');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=16;c.getContext('2d').fillRect(0,0,16,16);return c.toDataURL('image/png').split(',')[1];});
  await page.locator('#product-image').setInputFiles({name:'imagen.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.locator('#modal-form button[type="submit"]').click();await page.waitForSelector('dialog:not([open])',{state:'attached'});
  assert.match(await page.locator('body').innerText(),/Producto Firestore/);
  const saved=await adb.collection('products').where('name','==','Producto Firestore').get();assert.match(saved.docs[0].data().imagePath,/^firestore:/);
  await page.locator('[data-action="logout"]').click();await page.locator('#email').fill('nuevo@example.com');await page.locator('#password').fill('Nuevo2026!');await page.locator('#login-form button').click();
  await page.waitForSelector('h1:has-text("Punto de venta")');assert.equal(await page.locator('a[href="#/users"]').count(),0);
  await page.locator('a[href="#/shifts"]').first().click();await page.locator('[data-action="shift-open"]').click();await page.locator('#f-openingCashCents').fill('1000');await page.locator('#modal-form button[type="submit"]').click();await page.waitForSelector('dialog:not([open])',{state:'attached'});
  await page.locator('a[href="#/pos"]').click();await page.locator('.product-card[data-id="prod-3"]').click();await page.locator('[data-action="pay"]').click();await page.locator('#f-paymentReceivedCents').fill('1000');await page.locator('#modal-form button[type="submit"]').click();
  await page.waitForSelector('.receipt');assert.match(await page.locator('.receipt').innerText(),/310\.00/);await page.locator('[data-action="close"]').first().click();
  await page.reload();await page.waitForSelector('h1:has-text("Punto de venta")');
  for(const [width,height]of [[768,1024],[390,844]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  assert.equal(errors.length,0,errors.join('; '));
  console.log('UI OK: admin crea cajero sin perder sesión, producto guardado, cajero cobra, cambio, persistencia y móvil.');
 }finally{await browser.close();child.kill();}
}
console.log('FIRESTORE OK: roles sin claims, transacciones, máximo 8 líneas, ataques rechazados, concurrencia, corte e imágenes.');
process.exit(0);
