import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD1a13HbctNbuudUX-M2H3O7SJcCG3C3C4",
  authDomain: "wawalle.firebaseapp.com",
  projectId: "wawalle",
  storageBucket: "wawalle.appspot.com",
  messagingSenderId: "913227071339",
  appId: "1:913227071339:web:21f2333aebb750ce7dd62e",
};

// Asegura una sola instancia de la app Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Inicializa Auth y Firestore (Expo Go: persistencia solo en memoria)
const auth = getAuth(app);
const db = getFirestore(app);

// Exporta para usar en el resto de tu proyecto
export { app, auth, db };

