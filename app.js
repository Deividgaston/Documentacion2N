// ==========================================
// app.js · Inicialización Firebase + export
// ==========================================

// ⚠️ TU CONFIGURACIÓN DE FIREBASE (no modificar nombres)
const firebaseConfig = {
  apiKey: "AIzaSyB51403DF43zxqq4K3Ex65i5-Sqm-EkiTY",
  authDomain: "crm-obras-2n.firebaseapp.com",
  projectId: "crm-obras-2n",
  storageBucket: "crm-obras-2n.firebasestorage.app",
  messagingSenderId: "545667121262",
  appId: "1:545667121262:web:9dd55a09bc7a7bb3e9a67f"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);

// Servicios Firebase
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Proveedor de Google para login
const providerGoogle = new firebase.auth.GoogleAuthProvider();

// ==========================================
// LOGIN NORMAL (email / password)
// ==========================================

async function loginWithEmailPassword(email, password) {
  try {
    const userCred = await auth.signInWithEmailAndPassword(email, password);
    return userCred.user;
  } catch (error) {
    console.error("Error login email/password:", error);
    throw error;
  }
}

// ==========================================
// LOGIN CON GOOGLE
// ==========================================

async function loginWithGoogle() {
  try {
    const result = await auth.signInWithPopup(providerGoogle);
    return result.user;
  } catch (error) {
    console.error("Error login Google:", error);
    throw error;
  }
}

// ==========================================
// OBTENER TARIFAS (LECTURA ÚNICA + CACHÉ)
// ==========================================

async function getTarifas() {
  // Si ya está en caché → usarlo
  if (appState.tarifas.data) {
    return appState.tarifas.data;
  }

  try {
    const col = await db.collection("tarifas").get();

    const tarifas = {};
    col.forEach((doc) => {
      const data = doc.data();
      const ref = String(doc.id).trim();
      tarifas[ref] = data.pvp || data.precio || data.price || 0;
    });

    // Guardar en caché
    appState.tarifas.data = tarifas;
    appState.tarifas.lastLoaded = Date.now();

    // Guardar caché local (opcional)
    try {
      localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(tarifas));
    } catch {}

    console.log("%cTarifa cargada (1 lectura Firestore)", "color:#22c55e;");
    return tarifas;

  } catch (error) {
    console.error("Error obteniendo tarifas:", error);

    // Intentar recuperar desde localStorage si existe
    try {
      const cached = localStorage.getItem(TARIFA_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        appState.tarifas.data = parsed;
        return parsed;
      }
    } catch {}

    return {};
  }
}

// ==========================================
// UTILIDADES GLOBALES
// ==========================================

function normalizarRef(ref) {
  return String(ref).trim().replace(/\s+/g, "").toUpperCase();
}

function limpiarTexto(t) {
  return String(t || "").trim();
}

function formatNumber(n) {
  return Number(n).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

console.log("%cFirebase inicializado (app.js)", "color:#0ea5e9; font-weight:600;");
