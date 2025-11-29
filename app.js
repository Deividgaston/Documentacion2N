// app.js – Estructura base 2N Presupuestos (optimizada para pocas llamadas a Firebase)

// ==============================
// 1) CONFIGURACIÓN FIREBASE
// ==============================
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Inicialización Firebase v8 (scripts CDN ya cargan el objeto global "firebase")
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ==============================
// 2) ESTADO GLOBAL (mínimo)
// ==============================
const appState = {
  user: null,          // se rellenará con Firebase Auth
  tarifas: null,       // cache en memoria
  tarifasLoaded: false // bandera para evitar llamadas repetidas
};

const TARIFAS_CACHE_KEY = "2n_tarifas_v1";

// ==============================
// 3) UTILIDADES DOM
// ==============================
const appRoot = document.getElementById("app");

function clearApp() {
  appRoot.in
