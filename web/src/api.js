import {firebaseConfig, functionsRegion, useEmulators} from '../config.js';
let clientPromise, uid=null;

function friendly(error) {
  const messages={
    'auth/invalid-credential':'Correo o contraseña incorrectos.',
    'auth/invalid-email':'El correo no es válido.',
    'auth/user-disabled':'La cuenta está desactivada.',
    'auth/too-many-requests':'Se hicieron demasiados intentos. Espera unos minutos.',
    'auth/network-request-failed':'No se pudo conectar con Firebase. Revisa Internet.',
    'auth/operation-not-allowed':'Activa Correo/Contraseña en Firebase Authentication.',
    'auth/unauthorized-domain':'Autoriza este dominio en Firebase Authentication.',
    'auth/weak-password':'Usa una contraseña de al menos 10 caracteres.',
    'functions/not-found':'No se encontró el backend. Despliega Cloud Functions en us-central1.',
    'functions/unavailable':'No se pudo contactar al backend. Revisa conexión y despliegue.',
    'functions/unauthenticated':'La sesión venció o fue revocada. Vuelve a entrar.',
    'storage/unauthorized':'Sin permiso para la imagen. Revisa sesión y Storage Rules.',
    'storage/unknown':'No se pudo cargar la imagen. Revisa Storage, reglas y conexión.'
  };
  const result=new Error(messages[error.code] || error.message || 'No se pudo completar la operación.');
  result.code=error.code;
  return result;
}
async function client() {
  if(!clientPromise) clientPromise=(async()=>{
    if(!firebaseConfig.projectId||!firebaseConfig.apiKey) throw Error('Falta la configuración pública en config.js.');
    const sdk=await import('../vendor/firebase-sdk.js');
    const app=sdk.initializeApp(firebaseConfig),auth=sdk.getAuth(app);
    const functions=sdk.getFunctions(app,functionsRegion),storage=sdk.getStorage(app);
    if(useEmulators){
      sdk.connectAuthEmulator(auth,'http://127.0.0.1:9099');
      sdk.connectFunctionsEmulator(functions,'127.0.0.1',5001);
      sdk.connectStorageEmulator(storage,'127.0.0.1',9199);
    }
    await auth.authStateReady();
    uid=auth.currentUser?.uid||null;
    return {sdk,auth,functions,storage};
  })().catch(error=>{clientPromise=null;throw friendly(error);});
  return clientPromise;
}
async function callable(name,data={}) {
  try {const {sdk,functions}=await client();return (await sdk.httpsCallable(functions,name)(data)).data;}
  catch(error){throw friendly(error);}
}

export const api={
  get uid(){return uid;},
  async restore(){const {auth}=await client();uid=auth.currentUser?.uid||null;return Boolean(uid);},
  async login(email,password){
    try {
      const {sdk,auth}=await client();
      const {user}=await sdk.signInWithEmailAndPassword(auth,email.trim(),password);
      uid=user.uid;
      await sdk.getIdTokenResult(user,true);
      return await this.state();
    }catch(error){throw friendly(error);}
  },
  async state(){
    const {auth}=await client();
    if(!auth.currentUser)throw Error('Inicia sesión.');
    uid=auth.currentUser.uid;
    return callable('getState');
  },
  async action(action,data){
    if(!navigator.onLine)throw Error('Sin conexión: no se guardó la operación.');
    return callable('mutate',{action,data});
  },
  async logout(){const {sdk,auth}=await client();await sdk.signOut(auth);uid=null;},
  async recover(email){
    try {const {sdk,auth}=await client();await sdk.sendPasswordResetEmail(auth,email.trim());}
    catch(error){throw friendly(error);}
  },
  async registerOwner(email,password,name){
    if(password.length<10)throw Error('Usa una contraseña de al menos 10 caracteres.');
    const {sdk,auth}=await client();
    let user;
    try {
      try {({user}=await sdk.createUserWithEmailAndPassword(auth,email.trim(),password));}
      catch(error){
        if(error.code!=='auth/email-already-in-use')throw error;
        ({user}=await sdk.signInWithEmailAndPassword(auth,email.trim(),password));
      }
      uid=user.uid;
      if(!user.emailVerified)await sdk.sendEmailVerification(user);
      return {verified:user.emailVerified,name};
    }catch(error){throw friendly(error);}
  },
  async claimOwner(name){
    const {sdk,auth}=await client();
    if(!auth.currentUser)throw Error('Primero crea o inicia la cuenta del propietario.');
    await sdk.reload(auth.currentUser);
    await sdk.getIdTokenResult(auth.currentUser,true);
    const result=await callable('claimFirstAdmin',{name});
    await sdk.getIdTokenResult(auth.currentUser,true);
    uid=auth.currentUser.uid;
    return result;
  },
  async uploadImage(file,productId){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)
      throw Error('Usa JPG, PNG o WebP de hasta 5 MB.');
    if(!navigator.onLine)throw Error('Sin conexión: no se cargó la imagen.');
    try {
      const {sdk,storage}=await client();
      const path=`products/${productId}/${crypto.randomUUID()}.${file.type.split('/')[1]}`;
      await sdk.uploadBytes(sdk.ref(storage,path),file,{contentType:file.type});
      return path;
    }catch(error){throw friendly(error);}
  },
  async image(path){
    if(!path)return '';
    if(typeof path!=='string'||!/^products\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(path))
      throw Error('Ruta de imagen inválida.');
    const {sdk,storage}=await client();
    return URL.createObjectURL(await sdk.getBlob(sdk.ref(storage,path)));
  }
};
