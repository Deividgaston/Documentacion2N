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
// ESTADO GLOBAL
// ======================================
const appState = {
  user: null,
  loginError: "",
  tarifas: null,
  lineasProyecto: [],
  activeTab: "dashboard",
  rol: "pvp",             // Default sin márgenes
  descuentoGlobal: 0,
  aplicarIVA: false
};

const appRoot = document.getElementById("app");

// Helpers UI
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
// LOGIN GOOGLE
// ======================================
function renderLogin() {
  clearApp();
  const box = el("div", "login-container");
  const title = el("div", "login-title", "Acceso 2N Presupuestos");

  const content = el("div", null, `
    <p style="font-size:0.9rem; margin-bottom:16px; text-align:center;">
      Inicia sesión con tu cuenta de Google 2N para generar presupuestos.
    </p>
  `);

  const err = el("div", null,
    appState.loginError
      ? `<p style="color:#e74c3c; font-size:0.85rem; text-align:center;">${appState.loginError}</p>`
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
      appState.loginError = "No se pudo iniciar sesión con Google";
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
// SHELL + NAV
// ======================================
function setActiveTab(tab) {
  appState.activeTab = tab;
  renderShell();
}

function renderShell() {
  clearApp();
  const shell = el("div", "app-shell");
  const nav = el("div", "main-nav");

  const navLeft = el("div", "nav-left");
  const brand = el("div", "nav-brand", "Presupuestos 2N");

  const tabs = el("div", "nav-tabs");
  [
    ["dashboard", "Dashboard"],
    ["proyecto", "Proyecto"],
    ["presupuesto", "Presupuesto"],
    ["doc", "Documentación"],
    ["tarifa", "Tarifa 2N"]
  ].forEach(([id, label]) => {
    const t = el(
      "div",
      "nav-tab" + (appState.activeTab === id ? " active" : ""),
      label
    );
    t.onclick = () => setActiveTab(id);
    tabs.appendChild(t);
  });

  navLeft.appendChild(brand);
  navLeft.appendChild(tabs);

  const navRight = el("div", "nav-right");
  navRight.innerHTML = `
    <span>${appState.user?.email || ""}</span>
    <button class="btn-logout" id="btnLogout">Salir</button>
  `;
  nav.appendChild(navLeft);
  nav.appendChild(navRight);

  const main = el("div", "main-content");
  main.id = "mainContent";

  shell.appendChild(nav);
  shell.appendChild(main);
  appRoot.appendChild(shell);

  document.getElementById("btnLogout").onclick = () => auth.signOut();

  renderActiveView();
}

function renderActiveView() {
  const c = document.getElementById("mainContent");
  c.innerHTML = "";

  if (appState.activeTab === "dashboard") renderDashboard(c);
  else if (appState.activeTab === "proyecto") renderProyecto(c);
  else if (appState.activeTab === "presupuesto") renderPresupuesto(c);
  else if (appState.activeTab === "tarifa") renderTarifas(c);
  else if (appState.activeTab === "doc") renderDoc(c);
}

// ======================================
// DASHBOARD
// ======================================
function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-title">Dashboard general</div>
    <div class="page-subtitle">Resumen del estado del sistema.</div>
  `;
}

// ======================================
// UTILIDADES
// ======================================
async function loadTarifasOnce() {
  if (appState.tarifas) return appState.tarifas;

  const cached = localStorage.getItem(TARIFA_CACHE_KEY);
  if (cached) {
    appState.tarifas = JSON.parse(cached);
    return appState.tarifas;
  }

  const snap = await db.collection("tarifas").doc("v1").get();
  if (snap.exists) {
    appState.tarifas = snap.data().productos || {};
    localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(appState.tarifas));
  } else {
    appState.tarifas = {};
  }

  return appState.tarifas;
}

function toNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  return Number(String(v).replace(",", ".")) || 0;
}

function findHeaderKey(keys, regexList) {
  for (const k of keys) {
    const norm = k.toLowerCase().replace(/\s+/g, " ").trim();
    for (const r of regexList) {
      if (r.test(norm)) return k;
    }
  }
  return null;
}

// ======================================
// TARIFA 2N
// ======================================
function renderTarifas(container) {
  container.innerHTML = `
    <div class="page-title">Tarifa 2N</div>
    <div class="page-subtitle">Importa la tarifa oficial.</div>

    <div class="card">
      <div class="card-header">Actualizar tarifa</div>
      <input type="file" id="fileTarifa" accept=".xlsx,.xls"/>
      <button class="btn btn-blue" id="btnProcesar" style="margin-top:16px;">Importar tarifa</button>
      <div id="resultado" style="margin-top:16px; font-size:0.9rem;"></div>
    </div>
  `;

  document.getElementById("btnProcesar").onclick = procesarTarifaExcel;
}

async function procesarTarifaExcel() {
  const file = document.getElementById("fileTarifa").files[0];
  const out = document.getElementById("resultado");

  if (!file) {
    out.innerHTML = `<span style="color:red;">Selecciona un archivo.</span>`;
    return;
  }

  out.innerHTML = "Procesando…";

  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });

    const sheet = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    let headerRow = -1;
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i].some(c => String(c).toLowerCase().includes("2n sku"))) {
        headerRow = i;
        break;
      }
    }

    if (headerRow === -1) {
      out.innerHTML = `<span style="color:red;">No se encontró columna 2N SKU.</span>`;
      return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      range: headerRow,
      defval: ""
    });

    const keys = Object.keys(rows[0]);

    const skuKey = findHeaderKey(keys, [/sku/i]);
    const nombreKey = findHeaderKey(keys, [/nombre/i]);
    const msrpKey = findHeaderKey(keys, [/msrp/i, /pvp/i]);

    const productos = {};
    let count = 0;

    rows.forEach(r => {
      const sku = r[skuKey]?.toString().trim();
      if (!sku) return;

      productos[sku] = {
        sku,
        nombre: r[nombreKey] || "",
        pvp: toNum(r[msrpKey]),
        campos_originales: r
      };

      count++;
    });

    await db.collection("tarifas").doc("v1").set({
      ultima_actualizacion: new Date().toISOString(),
      total_productos: count,
      productos
    });

    localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(productos));
    appState.tarifas = productos;

    out.innerHTML = `<span style="color:green;">Tarifa importada (${count} productos).</span>`;
  };

  reader.readAsArrayBuffer(file);
}

// ======================================
// PROYECTO
// ======================================
function renderProyecto(container) {
  container.innerHTML = `
    <div class="page-title">Proyecto</div>
    <div class="page-subtitle">Importa el Excel del proyecto.</div>

    <div class="card">
      <div class="card-header">Importar proyecto</div>
      <input type="file" id="fileProyecto" accept=".xlsx,.xls"/>
      <button class="btn btn-blue" id="btnProyecto" style="margin-top:16px;">Procesar proyecto</button>
      <div id="resProyecto" style="margin-top:16px; font-size:0.9rem;"></div>
    </div>
  `;

  document.getElementById("btnProyecto").onclick = procesarProyectoExcel;
}

async function procesarProyectoExcel() {
  const file = document.getElementById("fileProyecto").files[0];
  const out = document.getElementById("resProyecto");

  if (!file) {
    out.innerHTML = `<span style="color:red;">Selecciona un archivo.</span>`;
    return;
  }

  out.innerHTML = "Procesando…";

  const tarifas = await loadTarifasOnce();

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const sample = rows[0];
    const cols = Object.keys(sample);

    const colRef = cols.find(c => /sku|ref|referencia/i.test(c));
    const colQty = cols.find(c => /cant|qty/i.test(c));

    const lineas = [];
    let conTarifa = 0;
    let sinTarifa = 0;

    rows.forEach(r => {
      const ref = r[colRef]?.toString().trim();
      if (!ref) return;

      const qty = Number(r[colQty] || 0);
      const tarifa = tarifas[ref];

      if (tarifa) conTarifa++;
      else sinTarifa++;

      lineas.push({
        referencia: ref,
        cantidad: qty,
        nombreTarifa: tarifa ? tarifa.nombre : "",
        pvp: tarifa ? tarifa.pvp : null
      });
    });

    appState.lineasProyecto = lineas;

    out.innerHTML = `
      <p>
        <strong>${lineas.length}</strong> líneas procesadas<br>
        Con tarifa: <strong>${conTarifa}</strong><br>
        Sin tarifa: <strong>${sinTarifa}</strong>
      </p>
    `;
  };

  reader.readAsArrayBuffer(file);
}

// ======================================
// PRESUPUESTO (MÓDULO COMPLETO)
// ======================================
function renderPresupuesto(container) {
  container.innerHTML = `
    <div class="page-title">Presupuesto</div>
    <div class="page-subtitle">Generador profesional basado en PVP.</div>

    <div class="card">
      <div class="card-header">Opciones</div>

      <label>Rol:</label>
      <select id="rolSelect" class="input">
        <option value="pvp">PVP (sin márgenes)</option>
        <option value="distribuidor">Distribuidor</option>
        <option value="subdistribuidor">Subdistribuidor</option>
        <option value="integrador">Integrador</option>
        <option value="promotora">Promotora / constructora</option>
      </select>

      <label style="margin-top:12px;">Descuento global (%):</label>
      <input type="number" id="descuentoGlobal" class="input" value="${appState.descuentoGlobal}" />

      <label style="margin-top:12px;">
        <input type="checkbox" id="aplicarIVA" ${appState.aplicarIVA ? "checked" : ""}/>
        Aplicar IVA (21%)
      </label>

      <button class="btn btn-blue" style="margin-top:16px;" id="btnRecalcular">Recalcular</button>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header">Líneas del presupuesto</div>
      <div id="tablaPresupuesto"></div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header">Totales</div>
      <div id="totalesPresupuesto"></div>
    </div>
  `;

  document.getElementById("btnRecalcular").onclick = () => {
    appState.rol = document.getElementById("rolSelect").value;
    appState.descuentoGlobal = Number(document.getElementById("descuentoGlobal").value || 0);
    appState.aplicarIVA = document.getElementById("aplicarIVA").checked;
    recalcularPresupuesto();
  };

  recalcularPresupuesto();
}

function recalcularPresupuesto() {
  const contTabla = document.getElementById("tablaPresupuesto");
  const contTotales = document.getElementById("totalesPresupuesto");

  if (!appState.lineasProyecto.length) {
    contTabla.innerHTML = `<p style="color:#666;">No hay líneas importadas.</p>`;
    contTotales.innerHTML = "";
    return;
  }

  let html = `
    <table class="table-simple">
      <thead>
        <tr>
          <th>Referencia</th>
          <th>Descripción</th>
          <th class="text-right">Cant.</th>
          <th class="text-right">PVP</th>
          <th class="text-right">Total línea</th>
        </tr>
      </thead>
      <tbody>
  `;

  let subtotal = 0;

  appState.lineasProyecto.forEach(l => {
    const pvp = Number(l.pvp || 0);
    const totalLinea = l.cantidad * pvp;
    subtotal += totalLinea;

    html += `
      <tr>
        <td>${l.referencia}</td>
        <td>${l.nombreTarifa || ""}</td>
        <td class="text-right">${l.cantidad}</td>
        <td class="text-right">${pvp.toFixed(2)} €</td>
        <td class="text-right">${totalLinea.toFixed(2)} €</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  contTabla.innerHTML = html;

  // DESCUENTO
  const descuentoEur = subtotal * (appState.descuentoGlobal / 100);
  const baseImponible = subtotal - descuentoEur;

  // IVA opcional
  let iva = 0;
  if (appState.aplicarIVA) iva = baseImponible * 0.21;

  const totalFinal = baseImponible + iva;

  contTotales.innerHTML = `
    <p>Subtotal: <strong>${subtotal.toFixed(2)} €</strong></p>
    <p>Descuento (${appState.descuentoGlobal}%): <strong>-${descuentoEur.toFixed(2)} €</strong></p>
    <p>Base imponible: <strong>${baseImponible.toFixed(2)} €</strong></p>
    <p>IVA (21%): <strong>${iva.toFixed(2)} €</strong></p>
    <p style="font-size:1.1rem; margin-top:10px;">TOTAL: <strong>${totalFinal.toFixed(2)} €</strong></p>
  `;
}

// ======================================
// DOCUMENTACIÓN
// ======================================
function renderDoc(container) {
  container.innerHTML = `
    <div class="page-title">Documentación</div>
    <p>Pendiente de implementar.</p>
  `;
}

// ======================================
// OBSERVADOR LOGIN
// ======================================
auth.onAuthStateChanged((user) => {
  if (user) {
    appState.user = user;
    renderShell();
  } else {
    renderLogin();
  }
});
