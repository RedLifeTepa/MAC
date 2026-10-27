import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,Timestamp,FieldValue} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {defineString} from 'firebase-functions/params';
const ownerEmail=defineString('BOOTSTRAP_ADMIN_EMAIL',{description:'Correo real del propietario que verificará su email para activar MAC Store.'});
import {randomUUID} from 'node:crypto';
import {apply,emptyState,COLLECTIONS,check} from './domain.js';
if(!getApps().length)initializeApp();const db=getFirestore(),auth=getAuth();
const options={region:'us-central1',maxInstances:5,timeoutSeconds:120,memory:'512MiB'};
const encode=(v,k='')=>{if(v===null||v===undefined)return v??null;if(typeof v==='string'&&k.endsWith('At')&&/^\d{4}-\d{2}-\d{2}T/.test(v))return Timestamp.fromDate(new Date(v));if(Array.isArray(v))return v.map(x=>encode(x));if(typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([key])=>key!=='id').map(([key,x])=>[key,encode(x,key)]));return v;};
const decode=v=>{if(v instanceof Timestamp)return v.toDate().toISOString();if(Array.isArray(v))return v.map(decode);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]));return v;};
function authorize(req,u){check(req.auth,'Inicia sesión.');check(u?.active,'Usuario inactivo o sin perfil.');check(['admin','cashier'].includes(u.role)&&u.role===req.auth.token.role,'El rol cambió. Vuelve a iniciar sesión.');}
function fail(error){if(error instanceof HttpsError)throw error;console.error('MAC Store:',error.code||'',error.message);throw new HttpsError('failed-precondition',error.message||'No se pudo completar la operación.');}
async function load(tx){const snapshots=await Promise.all(COLLECTIONS.map(c=>tx.get(db.collection(c))));const settings=await tx.get(db.doc('settings/store'));const s=emptyState();COLLECTIONS.forEach((c,i)=>s[c]=snapshots[i].docs.map(d=>({id:d.id,...decode(d.data())})));if(settings.exists)s.settings=decode(settings.data());return s;}
function writeDiff(tx,before,after){for(const c of COLLECTIONS){const old=new Map(before[c].map(d=>[d.id,d])),next=new Map(after[c].map(d=>[d.id,d]));for(const [id,doc]of next){check(typeof id==='string'&&!id.includes('/')&&id.length<1500,'ID de documento inválido.');if(JSON.stringify(old.get(id))!==JSON.stringify(doc))tx.set(db.collection(c).doc(id),encode(doc));}for(const id of old.keys())if(!next.has(id))tx.delete(db.collection(c).doc(id));}if(JSON.stringify(before.settings)!==JSON.stringify(after.settings))tx.set(db.doc('settings/store'),after.settings);}
async function transact(req,action,data,operationId){return db.runTransaction(async tx=>{const revision=await tx.get(db.doc('control/revision'));const before=await load(tx);authorize(req,before.users.find(u=>u.id===req.auth.uid));const out=apply(before,req.auth.uid,action,data,new Date().toISOString(),operationId);writeDiff(tx,before,out.state);tx.set(db.doc('control/revision'),{version:(revision.data()?.version||0)+1,updatedAt:FieldValue.serverTimestamp()});return out.result;});}
export const getState=onCall(options,async req=>{try{check(req.auth,'Inicia sesión.');const profile=await db.doc(`users/${req.auth.uid}`).get(),u=profile.data();authorize(req,u);const s=emptyState();const admin=u.role==='admin';const collections=admin?COLLECTIONS:['products','categories','registers','sales','shifts','cashMovements'];const snaps=await Promise.all(collections.map(c=>{let q=db.collection(c);if(!admin&&['sales','shifts','cashMovements'].includes(c))q=q.where('cashierId','==',req.auth.uid);return q.get();}));collections.forEach((c,i)=>s[c]=snaps[i].docs.map(d=>({id:d.id,...decode(d.data())})));if(!admin)s.users=[{id:profile.id,...decode(u)}];const settings=await db.doc('settings/store').get();if(settings.exists)s.settings=decode(settings.data());return s;}catch(e){fail(e);}});
export const mutate=onCall(options,async req=>{let createdUid=null;try{check(req.auth,'Inicia sesión.');const {action,data}=req.data||{};check(typeof action==='string'&&data&&typeof data==='object','Solicitud inválida.');check(Buffer.byteLength(JSON.stringify(req.data),'utf8')<120000,'Solicitud demasiado grande.');const operationId=randomUUID();
 if(action!=='user.save')return await transact(req,action,data,operationId);
 const profile=await db.doc(`users/${req.auth.uid}`).get();authorize(req,profile.data());check(profile.data().role==='admin','Solo administradores crean usuarios.');check(['admin','cashier'].includes(data.role),'Rol inválido.');
 if(data.password)check(typeof data.password==='string'&&data.password.length>=10&&data.password.length<=128,'Contraseña de 10 a 128 caracteres.');
 let uid=data.id;
 // Prevalidar la política de dominio antes de cambiar Authentication.
 await db.runTransaction(async tx=>{const s=await load(tx);authorize(req,s.users.find(u=>u.id===req.auth.uid));apply(s,req.auth.uid,action,data,new Date().toISOString(),operationId);});
 if(!uid){check(data.password,'Captura una contraseña inicial.');const account=await auth.createUser({email:data.email.trim(),password:data.password,displayName:data.name,disabled:true});uid=account.uid;createdUid=uid;}
 const payload={...data};delete payload.password;
 // Para alta, el ID de operación es el UID que generó Authentication.
 const result=await transact(req,action,payload,createdUid||operationId);
 createdUid=null;
 // Idempotente: si Auth falla después del commit, el administrador puede
 // volver a guardar el perfil. Claim/perfil distintos siempre deniegan acceso.
 try{const account=await auth.getUser(uid);await auth.setCustomUserClaims(uid,{...account.customClaims,role:data.role});await auth.updateUser(uid,{email:data.email.trim(),displayName:data.name,disabled:data.active===false,...(data.password?{password:data.password}:{})});if(data.active===false)await auth.revokeRefreshTokens(uid);await db.doc(`users/${uid}`).update({authSyncStatus:'ready'});}catch(error){await db.doc(`users/${uid}`).update({authSyncStatus:'pending'});throw new Error('Perfil guardado; sincronización Auth pendiente. Vuelve a editar y guardar este usuario.');}
 return result;
 }catch(e){if(createdUid)await auth.deleteUser(createdUid).catch(()=>{});fail(e);}});

// Inicialización limitada a un correo propietario verificado. Nunca se concede
// administración al primer usuario que simplemente se registre.
export const claimFirstAdmin=onCall(options,async req=>{
 try {
  if(!req.auth)throw new HttpsError('unauthenticated','Crea o inicia la cuenta del propietario.');
  const allowed=ownerEmail.value().trim().toLowerCase();
  if(!allowed||req.auth.token.email?.toLowerCase()!==allowed)
    throw new HttpsError('permission-denied','Este correo no es el propietario configurado al desplegar.');
  if(req.auth.token.email_verified!==true)
    throw new HttpsError('failed-precondition','Verifica el correo antes de activar al administrador.');
  const name=String(req.data?.name||'').trim();
  check(name.length>0&&name.length<=120,'Nombre requerido (máximo 120 caracteres).');
  const uid=req.auth.uid,profileRef=db.doc(`users/${uid}`),firstRef=db.doc('control/first-admin');
  await db.runTransaction(async tx=>{
    const [first,profile,admins,settings,r1,r2]=await Promise.all([
      tx.get(firstRef),tx.get(profileRef),
      tx.get(db.collection('users').where('role','==','admin')),
      tx.get(db.doc('settings/store')),tx.get(db.doc('registers/caja-1')),tx.get(db.doc('registers/caja-2'))
    ]);
    if(first.exists&&first.data().uid!==uid)
      throw new HttpsError('permission-denied','La tienda ya tiene un administrador inicial.');
    if(admins.docs.some(d=>d.id!==uid))
      throw new HttpsError('permission-denied','La tienda ya está administrada. Solicita acceso al administrador.');
    if(profile.exists&&(profile.data().role!=='admin'||!profile.data().active))
      throw new HttpsError('permission-denied','Esta cuenta ya tiene un perfil. Solicita acceso al administrador.');
    if(!first.exists)tx.create(firstRef,{uid,email:allowed,createdAt:FieldValue.serverTimestamp()});
    if(!profile.exists)tx.create(profileRef,{name,email:allowed,role:'admin',active:true,openShiftId:null,authSyncStatus:'pending',createdAt:FieldValue.serverTimestamp()});
    if(!settings.exists)tx.create(db.doc('settings/store'),emptyState().settings);
    if(!r1.exists)tx.create(r1.ref,{name:'Caja principal',active:true,openShiftId:null});
    if(!r2.exists)tx.create(r2.ref,{name:'Caja auxiliar',active:true,openShiftId:null});
    tx.set(db.doc(`logs/bootstrap_${uid}`),{action:'store.initialized',actorId:uid,entityId:uid,details:{},createdAt:FieldValue.serverTimestamp()});
  });
  const account=await auth.getUser(uid);
  await auth.setCustomUserClaims(uid,{...account.customClaims,role:'admin'});
  await profileRef.update({authSyncStatus:'ready'});
  return {uid,role:'admin'};
 }catch(error){fail(error);}
});
