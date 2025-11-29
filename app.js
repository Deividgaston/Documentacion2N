// ======================================
// 1) CONFIGURACIÓN FIREBASE (REAL TUYA)
// ======================================
const firebaseConfig = {
  apiKey: "AIzaSyDzVSSaP2wNJenJov-5S9PsYWWUp-HITz0",
  authDomain: "n-presupuestos.firebaseapp.com",
  projectId: "n-presupuestos",
  storageBucket: "n-presupuestos.firebasestorage.app",
  messagingSenderId: "380694582040",
  appId: "1:380694582040:web:d88b2298eecf4f15eec46d"
};

// Inicializar Firebase v8
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
  tarifas: null
};

const appRoot = document.getElementById("app");

function clearApp() { appRoot.innerHTML = ""; }

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

  const content = el("div", null, `
    <p style="font-size:0.9rem; margin-bottom:16px; text-align:center;">
      Inicia sesión con tu cuenta de Google 2N.
    </p>
  `);

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
        <p>Importar Excel del proyecto.</p>
        <button class="btn btn-blue" id="goProyecto">Ir a proyectos</button>
      </div>

      <div class="card">
        <div class="card-header">3. Presupuesto</div>
        <p>Generar presupuesto y exportar.</p>
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
// 5) MÓDULO TARIFAS
// ======================================
function renderTarifas() {
  clearApp();

  const top = el("div", "topbar");
  top.innerHTML = `
    <div class="topbar-title">Tarifas 2N</div>
    <button class="btn-logout" id="logoutBtn">Logout</button>
  `;
  top.querySelector("#logoutBtn").onclick = () => auth.signOut();

  const card = el("div", "card");

  card.innerHTML = `
    <div class="card-header">Importar tarifa Excel → Firestore</div>

    <p style="margin-bottom:10px;">
      Selecciona el Excel oficial de 2N con la tabla de precios.
    </p>

    <input type="file" id="fileTarifa" accept=".xlsx,.xls" />

    <button class="btn btn-blue" id="btnProcesar" style="margin-top:16px;">Procesar e importar</button>

    <div id="resultado" style="margin-top:20px; font-size:0.9rem;"></div>

    <button class="btn btn-grey" id="volver" style="margin-top:20px;">Volver al panel</button>
  `;

  appRoot.appendChild(top);
  appRoot.appendChild(card);

  document.getElementById("volver").onclick = renderPanel;
  document.getElementById("btnProcesar").onclick = procesarTarifaExcel;
}


// ======================================
// 6) PROCESAR TARIFA DESDE EXCEL
// ======================================
async function procesarTarifaExcel() {
  const file = document.getElementById("fileTarifa").files[0];
  const out = document.getElementById("resultado");

  if (!file) {
    out.innerHTML = `<span style="color:red;">Selecciona un archivo Excel.</span>`;
    return;
  }

  out.innerHTML = "Procesando Excel...";

  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const productos = {};

    rows.forEach((r) => {
      const sku = r["2N SKU"] || r["SKU"] || r["Referencia"];
      if (!sku) return;

      productos[sku] = {
        sku: sku,
        nombre: r["Nombre"] || "",
        pvp: r["SRP (EUR)"] || 0,
        precio_distribuidor: r["Distributor Price (EUR)"] || 0,
        precio_subdistribuidor: r["Recommended Reseller Price 1 (EUR)"] || 0,
        precio_instalador: r["Recommended Reseller Price 2 (EUR)"] || 0,
        precio_constructora: r["Recommended Reseller Price 2 (EUR)"] || 0,
        precio_promotora: r["SRP (EUR)"] || 0,
        ean: r["EAN"] || "",
        hs_code: r["CUSTOMS TARIFF NUMBER (HS CODE)"] || "",
        web: r["Página web"] || "",
        eol: r["EOL"] || false
      };
    });

    out.innerHTML = "Guardando en Firestore...";

    await db.collection("tarifas").doc("v1").set({
      ultima_actualizacion: new Date().toISOString(),
      productos: productos
    });

    localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(productos));

    out.innerHTML = `<span style="color:green;">Tarifa importada correctamente.</span>`;
  };

  reader.readAsArrayBuffer(file);
}


// ======================================
// 7) OTROS MÓDULOS (PLACEHOLDERS)
// ======================================
function renderProyecto() {
  clearApp();
  const top = el("div", "topbar");
  top.innerHTML = `
    <div class="topbar-title">Proyecto</div>
    <button class="btn-logout" id="logoutBtn">Logout</button>
  `;
  top.querySelector("#logoutBtn").onclick = () => auth.signOut();

  const card = el("div", "card");
  card.innerHTML = `
    <div class="card-header">Importar Excel de proyecto</div>
    <p>Placeholder...</p>
    <button class="btn btn-grey" onclick="renderPanel()">Volver</button>
  `;

  appRoot.appendChild(top);
  appRoot.appendChild(card);
}

function renderPresupuesto() {
  clearApp();
  const top = el("div", "topbar");
  top.innerHTML = `
    <div class="topbar-title">Presupuesto</div>
    <button class="btn-logout" id="logoutBtn">Logout</button>
  `;
  top.querySelector("#logoutBtn").onclick = () => auth.signOut();

  const card = el("div", "card");
  card.innerHTML = `
    <div class="card-header">Generar presupuesto</div>
    <p>Placeholder...</p>
    <button class="btn btn-grey" onclick="renderPanel()">Volver</button>
  `;

  appRoot.appendChild(top);
  appRoot.appendChild(card);
}

function renderDoc() {
  clearApp();
  const top = el("div", "topbar");
  top.innerHTML = `
    <div class="topbar-title">Documentación & BC3</div>
    <button class="btn-logout" id="logoutBtn">Logout</button>
  `;
  top.querySelector("#logoutBtn").onclick = () => auth.signOut();

  const card = el("div", "card");
  card.innerHTML = `
    <div class="card-header">Documentación</div>
    <p>Placeholder...</p>
    <button class="btn btn-grey" onclick="renderPanel()">Volver</button>
  `;

  appRoot.appendChild(top);
  appRoot.appendChild(card);
}


// ======================================
// 8) OBSERVADOR AUTH
// ======================================
auth.onAuthStateChanged((user) => {
  if (user) {
    appState.user = { email: user.email };
    renderPanel();
  } else {
    appState.user = null;
    renderLogin();
  }
});
