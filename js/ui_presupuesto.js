// js/ui_presupuesto.js
// Generación del presupuesto a partir de los datos del proyecto y la tarifa

window.appState = window.appState || {};
appState.presupuesto = appState.presupuesto || {
  lineas: [],
  resumen: {},
  notas: "",
  sectionNotes: {},
  extraSections: [],
};

console.log("%cUI Presupuesto · versión DAVID-01-12", "color:#22c55e; font-weight:bold;");

// ======================================================================
// Render de la vista de PRESUPUESTO
// ======================================================================
function renderPresupuestoView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  container.innerHTML = `
    <div class="presupuesto-layout">

      <!-- COLUMNA IZQUIERDA -->
      <div class="presupuesto-left-column">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Datos del presupuesto</div>
              <div class="card-subtitle">
                Revisa los datos del proyecto, añade notas y genera el presupuesto.
              </div>
            </div>
            <span class="badge-step">Paso 2 de 3</span>
          </div>

          <div class="card-body">
            <div class="form-grid">

              <div class="form-group">
                <label>Nombre del proyecto</label>
                <input id="presuNombre" type="text" />
              </div>

              <div class="form-group">
                <label>Cliente (opcional)</label>
                <input id="presuCliente" type="text" />
              </div>

              <div class="form-group">
                <label>Fecha presupuesto</label>
                <input id="presuFecha" type="date" />
              </div>

              <div class="form-group">
                <label>Descuento global (%)</label>
                <input id="presuDto" type="number" min="0" max="90" value="0" />
              </div>

            </div>

            <div class="form-group mt-3">
              <label>Notas del presupuesto</label>
              <textarea id="presuNotas" rows="3"></textarea>
              <p style="font-size:0.78rem; color:#6b7280; margin-top:0.25rem;">
                Estas notas se usarán como observaciones generales.
              </p>
            </div>

            <button id="btnGenerarPresupuesto" class="btn btn-primary w-full mt-3">
              Generar / Recalcular presupuesto
            </button>

            <div id="presuMsg" class="alert alert-success mt-3" style="display:none;">
              Presupuesto generado correctamente
            </div>
          </div>
        </div>

        <!-- RESUMEN ECONÓMICO -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Resumen económico</div>
          </div>
          <div class="card-body" id="presuResumen">
            No se ha generado todavía el presupuesto.
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA -->
      <div class="presupuesto-right-column">
        <div class="card">
          <div class="card-header" style="display:flex; align-items:center; justify-content:space-between;">
            <div class="card-title">
              Líneas del presupuesto
              <span id="presuLineCount" style="font-size:0.8rem; color:#6b7280;">
                0 líneas cargadas desde el proyecto
              </span>
            </div>

            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span>Filtro ref:</span>
              <input id="presuFiltroRef" type="text" class="input" style="width:130px;" />
              <button id="btnAddLinea" class="btn btn-secondary">Añadir línea</button>
              <button id="btnAddSection" class="btn btn-secondary">Añadir sección</button>
            </div>

          </div>
          <div class="card-body" id="presuDetalle">No hay líneas de presupuesto generadas.</div>
        </div>
      </div>

    </div>
  `;

  document.getElementById("btnGenerarPresupuesto")?.addEventListener("click", generarPresupuesto);
  document.getElementById("btnAddSection")?.addEventListener("click", onAddManualSection);
  document.getElementById("btnAddLinea")?.addEventListener("click", () => {
    alert("Función pendiente de implementar.");
  });

  precargarDatosProyecto();
}

// ======================================================================
// Precargar datos
// ======================================================================
function precargarDatosProyecto() {
  const p = appState.proyecto || {};
  const presu = appState.presupuesto || {};

  document.getElementById("presuNombre").value = p.nombre || presu.nombre || "Proyecto sin nombre";
  document.getElementById("presuCliente").value = p.cliente || presu.cliente || "";

  document.getElementById("presuFecha").value =
    p.fecha || presu.fecha || new Date().toISOString().split("T")[0];

  document.getElementById("presuDto").value = presu.resumen?.dto || p.dto || 0;

  const notasPorDefecto = "se requiere de switch poe para alimentar los equipos";
  document.getElementById("presuNotas").value = presu.notas || p.notas || notasPorDefecto;
}

// ======================================================================
// Cargar tarifas Firestore
// ======================================================================
async function cargarTarifasDesdeFirestore() {
  const db = firebase.firestore();
  const snap = await db.collection("tarifas").doc("v1").collection("productos").get();

  const result = {};
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (!d) return;
    const ref = docSnap.id;
    const pvp = Number(d.pvp) || 0;
    if (!pvp) return;
    result[ref] = pvp;
  });

  console.log("%cTarifa cargada -> " + Object.keys(result).length, "color:#3b82f6;");
  return result;
}

// ======================================================================
// Generar presupuesto
// ======================================================================
async function generarPresupuesto() {
  const msg = document.getElementById("presuMsg");
  if (msg) msg.style.display = "none";

  const tarifas = await cargarTarifasDesdeFirestore();

  const proyecto = appState.proyecto || {};
  const lineasProyecto =
    (proyecto.lineas?.length ? proyecto.lineas : proyecto.filas) || [];

  console.log("[Presupuesto] líneas:", lineasProyecto.length);

  let lineasPresupuesto = [];
  let totalBruto = 0;

  for (const item of lineasProyecto) {
    const refCampo =
      item.ref ||
      item.referencia ||
      item.numeroPedido ||
      item["Número de pedido"];

    if (!refCampo) continue;

    const ref = String(refCampo).replace(/\s+/g, "");
    const cantidad = Number(item.cantidad || 1);

    let pvp = tarifas[ref] || 0;
    if (!pvp) continue;

    const subtotal = cantidad * pvp;
    totalBruto += subtotal;

    const seccion =
      item.seccion || item["Sección"] || item.section || "";

    const titulo =
      item.titulo || item["Título"] || item.title || "";

    const descripcion =
      item.descripcion ||
      item["Nombre del producto"] ||
      item.titulo ||
      "";

    lineasPresupuesto.push({
      ref,
      descripcion,
      cantidad,
      pvp,
      subtotal,
      seccion,
      titulo,
    });
  }

  const dto = Number(document.getElementById("presuDto").value) || 0;
  const factorDto = 1 - dto / 100;

  const totalNeto = totalBruto * factorDto;
  const notas = document.getElementById("presuNotas").value;

  appState.presupuesto = {
    lineas: lineasPresupuesto,
    resumen: { totalBruto, totalNeto, dto },
    notas,
    nombre: document.getElementById("presuNombre").value,
    cliente: document.getElementById("presuCliente").value,
    fecha: document.getElementById("presuFecha").value,
    sectionNotes: appState.presupuesto.sectionNotes || {},
    extraSections: appState.presupuesto.extraSections || [],
  };

  renderResultados(lineasPresupuesto, totalBruto, totalNeto, dto);

  if (msg) {
    msg.textContent = `Presupuesto generado: ${lineasPresupuesto.length} líneas con precio.`;
    msg.style.display = "block";
  }
}

// ======================================================================
// Añadir sección manual
// ======================================================================
function onAddManualSection() {
  const nombre = prompt("Nombre de la nueva sección:");
  if (!nombre) return;

  const titulo = prompt("Título dentro de la sección (opcional):") || "";

  const presu = appState.presupuesto;
  presu.extraSections.push({
    id: Date.now().toString(),
    seccion: nombre,
    titulo,
    nota: "",
  });

  renderResultados(
    presu.lineas,
    presu.resumen.totalBruto,
    presu.resumen.totalNeto,
    presu.resumen.dto
  );
}

// ======================================================================
// RenderResultados (DETALLE PRESUPUESTO)
// ======================================================================
function renderResultados(lineas, totalBruto, totalNeto, dto) {
  const detalle = document.getElementById("presuDetalle");
  const resumen = document.getElementById("presuResumen");

  if (!lineas?.length) {
    detalle.textContent = "No hay líneas de presupuesto generadas.";
    resumen.textContent = "No se ha generado todavía el presupuesto.";
    return;
  }

  let html = `
    <table class="table">
      <thead>
        <tr>
          <th style="width:48px;">OK</th>
          <th>Ref.</th>
          <th>Sección</th>
          <th>Descripción</th>
          <th style="width:70px;">Ud.</th>
          <th style="width:90px;">PVP</th>
          <th style="width:110px;">Importe</th>
        </tr>
      </thead>
      <tbody>
  `;

  let currentSection = null;
  let currentTitle = null;
  const notes = appState.presupuesto.sectionNotes;

  for (const l of lineas) {
    const sec = l.seccion || "Sin sección";
    const tit = l.titulo || "";

    if (sec !== currentSection) {
      currentSection = sec;
      currentTitle = null;

      html += `
        <tr>
          <td colspan="7" style="background:#eef2ff; font-weight:600;">
            ${sec}
          </td>
        </tr>
        <tr>
          <td colspan="7">
            <textarea class="section-note"
                      data-section="${sec}"
                      rows="2"
                      style="width:100%; font-size:0.78rem;">${notes[sec] || ""}</textarea>
          </td>
        </tr>
      `;
    }

    if (tit && tit !== currentTitle) {
      currentTitle = tit;
      html += `
        <tr>
          <td colspan="7" style="background:#f3f4f6; font-weight:500;">
            ${tit}
          </td>
        </tr>
      `;
    }

    // ⭐ CAMBIO ÚNICO REALIZADO: MOSTRAR LA SECCIÓN EN SU COLUMNA ⭐
    const importe = l.subtotal;

    html += `
      <tr>
        <td><input type="checkbox" checked /></td>
        <td>${l.ref}</td>
        <td>${sec}</td>   <!-- <- AQUI EL CAMBIO -->
        <td>${l.descripcion}</td>
        <td>${l.cantidad}</td>
        <td>${l.pvp.toFixed(2)} €</td>
        <td>${importe.toFixed(2)} €</td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  detalle.innerHTML = html;

  // Resumen económico
  const iva = totalNeto * 0.21;
  const totalConIva = totalNeto + iva;

  resumen.innerHTML = `
    <div class="metric-card">
      <span class="metric-label">SUBTOTAL (base imponible)</span>
      <span class="metric-value">${totalNeto.toFixed(2)} €</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">IVA 21%</span>
      <span class="metric-value">${iva.toFixed(2)} €</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">TOTAL CON IVA</span>
      <span class="metric-value">${totalConIva.toFixed(2)} €</span>
    </div>
  `;
}

console.log("%cUI Presupuesto cargado", "color:#0284c7;");
window.renderPresupuestoView = renderPresupuestoView;
