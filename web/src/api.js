import {firebaseConfig,useEmulators} from '../config.js';
import {loadState,performAction,initializeStore} from './firestore-store.js';
let promise,uid=null,initializedFor=null;
function friendly(error){
 const messages={
  'auth/invalid-credential':'Correo o contraseña incorrectos.',
  'auth/operation-not-allowed':'Activa Correo/Contraseña en Firebase Authentication.',
  'auth/invalid-email':'Correo inválido.',
  'auth/user-disabled':'Cuenta desactivada en Authentication.',
  'auth/email-already-in-use':'Ese correo ya existe. Usa su contraseña actual o vincula su UID desde Firebase.',
  'auth/too-many-requests':'Espera unos minutos antes de volver a intentar.',
  'auth/network-request-failed':'No se pudo conectar. Revisa Internet.',
  'permission-denied':'Firestore rechazó la operación. Publica las reglas de esta versión y verifica users/{UID}: role y active.',
  'resource-exhausted':'Se alcanzó una cuota de Firestore. Revisa Uso en la consola.',
  'unavailable':'No se pudo conectar a Firestore. La operación no se confirmó.',
  'failed-precondition':'Revisa que Cloud Firestore esté creado en modo nativo, base (default), y que sus reglas estén publicadas.'
 };
 const out=Error(messages[error.code]||error.message||'No se pudo completar la operación.');out.code=error.code;return out;
}
async function client(){
 if(!promise)promise=(async()=>{
  const sdk=await import('../vendor/firebase-sdk.js');
  const app=sdk.initializeApp(firebaseConfig),auth=sdk.getAuth(app),db=sdk.getFirestore(app);
  if(useEmulators){sdk.connectAuthEmulator(auth,'http://127.0.0.1:9099');sdk.connectFirestoreEmulator(db,'127.0.0.1',8081);}
  await auth.authStateReady();uid=auth.currentUser?.uid||null;
  return {sdk,auth,db};
 })().catch(error=>{promise=null;throw friendly(error);});
 return promise;
}
async function profileReady(){const {sdk,db}=await client();await initializeStore(sdk,db,uid);initializedFor=uid;return loadState(sdk,db,uid);}
export const api={
 get uid(){return uid;},
 async restore(){const {auth}=await client();uid=auth.currentUser?.uid||null;return Boolean(uid);},
 async login(email,password){try{const {sdk,auth}=await client();const result=await sdk.signInWithEmailAndPassword(auth,email.trim(),password);uid=result.user.uid;return await profileReady();}catch(e){throw friendly(e);}},
 async state(){try{const {sdk,auth,db}=await client();if(!auth.currentUser)throw Error('Inicia sesión.');uid=auth.currentUser.uid;if(initializedFor!==uid){await initializeStore(sdk,db,uid);initializedFor=uid;}return await loadState(sdk,db,uid);}catch(e){throw friendly(e);}},
 async action(action,data){
  if(!navigator.onLine)throw Error('Sin conexión. La operación no se confirmó.');
  const {sdk,db}=await client();
  let secondary=null,created=false;
  try{
   if(action==='user.save'){
    const me=await sdk.getDocFromServer(sdk.doc(db,'users',uid));if(me.data()?.role!=='admin'||!me.data()?.active)throw Error('Solo un administrador crea perfiles.');
    if(data.id){
     const target=await sdk.getDocFromServer(sdk.doc(db,'users',data.id));
     if(target.data()?.email!==data.email.trim().toLowerCase())throw Error('Para cambiar el correo de otra cuenta utiliza Firebase Authentication Console.');
     if(data.id===uid&&(data.role!=='admin'||data.active===false))throw Error('Otro administrador debe modificar tu rol o acceso.');
     if(data.password)throw Error('Las cuentas existentes cambian su contraseña mediante Recuperar contraseña.');
    }else{
     if(!data.password||data.password.length<10)throw Error('Contraseña inicial de al menos 10 caracteres.');
     const app=sdk.initializeApp(firebaseConfig,`staff-${crypto.randomUUID()}`);secondary={app,auth:sdk.getAuth(app)};
     await sdk.setPersistence(secondary.auth,sdk.inMemoryPersistence);
     if(useEmulators)sdk.connectAuthEmulator(secondary.auth,'http://127.0.0.1:9099',{disableWarnings:true});
     let user;
     try{({user}=await sdk.createUserWithEmailAndPassword(secondary.auth,data.email.trim(),data.password));created=true;}
     catch(e){if(e.code!=='auth/email-already-in-use')throw e;({user}=await sdk.signInWithEmailAndPassword(secondary.auth,data.email.trim(),data.password));}
     const existing=await sdk.getDocFromServer(sdk.doc(db,'users',user.uid));
     if(existing.exists())throw Error('La cuenta ya tiene un perfil. Edítalo desde Usuarios.');
     const payload={...data};delete payload.password;
     const result=await performAction(sdk,db,uid,action,payload,user.uid);created=false;return result;
    }
   }
   const payload={...data};delete payload.password;
   return await performAction(sdk,db,uid,action,payload);
  }catch(e){if(created&&secondary?.auth.currentUser)await sdk.deleteUser(secondary.auth.currentUser).catch(()=>{});throw friendly(e);}
  finally{if(secondary){await sdk.signOut(secondary.auth).catch(()=>{});await sdk.deleteApp(secondary.app);}}
 },
 async logout(){const {sdk,auth}=await client();await sdk.signOut(auth);uid=null;},
 async recover(email){try{const {sdk,auth}=await client();await sdk.sendPasswordResetEmail(auth,email.trim());}catch(e){throw friendly(e);}},
 async uploadImage(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Usa JPG, PNG o WebP de hasta 5 MB.');
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,480/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  let dataUrl=canvas.toDataURL('image/webp',0.75);
  for(const quality of [0.55,0.35,0.2]){if(dataUrl.length<=150000)break;dataUrl=canvas.toDataURL('image/webp',quality);}
  if(dataUrl.length>150000)throw Error('La imagen sigue siendo grande. Usa una imagen más sencilla.');
  const {sdk,db}=await client();const id=crypto.randomUUID();
  await sdk.setDoc(sdk.doc(db,'images',id),{dataUrl,createdBy:uid,createdAt:sdk.serverTimestamp()});return `firestore:${id}`;
 },
 async image(path){
  if(typeof path!=='string'||!/^firestore:[A-Za-z0-9_-]+$/.test(path))throw Error('Esta imagen pertenece a una versión anterior. Vuelve a cargarla en Firestore.');
  const {sdk,db}=await client();const doc=await sdk.getDocFromServer(sdk.doc(db,'images',path.slice(10)));if(!doc.exists())throw Error('Imagen no encontrada.');return doc.data().dataUrl;
 }
};
