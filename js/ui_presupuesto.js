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
    <div class="presupuesto-layout-grid">

      <!-- Columna izquierda: datos + resumen -->
      <div class="presupuesto-left">

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
                  <input id="presupuestoDtoGlobal" type="number" min="0" max="100" step="0.1" value="0">
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

      </div>

      <!-- Columna derecha: tabla detalle -->
      <div class="presupuesto-right">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Detalle del presupuesto</div>
          </div>
          <div class="card-body" id="presupuestoTablaWrapper">
            No hay líneas de presupuesto generadas.
          </div>
        </div>
      </div>

    </div>
  `;

  const btnGenerar = document.getElementById("btnGenerarPresupuesto");
  if (btnGenerar) {
    btnGenerar.addEventListener("click", onGenerarPresupuestoClick);
  }

  // Si ya hay presupuesto previo, lo pintamos
  if (p.lineas && p.lineas.length > 0) {
    pintarResumenPresupuesto();
    pintarTablaPresupuesto();
  }
}

// ====================
// GENERAR PRESUPUESTO
// ====================

async function onGenerarPresupuestoClick() {
  console.log("➡ [Presupuesto] Botón Generar pulsado");
  const msg = document.getElementById("presupuestoMensaje");
  if (msg) {
    msg.style.display = "none";
    msg.textContent = "";
  }

  const proyecto = appState.proyecto;
  console.log("➡ [Presupuesto] Proyecto en memoria:", proyecto);

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

  // Obtener tarifas optimizadas (usa caché, 1 lectura a Firestore máx.)
  const tarifas = await getTarifas();
  console.log("➡ [Presupuesto] Tarifas cargadas:", tarifas);

  if (!tarifas || Object.keys(tarifas).length === 0) {
    if (msg) {
      msg.className = "alert alert-error mt-2";
      msg.textContent =
        "No se pudieron cargar las tarifas desde Firebase. Revisa la colección 'tarifas/v1'.";
      msg.style.display = "flex";
    }
    return;
  }

  // Construir líneas de presupuesto a partir del proyecto importado
  const lineas = proyecto.filas.map((fila) => {
    const refOriginal = String(fila.referencia || "").trim();

    // Normalizar fuerte para que coincida con las claves del mapa productos
    const ref = refOriginal
      .replace(/\s+/g, "")
      .replace(/\./g, "")
      .toUpperCase();

    const cantidad = Number(fila.cantidad || 0);
    const desc = fila.descripcion || "";

    const seccion = fila.seccion || proyecto.seccion || "";
    const titulo = fila.titulo || proyecto.titulo || "";

    let pvp = 0;
    if (tarifas[ref] != null) {
      pvp = Number(tarifas[ref]) || 0;
    }

    const total = pvp * cantidad;

    if (!pvp || cantidad <= 0) {
      console.log(
        "⚠ Línea sin precio o cantidad inválida",
        { refOriginal, ref, cantidad, desc }
      );
    }

    return {
      seccion,
      titulo,
      descripcion: desc,
      referencia: ref,
      cantidad,
      pvp,
      total,
    };
  });

  // Filtrar solo líneas válidas
  const lineasValidas = lineas.filter((l) => l.cantidad > 0 && l.pvp > 0);

  console.log(
    `✅ [Presupuesto] Generado con ${lineasValidas.length} líneas válidas de ${lineas.length} totales`
  );

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
// CÁLCULO TOTALES
// ====================

function calcularTotalesPresupuesto(lineas, dtoGlobalPorc) {
  const base = lineas.reduce((acc, l) => acc + (l.total || 0), 0);
  const dtoImporte = base * (dtoGlobalPorc / 100);
  const baseNeta = base - dtoImporte;
  const iva = baseNeta * 0.21;
  const totalConIva = baseNeta + iva;

  return {
    base: Math.round(base * 100) / 100,
    dtoGlobal: Math.round(dtoImporte * 100) / 100,
    iva: Math.round(iva * 100) / 100,
    totalConIva: Math.round(totalConIva * 100) / 100,
  };
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
          <td>${l.seccion || ""}</td>
          <td>${l.titulo || ""}</td>
          <td>${l.descripcion || ""}</td>
          <td>${l.referencia}</td>
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
            <th>Sección</th>
            <th>Título</th>
            <th>Nombre producto</th>
            <th>Referencia</th>
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
  "%cUI Presupuesto cargada (ui_presupuesto.js · tabla derecha + PVP)",
  "color:#22c55e; font-weight:600;"
);
