// js/ui_presupuesto.js
// Pantalla de PRESUPUESTO: combina proyecto + tarifas y calcula totales

window.appState = window.appState || {};
appState.presupuesto = appState.presupuesto || {
  lineas: [],
  totales: {
    base: 0,
    dtoGlobal: 0,
    iva: 0,
    totalConIva: 0,
  },
  nombreProyecto: "",
  cliente: "",
  fechaPresupuesto: null,
};

// ====================
// SUBTÍTULO
// ====================

function setSubtitlePresupuesto() {
  const sub = document.getElementById("currentViewSubtitle");
  if (sub) {
    sub.textContent =
      "Paso 2 · Genera el presupuesto a partir del proyecto importado y la tarifa 2N.";
  }
}

// ====================
// RENDER PRINCIPAL
// ====================

function renderPresupuestoView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  setSubtitlePresupuesto();

  const p = appState.presupuesto;
  const nombreProyecto = p.nombreProyecto || "Proyecto sin nombre";
  const cliente = p.cliente || "";
  const fecha = p.fechaPresupuesto || new Date().toISOString();

  container.innerHTML = `
    <div class="proyecto-layout">

      <!-- Card parámetros -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Datos del presupuesto</div>
            <div class="card-subtitle">
              Revisa los datos del proyecto y genera el presupuesto.
            </div>
          </div>
          <span class="chip">Paso 2 de 3</span>
        </div>

        <div class="card-body">
          <div class="form-grid">
            <div class="form-row">
              <div class="form-group">
                <label>Nombre del proyecto</label>
                <input id="presupuestoNombreProyecto" type="text" value="${nombreProyecto}" />
              </div>
              <div class="form-group">
                <label>Cliente (opcional)</label>
                <input id="presupuestoCliente" type="text" value="${cliente}" />
              </div>
              <div class="form-group">
                <label>Fecha presupuesto</label>
                <input id="presupuestoFecha" type="date" value="${fecha.slice(0,10)}" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Descuento global (%)</label>
                <input id="presupuestoDtoGlobal" type="number" min="0" max="100" step="0.1"
                  value="${(p.totales && p.totales.dtoGlobal > 0) ? 
                    (100 * p.totales.dtoGlobal / (p.totales.base || 1)).toFixed(1) : 0}">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <button id="btnGenerarPresupuesto" class="btn btn-primary">
                  Generar / Recalcular presupuesto
                </button>
              </div>
            </div>

            <div id="presupuestoMensaje" class="alert alert-info mt-2" style="display:none;"></div>
          </div>
        </div>
      </div>

      <!-- Card resumen -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Resumen económico</div>
        </div>
        <div class="card-body" id="presupuestoResumen">
          No se ha generado todavía el presupuesto.
        </div>
      </div>

      <!-- Card detalle líneas -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Detalle del presupuesto</div>
        </div>
        <div class="card-body" id="presupuestoTablaWrapper">
          No hay líneas de presupuesto generadas.
        </div>
      </div>

    </div>
  `;

  const btnGenerar = document.getElementById("btnGenerarPresupuesto");
  if (btnGenerar) {
    btnGenerar.addEventListener("click", onGenerarPresupuestoClick);
  }

  // Si ya hay un presupuesto previo, reflejarlo
  if (p.lineas && p.lineas.length > 0) {
    pintarResumenPresupuesto();
    pintarTablaPresupuesto();
  }
}

// ====================
// GENERAR PRESUPUESTO
// ====================

async function onGenerarPresupuestoClick() {
  const msg = document.getElementById("presupuestoMensaje");
  if (msg) {
    msg.style.display = "none";
    msg.textContent = "";
  }

  const proyecto = appState.proyecto;
  if (!proyecto || !Array.isArray(proyecto.filas) || proyecto.filas.length === 0) {
    if (msg) {
      msg.className = "alert alert-error mt-2";
      msg.textContent =
        "No hay proyecto importado. Ve primero a la pestaña 'Proyecto' y carga el Excel.";
      msg.style.display = "flex";
    }
    return;
  }

  // Datos de cabecera
  const inputNombre = document.getElementById("presupuestoNombreProyecto");
  const inputCliente = document.getElementById("presupuestoCliente");
  const inputFecha = document.getElementById("presupuestoFecha");
  const inputDtoGlobal = document.getElementById("presupuestoDtoGlobal");

  const nombreProyecto = limpiarTexto(inputNombre?.value || "");
  const cliente = limpiarTexto(inputCliente?.value || "");
  const fecha = inputFecha?.value || new Date().toISOString().slice(0, 10);
  const dtoGlobalPorc = Number(inputDtoGlobal?.value || 0) || 0;

  // Obtener tarifas optimizadas
  const tarifas = await getTarifas();

  // Construir líneas de presupuesto
  const lineas = proyecto.filas.map((fila) => {
    const ref = normalizarRef(fila.referencia);
    const cantidad = Number(fila.cantidad) || 0;
    const desc = fila.descripcion || "";

    let infoTarifa = tarifas[ref];
    let pvp = 0;

    if (typeof infoTarifa === "number") {
      pvp = infoTarifa;
    } else if (infoTarifa && typeof infoTarifa === "object") {
      // Intentar campos típicos
      pvp =
        Number(infoTarifa.pvp) ||
        Number(infoTarifa.precio) ||
        Number(infoTarifa.price) ||
        0;
    }

    const total = pvp * cantidad;

    return {
      referencia: ref,
      descripcion: desc,
      cantidad,
      pvp,
      total,
    };
  });

  // Filtro: quitar líneas sin precio y sin total
  const lineasValidas = lineas.filter((l) => l.cantidad > 0 && l.pvp > 0);

  const totales = calcularTotalesPresupuesto(lineasValidas, dtoGlobalPorc);

  appState.presupuesto = {
    lineas: lineasValidas,
    totales,
    nombreProyecto: nombreProyecto || "Proyecto sin nombre",
    cliente,
    fechaPresupuesto: fecha,
  };

  // Guardar en localStorage
  try {
    localStorage.setItem(
      PRESUPUESTO_CACHE_KEY,
      JSON.stringify(appState.presupuesto)
    );
  } catch (e) {
    console.warn("No se pudo guardar presupuesto en localStorage:", e);
  }

  if (msg) {
    msg.className = "alert alert-success mt-2";
    msg.textContent = `Presupuesto generado: ${lineasValidas.length} líneas con precio.`;
    msg.style.display = "flex";
  }

  pintarResumenPresupuesto();
  pintarTablaPresupuesto();
}

// ====================
// PINTAR RESUMEN
// ====================

function pintarResumenPresupuesto() {
  const resumen = document.getElementById("presupuestoResumen");
  if (!resumen) return;

  const p = appState.presupuesto;
  if (!p || !p.lineas || p.lineas.length === 0) {
    resumen.textContent = "No se ha generado todavía el presupuesto.";
    return;
  }

  const t = p.totales || {
    base: 0,
    dtoGlobal: 0,
    iva: 0,
    totalConIva: 0,
  };

  resumen.innerHTML = `
    <div class="metric-card">
      <span class="metric-label">Base imponible</span>
      <span class="metric-value">${formatNumber(t.base)} €</span>
    </div>

    <div class="form-row mt-3">
      <div>
        <p style="font-size:0.82rem; color:#4b5563;">
          Descuento global: <strong>${formatNumber(t.dtoGlobal)} €</strong><br/>
          IVA (21%): <strong>${formatNumber(t.iva)} €</strong>
        </p>
      </div>
      <div class="text-right">
        <p style="font-size:0.9rem; font-weight:600; color:#111827;">
          Total con IVA: <span style="font-size:1.1rem; color:#1d4fd8;">${formatNumber(
            t.totalConIva
          )} €</span>
        </p>
      </div>
    </div>
  `;
}

// ====================
// PINTAR TABLA DETALLE
// ====================

function pintarTablaPresupuesto() {
  const wrapper = document.getElementById("presupuestoTablaWrapper");
  if (!wrapper) return;

  const p = appState.presupuesto;
  if (!p || !p.lineas || p.lineas.length === 0) {
    wrapper.textContent = "No hay líneas de presupuesto generadas.";
    return;
  }

  const filasHtml = p.lineas
    .map((l) => {
      return `
        <tr>
          <td>${l.referencia}</td>
          <td>${l.descripcion || ""}</td>
          <td class="text-right">${l.cantidad}</td>
          <td class="text-right">${formatNumber(l.pvp)} €</td>
          <td class="text-right">${formatNumber(l.total)} €</td>
        </tr>
      `;
    })
    .join("");

  wrapper.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Referencia</th>
            <th>Descripción</th>
            <th>Cant.</th>
            <th>PVP</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${filasHtml}
        </tbody>
      </table>
    </div>
  `;
}

console.log(
  "%cUI Presupuesto cargada (ui_presupuesto.js)",
  "color:#22c55e; font-weight:600;"
);
// js/ui_presupuesto.js
// Pantalla de presupuesto + cálculo

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

  // Si no hay líneas, simple aviso
  if (!appState.lineasProyecto || !appState.lineasProyecto.length) {
    const tbody = document.getElementById("tbodyPresupuesto");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="font-size:0.85rem; color:#6b7280; padding:10px;">
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

function rebuildPresupuestoTable(filtroRefTexto) {
  const tbody = document.getElementById("tbodyPresupuesto");
  if (!tbody) return;

  const lines = appState.lineasProyecto || [];
  const filtro = (filtroRefTexto || "").toLowerCase();

  tbody.innerHTML = "";

  lines.forEach((linea, idx) => {
    if (filtro && !linea.ref.toLowerCase().includes(filtro)) return;

    const tr = document.createElement("tr");

    const tdCheck = document.createElement("td");
    tdCheck.className = "col-check";
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = linea.incluir !== false;
    chk.onchange = () => {
      linea.incluir = chk.checked;
      recalcularPresupuesto();
    };
    tdCheck.appendChild(chk);

    const tdRef = document.createElement("td");
    tdRef.className = "col-ref";
    tdRef.textContent = linea.ref;

    const tdDesc = document.createElement("td");
    tdDesc.textContent = linea.descripcion || "";

    const tdUd = document.createElement("td");
    const inputUd = document.createElement("input");
    inputUd.type = "number";
    inputUd.min = "0";
    inputUd.step = "1";
    inputUd.value = linea.cantidad;
    inputUd.onchange = () => {
      linea.cantidad = toNum(inputUd.value);
      recalcularPresupuesto();
      // actualizar subtotal fila
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
        <span>IVA ${appState.aplicarIVA ? "21%" : "(no aplicado)"}</span>
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
