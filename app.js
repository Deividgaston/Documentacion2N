// ======================================
// CONFIGURACIÓN FIREBASE
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
const appRoot = document.getElementById("app");

// ======================================
// ESTADO GLOBAL
// ======================================
const appState = {
  user: null,
  loginError: "",
  tarifas: null,
  lineasProyecto: [],
  activeTab: "dashboard",
  rol: "pvp",
  descuentoGlobal: 0,
  aplicarIVA: false,
  infoPresupuesto: {
    cliente: "",
    proyecto: "",
    direccion: "",
    contacto: "",
    email: "",
    telefono: "",
    notas:
      "Para la alimentación de los equipos se requiere de un switch PoE acorde con el consumo de los dispositivos."
  }
};

// Helpers
function clearApp() {
  appRoot.innerHTML = "";
}

function el(tag, className, html) {
  const x = document.createElement(tag);
  if (className) x.className = className;
  if (html) x.innerHTML = html;
  return x;
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

function generarCodigoPresupuesto() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
  return `2N-${y}${m}${d}-${rand}`;
}

// ======================================
// LOGIN
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
      Inicia sesión con tu cuenta de Google 2N para generar presupuestos.
    </p>
  `
  );

  const err = el(
    "div",
    null,
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
// TARIFA
// ======================================
function renderTarifas(container) {
  container.innerHTML = `
    <div class="page-title">Tarifa 2N</div>
    <div class="page-subtitle">Importa la tarifa oficial (solo cuando cambie el Excel).</div>

    <div class="card">
      <div class="card-header">Actualizar tarifa</div>
      <input type="file" id="fileTarifa" accept=".xlsx,.xls"/>
      <button class="btn btn-blue" id="btnProcesarTarifa" style="margin-top:16px;">Importar tarifa</button>
      <div id="resultadoTarifa" style="margin-top:16px; font-size:0.9rem;"></div>
    </div>
  `;

  document.getElementById("btnProcesarTarifa").onclick = procesarTarifaExcel;
}

async function procesarTarifaExcel() {
  const file = document.getElementById("fileTarifa").files[0];
  const out = document.getElementById("resultadoTarifa");

  if (!file) {
    out.innerHTML = `<span style="color:red;">Selecciona un archivo.</span>`;
    return;
  }

  out.innerHTML = "Procesando tarifa…";

  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });

    const sheet = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    let headerRow = -1;
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i].some((c) => String(c).toLowerCase().includes("2n sku"))) {
        headerRow = i;
        break;
      }
    }

    if (headerRow === -1) {
      out.innerHTML = `<span style="color:red;">No se encontró la columna 2N SKU.</span>`;
      return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      range: headerRow,
      defval: ""
    });

    if (!rows.length) {
      out.innerHTML = `<span style="color:red;">Tarifa vacía.</span>`;
      return;
    }

    const keys = Object.keys(rows[0]);
    const skuKey = findHeaderKey(keys, [/sku/i]);
    const nombreKey = findHeaderKey(keys, [/nombre/i, /name/i]);
    const msrpKey = findHeaderKey(keys, [/msrp/i, /pvp/i]);

    const productos = {};
    let count = 0;

    rows.forEach((r) => {
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

    out.innerHTML = `<span style="color:green;">Tarifa importada correctamente (${count} productos).</span>`;
  };

  reader.readAsArrayBuffer(file);
}

// ======================================
// PROYECTO
// ======================================
function renderProyecto(container) {
  container.innerHTML = `
    <div class="page-title">Proyecto</div>
    <div class="page-subtitle">Importa el Excel del proyecto para generar el presupuesto.</div>

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

  out.innerHTML = "Procesando proyecto…";

  const tarifas = await loadTarifasOnce();

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      out.innerHTML = `<span style="color:red;">El Excel del proyecto está vacío.</span>`;
      return;
    }

    const sample = rows[0];
    const cols = Object.keys(sample);
    const colRef = cols.find((c) => /sku|ref|referencia/i.test(c));
    const colQty = cols.find((c) => /cant|qty|cantidad/i.test(c));

    if (!colRef || !colQty) {
      out.innerHTML =
        `<span style="color:red;">No encuentro columnas de referencia/cantidad.</span>`;
      return;
    }

    const lineas = [];
    let conTarifa = 0;
    let sinTarifa = 0;

    rows.forEach((r) => {
      const ref = r[colRef]?.toString().trim();
      if (!ref) return;

      const qty = Number(r[colQty] || 0);
      if (!qty) return;

      const tarifa = tarifas[ref];

      if (tarifa) conTarifa++;
      else sinTarifa++;

      lineas.push({
        referencia: ref,
        cantidad: qty,
        nombreTarifa: tarifa ? tarifa.nombre : "",
        pvp: tarifa ? tarifa.pvp : 0
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
// PRESUPUESTO
// ======================================
function renderPresupuesto(container) {
  container.innerHTML = `
    <div class="page-title">Presupuesto</div>
    <div class="page-subtitle">Generador de presupuesto basado en PVP, descuento global e IVA opcional.</div>

    <div class="card">
      <div class="card-header">Datos del presupuesto</div>

      <div class="form-grid">
        <div>
          <label>Cliente</label>
          <input type="text" id="p_cliente" class="input" value="${appState.infoPresupuesto.cliente}">
        </div>
        <div>
          <label>Proyecto / Obra</label>
          <input type="text" id="p_proyecto" class="input" value="${appState.infoPresupuesto.proyecto}">
        </div>
        <div>
          <label>Dirección</label>
          <input type="text" id="p_direccion" class="input" value="${appState.infoPresupuesto.direccion}">
        </div>
        <div>
          <label>Persona de contacto</label>
          <input type="text" id="p_contacto" class="input" value="${appState.infoPresupuesto.contacto}">
        </div>
        <div>
          <label>Email del contacto</label>
          <input type="email" id="p_email" class="input" value="${appState.infoPresupuesto.email}">
        </div>
        <div>
          <label>Teléfono</label>
          <input type="text" id="p_telefono" class="input" value="${appState.infoPresupuesto.telefono}">
        </div>
      </div>

      <label style="margin-top:20px;">Notas adicionales:</label>
      <textarea id="p_notas" class="input" style="height:100px;">${appState.infoPresupuesto.notas}</textarea>

      <button class="btn btn-blue" style="margin-top:16px;" id="btnGuardarDatos">
        Guardar datos
      </button>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header">Opciones del cálculo</div>

      <label>Rol:</label>
      <select id="rolSelect" class="input">
        <option value="pvp" ${appState.rol === "pvp" ? "selected" : ""}>PVP (sin márgenes)</option>
        <option value="distribuidor" ${appState.rol === "distribuidor" ? "selected" : ""}>Distribuidor</option>
        <option value="subdistribuidor" ${appState.rol === "subdistribuidor" ? "selected" : ""}>Subdistribuidor</option>
        <option value="integrador" ${appState.rol === "integrador" ? "selected" : ""}>Integrador</option>
        <option value="promotora" ${appState.rol === "promotora" ? "selected" : ""}>Promotora / Constructora</option>
      </select>

      <label style="margin-top:12px;">Descuento global (%):</label>
      <input type="number" id="descuentoGlobal" class="input" value="${appState.descuentoGlobal}" />

      <label style="margin-top:12px;">
        <input type="checkbox" id="aplicarIVA" ${appState.aplicarIVA ? "checked" : ""}/>
        Aplicar IVA (21%)
      </label>

      <button class="btn btn-blue" style="margin-top:16px;" id="btnRecalcular">
        Recalcular
      </button>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header">Líneas del presupuesto</div>
      <div id="tablaPresupuesto"></div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header">Totales</div>
      <div id="totalesPresupuesto"></div>

      <button class="btn btn-blue" id="btnPdf" style="margin-top:20px;">Exportar PDF</button>
      <button class="btn btn-blue" id="btnExcel" style="margin-top:10px;">Exportar Excel</button>
    </div>
  `;

  document.getElementById("btnGuardarDatos").onclick = () => {
    appState.infoPresupuesto.cliente = document.getElementById("p_cliente").value;
    appState.infoPresupuesto.proyecto = document.getElementById("p_proyecto").value;
    appState.infoPresupuesto.direccion = document.getElementById("p_direccion").value;
    appState.infoPresupuesto.contacto = document.getElementById("p_contacto").value;
    appState.infoPresupuesto.email = document.getElementById("p_email").value;
    appState.infoPresupuesto.telefono = document.getElementById("p_telefono").value;
    appState.infoPresupuesto.notas = document.getElementById("p_notas").value;
    alert("Datos del presupuesto guardados.");
  };

  document.getElementById("btnRecalcular").onclick = () => {
    appState.rol = document.getElementById("rolSelect").value;
    appState.descuentoGlobal = Number(
      document.getElementById("descuentoGlobal").value || 0
    );
    appState.aplicarIVA = document.getElementById("aplicarIVA").checked;
    recalcularPresupuesto();
  };

  document.getElementById("btnPdf").onclick = () => generarPDF();
  document.getElementById("btnExcel").onclick = () => generarExcel();

  recalcularPresupuesto();
}

function recalcularPresupuesto() {
  const contTabla = document.getElementById("tablaPresupuesto");
  const contTotales = document.getElementById("totalesPresupuesto");

  if (!appState.lineasProyecto.length) {
    contTabla.innerHTML = `<p style="color:#666;">No hay líneas importadas desde el proyecto.</p>`;
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

  appState.lineasProyecto.forEach((l) => {
    const pvp = Number(l.pvp || 0);
    const totalLinea = pvp * l.cantidad;
    subtotal += totalLinea;

    html += `
      <tr>
        <td>${l.referencia}</td>
        <td>${l.nombreTarifa}</td>
        <td class="text-right">${l.cantidad}</td>
        <td class="text-right">${pvp.toFixed(2)} €</td>
        <td class="text-right">${totalLinea.toFixed(2)} €</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  contTabla.innerHTML = html;

  const descuentoEur = subtotal * (appState.descuentoGlobal / 100);
  const baseImponible = subtotal - descuentoEur;
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
// PDF (simple pero funcional, landscape)
// ======================================
function generarPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("No se ha cargado jsPDF. Revisa los <script> del index.html.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const codigo = generarCodigoPresupuesto();
  const d = appState.infoPresupuesto;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(
    "Presupuesto de Suministro de Videoportero IP y Control de Accesos 2N",
    40,
    50
  );

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Código: ${codigo}`, 40, 70);

  pdf.text(`Cliente: ${d.cliente || "-"}`, 40, 100);
  pdf.text(`Proyecto / Obra: ${d.proyecto || "-"}`, 40, 120);
  pdf.text(`Dirección: ${d.direccion || "-"}`, 40, 140);
  pdf.text(`Contacto: ${d.contacto || "-"}`, 40, 160);
  pdf.text(`Email: ${d.email || "-"}`, 40, 180);
  pdf.text(`Teléfono: ${d.telefono || "-"}`, 40, 200);

  const body = appState.lineasProyecto.map((l) => [
    l.referencia,
    l.nombreTarifa,
    l.cantidad,
    l.pvp.toFixed(2) + " €",
    (l.cantidad * l.pvp).toFixed(2) + " €"
  ]);

  pdf.autoTable({
    startY: 230,
    head: [["Ref", "Descripción", "Cant.", "PVP", "Total línea"]],
    body,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [0, 0, 0], textColor: 255 }
  });

  let finalY = pdf.lastAutoTable.finalY + 20;

  const subtotal = appState.lineasProyecto.reduce(
    (acc, l) => acc + l.cantidad * l.pvp,
    0
  );
  const descEu = subtotal * (appState.descuentoGlobal / 100);
  const baseImp = subtotal - descEu;
  const iva = appState.aplicarIVA ? baseImp * 0.21 : 0;
  const total = baseImp + iva;

  pdf.setFontSize(11);
  pdf.text(`Subtotal: ${subtotal.toFixed(2)} €`, 40, finalY);
  pdf.text(
    `Descuento (${appState.descuentoGlobal}%): -${descEu.toFixed(2)} €`,
    40,
    finalY + 18
  );
  pdf.text(`Base imponible: ${baseImp.toFixed(2)} €`, 40, finalY + 36);
  pdf.text(`IVA (21%): ${iva.toFixed(2)} €`, 300, finalY + 18);
  pdf.setFont("helvetica", "bold");
  pdf.text(`TOTAL: ${total.toFixed(2)} €`, 300, finalY + 36);
  pdf.setFont("helvetica", "normal");

  finalY += 70;
  pdf.setFontSize(11);
  pdf.text("Notas:", 40, finalY);
  pdf.setFontSize(10);
  pdf.text(d.notas || "", 40, finalY + 18, { maxWidth: 700 });

  finalY += 80;
  const condiciones = [
    "• Presupuesto válido durante 30 días naturales.",
    "• Precios sin IVA.",
    "• Material sujeto a disponibilidad.",
    "• Plazo estimado de entrega 2–4 semanas.",
    "• Garantía estándar 36 meses.",
    "• No incluye instalación ni puesta en marcha.",
    "• Cualquier modificación puede afectar al precio final."
  ];
  pdf.setFontSize(11);
  pdf.text("Condiciones generales:", 40, finalY);
  pdf.setFontSize(10);
  let y = finalY + 18;
  condiciones.forEach((c) => {
    pdf.text(c, 40, y);
    y += 14;
  });

  pdf.save(`Presupuesto_${codigo}.pdf`);
}

// ======================================
// EXCEL
// ======================================
function generarExcel() {
  const codigo = generarCodigoPresupuesto();
  const wb = XLSX.utils.book_new();

  const rows = [
    ["Ref", "Descripción", "Cantidad", "PVP", "Total línea"]
  ];

  appState.lineasProyecto.forEach((l) => {
    rows.push([
      l.referencia,
      l.nombreTarifa,
      l.cantidad,
      l.pvp,
      l.cantidad * l.pvp
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");

  const subtotal = appState.lineasProyecto.reduce(
    (acc, l) => acc + l.cantidad * l.pvp,
    0
  );
  const descEu = subtotal * (appState.descuentoGlobal / 100);
  const baseImp = subtotal - descEu;
  const iva = appState.aplicarIVA ? baseImp * 0.21 : 0;
  const total = baseImp + iva;

  const rows2 = [
    ["Subtotal", subtotal],
    [`Descuento ${appState.descuentoGlobal}%`, -descEu],
    ["Base imponible", baseImp],
    ["IVA (21%)", iva],
    ["TOTAL", total]
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  XLSX.utils.book_append_sheet(wb, ws2, "Totales");

  XLSX.writeFile(wb, `Presupuesto_${codigo}.xlsx`);
}

// ======================================
// DOCUMENTACIÓN (placeholder)
// ======================================
function renderDoc(container) {
  container.innerHTML = `
    <div class="page-title">Documentación</div>
    <p>Pendiente de implementar (hojas técnicas, declaraciones de conformidad, etc.).</p>
  `;
}

// ======================================
// OBSERVADOR DE LOGIN
// ======================================
auth.onAuthStateChanged((user) => {
  if (user) {
    appState.user = user;
    renderShell();
  } else {
    appState.user = null;
    renderLogin();
  }
});
