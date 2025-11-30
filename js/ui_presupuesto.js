// ===============================================
// js/ui_presupuesto.js
// Página: PRESUPUESTO (cabecera + líneas + totales)
// ===============================================

if (!window.appState) window.appState = {};
if (!appState.lineasProyecto) appState.lineasProyecto = [];
if (!appState.presupuestoCabecera) {
  appState.presupuestoCabecera = {
    cliente: "",
    proyecto: "",
    direccion: "",
    contacto: "",
    email: "",
    telefono: "",
    notas: "",
  };
}
if (!appState.presupuestoOpciones) {
  appState.presupuestoOpciones = {
    descuentoGlobal: 0,
    aplicarIVA: false,
  };
}
if (!appState.presupuestoTotales) {
  appState.presupuestoTotales = {
    subtotal: 0,
    descuento: 0,
    base: 0,
    iva: 0,
    total: 0,
  };
}

// ===============================================
// Render principal
// ===============================================
function renderPresupuesto(root) {
  // recalcular importes + totales antes de pintar
  recalcularPresupuestoCore();

  const cab = appState.presupuestoCabecera;
  const opt = appState.presupuestoOpciones;
  const tot = appState.presupuestoTotales;
  const lineas = appState.lineasProyecto || [];

  root.innerHTML = `
    <div class="presupuesto-grid">

      <!-- Columna izquierda: cabecera + opciones -->
      <div class="presupuesto-col-left">
        <div class="card">
          <h3>Presupuesto</h3>
          <p>Generador de presupuesto basado en PVP, descuento global e IVA opcional.</p>

          <h4 class="mt-3">Datos del presupuesto (cabecera)</h4>
          <div class="mt-2">
            <label>Cliente</label>
            <input type="text" id="cab_cliente" value="${cab.cliente || ""}">
          </div>
          <div class="mt-2">
            <label>Proyecto / Obra</label>
            <input type="text" id="cab_proyecto" value="${cab.proyecto || ""}">
          </div>
          <div class="mt-2">
            <label>Dirección</label>
            <input type="text" id="cab_direccion" value="${cab.direccion || ""}">
          </div>
          <div class="mt-2">
            <label>Persona de contacto</label>
            <input type="text" id="cab_contacto" value="${cab.contacto || ""}">
          </div>
          <div class="mt-2">
            <label>Email</label>
            <input type="text" id="cab_email" value="${cab.email || ""}">
          </div>
          <div class="mt-2">
            <label>Teléfono</label>
            <input type="text" id="cab_telefono" value="${cab.telefono || ""}">
          </div>
          <div class="mt-2">
            <label>Notas adicionales</label>
            <textarea id="cab_notas" rows="3">${cab.notas || ""}</textarea>
          </div>

          <div class="mt-3">
            <button id="btnGuardarCabecera" class="btn-primary">Guardar cabecera</button>
          </div>
        </div>

        <div class="card mt-3">
          <h4>Opciones de cálculo</h4>
          <div class="mt-2">
            <label>Descuento global (%)</label>
            <input type="number" id="opt_descuento" value="${opt.descuentoGlobal}" min="0" max="100" step="0.01">
          </div>
          <div class="mt-2">
            <label>
              <input type="checkbox" id="opt_iva" ${opt.aplicarIVA ? "checked" : ""}>
              Aplicar IVA (21%)
            </label>
          </div>

          <div class="mt-3">
            <div>Subtotal: ${tot.subtotal.toFixed(2)} €</div>
            <div>Descuento: ${tot.descuento.toFixed(2)} €</div>
            <div>Base imponible: ${tot.base.toFixed(2)} €</div>
            <div>IVA: ${tot.iva.toFixed(2)} €</div>
            <div><strong>Total: ${tot.total.toFixed(2)} €</strong></div>
          </div>

          <div class="mt-3">
            <button id="btnRecalcular" class="btn-secondary">Recalcular</button>
            <button id="btnExportarPDF" class="btn-secondary">Exportar PDF</button>
            <button id="btnExportarExcel" class="btn-secondary">Exportar Excel</button>
          </div>
        </div>
      </div>

      <!-- Columna derecha: líneas del presupuesto -->
      <div class="presupuesto-col-right">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h3>Líneas del presupuesto</h3>
              <p style="margin-bottom:0;">${lineas.length} líneas cargadas desde el proyecto</p>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" id="filtroRef" placeholder="Filtrar por ref..." style="width:160px;">
              <button id="btnAddSeccion" class="btn-secondary">Añadir sección</button>
              <button id="btnAddLinea" class="btn-secondary">Añadir línea</button>
            </div>
          </div>

          <div class="mt-3" style="overflow-x:auto;">
            ${renderTablaLineasPresupuesto(lineas)}
          </div>
        </div>
      </div>
    </div>
  `;

  // Eventos cabecera
  document.getElementById("btnGuardarCabecera").onclick = guardarCabeceraDesdeUI;

  // Eventos opciones
  document.getElementById("btnRecalcular").onclick = () => {
    leerOpcionesDesdeUI();
    recalcularPresupuesto();
  };
  document.getElementById("opt_descuento").onchange = () => {
    leerOpcionesDesdeUI();
    recalcularPresupuesto();
  };
  document.getElementById("opt_iva").onchange = () => {
    leerOpcionesDesdeUI();
    recalcularPresupuesto();
  };

  // Export (placeholder, enlaza con tus funciones reales si las tienes)
  document.getElementById("btnExportarPDF").onclick = () => {
    if (window.exportarPresupuestoPDF) {
      exportarPresupuestoPDF();
    } else {
      alert("Función PDF aún no conectada.");
    }
  };
  document.getElementById("btnExportarExcel").onclick = () => {
    if (window.exportarPresupuestoExcel) {
      exportarPresupuestoExcel();
    } else {
      alert("Función Excel aún no conectada.");
    }
  };

  // Filtro
  const filtroRefInput = document.getElementById("filtroRef");
  filtroRefInput.oninput = () => {
    const val = filtroRefInput.value.trim().toLowerCase();
    const filas = document.querySelectorAll(".fila-presupuesto");
    filas.forEach((tr) => {
      const ref = (tr.getAttribute("data-ref") || "").toLowerCase();
      tr.style.display = !val || ref.includes(val) ? "" : "none";
    });
  };

  // Añadir sección / línea (versión simple)
  document.getElementById("btnAddSeccion").onclick = () => {
    const titulo = prompt("Título de la sección:");
    if (!titulo) return;
    appState.lineasProyecto.push({
      ref: "",
      descripcion: "",
      seccion: titulo.toUpperCase(),
      cantidad: 0,
      pvp: 0,
      importe: 0,
      ok: true,
    });
    recalcularPresupuesto();
  };

  document.getElementById("btnAddLinea").onclick = () => {
    appState.lineasProyecto.push({
      ref: "",
      descripcion: "",
      seccion: "NUEVA SECCIÓN",
      cantidad: 1,
      pvp: 0,
      importe: 0,
      ok: true,
    });
    recalcularPresupuesto();
  };

  // Eventos de edición en la tabla
  enlazarEventosTabla();
}

// Render de la tabla
function renderTablaLineasPresupuesto(lineas) {
  if (!lineas || !lineas.length) {
    return `<p>No hay líneas cargadas. Importa un proyecto desde la pestaña Proyecto.</p>`;
  }

  let html = `
    <table class="table-presupuesto">
      <thead>
        <tr>
          <th>OK</th>
          <th>Ref.</th>
          <th>Sección</th>
          <th>Descripción</th>
          <th class="text-right">Ud.</th>
          <th class="text-right">PVP</th>
          <th class="text-right">Importe</th>
        </tr>
      </thead>
      <tbody>
  `;

  lineas.forEach((l, idx) => {
    html += `
      <tr class="fila-presupuesto" data-index="${idx}" data-ref="${l.ref || ""}">
        <td>
          <input type="checkbox" class="ln_ok" ${l.ok !== false ? "checked" : ""}>
        </td>
        <td>
          <input type="text" class="ln_ref" value="${l.ref || ""}" style="width:90px;">
        </td>
        <td>
          <input type="text" class="ln_seccion" value="${l.seccion || ""}" style="width:140px;">
        </td>
        <td>
          <input type="text" class="ln_desc" value="${l.descripcion || ""}" style="width:100%;">
        </td>
        <td class="text-right">
          <input type="number" class="ln_cant" min="0" step="1" value="${l.cantidad || 1}" style="width:60px;">
        </td>
        <td class="text-right">
          <input type="number" class="ln_pvp" step="0.01" value="${l.pvp || 0}" style="width:90px;">
        </td>
        <td class="text-right">
          ${Number(l.importe || 0).toFixed(2)} €
        </td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;
  return html;
}

// Leer cabecera desde UI
function guardarCabeceraDesdeUI() {
  const cab = appState.presupuestoCabecera;
  cab.cliente = document.getElementById("cab_cliente").value.trim();
  cab.proyecto = document.getElementById("cab_proyecto").value.trim();
  cab.direccion = document.getElementById("cab_direccion").value.trim();
  cab.contacto = document.getElementById("cab_contacto").value.trim();
  cab.email = document.getElementById("cab_email").value.trim();
  cab.telefono = document.getElementById("cab_telefono").value.trim();
  cab.notas = document.getElementById("cab_notas").value.trim();

  alert("Cabecera guardada (en memoria local de la app).");
}

// Leer opciones desde UI
function leerOpcionesDesdeUI() {
  const opt = appState.presupuestoOpciones;
  const d = parseFloat(document.getElementById("opt_descuento").value.replace(",", "."));
  opt.descuentoGlobal = isNaN(d) ? 0 : d;
  opt.aplicarIVA = document.getElementById("opt_iva").checked;
}

// Recalcular importes y totales (núcleo)
function recalcularPresupuestoCore() {
  const lineas = appState.lineasProyecto || [];
  const opt = appState.presupuestoOpciones;
  const tot = appState.presupuestoTotales;

  let subtotal = 0;

  lineas.forEach((l) => {
    // aplicar tarifa si existe
    if (l.ref && window.findTarifaItem) {
      const t = findTarifaItem(l.ref);
      if (t) {
        if (!l.pvp || l.pvp === 0) l.pvp = t.pvp || 0;
        if (!l.descripcion) l.descripcion = t.descripcion || l.descripcion;
      }
    }

    const cant = Number(l.cantidad || 1);
    const pvp = Number(l.pvp || 0);
    const importe = (l.ok !== false ? cant * pvp : 0);
    l.importe = importe;
    subtotal += importe;
  });

  const descuento = subtotal * (opt.descuentoGlobal / 100);
  const base = subtotal - descuento;
  const iva = opt.aplicarIVA ? base * 0.21 : 0;
  const total = base + iva;

  tot.subtotal = subtotal;
  tot.descuento = descuento;
  tot.base = base;
  tot.iva = iva;
  tot.total = total;
}

// Recalcular y repintar
function recalcularPresupuesto() {
  recalcularPresupuestoCore();
  const root = document.getElementById("shellContent");
  if (root) renderPresupuesto(root);
}

// Enlazar eventos de la tabla (edición inline)
function enlazarEventosTabla() {
  const filas = document.querySelectorAll(".fila-presupuesto");
  filas.forEach((tr) => {
    const idx = Number(tr.getAttribute("data-index"));
    const linea = appState.lineasProyecto[idx];

    const ck = tr.querySelector(".ln_ok");
    const refInput = tr.querySelector(".ln_ref");
    const secInput = tr.querySelector(".ln_seccion");
    const descInput = tr.querySelector(".ln_desc");
    const cantInput = tr.querySelector(".ln_cant");
    const pvpInput = tr.querySelector(".ln_pvp");

    ck.onchange = () => {
      linea.ok = ck.checked;
      recalcularPresupuesto();
    };
    refInput.onchange = () => {
      linea.ref = refInput.value.trim();
      recalcularPresupuesto();
    };
    secInput.onchange = () => {
      linea.seccion = secInput.value.trim();
    };
    descInput.onchange = () => {
      linea.descripcion = descInput.value.trim();
    };
    cantInput.onchange = () => {
      linea.cantidad = Number(cantInput.value || 1);
      recalcularPresupuesto();
    };
    pvpInput.onchange = () => {
      linea.pvp = Number(pvpInput.value || 0);
      recalcularPresupuesto();
    };
  });
}

// Expose
window.renderPresupuesto = renderPresupuesto;
window.recalcularPresupuesto = recalcularPresupuesto;
