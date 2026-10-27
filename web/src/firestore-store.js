import {apply,emptyState,COLLECTIONS,businessDate} from './domain.js';
export const MAX_ITEMS=8;
const decode=v=>{
 if(v&&typeof v.toDate==='function')return v.toDate().toISOString();
 if(Array.isArray(v))return v.map(decode);
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]));
 return v;
};
const fromDoc=d=>d.exists()?{id:d.id,...decode(d.data())}:null;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function normalize(s){for(const u of s.users)u.openShiftId??=null;for(const sale of s.sales)if(sale.createdAt)sale.businessDate=businessDate(sale.createdAt,s.settings.timezone);return s;}
export async function loadState(sdk,db,uid){
 const profile=await sdk.getDocFromServer(sdk.doc(db,'users',uid));
 if(!profile.exists())throw Error(`Cuenta autenticada, pero falta tu perfil en Firestore: users/${uid}. Crea ese documento como indica LEEME_PRIMERO.txt.`);
 const u=fromDoc(profile);if(!u.active||!['admin','cashier'].includes(u.role))throw Error('Tu perfil está inactivo o no tiene un rol válido.');
 const s=emptyState(),admin=u.role==='admin';
 const collections=admin?COLLECTIONS.filter(c=>c!=='users'):['products','categories','registers','sales','shifts','cashMovements'];
 const snapshots=await Promise.all(collections.map(c=>{
  let query=sdk.collection(db,c);
  if(!admin&&['sales','shifts','cashMovements'].includes(c))query=sdk.query(query,sdk.where('cashierId','==',uid));
  return sdk.getDocsFromServer(query);
 }));
 collections.forEach((c,i)=>s[c]=snapshots[i].docs.map(fromDoc));
 s.users=admin?(await sdk.getDocsFromServer(sdk.collection(db,'users'))).docs.map(fromDoc):[u];
 const settings=await sdk.getDocFromServer(sdk.doc(db,'settings','store'));
 if(settings.exists())s.settings=decode(settings.data());
 return normalize(s);
}
export async function initializeStore(sdk,db,uid){
 const profile=await sdk.getDocFromServer(sdk.doc(db,'users',uid));
 if(!profile.exists()||profile.data().role!=='admin'||!profile.data().active)return;
 await sdk.runTransaction(db,async tx=>{
  const refs=[sdk.doc(db,'settings','store'),sdk.doc(db,'registers','caja-1'),sdk.doc(db,'registers','caja-2'),sdk.doc(db,'control','revision')];
  const docs=await Promise.all(refs.map(r=>tx.get(r)));
  if(!docs[0].exists())tx.set(refs[0],emptyState().settings);
  if(!docs[1].exists())tx.set(refs[1],{name:'Caja principal',active:true,openShiftId:null});
  if(!docs[2].exists())tx.set(refs[2],{name:'Caja auxiliar',active:true,openShiftId:null});
  if(!docs[3].exists())tx.set(refs[3],{version:0,updatedAt:sdk.serverTimestamp()});
 });
}
async function cashierPaths(sdk,db,uid,action,data){
 const paths=new Set([`users/${uid}`,'settings/store']);
 const user=(await sdk.getDocFromServer(sdk.doc(db,'users',uid))).data();
 if(!user?.active)throw Error('Usuario inactivo o sin perfil.');
 if(!['sale.create','shift.open','shift.close','cash.move'].includes(action))throw Error('Esta acción requiere administrador.');
 let shiftId=data.shiftId||user.openShiftId;
 if(shiftId){
  paths.add(`shifts/${shiftId}`);
  const shift=(await sdk.getDocFromServer(sdk.doc(db,'shifts',shiftId))).data();
  if(shift?.registerId)paths.add(`registers/${shift.registerId}`);
 }
 if(action==='shift.open')paths.add(`registers/${data.registerId}`);
 if(action==='sale.create'){
  paths.add(`sales/${uid}_${data.requestId}`);
  for(const i of data.items||[])paths.add(`products/${i.productId}`);
 }
 return [...paths];
}
function serialized(sdk,value,now,key='',original){
 if(value===undefined||value===null)return null;
 if(typeof value==='string'&&key.endsWith('At')&&/^\d{4}-\d{2}-\d{2}T/.test(value)){
  if(original&&typeof original.toDate==='function'&&original.toDate().toISOString()===value&&(value!==now||['createdAt','openedAt'].includes(key)))return original;
  return value===now?sdk.serverTimestamp():sdk.Timestamp.fromDate(new Date(value));
 }
 if(Array.isArray(value))return value.map(x=>serialized(sdk,x,now));
 if(typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>k!=='id').map(([k,x])=>[k,serialized(sdk,x,now,k,original?.[k])]));
 return value;
}
export async function performAction(sdk,db,uid,action,data,operationId=crypto.randomUUID()){
 for(let attempt=0;attempt<5;attempt++){
  const revisionRef=sdk.doc(db,'control','revision');
  const observedRevision=await sdk.getDocFromServer(revisionRef);
  const version=observedRevision.data()?.version||0;
  const profile=await sdk.getDocFromServer(sdk.doc(db,'users',uid));
  const isAdmin=profile.data()?.role==='admin'&&profile.data()?.active;
  let paths;
  if(isAdmin){
   const state=await loadState(sdk,db,uid);
   paths=[...COLLECTIONS.flatMap(c=>state[c].map(d=>`${c}/${d.id}`)),'settings/store'];
  }else paths=await cashierPaths(sdk,db,uid,action,data);
  // Reservas de código permanentes: un código histórico no cambia de producto.
  if(action==='product.save'){
   for(const [collection,key]of [['barcodes','barcode'],['skus','sku']])if(data[key])paths.push(`${collection}/${data[key]}`);
  }
  paths=[...new Set(paths)];
  try{return await sdk.runTransaction(db,async tx=>{
   const revision=await tx.get(revisionRef);
   if((revision.data()?.version||0)!==version){const error=Error('El conjunto cambió.');error.code='context-retry';throw error;}
   const snapshots=await Promise.all(paths.map(path=>tx.get(sdk.doc(db,path))));
   const before=emptyState(),reservations=[],raw=new Map();
   snapshots.forEach((snapshot,i)=>{
    const [c]=paths[i].split('/');if(snapshot.exists())raw.set(paths[i],snapshot.data());
    if(c==='settings'){if(snapshot.exists())before.settings=decode(snapshot.data());}
    else if(['barcodes','skus'].includes(c))reservations.push(snapshot);
    else if(snapshot.exists())before[c].push(fromDoc(snapshot));
   });
   for(const u of before.users)u.openShiftId??=null;
   const now=new Date().toISOString();
   const {state:after,result}=apply(before,uid,action,data,now,operationId);
   if(action==='sale.create'&&!before.sales.some(s=>s.id===result.id)){
    const sale=after.sales.find(s=>s.id===result.id);sale.operationId=operationId;sale.requestId=data.requestId;
    let runningSaleCents=0,runningCostCents=0;sale.items.forEach((item,index)=>{runningSaleCents+=item.subtotalCents;runningCostCents+=item.qty*item.unitCostCents;item.runningSaleCents=runningSaleCents;item.runningCostCents=runningCostCents;const p=after.products.find(p=>p.id===item.productId);p.lastSaleId=sale.id;p.lastSaleIndex=index;p.lastMovementId=`${operationId}_${index}`;});
    after.shifts.find(s=>s.id===sale.shiftId).lastSaleId=sale.id;
   }
   if(action==='cash.move')after.shifts.find(s=>s.id===data.shiftId).lastCashMovementId=operationId;
   const writes=[];
   for(const c of COLLECTIONS){
    const old=new Map(before[c].map(d=>[d.id,d]));
    for(const doc of after[c])if(!equal(old.get(doc.id),doc))writes.push([sdk.doc(db,c,doc.id),serialized(sdk,doc,now,'',raw.get(`${c}/${doc.id}`))]);
    if(before[c].some(d=>!after[c].some(x=>x.id===d.id)))throw Error('La eliminación física no está habilitada. Usa baja lógica.');
   }
   if(!equal(before.settings,after.settings))writes.push([sdk.doc(db,'settings','store'),after.settings]);
   if(action==='product.save'){
    for(const snapshot of reservations)if(snapshot.exists()&&snapshot.data().productId!==result.id)throw Error('El código o SKU pertenece a otro producto (incluye códigos históricos).');
    for(const [collection,key]of [['barcodes','barcode'],['skus','sku']])if(data[key])writes.push([sdk.doc(db,collection,data[key]),{productId:result.id}]);
   }
   if(!writes.length)return result;
   writes.forEach(([ref,value])=>tx.set(ref,value));
   tx.set(revisionRef,{version:version+1,updatedAt:sdk.serverTimestamp()});
   return result;
  });}catch(error){if(error.code==='context-retry'&&attempt<4)continue;throw error;}
 }
 throw Error('Hay varias operaciones simultáneas. Actualiza y vuelve a intentar.');
}
