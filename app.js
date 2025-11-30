// ======================================
// 0) LOGO BASE64 2N NEGRO (PDF)
// ======================================

const LOGO_2N_BASE64 = `
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAYAAAAt5V9bAAAAAXNSR0IArs4c6QAA
...(recortado para mensaje)... 
`; 
// IMPORTANTE: En el siguiente mensaje te paso el LOGO COMPLETO SIN RECORTAR
// (Este campo es muy largo y se envía en bloque separado)

// ======================================
// 1) CONFIGURACIÓN FIREBASE
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

  // CAMPOS DEL PRESUPUESTO
  infoPresupuesto: {
    cliente: "",
    proyecto: "",
    direccion: "",
    contacto: "",
    email: "",
    telefono: "",
    notas: "Para la alimentación de los equipos se requiere de un switch PoE acorde con el consumo de los dispositivos."
  },

  rol: "pvp",
  descuentoGlobal: 0,
  aplicarIVA: false
};

// Helpers UI
function clearApp() { appRoot.innerHTML = ""; }

function el(tag, className, html) {
  const x = document.createElement(tag);
  if (className) x.className = className;
  if (html) x.innerHTML = html;
  return x;
}

// ======================================
// GENERAR NUMERACIÓN DEL PRESUPUESTO
// ======================================
function generarCodigoPresupuesto() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,"0");
  const d = String(now.getDate()).padStart(2,"0");
  const rand = String(Math.floor(Math.random()*9999)).padStart(4,"0");
  return `2N-${y}${m}${d}-${rand}`;
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
// PRESUPUESTO — UI COMPLETA
// ======================================

function renderPresupuesto(container) {
  container.innerHTML = `
    <div class="page-title">Presupuesto</div>
    <div class="page-subtitle">Generador profesional — basado en PVP, descuento global e IVA opcional.</div>

    <!-- FORMULARIO DE DATOS DEL PRESUPUESTO -->
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


    <!-- OPCIONES DE CÁLCULO -->
    <div class="card" style="margin-top:20px;">
      <div class="card-header">Opciones del cálculo</div>

      <label>Rol:</label>
      <select id="rolSelect" class="input">
        <option value="pvp" ${appState.rol==="pvp"?"selected":""}>PVP (sin márgenes)</option>
        <option value="distribuidor" ${appState.rol==="distribuidor"?"selected":""}>Distribuidor</option>
        <option value="subdistribuidor" ${appState.rol==="subdistribuidor"?"selected":""}>Subdistribuidor</option>
        <option value="integrador" ${appState.rol==="integrador"?"selected":""}>Integrador</option>
        <option value="promotora" ${appState.rol==="promotora"?"selected":""}>Promotora / Constructora</option>
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


    <!-- TABLA DEL PRESUPUESTO -->
    <div class="card" style="margin-top:20px;">
      <div class="card-header">Líneas del presupuesto</div>
      <div id="tablaPresupuesto"></div>
    </div>

    <!-- TOTALES -->
    <div class="card" style="margin-top:20px;">
      <div class="card-header">Totales</div>
      <div id="totalesPresupuesto"></div>

      <button class="btn btn-blue" id="btnPdf" style="margin-top:20px;">Exportar PDF</button>
      <button class="btn btn-blue" id="btnExcel" style="margin-top:10px;">Exportar Excel</button>
    </div>
  `;

  // Guardar datos de cabecera
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

  // Eventos de cálculo
  document.getElementById("btnRecalcular").onclick = () => {
    appState.rol = document.getElementById("rolSelect").value;
    appState.descuentoGlobal = Number(document.getElementById("descuentoGlobal").value || 0);
    appState.aplicarIVA = document.getElementById("aplicarIVA").checked;
    recalcularPresupuesto();
  };

  // Eventos exportación (se implementa en bloque 3)
  document.getElementById("btnPdf").onclick = () => generarPDF();
  document.getElementById("btnExcel").onclick = () => generarExcel();

  recalcularPresupuesto();
}



// ======================================
// FUNCIONES DE CÁLCULO
// ======================================
function recalcularPresupuesto() {
  const contTabla = document.getElementById("tablaPresupuesto");
  const contTotales = document.getElementById("totalesPresupuesto");

  if (!appState.lineasProyecto.length) {
    contTabla.innerHTML = `<p style="color:#666;">No hay líneas importadas.</p>`;
    contTotales.innerHTML = "";
    return;
  }

  // TABLA
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

  // CÁLCULO DESCUENTO
  const descuentoEur = subtotal * (appState.descuentoGlobal / 100);
  const baseImponible = subtotal - descuentoEur;

  // IVA
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
// BLOQUE 3 — EXPORTAR PDF + EXCEL
// ======================================

// LIBRERÍA jsPDF + autotable
// Añade esto en tu index.html si no está ya:
//
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js"></script>

// ======================================
// GENERACIÓN DEL PDF PROFESIONAL (A4 landscape)
// ======================================

async function generarPDF() {
  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4"
  });

  // --------------------------
  // CABECERA + LOGO
  // --------------------------
  const codigo = generarCodigoPresupuesto();

  pdf.addImage(LOGO_2N_BASE64, "PNG", 40, 30, 140, 60);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Presupuesto de Suministro de Videoportero IP y Control de Accesos 2N", 200, 60);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.text(`Código: ${codigo}`, 200, 80);

  // --------------------------
  // DATOS DEL PRESUPUESTO
  // --------------------------
  const d = appState.infoPresupuesto;

  pdf.setFontSize(11);
  pdf.text(`Cliente: ${d.cliente || "-"}`, 40, 120);
  pdf.text(`Proyecto / Obra: ${d.proyecto || "-"}`, 40, 140);
  pdf.text(`Dirección: ${d.direccion || "-"}`, 40, 160);
  pdf.text(`Contacto: ${d.contacto || "-"}`, 300, 120);
  pdf.text(`Email: ${d.email || "-"}`, 300, 140);
  pdf.text(`Teléfono: ${d.telefono || "-"}`, 300, 160);

  // --------------------------
  // TABLA DE LÍNEAS
  // --------------------------
  const body = appState.lineasProyecto.map(l => ([
    l.referencia,
    l.nombreTarifa,
    l.cantidad,
    l.pvp.toFixed(2) + " €",
    (l.cantidad * l.pvp).toFixed(2) + " €"
  ]));

  pdf.autoTable({
    startY: 200,
    head: [["Ref", "Descripción", "Cant.", "PVP", "Total línea"]],
    body: body,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [0, 0, 0], textColor: 255 },
  });

  let finalY = pdf.lastAutoTable.finalY + 30;

  // --------------------------
  // TOTALES
  // --------------------------
  const subtotal = appState.lineasProyecto.reduce((acc, l) => acc + l.cantidad * l.pvp, 0);
  const descEu = subtotal * (appState.descuentoGlobal / 100);
  const baseImp = subtotal - descEu;
  const iva = appState.aplicarIVA ? baseImp * 0.21 : 0;
  const total = baseImp + iva;

  pdf.setFontSize(12);
  pdf.text(`Subtotal: ${subtotal.toFixed(2)} €`, 40, finalY);
  pdf.text(`Descuento (${appState.descuentoGlobal}%): -${descEu.toFixed(2)} €`, 40, finalY + 20);
  pdf.text(`Base imponible: ${baseImp.toFixed(2)} €`, 40, finalY + 40);
  pdf.text(`IVA (21%): ${iva.toFixed(2)} €`, 300, finalY + 20);
  pdf.setFont("helvetica", "bold");
  pdf.text(`TOTAL: ${total.toFixed(2)} €`, 300, finalY + 50);
  pdf.setFont("helvetica", "normal");

  // --------------------------
  // NOTAS
  // --------------------------
  finalY += 90;
  pdf.setFontSize(11);
  pdf.text("Notas:", 40, finalY);
  pdf.setFontSize(10);
  pdf.text(d.notas || "", 40, finalY + 20);

  // --------------------------
  // CONDICIONES COMERCIALES
  // --------------------------
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
  pdf.text("Condiciones generales:", 40, finalY + 80);
  pdf.setFontSize(10);
  let y = finalY + 100;

  condiciones.forEach(c => {
    pdf.text(c, 40, y);
    y += 18;
  });

  pdf.save(`Presupuesto_${codigo}.pdf`);
}

// ======================================
// EXPORTACIÓN A EXCEL
// ======================================
function generarExcel() {
  const codigo = generarCodigoPresupuesto();

  const wb = XLSX.utils.book_new();

  // Primera hoja: líneas
  const rows = [
    ["Ref", "Descripción", "Cantidad", "PVP", "Total línea"]
  ];

  appState.lineasProyecto.forEach(l => {
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

  // Hoja totales
  const subtotal = appState.lineasProyecto.reduce((acc, l) => acc + l.cantidad * l.pvp, 0);
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
