// js/ui_simulador.js
// SIMULADOR de tarifas / descuentos a partir del presupuesto actual

window.appState = window.appState || {};
appState.simulador = appState.simulador || {
  tarifaDefecto: "DIST_PRICE", // Tarifa global por defecto: Distributor Price (EUR)
  dtoGlobal: 0,                // descuento adicional global sobre tarifa
  lineasSimuladas: [],         // último resultado
  lineDtoEdited: {},           // mapa: key -> true si el dto de esa línea se ha editado a mano
  mgnDist: 0,
  mgnSubdist: 0,
  mgnInte: 0,
  mgnConst: 0,
};

appState.tarifasBaseSimCache = appState.tarifasBaseSimCache || null;

// Helpers del presupuesto (expuestos en ui_presupuesto.js)
const getPresupuestoActual =
  typeof window.getPresupuestoActual === "function"
    ? window.getPresupuestoActual
    : null;

/**
 * TARIFAS DEFINIDAS (coinciden con las columnas de tu Excel)
 * De momento se implementan como "descuento sobre el PVP base" (campo pvp)
 * para simplificar. Más adelante podemos leer directamente columnas
 * específicas de Firestore (nfrDistributor, etc.).
 */
const TARIFAS_2N = [
  { id: "NFR_DIST",     label: "NFR Distributor (EUR)",               dto: 55 },
  { id: "NFR_RESELLER", label: "NFR Reseller (EUR)",                  dto: 50 },
  { id: "DIST_PRICE",   label: "Distributor Price (EUR)",             dto: 39 },
  { id: "RRP2",         label: "Recommended Reseller Price 2 (EUR)", dto: 28 },
  { id: "RRP1",         label: "Recommended Reseller Price 1 (EUR)", dto: 10 },
  { id: "MSRP",         label: "MSRP (EUR)",                          dto: 0  },
];

// Mapa id -> objeto tarifa
const TARIFAS_MAP = TARIFAS_2N.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {});

console.log(
  "%cUI Simulador · v3.4 · layout 2 columnas + márgenes por actor",
  "color:#22c55e; font-weight:bold;"
);

// ===============================
// Helper: clave única por línea
// ===============================
function buildLineaKey(baseLinea, index) {
  return (
    (baseLinea.ref || "") +
    "§" +
    (baseLinea.seccion || "") +
    "§" +
    (baseLinea.titulo || "") +
    "§" +
    index
  );
}

// ===============================
// Cargar tarifas base (PVP) desde Firestore
// ===============================
async function getTarifasBase2N() {
  if (appState.tarifasBaseSimCache) {
    console.log(
      "%cSimulador · tarifas base desde caché (" +
        Object.keys(appState.tarifasBaseSimCache).length +
        " refs)",
      "color:#16a34a;"
    );
    return appState.tarifasBaseSimCache;
  }

  if (typeof cargarTarifasDesdeFirestore !== "function") {
    console.warn(
      "[Simulador] cargarTarifasDesdeFirestore no está disponible. Devuelvo objeto vacío."
    );
    appState.tarifasBaseSimCache = {};
    return appState.tarifasBaseSimCache;
  }

  const tarifas = await cargarTarifasDesdeFirestore();
  appState.tarifasBaseSimCache = tarifas || {};
  return appState.tarifasBaseSimCache;
}

// ===============================
// Leer configuración de líneas desde el DOM
// ===============================
function leerConfigLineasDesdeDOM() {
  const detalle = document.getElementById("simDetalle");
  const config = {};
  if (!detalle) return config;

  detalle.querySelectorAll("tr[data-key]").forEach((row) => {
    const key = row.dataset.key;
    if (!key) return;

    const selTarifa = row.querySelector(".sim-tarifa-line");
    const inpDtoLinea = row.querySelector(".sim-dto-line");

    const tarifaId =
      (selTarifa && selTarifa.value) ||
      appState.simulador.tarifaDefecto ||
      "DIST_PRICE";

    const dtoLinea = Number(inpDtoLinea && inpDtoLinea.value) || 0;

    config[key] = { tarifaId, dtoLinea };
  });

  return config;
}

// ===============================
// RENDER PRINCIPAL
// ===============================
function renderSimuladorView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  const tarifaOptions = TARIFAS_2N.map(
    (t) => `<option value="${t.id}">${t.label}</option>`
  ).join("");

  container.innerHTML = `
    <div class="presupuesto-layout simulador-layout">

      <!-- COLUMNA IZQUIERDA: 3 bloques compactos -->
      <div class="presupuesto-left-column">

        <!-- BLOQUE 1 · SIMULADOR -->
        <div class="card">
          <div class="card-header" style="padding-bottom:0.35rem;">
            <div class="card-title" style="font-size:0.9rem;">1 · Simulador de tarifas</div>
          </div>
          <div class="card-body" style="padding-top:0.35rem;">
            <div class="form-group" style="margin-bottom:0.4rem;">
              <label style="font-size:0.75rem;">Tarifa 2N por defecto</label>
              <select id="simTarifaDefecto" class="input" style="padding:0.2rem; font-size:0.8rem;">
                ${tarifaOptions}
              </select>
            </div>

            <div class="form-group" style="margin-bottom:0.4rem;">
              <label style="font-size:0.75rem;">Descuento adicional (%)</label>
              <input id="simDtoGlobal" type="number" min="0" max="90" value="0"
                style="padding:0.2rem; font-size:0.8rem; width:100%;" />
              <p style="font-size:0.7rem; color:#6b7280; margin-top:0.2rem;">
                Se aplica sobre el precio de la tarifa seleccionada y se copia
                como valor inicial del descuento por línea (editable).
              </p>
            </div>

            <button id="btnSimRecalcular"
              class="btn btn-primary"
              style="width:100%; padding:0.35rem; font-size:0.8rem;">
              Recalcular simulación
            </button>
          </div>
        </div>

        <!-- BLOQUE 2 · RESUMEN -->
        <div class="card">
          <div class="card-header" style="padding-bottom:0.25rem;">
            <div class="card-title" style="font-size:0.9rem;">2 · Resumen (referencia PVP)</div>
          </div>
          <div class="card-body" style="padding-top:0.3rem;">
            <div id="simResumenCard"
              style="font-size:0.8rem; line-height:1.2;">
              No se ha calculado todavía la simulación.
            </div>
          </div>
        </div>

        <!-- BLOQUE 3 · CADENA DE MÁRGENES -->
        <div class="card">
          <div class="card-header" style="padding-bottom:0.25rem;">
            <div class="card-title" style="font-size:0.9rem;">3 · Márgenes hasta promotor</div>
          </div>
          <div class="card-body" style="padding-top:0.3rem;">
            <div class="form-grid"
                 style="grid-template-columns:repeat(4,1fr); gap:0.4rem; font-size:0.7rem; margin-bottom:0.45rem;">
              <div>
                <label>Dist.</label>
                <input id="simMgnDist" type="number" min="0" max="100" step="0.5"
                  style="padding:0.2rem; font-size:0.75rem; width:100%;" />
              </div>
              <div>
                <label>SubDist.</label>
                <input id="simMgnSubdist" type="number" min="0" max="100" step="0.5"
                  style="padding:0.2rem; font-size:0.75rem; width:100%;" />
              </div>
              <div>
                <label>Integr.</label>
                <input id="simMgnInte" type="number" min="0" max="100" step="0.5"
                  style="padding:0.2rem; font-size:0.75rem; width:100%;" />
              </div>
              <div>
                <label>Constr.</label>
                <input id="simMgnConst" type="number" min="0" max="100" step="0.5"
                  style="padding:0.2rem; font-size:0.75rem; width:100%;" />
              </div>
            </div>

            <div id="simCadenaCard"
              style="font-size:0.8rem; line-height:1.2;">
              Introduce márgenes para ver el precio final estimado al promotor.
            </div>
          </div>
        </div>

      </div>

      <!-- COLUMNA DERECHA: Tabla de simulación -->
      <div class="presupuesto-right-column">
        <div class="card">
          <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
            <div class="card-title">
              Resultado de la simulación
              <span id="simLineCount" style="font-size:0.8rem; color:#6b7280; font-weight:400; margin-left:0.35rem;">
                0 líneas simuladas
              </span>
            </div>
          </div>

          <div class="card-body" id="simDetalle">
            No hay datos de presupuesto para simular. Genera primero un presupuesto.
          </div>
        </div>
      </div>

    </div>
  `;

  // Referencias a inputs
  const selTarifaDefecto = document.getElementById("simTarifaDefecto");
  const inpDtoGlobal = document.getElementById("simDtoGlobal");
  const inpMgnDist = document.getElementById("simMgnDist");
  const inpMgnSubdist = document.getElementById("simMgnSubdist");
  const inpMgnInte = document.getElementById("simMgnInte");
  const inpMgnConst = document.getElementById("simMgnConst");

  // Inicializar con el estado guardado
  if (selTarifaDefecto) {
    selTarifaDefecto.value =
      appState.simulador.tarifaDefecto || "DIST_PRICE";
  }
  if (inpDtoGlobal) {
    inpDtoGlobal.value = appState.simulador.dtoGlobal || 0;
  }
  if (inpMgnDist) {
    inpMgnDist.value = appState.simulador.mgnDist || 0;
  }
  if (inpMgnSubdist) {
    inpMgnSubdist.value = appState.simulador.mgnSubdist || 0;
  }
  if (inpMgnInte) {
    inpMgnInte.value = appState.simulador.mgnInte || 0;
  }
  if (inpMgnConst) {
    inpMgnConst.value = appState.simulador.mgnConst || 0;
  }

  const btnRecalc = document.getElementById("btnSimRecalcular");
  if (btnRecalc) {
    btnRecalc.addEventListener("click", () => {
      recalcularSimulador();
    });
  }

  // Recalcular también cuando cambian estos campos
  if (selTarifaDefecto) {
    selTarifaDefecto.addEventListener("change", () => {
      recalcularSimulador();
    });
  }
  if (inpDtoGlobal) {
    inpDtoGlobal.addEventListener("change", () => {
      recalcularSimulador();
    });
  }
  if (inpMgnDist) {
    inpMgnDist.addEventListener("change", () => {
      recalcularSimulador();
    });
  }
  if (inpMgnSubdist) {
    inpMgnSubdist.addEventListener("change", () => {
      recalcularSimulador();
    });
  }
  if (inpMgnInte) {
    inpMgnInte.addEventListener("change", () => {
      recalcularSimulador();
    });
  }
  if (inpMgnConst) {
    inpMgnConst.addEventListener("change", () => {
      recalcularSimulador();
    });
  }

  // Primera carga
  recalcularSimulador();
}

// ===============================
// Lógica principal de simulación
// ===============================
async function recalcularSimulador() {
  const detalle = document.getElementById("simDetalle");
  const resumenCard = document.getElementById("simResumenCard");
  const cadenaCard = document.getElementById("simCadenaCard");
  const countLabel = document.getElementById("simLineCount");
  if (!detalle || !resumenCard || !cadenaCard) return;

  // 1) Leemos presupuesto
  const presu =
    (typeof getPresupuestoActual === "function" &&
      getPresupuestoActual()) ||
    null;

  const lineasBase = presu && presu.lineas ? presu.lineas : [];

  if (!lineasBase.length) {
    detalle.textContent =
      "No hay líneas de presupuesto. Ve a la pestaña de Presupuesto, genera una oferta y vuelve.";
    resumenCard.textContent =
      "Sin datos de presupuesto, no se puede realizar la simulación.";
    cadenaCard.textContent =
      "Introduce márgenes cuando haya una simulación calculada.";
    if (countLabel) countLabel.textContent = "0 líneas simuladas";
    return;
  }

  // 2) Parámetros globales
  const selTarifaDefecto = document.getElementById("simTarifaDefecto");
  const inpDtoGlobal = document.getElementById("simDtoGlobal");
  const inpMgnDist = document.getElementById("simMgnDist");
  const inpMgnSubdist = document.getElementById("simMgnSubdist");
  const inpMgnInte = document.getElementById("simMgnInte");
  const inpMgnConst = document.getElementById("simMgnConst");

  const oldTarifaDefecto = appState.simulador.tarifaDefecto || "DIST_PRICE";

  const tarifaDefecto =
    (selTarifaDefecto && selTarifaDefecto.value) || "DIST_PRICE";
  const dtoGlobal = Number(inpDtoGlobal && inpDtoGlobal.value) || 0;

  const mgnDist = Number(inpMgnDist && inpMgnDist.value) || 0;
  const mgnSubdist = Number(inpMgnSubdist && inpMgnSubdist.value) || 0;
  const mgnInte = Number(inpMgnInte && inpMgnInte.value) || 0;
  const mgnConst = Number(inpMgnConst && inpMgnConst.value) || 0;

  appState.simulador.tarifaDefecto = tarifaDefecto;
  appState.simulador.dtoGlobal = dtoGlobal;
  appState.simulador.mgnDist = mgnDist;
  appState.simulador.mgnSubdist = mgnSubdist;
  appState.simulador.mgnInte = mgnInte;
  appState.simulador.mgnConst = mgnConst;
  appState.simulador.lineDtoEdited = appState.simulador.lineDtoEdited || {};

  // 3) Config de líneas modificadas (si existe DOM previo)
  let configPrev = {};
  if (tarifaDefecto === oldTarifaDefecto) {
    configPrev = leerConfigLineasDesdeDOM();
  }

  const editedMap = appState.simulador.lineDtoEdited || {};

  // 4) Cargar tarifas base 2N (PVP) desde Firestore
  const tarifasBase = await getTarifasBase2N();

  // 5) Construir nuevas líneas simuladas
  let totalBaseTarifa = 0; // total a precio de tarifa (PVP - dtoTarifa)
  let totalFinal = 0;      // total final (tarifa + dto adicional + dto línea)
  let totalPvpBase = 0;    // total PVP puro (sin descuentos)

  const lineasSim = lineasBase.map((lBase, index) => {
    const key = buildLineaKey(lBase, index);

    const refNorm = String(lBase.ref || "")
      .trim()
      .replace(/\s+/g, "");

    const infoTarifa = tarifasBase[refNorm] || {};
    const basePvp =
      Number(infoTarifa.pvp) || Number(lBase.pvp || 0) || 0;

    const cantidad = Number(lBase.cantidad || 0) || 0;

    const cfg = configPrev[key] || {};
    const tarifaId = cfg.tarifaId || tarifaDefecto;

    // DTO LÍNEA:
    // - Si la línea fue editada, respetamos el valor actual.
    // - Si no, usamos SIEMPRE dtoGlobal como valor por defecto.
    const edited = !!editedMap[key];
    const dtoLinea = edited
      ? (Number(cfg.dtoLinea || 0) || 0)
      : dtoGlobal;

    const objTarifa = TARIFAS_MAP[tarifaId] || TARIFAS_MAP["DIST_PRICE"];
    const dtoTarifa = objTarifa ? objTarifa.dto || 0 : 0;

    // Descuentos combinados (multiplicativo):
    //   primero tarifa, luego dto adicional global, luego dto línea.
    const factorTarifa = 1 - dtoTarifa / 100;
    const factorGlobal = 1 - dtoGlobal / 100;
    const factorLinea = 1 - dtoLinea / 100;

    const factorTotal = factorTarifa * factorGlobal * factorLinea;

    const subtotalPvpBase = basePvp * cantidad;
    const pvpTarifaUd = basePvp * factorTarifa; // precio tras tarifa (sin dto adicional / línea)
    const pvpFinalUd = basePvp * factorTotal;
    const subtotalTarifa = pvpTarifaUd * cantidad;
    const subtotalFinal = pvpFinalUd * cantidad;

    totalPvpBase += subtotalPvpBase;
    totalBaseTarifa += subtotalTarifa;
    totalFinal += subtotalFinal;

    return {
      key,
      ref: refNorm || lBase.ref || "-",
      descripcion:
        lBase.descripcion ||
        infoTarifa.descripcion ||
        "Producto sin descripción",
      seccion: lBase.seccion || "",
      titulo: lBase.titulo || "",
      cantidad,
      basePvp,
      tarifaId,
      dtoTarifa,
      dtoGlobal,
      dtoLinea,
      pvpTarifaUd,
      pvpFinalUd,
      subtotalTarifa,
      subtotalFinal,
    };
  });

  appState.simulador.lineasSimuladas = lineasSim;

  // 6) Pintar tabla
  if (countLabel) {
    countLabel.textContent = `${lineasSim.length} líneas simuladas`;
  }

  let html = `
    <table class="table">
      <thead>
        <tr>
          <th style="width:12%;">Ref.</th>
          <th>Descripción</th>
          <th style="width:8%;">Ud.</th>
          <th style="width:18%;">Tarifa 2N</th>
          <th style="width:9%;">Dto tarifa</th>
          <th style="width:10%;">Dto línea</th>
          <th style="width:10%;">PVP base</th>
          <th style="width:12%;">PVP final ud.</th>
          <th style="width:12%;">Importe final</th>
        </tr>
      </thead>
      <tbody>
  `;

  lineasSim.forEach((l) => {
    const optionsHtml = TARIFAS_2N.map(
      (t) =>
        `<option value="${t.id}" ${
          t.id === l.tarifaId ? "selected" : ""
        }>${t.label}</option>`
    ).join("");

    html += `
      <tr data-key="${l.key}">
        <td>${l.ref}</td>
        <td>
          ${l.descripcion}
          ${
            l.seccion || l.titulo
              ? `<div style="font-size:0.75rem; color:#6b7280; margin-top:0.15rem;">
                   ${l.seccion ? `<strong>${l.seccion}</strong>` : ""}${
                   l.seccion && l.titulo ? " · " : ""
                 }${l.titulo || ""}
                 </div>`
              : ""
          }
        </td>
        <td>${l.cantidad}</td>

        <td>
          <select
            class="input sim-tarifa-line"
            data-key="${l.key}"
            style="font-size:0.78rem; padding:0.15rem 0.25rem;"
          >
            ${optionsHtml}
          </select>
        </td>

        <td>${l.dtoTarifa.toFixed(1)} %</td>

        <td>
          <input
            type="number"
            class="input sim-dto-line"
            data-key="${l.key}"
            min="0"
            max="90"
            step="0.5"
            value="${l.dtoLinea.toFixed(1)}"
            style="width:80px; font-size:0.78rem; padding:0.15rem 0.25rem;"
          />
        </td>

        <td>${l.basePvp.toFixed(2)} €</td>
        <td>${l.pvpFinalUd.toFixed(2)} €</td>
        <td>${l.subtotalFinal.toFixed(2)} €</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  detalle.innerHTML = html;

  // 7) Listeners por línea (tarifa / dto línea)
  detalle.querySelectorAll(".sim-tarifa-line").forEach((sel) => {
    sel.addEventListener("change", () => {
      recalcularSimulador();
    });
  });

  detalle.querySelectorAll(".sim-dto-line").forEach((input) => {
    input.addEventListener("change", (e) => {
      const key = e.target.dataset.key;
      if (key) {
        appState.simulador.lineDtoEdited =
          appState.simulador.lineDtoEdited || {};
        appState.simulador.lineDtoEdited[key] = true;
      }
      recalcularSimulador();
    });
  });

  // 8) Cálculos de resumen (todo respecto al PVP)
  const tarifaLabel =
    TARIFAS_MAP[tarifaDefecto]?.label || tarifaDefecto;

  const dtoTarifaEf =
    totalPvpBase > 0
      ? (1 - totalBaseTarifa / totalPvpBase) * 100
      : 0;

  const dtoTotalEf =
    totalPvpBase > 0
      ? (1 - totalFinal / totalPvpBase) * 100
      : 0;

  const dtoExtraEf =
    totalBaseTarifa > 0
      ? (1 - totalFinal / totalBaseTarifa) * 100
      : 0;

  resumenCard.innerHTML = `
    <div>
      PVP base total:
      <strong>${totalPvpBase.toFixed(2)} €</strong>
    </div>
    <div>
      Total tras tarifa <strong>${tarifaLabel}</strong>:
      <strong>${totalBaseTarifa.toFixed(2)} €</strong>
      <span style="color:#6b7280;">
        (${dtoTarifaEf.toFixed(1)} % dto vs PVP)
      </span>
    </div>
    <div>
      Total simulado (tarifa + dto adicional + dto línea):
      <strong>${totalFinal.toFixed(2)} €</strong>
      <span style="color:#6b7280;">
        (${dtoTotalEf.toFixed(1)} % dto total vs PVP)
      </span>
    </div>
    <div style="font-size:0.78rem; color:#4b5563; margin-top:0.2rem;">
      Descuento extra sobre el precio de tarifa (dto adicional + dto por línea):
      <strong>${dtoExtraEf.toFixed(1)} %</strong>
    </div>
  `;

  // ===== 9) Cadena de márgenes (margen = beneficio sobre precio de venta) =====
  function aplicarMargenSobreVenta(cost, marginPct) {
    const m = Number(marginPct) || 0;
    if (m <= 0) return cost;
    const f = m / 100;
    if (f >= 0.99) return cost / 0.01; // evitar 100% o más
    return cost / (1 - f);
  }

  const precio2N = totalFinal; // 2N vende al distribuidor a este precio

  const precioDist    = aplicarMargenSobreVenta(precio2N,     mgnDist);
  const precioSubdist = aplicarMargenSobreVenta(precioDist,   mgnSubdist);
  const precioInte    = aplicarMargenSobreVenta(precioSubdist, mgnInte);
  const precioConst   = aplicarMargenSobreVenta(precioInte,   mgnConst);

  const desc2N =
    totalPvpBase > 0 ? (1 - precio2N / totalPvpBase) * 100 : 0;
  const descDist =
    totalPvpBase > 0 ? (1 - precioDist / totalPvpBase) * 100 : 0;
  const descSubdist =
    totalPvpBase > 0 ? (1 - precioSubdist / totalPvpBase) * 100 : 0;
  const descInte =
    totalPvpBase > 0 ? (1 - precioInte / totalPvpBase) * 100 : 0;
  const descConst =
    totalPvpBase > 0 ? (1 - precioConst / totalPvpBase) * 100 : 0;

  cadenaCard.innerHTML = `
    <div style="margin-bottom:0.2rem;">
      <strong>2N (precio simulado):</strong>
      ${precio2N.toFixed(2)} €
      <span style="color:#6b7280;">
        (${desc2N.toFixed(1)} % vs PVP)
      </span>
    </div>
    <div style="margin-bottom:0.2rem;">
      <strong>Distribuidor (${mgnDist.toFixed(1)} % margen):</strong>
      ${precioDist.toFixed(2)} €
      <span style="color:#6b7280;">
        (${descDist.toFixed(1)} % vs PVP)
      </span>
    </div>
    <div style="margin-bottom:0.2rem;">
      <strong>Subdistribuidor (${mgnSubdist.toFixed(1)} % margen):</strong>
      ${precioSubdist.toFixed(2)} €
      <span style="color:#6b7280;">
        (${descSubdist.toFixed(1)} % vs PVP)
      </span>
    </div>
    <div style="margin-bottom:0.2rem;">
      <strong>Integrador (${mgnInte.toFixed(1)} % margen):</strong>
      ${precioInte.toFixed(2)} €
      <span style="color:#6b7280;">
        (${descInte.toFixed(1)} % vs PVP)
      </span>
    </div>
    <div>
      <strong>Constructora (${mgnConst.toFixed(1)} % margen):</strong>
      ${precioConst.toFixed(2)} €
      <span style="color:#6b7280;">
        (${descConst.toFixed(1)} % vs PVP · precio estimado al promotor)
      </span>
    </div>
  `;
}

// ===============================
// Exponer global
// ===============================
window.renderSimuladorView = renderSimuladorView;
