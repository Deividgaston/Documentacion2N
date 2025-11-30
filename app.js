// ======================================
// 1) CONFIGURACIÓN FIREBASE (REAL)
// ======================================
const firebaseConfig = {
  apiKey: "AIzaSyDzVSSaP2wNJenJov-5S9PsYWWUp-HITz0",
  authDomain: "n-presupuestos.firebaseapp.com",
  projectId: "n-presupuestos",
  storageBucket: "n-presupuestos.firebasestorage.app",
  messagingSenderId: "380694582040",
  appId: "1:380694582040:web:d88b2298eecf4f15eec46d"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const googleProvider = new firebase.auth.GoogleAuthProvider();

const TARIFA_CACHE_KEY = "tarifa_2n_v1";

// ======================================
// 2) ESTADO GLOBAL
// ======================================
const appState = {
  user: null,
  loginError: "",
  tarifas: null,
  lineasProyecto: []
};

const appRoot = document.getElementById("app");

function clearApp() {
  appRoot.innerHTML = "";
}

function el(tag, className, html) {
  const x = document.createElement(tag);
  if (className) x.className = className;
  if (html) x.innerHTML = html;
  return x;
}

// ======================================
// 3) LOGIN GOOGLE
// ======================================
function renderLogin() {
  clearApp();

  const box = el("div", "login-container");
  const title = el("div", "login-title", "Acceso 2N Presupuestos");

  const content = el(
    "div",
    null,
    `
    <p style="font-size:0.9rem; margin-bottom:16px; text-align:center;">
      Inicia sesión con tu cuenta de Google 2N.
    </p>
  `
  );

  const err = el(
    "div",
    null,
    appState.loginError
      ? `<p style="color:#e74c3c; font-size:0.85rem; margin-bottom:10px; text-align:center;">${appState.loginError}</p>`
      : ""
  );

  const btn = el("button", "btn btn-blue", "Entrar con Google");
  btn.style.width = "100%";
  btn.onclick = async () => {
    appState.loginError = "";
    renderLogin();
    try {
      await auth.signInWithPopup(googleProvider);
    } catch (error) {
      console.log(error);
      let msg = "No se pudo iniciar sesión con Google";
      if (error.code === "auth/popup-closed-by-user") msg = "Ventana de Google cerrada";
      appState.loginError = msg;
      renderLogin();
    }
  };

  content.appendChild(err);
  content.appendChild(btn);

  box.appendChild(title);
  box.appendChild(content);

  appRoot.appendChild(box);
}

// ======================================
// 4) PANEL PRINCIPAL
// ======================================
function renderPanel() {
  clearApp();

  const top = el("div", "topbar");
  top.innerHTML = `
    <div class="topbar-title">2N · Presupuestos</div>
    <div>
      ${appState.user.email}
      &nbsp;&nbsp;
      <button class="btn-logout" id="logoutBtn">Logout</button>
    </div>
  `;
  top.querySelector("#logoutBtn").onclick = () => auth.signOut();

  const main = el("div");
  main.style.marginTop = "20px";

  const card = el("div", "card");
  card.innerHTML = `
    <div class="card-header">
      Panel principal
      <span style="font-size:0.85rem; font-weight:400; color:#667;">
        Flujo: Tarifas → Proyecto → Presupuesto → Documentación → BC3
      </span>
    </div>

    <div class="grid grid-2">

      <div class="card">
        <div class="card-header">1. Tarifas 2N</div>
        <p>Importar Excel de tarifas → guardar en Firestore con una sola escritura.</p>
        <button class="btn btn-blue" id="goTarifas">Ir a tarifas</button>
      </div>

      <div class="card">
        <div class="card-header">2. Proyecto</div>
        <p>Importar Excel del proyecto y cruzar con tarifas.</p>
        <button class="btn btn-blue" id="goProyecto">Ir a proyectos</button>
      </div>

      <div class="card">
        <div class="card-header">3. Presupuesto</div>
        <p>Generar presupuesto por rol y exportar.</p>
        <button class="btn btn-blue" id="goPresupuesto">Ir a presupuestos</button>
      </div>

      <div class="card">
        <div class="card-header">4. Documentación & BC3</div>
        <p>Hojas técnicas, memoria y BC3.</p>
        <button class="btn btn-blue" id="goDoc">Ir a documentación</button>
      </div>

    </div>
  `;

  main.appendChild(card);

  appRoot.appendChild(top);
  appRoot.appendChild(main);

  document.getElementById("goTarifas").onclick = renderTarifas;
  document.getElementById("goProyecto").onclick = renderProyecto;
  document.getElementById("goPresupuesto").onclick = renderPresupuesto;
  document.getElementById("goDoc").onclick = renderDoc;
}

// ======================================
// 5) UTILIDAD: CARGAR TARIFAS OPTIMIZADO
// ======================================
async function loadTarifasOnce() {
  if (appState.tarifas && Object.keys(appState.tarifas).length > 0) {
    return appState.tarifas;
  }

  try {
    const cached = localStorage.getItem(TARIFA_CACHE_KEY);
    if (cached) {
      appState.tarifas = JSON.parse(cached);
      return appState.tarifas;
    }
  } catch (e) {
    console.warn("Error leyendo tarifas de localStorage", e);
  }

  try {
    const snap = await db.collection("tarifas").doc("v1").get();
    if (snap.exists) {
      const data = snap.data();
      const productos = data.productos || {};
      appState.tarifas = productos;
      try {
        localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(productos));
      } catch (e) {
        console.warn("No se pudieron cachear tarifas", e);
      }
      return productos;
    } else {
      console.warn("No existe tarifas/v1 en Firestore");
      appState.tarifas = {};
      return {};
    }
  } catch (e) {
    console.error("Error cargando tarifas desde Firestore", e);
    appState.tarifas = {};
    return {};
  }
}

// ======================================
// 6) MÓDULO TARIFAS
// ======================================
function renderTarifas() {
  clearApp();

  const top = el("div", "topbar");
  top.innerHTML = `
    <div class="topbar-title">Tarifas 2N</div>
    <button class="btn-logout" i
