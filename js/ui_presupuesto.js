// js/ui_presupuesto.js
// Pantalla de presupuesto + cálculo + modal de SECCIÓN + secciones agrupadas
// Las líneas solo permiten cambiar unidades e incluir/excluir. REF, DESCRIPCIÓN y PVP no se tocan.

let modalSeccionEl = null;

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
      <!-- COLUMNA IZQUIERDA: DATOS PRESUPUESTO -->
      <div class="col-left">
        <div class="card">
          <div class="card-section-title">Datos del cliente / proyecto</div>

          <div class="grid-2-equal" style="margin-bottom:10px;">
            <div>
              <div class="field-label">Cliente</div>
              <input type="text" id="p_cliente" class="input" value="${appState.infoPresupuesto.cliente}">
            </div>
            <div>
              <div class="field-label">Proyecto</div>
              <input type="text" id="p_proyecto" class="input" value="${appState.infoPresupuesto.proyecto}">
            </div>
          </div>

          <div class="grid-2-equal" style="margin-bottom:10px;">
            <div>
              <div class="field-label">Dirección</div>
              <input type="text" id="p_direccion" class="input" value="${appState.infoPresupuesto.direccion}">
            </div>
            <div>
              <div class="field-label">Contacto</div>
              <input type="text" id="p_contacto" class="input" value="${appState.infoPresupuesto.contacto}">
            </div>
          </div>

          <div class="grid-2-equal" style="margin-bottom:10px;">
            <div>
              <div class="field-label">Email</div>
              <input type="text" id="p_email" class="input" value="${appState.infoPresupuesto.email}">
            </div>
            <div>
              <div class="field-label">Teléfono</div>
              <input type="text" id="p_telefono" class="input" value="${appState.infoPresupuesto.telefono}">
            </div>
          </div>

          <div style="margin-top:8px;">
            <div class="field-label">Notas adicionales</div>
            <textarea id="p_notas" class="input textarea-notas">${appState.infoPresupuesto.notas}</textarea>
          </div>

          <button class="btn btn-blue btn-full" style="margin-top:12px;" id="btnGuardarDatos">
            Guardar datos
          </button>
        </div>

        <div class="card card-soft">
          <div class="card-section-title">Opciones de cálculo</div>

          <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
            <div style="flex:1;">
              <div class="field-label">Descuento global (%)</div>
              <input type="number" id="p_descuentoGlobal" class="input" value="${appState.descuentoGlobal}">
            </div>
            <label style="display:flex; align-items:center; gap:6px; margin-top:18px; font-size:0.8rem;">
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

      <!-- COLUMNA DERECHA: TABLA LÍNEAS -->
      <div class="col-right">
        <div class="table-wrapper">
          <div class="table-header-actions">
            <div class="table-header-title">
              Líneas del presupuesto
              <span class="badge-light" id="linesInfo"></span>
            </div>
            <div class="table-actions">
              <label>
                Filtro ref:
                <input type="text" id="filtroRef" class="input" style="width:140px; padding:4px 8px; font-size:0.75rem;">
              </label>
            </div>
          </div>

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
  `;

  // Modal de secciones
  setupPresupuestoModalSeccion(container);

  // Si no hay líneas, mensaje
  if (!appState.lineasProyecto || !appState.lineasProyecto.length) {
    const tbody = document.getElementById("tbodyPresupuesto");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="font-size:0.85rem; color:#6b7280; padding:10px;">
            No hay líneas de proyecto cargadas. Importa primero un Excel en la pestaña <strong>Proyecto</strong>.
          </td>
        </tr>
      `;
    }
  } else {
    rebuildPresupuestoTable();
  }

  // Eventos datos cabecera
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
  document.getElementById("btnPDF").onclick = () => generarPDF();
  document.getElementById("btnExcel").onclick = () => generarExcel();

  const filtroRef = document.getElementById("filtroRef");
  filtroRef.oninput = () => {
    rebuildPresupuestoTable(filtroRef.value.trim().toLowerCase());
  };

  recalcularPresupuesto();
}

/* ==========================
   MODAL SECCIÓN
   ========================== */

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

  const btnCerrar = modalSeccionEl.querySelector("#modalSeccionCerrarBtn");
  const btnCancelar = modalSeccionEl.querySelector("#modalSeccionCancelar");
  const btnGuardar = modalSeccionEl.querySelector("#modalSeccionGuardar");

  btnCerrar.onclick = () => closeSeccionModal();
  btnCancelar.onclick = () => closeSeccionModal();
  btnGuardar.onclick = () => saveSeccionModal();

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
  if (oldKey === undefined || oldKey === "") {
    closeSeccionModal();
    return;
  }

  const nuevoTitulo = (modalSeccionEl.querySelector("#modal_seccion_titulo").value || "").trim();
  const nuevoComentario = modalSeccionEl.querySelector("#modal_seccion_comentario").value || "";

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

/* ==========================
   TABLA + CÁLCULOS
   ========================== */

function rebuildPresupuestoTable(filtroRefTexto) {
  const tbody = document.getElementById("tbodyPresupuesto");
  if (!tbody) return;

  const lines = appState.lineasProyecto || [];
  const filtro = (filtroRefTexto || "").toLowerCase();

  tbody.innerHTML = "";

  const items = [];
  lines.forEach((linea, idx) => {
    if (filtro && !linea.ref.toLowerCase().includes(filtro)) return;
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

      const divTitulo = document.createElement("div");
      divTitulo.textContent = seccionKey;
      tdSec.appendChild(divTitulo);

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
    tdRef.textContent = linea.ref;

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
