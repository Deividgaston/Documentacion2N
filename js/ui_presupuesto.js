// js/ui_presupuesto.js
// Pantalla de presupuesto + cálculo con secciones editables y líneas manuales

if (!window.appState) {
  window.appState = {};
}
if (!appState.infoPresupuesto) {
  appState.infoPresupuesto = {
    cliente: "",
    proyecto: "",
    direccion: "",
    contacto: "",
    email: "",
    telefono: "",
    notas:
      "Para la alimentación de los equipos se requiere de un switch PoE acorde con el consumo de los dispositivos."
  };
}
if (!Array.isArray(appState.lineasProyecto)) {
  appState.lineasProyecto = [];
}
if (typeof appState.descuentoGlobal !== "number") {
  appState.descuentoGlobal = 0;
}
if (typeof appState.aplicarIVA !== "boolean") {
  appState.aplicarIVA = false;
}
if (!appState.tarifas) {
  appState.tarifas = {};
}

// Usamos toNum y formatCurrency de utils.js

function getLineasSeleccionadas() {
  return (appState.lineasProyecto || []).filter((l) => l.incluir !== false);
}

function findTarifaItem(ref) {
  if (!ref) return null;
  let t = null;
  if (appState.tarifas && appState.tarifas[ref]) {
    t = appState.tarifas[ref];
  }
  if (!t && typeof tarifasCache !== "undefined" && tarifasCache && tarifasCache[ref]) {
    t = tarifasCache[ref];
  }
  return t || null;
}

let modalSeccionEl = null;
let modalLineaManualEl = null;

function renderPresupuesto(container) {
  container.innerHTML = `
    <div class="page-header-row">
      <div>
        <div class="page-title">Presupuesto</div>
        <div class="page-subtitle">
          Generador de presupuesto basado en PVP, descuento global e IVA opcional.
        </div>
      </div>
      <div id="summaryChip" class="summary-chip hidden"></div>
    </div>

    <div class="layout-presupuesto">
      <!-- COLUMNA IZQUIERDA -->
      <div class="col-left">
        <div class="card">
          <div class="card-header-row">
            <span class="card-header">Datos del presupuesto</span>
            <span class="badge-light">Cabecera</span>
          </div>

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
              <label>Email</label>
              <input type="text" id="p_email" class="input" value="${appState.infoPresupuesto.email}">
            </div>
            <div>
              <label>Teléfono</label>
              <input type="text" id="p_telefono" class="input" value="${appState.infoPresupuesto.telefono}">
            </div>
          </div>

          <div style="margin-top:10px;">
            <label>Notas adicionales</label>
            <textarea id="p_notas" class="input textarea-notas">${appState.infoPresupuesto.notas}</textarea>
          </div>

          <button class="btn btn-blue btn-full" style="margin-top:12px;" id="btnGuardarDatos">
            Guardar cabecera
          </button>
        </div>

        <div class="card card-soft">
          <div class="card-header-row">
            <span class="card-header">Opciones de cálculo</span>
            <span class="badge-light">Totales</span>
          </div>

          <div class="form-row" style="margin-bottom:8px;">
            <div style="flex:1;">
              <label>Descuento global (%)</label>
              <input type="number" id="p_descuentoGlobal" class="input" value="${appState.descuentoGlobal}">
            </div>
            <label style="display:flex; align-items:center; gap:6px; margin-top:22px; font-size:0.8rem;">
              <input type="checkbox" id="p_aplicarIVA" ${appState.aplicarIVA ? "checked" : ""} />
              Aplicar IVA (21%)
            </label>
          </div>

          <div class="totales-box" id="totalesBox"></div>

          <div style="display:flex; gap:8px; margin-top:12px;">
            <button class="btn btn-outline btn-sm" id="btnRecalcular">Recalcular</button>
            <button class="btn btn-outline btn-sm" id="btnPDF">Exportar PDF</button>
            <button class="btn btn-outline btn-sm" id="btnExcel">Exportar Excel</button>
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA -->
      <div class="col-right">
        <div class="card card-table">
          <div class="table-header-actions">
            <div class="table-header-title">
              Líneas del presupuesto
              <span class="badge-light" id="linesInfo"></span>
            </div>
            <div class="table-actions" style="gap:8px;">
              <label>
                Filtro ref:
                <input type="text" id="filtroRef" class="input" style="width:140px; padding:4px 8px; font-size:0.75rem;">
              </label>
              <button class="btn btn-outline btn-sm" id="btnAddManual">
                Añadir línea
              </button>
            </div>
          </div>

          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th class="col-check">OK</th>
                  <th class="col-ref">Ref.</th>
                  <th>Sección</th>
                  <th>Descripción</th>
                  <th>Ud.</th>
                  <th>PVP</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody id="tbodyPresupuesto"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  setupPresupuestoModalSeccion(container);
  setupManualLineaModal(container);

  if (!appState.lineasProyecto || !appState.lineasProyecto.length) {
    const tbody = document.getElementById("tbodyPresupuesto");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="font-size:0.85rem; color:#6b7280; padding:10px;">
            No hay líneas de proyecto cargadas. Importa primero un Excel en la pestaña <strong>Proyecto</strong>
            o añade líneas manuales.
          </td>
        </tr>
      `;
    }
  } else {
    rebuildPresupuestoTable();
  }

  document.getElementById("btnGuardarDatos").onclick = () => {
    appState.infoPresupuesto.cliente = document.getElementById("p_cliente").value.trim();
    appState.infoPresupuesto.proyecto = document.getElementById("p_proyecto").value.trim();
    appState.infoPresupuesto.direccion = document.getElementById("p_direccion").value.trim();
    appState.infoPresupuesto.contacto = document.getElementById("p_contacto").value.trim();
    appState.infoPresupuesto.email = document.getElementById("p_email").value.trim();
    appState.infoPresupuesto.telefono = document.getElementById("p_telefono").value.trim();
    appState.infoPresupuesto.notas = document.getElementById("p_notas").value;
  };

  const inDesc = document.getElementById("p_descuentoGlobal");
  const cbIVA = document.getElementById("p_aplicarIVA");

  inDesc.onchange = () => {
    appState.descuentoGlobal = toNum(inDesc.value);
    recalcularPresupuesto();
  };

  cbIVA.onchange = () => {
    appState.aplicarIVA = cbIVA.checked;
    recalcularPresupuesto();
  };

  document.getElementById("btnRecalcular").onclick = () => recalcularPresupuesto();

  document.getElementById("btnPDF").onclick = () => {
    if (typeof generarPDF === "function") generarPDF();
  };
  document.getElementById("btnExcel").onclick = () => {
    if (typeof generarExcel === "function") generarExcel();
  };

  const filtroRef = document.getElementById("filtroRef");
  filtroRef.oninput = () => {
    rebuildPresupuestoTable(filtroRef.value.trim().toLowerCase());
  };

  document.getElementById("btnAddManual").onclick = () => openManualLineaModalForNew();

  recalcularPresupuesto();
}

/* ========== MODAL SECCIÓN ========== */

function setupPresupuestoModalSeccion(container) {
  if (container.querySelector("#modalSeccion")) {
    modalSeccionEl = container.querySelector("#modalSeccion");
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "modalSeccion";
  overlay.className = "modal-overlay hidden";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Editar sección del presupuesto</div>
        <button class="modal-close" id="modalSeccionCerrarBtn" title="Cerrar">&times;</button>
      </div>
      <div class="modal-body">
        <div>
          <div class="field-label">Título de la sección</div>
          <input type="text" id="modal_seccion_titulo" class="input" placeholder="Ej. Unidades de respuesta / MONITORES">
        </div>
        <div>
          <div class="field-label">Comentario de la sección</div>
          <textarea id="modal_seccion_comentario" class="input textarea-notas" placeholder="Texto que aparecerá debajo del título de la sección."></textarea>
        </div>
        <p class="info-text">
          Al guardar, se actualizarán todas las líneas que pertenezcan a esta sección.
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline btn-sm" id="modalSeccionCancelar">Cancelar</button>
        <button class="btn btn-blue btn-sm" id="modalSeccionGuardar">Guardar sección</button>
      </div>
    </div>
  `;

  container.appendChild(overlay);
  modalSeccionEl = overlay;

  modalSeccionEl.querySelector("#modalSeccionCerrarBtn").onclick = closeSeccionModal;
  modalSeccionEl.querySelector("#modalSeccionCancelar").onclick = closeSeccionModal;
  modalSeccionEl.querySelector("#modalSeccionGuardar").onclick = saveSeccionModal;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSeccionModal();
  });
}

function openSeccionModal(seccionKey) {
  if (!modalSeccionEl) return;

  const lines = appState.lineasProyecto || [];
  const lineaEjemplo = lines.find(
    (l) => (l.seccion || "SIN SECCIÓN").trim() === seccionKey
  );
  const nota = lineaEjemplo ? (lineaEjemplo.seccionNota || "") : "";

  modalSeccionEl.dataset.seccionKey = seccionKey;
  modalSeccionEl.querySelector("#modal_seccion_titulo").value =
    seccionKey === "SIN SECCIÓN" ? "" : seccionKey;
  modalSeccionEl.querySelector("#modal_seccion_comentario").value = nota;

  modalSeccionEl.classList.remove("hidden");
}

function closeSeccionModal() {
  if (!modalSeccionEl) return;
  modalSeccionEl.classList.add("hidden");
  modalSeccionEl.dataset.seccionKey = "";
}

function saveSeccionModal() {
  if (!modalSeccionEl) return;
  const oldKey = modalSeccionEl.dataset.seccionKey;
  if (!oldKey) {
    closeSeccionModal();
    return;
  }

  const nuevoTitulo = (modalSeccionEl.querySelector("#modal_seccion_titulo").value || "").trim();
  const nuevoComentario =
    modalSeccionEl.querySelector("#modal_seccion_comentario").value || "";

  const tituloFinal = nuevoTitulo || "SIN SECCIÓN";

  const lines = appState.lineasProyecto || [];
  lines.forEach((l) => {
    const keyLinea = (l.seccion || "SIN SECCIÓN").trim();
    if (keyLinea === oldKey) {
      l.seccion = tituloFinal === "SIN SECCIÓN" ? "" : tituloFinal;
      l.seccionNota = nuevoComentario;
    }
  });

  closeSeccionModal();

  const filtroRef = document.getElementById("filtroRef");
  const filtro = filtroRef ? filtroRef.value.trim().toLowerCase() : "";
  rebuildPresupuestoTable(filtro);
}

/* ========== MODAL LÍNEA MANUAL ========== */

function setupManualLineaModal(container) {
  if (container.querySelector("#modalLineaManual")) {
    modalLineaManualEl = container.querySelector("#modalLineaManual");
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "modalLineaManual";
  overlay.className = "modal-overlay hidden";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Línea manual de presupuesto</div>
        <button class="modal-close" id="modalLineaManualCerrarBtn" title="Cerrar">&times;</button>
      </div>
      <div class="modal-body">
        <div>
          <div class="field-label">Sección</div>
          <input type="text" id="modalManual_seccion" class="input" placeholder="Ej. Unidades de respuesta / MONITORES">
        </div>
        <div>
          <div class="field-label">Referencia (opcional)</div>
          <input type="text" id="modalManual_ref" class="input" placeholder="Código 2N o referencia propia">
        </div>
        <div>
          <div class="field-label">Descripción</div>
          <input type="text" id="modalManual_desc" class="input" placeholder="Descripción del concepto">
        </div>
        <div class="form-grid">
          <div>
            <div class="field-label">Unidades</div>
            <input type="number" id="modalManual_ud" class="input" min="0" step="1" value="1">
          </div>
          <div>
            <div class="field-label">PVP (€)</div>
            <input type="number" id="modalManual_pvp" class="input" min="0" step="0.01" value="0">
          </div>
        </div>
        <label style="display:flex; align-items:center; gap:8px; margin-top:4px; font-size:0.8rem;">
          <input type="checkbox" id="modalManual_incluir" checked>
          Incluir esta línea en el presupuesto
        </label>
        <p class="info-text" style="margin-top:6px;">
          Estas líneas manuales no se guardan en ninguna base de datos. Solo existen en este presupuesto mientras tengas la aplicación abierta.
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline btn-sm" id="modalManualCancelar">Cancelar</button>
        <button class="btn btn-blue btn-sm" id="modalManualGuardar">Guardar línea</button>
      </div>
    </div>
  `;

  container.appendChild(overlay);
  modalLineaManualEl = overlay;

  modalLineaManualEl.querySelector("#modalLineaManualCerrarBtn").onclick = closeManualLineaModal;
  modalLineaManualEl.querySelector("#modalManualCancelar").onclick = closeManualLineaModal;
  modalLineaManualEl.querySelector("#modalManualGuardar").onclick = saveManualLineaModal;

  const refInput = modalLineaManualEl.querySelector("#modalManual_ref");
  const descInput = modalLineaManualEl.querySelector("#modalManual_desc");
  const pvpInput = modalLineaManualEl.querySelector("#modalManual_pvp");

  refInput.addEventListener("change", () => {
    const ref = refInput.value.trim();
    const item = findTarifaItem(ref);
    if (item) {
      if (!descInput.value.trim() && item.descripcion) {
        descInput.value = item.descripcion;
      }
      const precio = item.pvp ?? item.PVP ?? item.precio;
      if (precio != null && (!pvpInput.value || Number(pvpInput.value) === 0)) {
        pvpInput.value = Number(precio);
      }
    }
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeManualLineaModal();
  });
}

function openManualLineaModalForNew() {
  if (!modalLineaManualEl) return;
  modalLineaManualEl.dataset.mode = "new";
  modalLineaManualEl.dataset.index = "";

  modalLineaManualEl.querySelector("#modalManual_seccion").value = "";
  modalLineaManualEl.querySelector("#modalManual_ref").value = "";
  modalLineaManualEl.querySelector("#modalManual_desc").value = "";
  modalLineaManualEl.querySelector("#modalManual_ud").value = "1";
  modalLineaManualEl.querySelector("#modalManual_pvp").value = "0";
  modalLineaManualEl.querySelector("#modalManual_incluir").checked = true;

  modalLineaManualEl.classList.remove("hidden");
}

function openManualLineaModalForEdit(index) {
  if (!modalLineaManualEl) return;
  const linea = appState.lineasProyecto[index];
  if (!linea || !linea.manual) return;

  modalLineaManualEl.dataset.mode = "edit";
  modalLineaManualEl.dataset.index = String(index);

  modalLineaManualEl.querySelector("#modalManual_seccion").value = linea.seccion || "";
  modalLineaManualEl.querySelector("#modalManual_ref").value = linea.ref || "";
  modalLineaManualEl.querySelector("#modalManual_desc").value = linea.descripcion || "";
  modalLineaManualEl.querySelector("#modalManual_ud").value = Number(linea.cantidad) || 0;
  modalLineaManualEl.querySelector("#modalManual_pvp").value = Number(linea.pvp) || 0;
  modalLineaManualEl.querySelector("#modalManual_incluir").checked = linea.incluir !== false;

  modalLineaManualEl.classList.remove("hidden");
}

function closeManualLineaModal() {
  if (!modalLineaManualEl) return;
  modalLineaManualEl.classList.add("hidden");
  modalLineaManualEl.dataset.mode = "";
  modalLineaManualEl.dataset.index = "";
}

function saveManualLineaModal() {
  if (!modalLineaManualEl) return;

  const mode = modalLineaManualEl.dataset.mode || "new";
  const idxStr = modalLineaManualEl.dataset.index;

  const seccion = (modalLineaManualEl.querySelector("#modalManual_seccion").value || "").trim();
  const ref = (modalLineaManualEl.querySelector("#modalManual_ref").value || "").trim();
  const desc = (modalLineaManualEl.querySelector("#modalManual_desc").value || "").trim();
  let ud = toNum(modalLineaManualEl.querySelector("#modalManual_ud").value);
  const pvp = toNum(modalLineaManualEl.querySelector("#modalManual_pvp").value);
  const incluir = modalLineaManualEl.querySelector("#modalManual_incluir").checked;

  if (!ud || ud < 0) ud = 1;

  if (mode === "new") {
    const nuevaLinea = {
      ref,
      descripcion: desc,
      cantidad: ud,
      pvp,
      incluir,
      seccion,
      manual: true
    };
    appState.lineasProyecto.push(nuevaLinea);
  } else if (mode === "edit" && idxStr !== undefined && idxStr !== "") {
    const index = Number(idxStr);
    const linea = appState.lineasProyecto[index];
    if (linea && linea.manual) {
      linea.ref = ref;
      linea.descripcion = desc;
      linea.cantidad = ud;
      linea.pvp = pvp;
      linea.incluir = incluir;
      linea.seccion = seccion;
    }
  }

  closeManualLineaModal();

  const filtroRef = document.getElementById("filtroRef");
  const filtro = filtroRef ? filtroRef.value.trim().toLowerCase() : "";
  rebuildPresupuestoTable(filtro);
  recalcularPresupuesto();
}

/* ========== REORDENAR SECCIONES ========== */

function moveSection(seccionKey, direction) {
  const lines = appState.lineasProyecto || [];
  if (!lines.length) return;

  const sections = [];
  lines.forEach((l) => {
    const key = (l.seccion || "SIN SECCIÓN").trim();
    if (!sections.includes(key)) sections.push(key);
  });

  const idx = sections.indexOf(seccionKey);
  if (idx === -1) return;

  const newIndex = idx + direction;
  if (newIndex < 0 || newIndex >= sections.length) return;

  const tmp = sections[idx];
  sections[idx] = sections[newIndex];
  sections[newIndex] = tmp;

  const newLines = [];
  sections.forEach((sec) => {
    lines.forEach((l) => {
      const key = (l.seccion || "SIN SECCIÓN").trim();
      if (key === sec) newLines.push(l);
    });
  });

  appState.lineasProyecto = newLines;

  const filtroRef = document.getElementById("filtroRef");
  const filtro = filtroRef ? filtroRef.value.trim().toLowerCase() : "";
  rebuildPresupuestoTable(filtro);
}

/* ========== TABLA + TOTALES ========== */

function rebuildPresupuestoTable(filtroRefTexto) {
  const tbody = document.getElementById("tbodyPresupuesto");
  if (!tbody) return;

  const lines = appState.lineasProyecto || [];
  const filtro = (filtroRefTexto || "").toLowerCase();

  tbody.innerHTML = "";

  const items = [];
  lines.forEach((linea, idx) => {
    const refLower = (linea.ref || "").toLowerCase();
    if (filtro && !refLower.includes(filtro)) return;
    items.push({ linea, idx });
  });

  let lastSeccionKey = null;

  items.forEach(({ linea, idx }) => {
    const seccionKey = (linea.seccion || "SIN SECCIÓN").trim();

    if (seccionKey !== lastSeccionKey) {
      const trSec = document.createElement("tr");
      trSec.className = "section-row";
      trSec.onclick = (e) => {
        e.stopPropagation();
        openSeccionModal(seccionKey);
      };

      const tdSec = document.createElement("td");
      tdSec.colSpan = 7;

      const headerRow = document.createElement("div");
      headerRow.style.display = "flex";
      headerRow.style.justifyContent = "space-between";
      headerRow.style.alignItems = "center";
      headerRow.style.gap = "8px";

      const divTitulo = document.createElement("div");
      divTitulo.textContent = seccionKey;

      const controls = document.createElement("div");
      controls.style.display = "flex";
      controls.style.gap = "4px";

      const btnUp = document.createElement("button");
      btnUp.textContent = "↑";
      btnUp.title = "Subir sección";
      btnUp.style.border = "none";
      btnUp.style.background = "transparent";
      btnUp.style.cursor = "pointer";
      btnUp.style.fontSize = "0.75rem";
      btnUp.onclick = (e) => {
        e.stopPropagation();
        moveSection(seccionKey, -1);
      };

      const btnDown = document.createElement("button");
      btnDown.textContent = "↓";
      btnDown.title = "Bajar sección";
      btnDown.style.border = "none";
      btnDown.style.background = "transparent";
      btnDown.style.cursor = "pointer";
      btnDown.style.fontSize = "0.75rem";
      btnDown.onclick = (e) => {
        e.stopPropagation();
        moveSection(seccionKey, 1);
      };

      controls.appendChild(btnUp);
      controls.appendChild(btnDown);

      headerRow.appendChild(divTitulo);
      headerRow.appendChild(controls);

      tdSec.appendChild(headerRow);

      const nota = linea.seccionNota || "";
      if (nota) {
        const divNota = document.createElement("div");
        divNota.className = "section-note";
        divNota.textContent = nota;
        tdSec.appendChild(divNota);
      }

      trSec.appendChild(tdSec);
      tbody.appendChild(trSec);
      lastSeccionKey = seccionKey;
    }

    const tr = document.createElement("tr");

    if (linea.manual) {
      tr.style.cursor = "pointer";
      tr.onclick = () => {
        openManualLineaModalForEdit(idx);
      };
    }

    const tdCheck = document.createElement("td");
    tdCheck.className = "col-check";
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = linea.incluir !== false;
    chk.onclick = (e) => e.stopPropagation();
    chk.onchange = () => {
      linea.incluir = chk.checked;
      recalcularPresupuesto();
    };
    tdCheck.appendChild(chk);

    const tdRef = document.createElement("td");
    tdRef.className = "col-ref";
    tdRef.textContent = linea.ref || "";

    const tdSeccion = document.createElement("td");
    tdSeccion.textContent = linea.seccion || "";

    const tdDesc = document.createElement("td");
    tdDesc.textContent = linea.descripcion || "";

    const tdUd = document.createElement("td");
    const inputUd = document.createElement("input");
    inputUd.type = "number";
    inputUd.min = "0";
    inputUd.step = "1";
    inputUd.value = linea.cantidad;
    inputUd.onclick = (e) => e.stopPropagation();
    inputUd.onchange = () => {
      linea.cantidad = toNum(inputUd.value);
      recalcularPresupuesto();
      tdImporte.textContent = formatCurrency(
        (Number(linea.cantidad) || 0) * (Number(linea.pvp) || 0)
      );
    };
    tdUd.appendChild(inputUd);

    const tdPvp = document.createElement("td");
    tdPvp.textContent = formatCurrency(linea.pvp);

    const tdImporte = document.createElement("td");
    tdImporte.textContent = formatCurrency(
      (Number(linea.cantidad) || 0) * (Number(linea.pvp) || 0)
    );

    tr.appendChild(tdCheck);
    tr.appendChild(tdRef);
    tr.appendChild(tdSeccion);
    tr.appendChild(tdDesc);
    tr.appendChild(tdUd);
    tr.appendChild(tdPvp);
    tr.appendChild(tdImporte);

    tbody.appendChild(tr);
  });

  const linesInfo = document.getElementById("linesInfo");
  if (linesInfo) {
    linesInfo.textContent = `${appState.lineasProyecto.length} líneas cargadas desde el proyecto`;
  }
}

function recalcularPresupuesto() {
  const seleccionadas = getLineasSeleccionadas();
  let subtotal = 0;

  seleccionadas.forEach((l) => {
    subtotal += (Number(l.cantidad) || 0) * (Number(l.pvp) || 0);
  });

  const descuento = subtotal * (appState.descuentoGlobal / 100);
  const baseImp = subtotal - descuento;
  const iva = appState.aplicarIVA ? baseImp * 0.21 : 0;
  const total = baseImp + iva;

  const totalesBox = document.getElementById("totalesBox");
  if (totalesBox) {
    totalesBox.innerHTML = `
      <div class="totales-row">
        <span>Subtotal</span>
        <span>${formatCurrency(subtotal)}</span>
      </div>
      <div class="totales-row">
        <span>Descuento (${appState.descuentoGlobal || 0}%)</span>
        <span>-${formatCurrency(descuento)}</span>
      </div>
      <div class="totales-row">
        <span>Base imponible</span>
        <span>${formatCurrency(baseImp)}</span>
      </div>
      <div class="totales-row">
        <span>IVA ${appState.aplicarIVA ? "21%" : "(no aplicado)"} </span>
        <span>${formatCurrency(iva)}</span>
      </div>
      <div class="totales-row total">
        <span>Total</span>
        <span>${formatCurrency(total)}</span>
      </div>
    `;
  }

  const summaryChip = document.getElementById("summaryChip");
  if (summaryChip) {
    if (!appState.lineasProyecto.length) {
      summaryChip.classList.add("hidden");
    } else {
      summaryChip.classList.remove("hidden");
      summaryChip.innerHTML = `
        <span>${appState.lineasProyecto.length} líneas</span>
        <span class="dot"></span>
        <span>Subtotal: ${subtotal.toFixed(0)} €</span>
      `;
    }
  }
}
