import {build} from 'esbuild';
await build({stdin:{contents:`export {initializeApp} from 'firebase/app';
export {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,sendEmailVerification,reload,signInWithEmailAndPassword,getIdTokenResult,signOut,sendPasswordResetEmail} from 'firebase/auth';
export {getFunctions,connectFunctionsEmulator,httpsCallable} from 'firebase/functions';
export {getStorage,connectStorageEmulator,ref,uploadBytes,getBlob} from 'firebase/storage';`,resolveDir:process.cwd()},bundle:true,format:'esm',minify:true,target:'es2022',outfile:'web/vendor/firebase-sdk.js',legalComments:'linked'});
console.log('SDK Firebase local generado.');
