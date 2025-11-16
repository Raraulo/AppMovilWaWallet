import AsyncStorage from "@react-native-async-storage/async-storage";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import generateCard from "./generateCard";

const INITIAL_BALANCE = 10000;
const BALANCE_STORAGE_KEY = "user_balance";

// Registrar usuario y crear tarjeta personalizada
export async function registerUser(email, password, nombre, apellido, celular) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const titular = `${nombre} ${apellido}`.trim();
  const tarjeta = generateCard(titular); // Pasa el titular al generador de tarjeta
  try {
    await AsyncStorage.setItem(BALANCE_STORAGE_KEY, INITIAL_BALANCE.toString());
  } catch (error) {
    console.warn("No se pudo guardar el saldo en AsyncStorage:", error);
  }
  try {
    // Normalizar email y teléfono para búsquedas consistentes
    const normalizedEmail = (user.email || email || '').toLowerCase();
    const normalizedPhone = (celular || '').replace(/\D/g, '');
    await setDoc(doc(db, "usuarios", user.uid), {
      email: normalizedEmail,
      rawEmail: user.email || email || null,
      nombre,
      apellido,
      celular: normalizedPhone,
      rawPhone: celular || null,
      balance: INITIAL_BALANCE,
      tarjeta, // {numero, cvv, fechaExp, titular}
      createdAt: new Date().toISOString(),
      currency: "USD"
    });
  } catch (error) {
    console.warn("No se pudo crear el documento en Firestore al registrar:", error);
  }
  return user;
}

// Login
export async function loginUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

// Logout
export async function logoutUser() {
  await signOut(auth);
}

// Obtener saldo del usuario
export async function getUserBalance(userId) {
  const maxRetries = 2;
  const delayMs = 500;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const userDoc = await getDoc(doc(db, "usuarios", userId));
      if (userDoc.exists()) {
        const balance = userDoc.data().balance;
        const numBalance = typeof balance === "number" ? balance : INITIAL_BALANCE;
        try {
          await AsyncStorage.setItem(BALANCE_STORAGE_KEY, numBalance.toString());
        } catch (error) {
          console.warn("No se pudo guardar saldo en AsyncStorage:", error);
        }
        console.log("Saldo obtenido de Firestore:", numBalance);
        return numBalance;
      }
      // Si el documento no existe, crea solo el saldo (no tarjeta porque es registro)
      try {
        await setDoc(doc(db, "usuarios", userId), {
          balance: INITIAL_BALANCE,
          createdAt: new Date().toISOString(),
          currency: "USD",
        });
        await AsyncStorage.setItem(BALANCE_STORAGE_KEY, INITIAL_BALANCE.toString());
        console.log("Usuario creado en Firestore con saldo inicial:", INITIAL_BALANCE);
      } catch {
        console.warn("No se pudo crear documento en Firestore");
      }
      return INITIAL_BALANCE;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (
        errorMsg.includes("ERR_BLOCKED_BY_CLIENT") ||
        errorMsg.includes("offline") ||
        errorMsg.includes("Failed to fetch") ||
        errorMsg.includes("NetworkError") ||
        errorMsg.includes("UNAVAILABLE")
      ) {
        console.warn("Firestore no disponible. Usando AsyncStorage como respaldo.");
        break;
      }
      console.warn(`Intento ${attempt + 1}/${maxRetries} fallido en Firestore:`, error);
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  try {
    const localBalance = await AsyncStorage.getItem(BALANCE_STORAGE_KEY);
    if (localBalance) {
      const balance = parseFloat(localBalance);
      if (!isNaN(balance)) {
        console.log("Saldo obtenido de AsyncStorage (caché):", balance);
        return balance;
      }
    }
  } catch (error) {
    console.warn("Error al obtener saldo de AsyncStorage:", error);
  }
  console.log("Retornando saldo inicial por defecto:", INITIAL_BALANCE);
  return INITIAL_BALANCE;
}
