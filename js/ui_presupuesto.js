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
// RENDER PRINCIPAL
// ====================

function renderPresupuestoView() {
  const container = document.getElementById("appContent");
  if (!container) return;

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
