import { initializeApp, getApps, getApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import { getAuth } from "firebase/auth"

/* --  Firebase config pulled from env ----------------------------- */
/*const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}*/
const firebaseConfig = {
  apiKey: "AIzaSyDchHesM2wvLU2maiOFexl2HvNudQB5whI",
  authDomain: "zippi-83528.firebaseapp.com",
  databaseURL: "https://zippi-83528-default-rtdb.firebaseio.com",
  projectId: "zippi-83528",
  storageBucket: "zippi-83528.appspot.com",
  messagingSenderId: "719914612501",
  appId: "1:719914612501:web:353b9885aba57f50fedb1c",
  measurementId: "G-YHJ6NN1Z0L"
};

/* --  Ensure we create or re-use a single app instance ------------- */
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

/* --  Export typed, tree-shake-friendly services ------------------- */
export const db = getFirestore(app);
export const storage = getStorage(app)
export const auth = getAuth(app)
export { app }
