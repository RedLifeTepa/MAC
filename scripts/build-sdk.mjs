import {build} from 'esbuild';
await build({stdin:{contents:`export {initializeApp,deleteApp} from 'firebase/app';
export {getAuth,connectAuthEmulator,signInWithEmailAndPassword,createUserWithEmailAndPassword,setPersistence,inMemoryPersistence,deleteUser,signOut,sendPasswordResetEmail} from 'firebase/auth';
export {getFirestore,connectFirestoreEmulator,doc,collection,query,where,getDocFromServer,getDocsFromServer,runTransaction,serverTimestamp,Timestamp,setDoc} from 'firebase/firestore';`,resolveDir:process.cwd()},bundle:true,format:'esm',minify:true,target:'es2022',outfile:'web/vendor/firebase-sdk.js',legalComments:'linked'});
console.log('SDK Auth + Firestore generado.');
