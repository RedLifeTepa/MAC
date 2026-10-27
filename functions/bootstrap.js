// Ejecutar con credenciales de aplicación del proyecto, nunca desde el navegador.
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
initializeApp();const auth=getAuth(),db=getFirestore();const rl=createInterface({input:stdin,output:stdout});
const email=(await rl.question('Correo del primer administrador: ')).trim();const name=(await rl.question('Nombre: ')).trim();rl.close();
if(!name||!email.includes('@'))throw Error('Nombre o correo inválido.');
// La cuenta se crea SIN contraseña: el administrador configura su clave mediante
// recuperación de contraseña en el login después de desplegar.
let user;try{user=await auth.getUserByEmail(email);}catch(e){if(e.code!=='auth/user-not-found')throw e;user=await auth.createUser({email,displayName:name});}
await auth.setCustomUserClaims(user.uid,{role:'admin'});
await db.runTransaction(async tx=>{const settingsRef=db.doc('settings/store'),profileRef=db.doc(`users/${user.uid}`);const settings=await tx.get(settingsRef),profile=await tx.get(profileRef);if(!profile.exists)tx.set(profileRef,{name,email,role:'admin',active:true,openShiftId:null,authSyncStatus:'ready',createdAt:FieldValue.serverTimestamp()});else tx.update(profileRef,{role:'admin',active:true});if(!settings.exists)tx.set(settingsRef,{name:'MAC Store',currency:'MXN',timezone:'America/Mexico_City',receiptMessage:'¡Gracias por tu compra!'});});
for(const [id,name]of [['caja-1','Caja principal'],['caja-2','Caja auxiliar']]){const ref=db.doc(`registers/${id}`);await db.runTransaction(async tx=>{if(!(await tx.get(ref)).exists)tx.set(ref,{name,active:true,openShiftId:null});});}
console.log(`Administrador preparado: ${email}. Abre MAC Store en modo Firebase y usa Recuperar contraseña.`);
