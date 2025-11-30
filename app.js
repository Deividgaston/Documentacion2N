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
  lineasProyecto: [],
  activeTab: "dashboard" // dashboard | proyecto | presupuesto | doc | tarifa
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
      Inicia sesión con tu cuenta de Google 2N para generar presupuestos de forma rápida y consistente.
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
// 4) SHELL TIPO CRM + NAVEGACIÓN
// ======================================
function setActiveTab(tab) {
  appState.activeTab = tab;
  renderShell();
}

function renderShell() {
  clearApp();

  const shell = el("div", "app-shell");

  // --- NAV SUPERIOR ---
  const nav = el("div", "main-nav");

  const navLeft = el("div", "nav-left");
  const brand = el("div", "nav-brand", "Presupuestos 2N");

  const tabs = el("div", "nav-tabs");
  const tabsInfo = [
    { id: "dashboard", label: "Dashboard" },
    { id: "proyecto", label: "Proyecto" },
    { id: "presupuesto", label: "Presupuesto" },
    { id: "doc", label: "Documentación" },
    { id: "tarifa", label: "Tarifa 2N" }
  ];

  tabsInfo.forEach((t) => {
    const tab = el(
      "div",
      "nav-tab" + (appState.activeTab === t.id ? " active" : ""),
      t.label
    );
    tab.addEventListener("click", () => setActiveTab(t.id));
    tabs.appendChild(tab);
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

  // --- CONTENIDO ---
  const mainContent = el("div", "main-content");
  mainContent.id = "mainContent";

  shell.appendChild(nav);
  shell.appendChild(mainContent);
  appRoot.appendChild(shell);

  document.getElementById("btnLogout").onclick = () => auth.signOut();

  renderActiveView();
}

function renderActiveView() {
  const container = document.getElementById("mainContent");
  container.innerHTML = "";

  switch (appState.activeTab) {
    case "dashboard":
      renderDashboard(container);
      break;
    case "proyecto":
      renderProyecto(container);
      break;
    case "presupuesto":
      renderPresupuesto(container);
      break;
    case "doc":
      renderDoc(container);
      break;
    case "tarifa":
      renderTarifas(container);
      break;
    default:
      renderDashboard(container);
  }
}

// ======================================
// 5) DASHBOARD
// ======================================
function renderDashboard(container) {
  const title = el("div", null);
  title.innerHTML = `
    <div class="page-title">Dashboard general</div>
    <div class="page-subtitle">
      Vista rápida de proyectos, líneas calculadas y estado de la tarifa 2N.
    </div>
  `;
  container.appendChild(title);

  const cards = el("div", "grid grid-2");

  const cardProyecto = el("div", "card");
  cardProyecto.innerHTML = `
    <div class="card-header">
      Proyectos recientes
      <span class="badge-soft">${appState.lineasProyecto.length} líneas en memoria</span>
    </div>
    <p style="font-size:0.9rem;">
      Importa un Excel de proyecto desde la pestaña <strong>Proyecto</strong> para generar precios de forma automática.
    </p>
  `;

  const cardTarifa = el("div", "card");
  const tarifaEstado =
    appState.tarifas && Object.keys(appState.tarifas).length
      ? `<span style="color:#16a34a;">Tarifa cargada (${Object.keys(appState.tarifas).length} referencias)</span>`
      : `<span style="color:#dc2626;">Tarifa no cargada</span>`;

  cardTarifa.innerHTML = `
    <div class="card-header">
      Tarifa 2N
    </div>
    <p style="font-size:0.9rem; margin-bottom:6px;">
      La tarifa solo se actualiza cuando 2N publica una nueva versión (1–2 veces/año).
    </p>
    <p style="font-size:0.9rem;">Estado actual: ${tarifaEstado}</p>
  `;

  cards.appendChild(cardProyecto);
  cards.appendChild(cardTarifa);

  container.appendChild(cards);
}

// ======================================
// 6) UTILIDAD: CARGAR TARIFAS OPTIMIZADO
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
// 7) MÓDULO TARIFA (CONFIGURACIÓN OCASIONAL)
// ======================================
function renderTarifas(container) {
  const header = el("div", null);
  header.innerHTML = `
    <div class="page-title">Tarifa 2N</div>
    <div class="page-subtitle">
      Configuración puntual. Solo cuando cambie el Excel oficial de precios.
    </div>
  `;
  container.appendChild(header);

  const card = el("div", "card");
  card.innerHTML = `
    <div class="card-header">
      Actualizar tarifa oficial de 2N
      <span style="font-size:0.8rem; font-weight:400; color:#777;">
        Se guarda en Firestore y se reutiliza en todos los proyectos.
      </span>
    </div>

    <p style="margin-bottom:10px; font-size:0.9rem;">
      Selecciona el Excel de tarifa de 2N y pulsa <strong>Importar tarifa</strong>.
    </p>

    <input type="file" id="fileTarifa" accept=".xlsx,.xls" />

    <button class="btn btn-blue" id="btnProcesar" style="margin-top:16px;">Importar tarifa</button>

    <div id="resultado" style="margin-top:20px; font-size:0.9rem;"></div>
  `;
  container.appendChild(card);

  document.getElementById("btnProcesar").onclick = procesarTarifaExcel;
}

async function procesarTarifaExcel() {
  const file = document.getElementById("fileTarifa").files[0];
  const out = document.getElementById("resultado");

  if (!file) {
    out.innerHTML = `<span style="color:red;">Selecciona un archivo Excel de tarifas.</span>`;
    return;
  }

  out.innerHTML = "Procesando Excel de tarifa...";

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

    out.innerHTML = "Guardando tarifa en Firestore...";

    await db.collection("tarifas").doc("v1").set({
      ultima_actualizacion: new Date().toISOString(),
      productos: productos
    });

    localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(productos));
    appState.tarifas = productos;

    out.innerHTML = `<span style="color:green;">Tarifa actualizada correctamente.</span>`;
  };

  reader.readAsArrayBuffer(file);
}

// ======================================
// 8) MÓDULO PROYECTO (EXCEL → LÍNEAS)
// ======================================
function renderProyecto(container) {
  const header = el("div", null);
  header.innerHTML = `
    <div class="page-title">Proyecto</div>
    <div class="page-subtitle">
      Importa el Excel de diseño del proyecto y cruzamos referencias con la tarifa 2N para generar las líneas de cálculo.
    </div>
  `;
  container.appendChild(header);

  const card = el("div", "card");
  card.innerHTML = `
    <div class="card-header">Importar Excel de proyecto</div>

    <p style="margin-bottom:10px;">
      Este será tu flujo principal: selecciona el Excel del proyecto y la herramienta generará las líneas con PVP.
    </p>

    <input type="file" id="fileProyecto" accept=".xlsx,.xls" />

    <button class="btn btn-blue" id="btnProyecto" style="margin-top:16px;">Procesar proyecto</button>

    <div id="resProyecto" style="margin-top:20px; font-size:0.9rem;"></div>
  `;
  container.appendChild(card);

  document.getElementById("btnProyecto").onclick = procesarProyectoExcel;
}

async function procesarProyectoExcel() {
  const file = document.getElementById("fileProyecto").files[0];
  const out = document.getElementById("resProyecto");

  if (!file) {
    out.innerHTML = `<span style="color:red;">Selecciona un archivo Excel de proyecto.</span>`;
    return;
  }

  out.innerHTML = "Cargando tarifa y procesando proyecto...";

  const tarifas = await loadTarifasOnce();

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const sample = rows[0] || {};
    const cols = Object.keys(sample);

    const colRef =
      cols.find((c) => /sku|ref|referencia/i.test(c)) || cols[0] || "Referencia";
    const colQty =
      cols.find((c) => /cant|qty|unid/i.test(c)) || cols[1] || "Cantidad";
    const colDesc =
      cols.find((c) => /desc|descripción|description/i.test(c)) || cols[2] || "Descripción";

    const lineas = [];
    let conTarifa = 0;
    let sinTarifa = 0;

    rows.forEach((r) => {
      const ref = String(r[colRef] || "").trim();
      if (!ref) return;

      const qtyRaw = r[colQty];
      const cantidad = Number(qtyRaw || 0) || 0;
      const descripcion = r[colDesc] || "";

      const tarifa = tarifas[ref];
      let pvp = null;
      let nombreTarifa = "";
      if (tarifa) {
        pvp = Number(tarifa.pvp || 0);
        nombreTarifa = tarifa.nombre || "";
        conTarifa++;
      } else {
        sinTarifa++;
      }

      lineas.push({
        referencia: ref,
        cantidad,
        descripcion,
        nombreTarifa,
        pvp
      });
    });

    appState.lineasProyecto = lineas;

    let html = `
      <p>
        Líneas procesadas: <strong>${lineas.length}</strong><br>
        Con tarifa encontrada: <strong>${conTarifa}</strong><br>
        Sin tarifa (revisar SKU/ref): <strong>${sinTarifa}</strong>
      </p>
    `;

    if (lineas.length > 0) {
      html += `
        <div class="table-wrapper">
          <table class="table-simple">
            <thead>
              <tr>
                <th style="text-align:left;">Ref</th>
                <th class="text-right">Cant.</th>
                <th style="text-align:left;">Descripción proyecto</th>
                <th style="text-align:left;">Nombre tarifa</th>
                <th class="text-right">PVP</th>
              </tr>
            </thead>
            <tbody>
      `;

      lineas.slice(0, 50).forEach((l) => {
        html += `
          <tr>
            <td>${l.referencia}</td>
            <td class="text-right">${l.cantidad}</td>
            <td>${l.descripcion || ""}</td>
            <td>${l.nombreTarifa || ""}</td>
            <td class="text-right">${
              l.pvp != null ? l.pvp.toFixed(2) + " €" : "-"
            }</td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
          ${
            lineas.length > 50
              ? `<p style="margin-top:6px; color:#777;">Mostrando primeras 50 líneas…</p>`
              : ""
          }
        </div>
      `;
    }

    out.innerHTML = html;
  };

  reader.readAsArrayBuffer(file);
}

// ======================================
// 9) PLACEHOLDERS PRESUPUESTO / DOC
// ======================================
function renderPresupuesto(container) {
  const header = el("div", null);
  header.innerHTML = `
    <div class="page-title">Presupuesto</div>
    <div class="page-subtitle">
      En esta sección generaremos el presupuesto por rol (distribuidor, instalador, etc.) usando las líneas del proyecto.
    </div>
  `;
  container.appendChild(header);

  const card = el("div", "card");
  card.innerHTML = `
    <div class="card-header">Generador de presupuesto</div>
    <p style="font-size:0.9rem;">
      Pendiente de implementar: cálculo por rol, descuentos y exportación a PDF / Excel.
    </p>
  `;
  container.appendChild(card);
}

function renderDoc(container) {
  const header = el("div", null);
  header.innerHTML = `
    <div class="page-title">Documentación & BC3</div>
    <div class="page-subtitle">
      Aquí añadiremos memoria descriptiva, hojas técnicas, declaraciones y exportación BC3 para Presto.
    </div>
  `;
  container.appendChild(header);

  const card = el("div", "card");
  card.innerHTML = `
    <div class="card-header">Gestor de documentación</div>
    <p style="font-size:0.9rem;">
      Pendiente de implementar: selección de PDFs, plantillas de memoria y generación BC3.
    </p>
  `;
  container.appendChild(card);
}

// ======================================
// 10) OBSERVADOR AUTH
// ======================================
auth.onAuthStateChanged((user) => {
  if (user) {
    appState.user = { email: user.email };
    if (!appState.activeTab) appState.activeTab = "dashboard";
    renderShell();
  } else {
    appState.user = null;
    appState.activeTab = "dashboard";
    renderLogin();
  }
});
