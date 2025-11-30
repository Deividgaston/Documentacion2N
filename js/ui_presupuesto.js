// js/ui_presupuesto.js
// Página PRESUPUESTO – cabecera, opciones, líneas, totales

function renderPresupuesto(root) {
  // asegurar tarifas cargadas para todas las refs actuales
  const refs = [...new Set((appState.lineasProyecto || []).map(l => l.ref).filter(Boolean))];
  if (refs.length && window.loadTarifasForRefs) {
    // no await para no bloquear UI: se recalcualará al siguiente render
    loadTarifasForRefs(refs).then(() => {
      recalcularPresupuestoCore();
      pintarPresupuesto(root);
    });
  }

  recalcularPresupuestoCore();
  pintarPresupuesto(root);
}

function pintarPresupuesto(root) {
  const cab = appState.presupuestoCabecera;
  const opt = appState.presupuestoOpciones;
  const tot = appState.presupuestoTotales;
  const lineas = appState.lineasProyecto || [];

  root.innerHTML = `
    <h2 class="page-title">Presupuesto</h2>
    <p class="page-subtitle">
      Generador de presupuesto basado en PVP, descuento global e IVA opcional.
    </p>

    <div class="presupuesto-grid">
      <div class="presupuesto-col-left">
        <div class="card">
          <h3>Datos del presupuesto</h3>

          <div class="mt-2">
            <label>Cliente</label>
            <input id="cab_cliente" type="text" value="${cab.cliente || ""}">
          </div>
          <div class="mt-2">
            <label>Proyecto / Obra</label>
            <input id="cab_proyecto" type="text" value="${cab.proyecto || ""}">
          </div>
          <div class="mt-2">
            <label>Dirección</label>
            <input id="cab_direccion" type="text" value="${cab.direccion || ""}">
          </div>
          <div class="mt-2">
            <label>Persona de contacto</label>
            <input id="cab_contacto" type="text" value="${cab.contacto || ""}">
          </div>
          <div class="mt-2">
            <label>Email</label>
            <input id="cab_email" type="text" value="${cab.email || ""}">
          </div>
          <div class="mt-2">
            <label>Teléfono</label>
            <input id="cab_telefono" type="text" value="${cab.telefono || ""}">
          </div>
          <div class="mt-2">
            <label>Notas adicionales</label>
            <textarea id="cab_notas" rows="3">${cab.notas || ""}</textarea>
          </div>

          <button id="btnGuardarCabecera" class="btn-primary mt-3">Guardar cabecera</button>
        </div>

        <div class="card mt-3">
          <h3>Opciones de cálculo</h3>
          <div class="mt-2">
            <label>Descuento global (%)</label>
            <input id="opt_descuento" type="number" min="0" max="100" step="0.01"
              value="${opt.descuentoGlobal}">
          </div>
          <div class="mt-2">
            <label>
              <input id="opt_iva" type="checkbox" ${opt.aplicarIVA ? "checked" : ""}>
              Aplicar IVA (21%)
            </label>
          </div>

          <div class="mt-3">
            <div>Subtotal: ${formatoEUR(tot.subtotal)}</div>
            <div>Descuento: ${formatoEUR(tot.descuento)}</div>
            <div>Base imponible: ${formatoEUR(tot.base)}</div>
            <div>IVA: ${formatoEUR(tot.iva)}</div>
            <div><strong>Total: ${formatoEUR(tot.total)}</strong></div>
          </div>

          <div class="mt-3">
            <button id="btnRecalcular" class="btn-secondary">Recalcular</button>
            <button id="btnExportarPDF" class="btn-secondary">Exportar PDF</button>
            <button id="btnExportarExcel" class="btn-secondary">Exportar Excel</button>
          </div>
        </div>
      </div>

      <div class="presupuesto-col-right">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h3>Líneas del presupuesto</h3>
              <p class="page-subtitle" style="margin-bottom:0;">
                ${lineas.length} líneas cargadas desde el proyecto
              </p>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <input id="filtroRef" type="text" placeholder="Filtrar ref..." style="width:150px;">
              <button id="btnAddSeccion" class="btn-secondary">Añadir sección</button>
              <button id="btnAddLinea" class="btn-secondary">Añadir línea</button>
            </div>
          </div>

          <div class="mt-3" style="overflow-x:auto;">
            ${renderTablaLineas(lineas)}
          </div>
        </div>
      </div>
    </div>
  `;

  enlazarEventosPresupuesto();
}

function renderTablaLineas(lineas) {
  if (!lineas.length) {
    return `<p>No hay líneas cargadas. Importa un proyecto desde la pestaña Proyecto.</p>`;
  }

  let html = `
    <table class="table-presupuesto">
      <thead>
        <tr>
          <th>OK</th>
          <th>Sección</th>
          <th>Ref.</th>
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
        <td><input type="checkbox" class="ln_ok" ${l.ok !== false ? "checked" : ""}></td>
        <td><input type="text" class="ln_seccion" value="${l.seccion || ""}" style="width:140px;"></td>
        <td><input type="text" class="ln_ref" value="${l.ref || ""}" style="width:90px;"></td>
        <td><input type="text" class="ln_desc" value="${l.descripcion || ""}" style="width:100%;"></td>
        <td class="text-right"><input type="number" class="ln_cant" min="0" step="1"
          value="${l.cantidad || 1}" style="width:60px;text-align:right;"></td>
        <td class="text-right"><input type="number" class="ln_pvp" step="0.01"
          value="${l.pvp || 0}" style="width:80px;text-align:right;"></td>
        <td class="text-right">${formatoEUR(l.importe || 0)}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  return html;
}

function enlazarEventosPresupuesto() {
  // Cabecera
  document.getElementById("btnGuardarCabecera").onclick = () => {
    const cab = appState.presupuestoCabecera;
    cab.cliente = document.getElementById("cab_cliente").value.trim();
    cab.proyecto = document.getElementById("cab_proyecto").value.trim();
    cab.direccion = document.getElementById("cab_direccion").value.trim();
    cab.contacto = document.getElementById("cab_contacto").value.trim();
    cab.email = document.getElementById("cab_email").value.trim();
    cab.telefono = document.getElementById("cab_telefono").value.trim();
    cab.notas = document.getElementById("cab_notas").value.trim();
    alert("Cabecera guardada (en memoria de la app).");
  };

  // Opciones
  document.getElementById("btnRecalcular").onclick = () => {
    leerOpcionesDesdeUI();
    renderPresupuesto(document.getElementById("shellContent"));
  };
  document.getElementById("opt_descuento").onchange =
    document.getElementById("opt_iva").onchange =
      () => {
        leerOpcionesDesdeUI();
        renderPresupuesto(document.getElementById("shellContent"));
      };

  // Export
  document.getElementById("btnExportarPDF").onclick = () => {
    if (window.exportarPresupuestoPDF) exportarPresupuestoPDF();
    else alert("Función PDF aún no implementada.");
  };
  document.getElementById("btnExportarExcel").onclick = () => {
    if (window.exportarPresupuestoExcel) exportarPresupuestoExcel();
    else alert("Función Excel aún no implementada.");
  };

  // Filtro
  const filtro = document.getElementById("filtroRef");
  filtro.oninput = () => {
    const val = filtro.value.trim().toLowerCase();
    document.querySelectorAll(".fila-presupuesto").forEach(tr => {
      const ref = (tr.getAttribute("data-ref") || "").toLowerCase();
      tr.style.display = !val || ref.includes(val) ? "" : "none";
    });
  };

  // Añadir sección / línea
  document.getElementById("btnAddSeccion").onclick = () => {
    const titulo = prompt("Título de la nueva sección:");
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
    renderPresupuesto(document.getElementById("shellContent"));
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
    renderPresupuesto(document.getElementById("shellContent"));
  };

  // Edición de filas
  document.querySelectorAll(".fila-presupuesto").forEach(tr => {
    const idx = Number(tr.getAttribute("data-index"));
    const linea = appState.lineasProyecto[idx];

    const ck = tr.querySelector(".ln_ok");
    const sec = tr.querySelector(".ln_seccion");
    const ref = tr.querySelector(".ln_ref");
    const desc = tr.querySelector(".ln_desc");
    const cant = tr.querySelector(".ln_cant");
    const pvp = tr.querySelector(".ln_pvp");

    ck.onchange = () => { linea.ok = ck.checked; renderPresupuesto(document.getElementById("shellContent")); };
    sec.onchange = () => { linea.seccion = sec.value.trim(); };
    ref.onchange = () => { linea.ref = ref.value.trim(); renderPresupuesto(document.getElementById("shellContent")); };
    desc.onchange = () => { linea.descripcion = desc.value.trim(); };
    cant.onchange = () => { linea.cantidad = Number(cant.value || 1); renderPresupuesto(document.getElementById("shellContent")); };
    pvp.onchange = () => { linea.pvp = Number(pvp.value || 0); renderPresupuesto(document.getElementById("shellContent")); };
  });
}

function leerOpcionesDesdeUI() {
  const opt = appState.presupuestoOpciones;
  const d = parseFloat(document.getElementById("opt_descuento").value.replace(",", "."));
  opt.descuentoGlobal = isNaN(d) ? 0 : d;
  opt.aplicarIVA = document.getElementById("opt_iva").checked;
}

function recalcularPresupuestoCore() {
  const lineas = appState.lineasProyecto || [];
  const opt = appState.presupuestoOpciones;
  const tot = appState.presupuestoTotales;

  let subtotal = 0;

  lineas.forEach(l => {
    if (l.ref && window.findTarifaItem) {
      const t = findTarifaItem(l.ref);
      if (t) {
        if (!l.pvp || l.pvp === 0) l.pvp = t.pvp || 0;
        if (!l.descripcion) l.descripcion = t.descripcion || l.descripcion;
      }
    }
    const cant = Number(l.cantidad || 1);
    const pvp = Number(l.pvp || 0);
    l.importe = (l.ok !== false) ? cant * pvp : 0;
    subtotal += l.importe;
  });

  const desc = subtotal * (opt.descuentoGlobal / 100);
  const base = subtotal - desc;
  const iva = opt.aplicarIVA ? base * 0.21 : 0;
  const total = base + iva;

  tot.subtotal = subtotal;
  tot.descuento = desc;
  tot.base = base;
  tot.iva = iva;
  tot.total = total;
}

window.renderPresupuesto = renderPresupuesto;
