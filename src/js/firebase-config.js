// MAC Store — Configuración Oficial de Firebase (NPM / Modular SDK)
// Pega aquí las credenciales de tu proyecto Firebase Console o cámbialas desde el panel "Firebase NPM & Config" de la app.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyAT-cOi_NM1nnwS9EC-SiKHFYxeTOLJPbs",
  authDomain: "mac-store-eba30.firebaseapp.com",
  projectId: "mac-store-eba30",
  storageBucket: "mac-store-eba30.firebasestorage.app",
  messagingSenderId: "846070152675",
  appId: "1:846070152675:web:a03ca51436c3237a8834d6"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const storage = getStorage(app);
