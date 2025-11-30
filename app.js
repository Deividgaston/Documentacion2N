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

  // NAV SUPERIOR
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
      Se guardarán <strong>todos los parámetros</strong> de cada fila en Firebase.
    </p>

    <input type="file" id="fileTarifa" accept=".xlsx,.xls" />

    <button class="btn btn-blue" id="btnProcesar" style="margin-top:16px;">Importar tarifa</button>

    <div id="resultado" style="margin-top:20px; font-size:0.9rem;"></div>
  `;
  container.appendChild(card);

  document.getElementById("btnProcesar").onclick = procesarTarifaExcel;
}

// Helper número
function toNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// Helper: buscar cabecera por patrones
function findHeaderKey(keys, regexList) {
  for (const k of keys) {
    const kNorm = (k || "").toString().replace(/\s+/g, " ").trim();
    for (const r of regexList) {
      if (r.test(kNorm)) return k;
    }
  }
  return null;
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

    // 1) Leemos como matriz (header:1) para localizar la fila que contiene "2N SKU"
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rowsMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    let headerRowIndex = -1;
    for (let i = 0; i < rowsMatrix.length; i++) {
      const row = rowsMatrix[i];
      const hasSku = row.some((cell) =>
        typeof cell === "string" &&
        cell.toLowerCase().replace(/\s+/g, " ").includes("2n sku")
      );
      if (hasSku) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      out.innerHTML = `<span style="color:red;">No se ha encontrado la columna "2N SKU" en la tarifa.</span>`;
      return;
    }

    // 2) Convertimos desde esa fila en adelante a objetos { cabecera: valor }
    const rows = XLSX.utils.sheet_to_json(sheet, {
      range: headerRowIndex,
      defval: ""
    });

    if (!rows.length) {
      out.innerHTML = `<span style="color:red;">La tabla de productos está vacía.</span>`;
      return;
    }

    // 3) Detectamos dinámicamente nombres de columnas
    const sample = rows[0];
    const keys = Object.keys(sample);

    const skuKey = findHeaderKey(keys, [/2n\s*sku/i, /\bsku\b/i, /referencia/i]);
    const nombreKey = findHeaderKey(keys, [/nombre/i, /name/i]);

    const nfrDistKey = findHeaderKey(keys, [/nfr.*distrib/i, /nfr.*distributor/i]);
    const nfrResKey = findHeaderKey(keys, [/nfr.*resell/i]);

    const distPriceKey = findHeaderKey(keys, [/distributor.*price/i]);
    const res1Key = findHeaderKey(keys, [/reseller.*price.*1/i, /reseller.*1/i]);
    const res2Key = findHeaderKey(keys, [/reseller.*price.*2/i, /reseller.*2/i]);
    const msrpKey = findHeaderKey(keys, [/msrp/i, /srp/i, /pvp/i]);

    const notaKey = findHeaderKey(keys, [/nota/i, /note/i]);
    const anchoKey = findHeaderKey(keys, [/ancho/i, /width/i]);
    const altoKey = findHeaderKey(keys, [/alto/i, /height/i]);
    const profKey = findHeaderKey(keys, [/profundidad/i, /depth/i]);
    const pesoKey = findHeaderKey(keys, [/peso/i, /weight/i]);
    const hsKey = findHeaderKey(keys, [/hs\s*code/i]);
    const eanKey = findHeaderKey(keys, [/ean/i]);
    const webKey = findHeaderKey(keys, [/p[aá]gina web/i, /pagina web/i, /\bweb\b/i]);
    const eolKey = findHeaderKey(keys, [/^eol$/i]);
    const motivoEolKey = findHeaderKey(keys, [/motivo.*venta/i, /reason.*end/i]);

    const productos = {};
    let count = 0;

    rows.forEach((r) => {
      const rawSku = skuKey ? r[skuKey] : "";
      const sku = (rawSku || "").toString().trim();
      if (!sku) return; // saltamos filas de sección / vacías

      const nombre = nombreKey ? (r[nombreKey] || "") : "";

      const nfrDist = nfrDistKey ? toNum(r[nfrDistKey]) : 0;
      const nfrRes = nfrResKey ? toNum(r[nfrResKey]) : 0;

      const distPrice = distPriceKey ? toNum(r[distPriceKey]) : 0;
      const res1 = res1Key ? toNum(r[res1Key]) : 0;
      const res2 = res2Key ? toNum(r[res2Key]) : 0;
      const msrp = msrpKey ? toNum(r[msrpKey]) : 0;

      const nota = notaKey ? (r[notaKey] || "") : "";
      const ancho = anchoKey ? toNum(r[anchoKey]) : 0;
      const alto = altoKey ? toNum(r[altoKey]) : 0;
      const profundidad = profKey ? toNum(r[profKey]) : 0;
      const peso = pesoKey ? toNum(r[pesoKey]) : 0;

      const hsCode = hsKey ? (r[hsKey] || "") : "";
      const eanCode = eanKey ? (r[eanKey] || "") : "";
      const paginaWeb = webKey ? (r[webKey] || "") : "";
      const eolFlag = eolKey ? !!r[eolKey] : false;
      const motivoEol = motivoEolKey ? (r[motivoEolKey] || "") : "";

      productos[sku] = {
        sku,
        nombre,

        // precios brutos de la tabla, flexibles a cambios de columnas
        nfr_distributor_eur: nfrDist,
        nfr_reseller_eur: nfrRes,
        distributor_price_eur: distPrice,
        reseller_price_1_eur: res1,
        reseller_price_2_eur: res2,
        msrp_eur: msrp,

        // mapping estándar de roles (podremos cambiar la lógica luego)
        pvp: msrp,
        precio_distribuidor: distPrice || nfrDist || 0,
        precio_subdistribuidor: res1 || res2 || 0,
        precio_instalador: res2 || res1 || 0,
        precio_constructora: res2 || res1 || 0,
        precio_promotora: msrp || res1 || res2 || 0,

        ancho_mm: ancho,
        alto_mm: alto,
        profundidad_mm: profundidad,
        peso_kg: peso,

        hs_code: hsCode,
        ean_code: eanCode,
        pagina_web: paginaWeb,
        eol: eolFlag,
        motivo_eol: motivoEol,
        nota,

        // TODO: cualquier campo adicional queda aquí
        campos_originales: r
      };

      count++;
    });

    out.innerHTML = "Guardando tarifa en Firestore...";

    await db.collection("tarifas").doc("v1").set({
      ultima_actualizacion: new Date().toISOString(),
      total_productos: count,
      productos
    });

    localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(productos));
    appState.tarifas = productos;

    out.innerHTML = `<span style="color:green;">Tarifa actualizada correctamente (${count} productos).</span>`;
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
      Flujo principal: selecciona el Excel del proyecto y la herramienta generará las líneas con PVP.
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
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

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
        Líneas procesadas: <strong>${lineas.len
