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

// Mapa rápido id -> objeto tarifa
const TARIFAS_MAP = TARIFAS_2N.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {});

console.log(
  "%cUI Simulador · v3.2 · resumen PVP + cadena de márgenes",
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
// Reutiliza cargarTarifasDesdeFirestore() del presupuesto
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
// (tarifa + dto línea) para mantener cambios del usuario
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

  container.innerHTML = `
    <div class="simulador-layout">

      <!-- COLUMNA IZQUIERDA: Configuración -->
      <div class="simulador-left-column">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Simulador de tarifas</div>
              <div class="card-subtitle">
                Ajusta tarifas, descuentos y márgenes sobre las líneas del presupuesto actual.
              </div>
            </div>
            <span class="badge-step">Paso 3 de 3</span>
          </div>

          <div class="card-body">
            <div class="form-group">
              <label>Fuente de líneas</label>
              <p style="font-size:0.8rem; color:#6b7280; margin-top:0.25rem;">
                Se utilizan las líneas del <strong>presupuesto actual</strong>: referencias, descripciones y cantidades.
              </p>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label>Tarifa 2N por defecto</label>
                <select id="simTarifaDefecto" class="input">
                  ${TARIFAS_2N.map(
                    (t) =>
                      `<option value="${t.id}">${t.label}</option>`
                  ).join("")}
                </select>
                <p style="font-size:0.75rem; color:#6b7280; margin-top:0.25rem;">
                  Esta tarifa se aplica por defecto a todas las líneas.
                  Luego podrás cambiarla individualmente en cada referencia.
                </p>
              </div>

              <div class="form-group">
                <label>Descuento global adicional (%)</label>
                <input id="simDtoGlobal" type="number" min="0" max="90" value="0" />
                <p style="font-size:0.75rem; color:#6b7280; margin-top:0.25rem;">
                  Se aplica a todas las líneas <strong>además</strong> del descuento propio de la tarifa
                  y se copia como descuento inicial de cada línea.
                </p>
              </div>
            </div>

            <!-- Cadena de márgenes por actor -->
            <div class="form-group" style="margin-top:1rem;">
              <label>Cadena de márgenes hasta promotor</label>
              <div class="form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr)); gap:0.5rem;">
                <div>
                  <div style="font-size:0.75rem; color:#6b7280;">Distribuidor (%)</div>
                  <input id="simMgnDist" type="number" min="0" max="100" step="0.5"
                    style="width:100%;" />
                </div>
                <div>
                  <div style="font-size:0.75rem; color:#6b7280;">Subdistribuidor (%)</div>
                  <input id="simMgnSubdist" type="number" min="0" max="100" step="0.5"
                    style="width:100%;" />
                </div>
                <div>
                  <div style="font-size:0.75rem; color:#6b7280;">Integrador (%)</div>
                  <input id="simMgnInte" type="number" min="0" max="100" step="0.5"
                    style="width:100%;" />
                </div>
                <div>
                  <div style="font-size:0.75rem; color:#6b7280;">Constructora (%)</div>
                  <input id="simMgnConst" type="number" min="0" max="100" step="0.5"
                    style="width:100%;" />
                </div>
              </div>
              <p style="font-size:0.72rem; color:#6b7280; margin-top:0.25rem;">
                Los márgenes se aplican en cadena sobre el importe final simulado, para estimar el precio
                al promotor.
              </p>
            </div>

            <button id="btnSimRecalcular" class="btn btn-primary w-full mt-3">
              Recalcular simulación
            </button>

            <div class="sim-summary mt-4" id="simResumenMini"
              style="font-size:0.9rem; color:#111827;">
              No se ha calculado todavía la simulación.
            </div>
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA: Tabla de simulación -->
      <div class="simulador-right-column">
        <div class="card">
          <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
            <div class="card-title">
              Resultado de la simulación
              <span id="simLineCount" style="font-size:0.8rem; color:#6b7280; font-weight:400;">
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
    selTarifaDefecto.addEventListener("change", () => {
      recalcularSimulador();
    });
  }

  if (inpDtoGlobal) {
    inpDtoGlobal.value = appState.simulador.dtoGlobal || 0;
    inpDtoGlobal.addEventListener("change", () => {
      recalcularSimulador();
    });
  }

  if (inpMgnDist) {
    inpMgnDist.value = appState.simulador.mgnDist || 0;
    inpMgnDist.addEventListener("change", () => {
      recalcularSimulador();
    });
  }

  if (inpMgnSubdist) {
    inpMgnSubdist.value = appState.simulador.mgnSubdist || 0;
    inpMgnSubdist.addEventListener("change", () => {
      recalcularSimulador();
    });
  }

  if (inpMgnInte) {
    inpMgnInte.value = appState.simulador.mgnInte || 0;
    inpMgnInte.addEventListener("change", () => {
      recalcularSimulador();
    });
  }

  if (inpMgnConst) {
    inpMgnConst.value = appState.simulador.mgnConst || 0;
    inpMgnConst.addEventListener("change", () => {
      recalcularSimulador();
    });
  }

  const btnRecalc = document.getElementById("btnSimRecalcular");
  if (btnRecalc) {
    btnRecalc.addEventListener("click", () => {
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
  const resumenMini = document.getElementById("simResumenMini");
  const countLabel = document.getElementById("simLineCount");
  if (!detalle || !resumenMini) return;

  // 1) Leemos presupuesto
  const presu =
    (typeof getPresupuestoActual === "function" &&
      getPresupuestoActual()) ||
    null;

  const lineasBase = presu && presu.lineas ? presu.lineas : [];

  if (!lineasBase.length) {
    detalle.textContent =
      "No hay líneas de presupuesto. Ve a la pestaña de Presupuesto, genera una oferta y vuelve.";
    resumenMini.textContent =
      "Sin datos de presupuesto, no se puede realizar la simulación.";
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
  //    Si cambia la tarifa global, ignoramos config previa para
  //    que todas las líneas adopten la nueva tarifa.
  let configPrev = {};
  if (tarifaDefecto === oldTarifaDefecto) {
    configPrev = leerConfigLineasDesdeDOM();
  }

  const editedMap = appState.simulador.lineDtoEdited || {};

  // 4) Cargar tarifas base 2N (PVP) desde Firestore
  const tarifasBase = await getTarifasBase2N();

  // 5) Construir nuevas líneas simuladas
  let totalBaseTarifa = 0; // total a precio de tarifa (PVP - dtoTarifa)
  let totalFinal = 0;      // total final (tarifa + dto global + dto línea)
  let totalPvpBase = 0;    // total PVP puro (sin descuentos)

  const lineasSim = lineasBase.map((lBase, index) => {
    const key = buildLineaKey(lBase, index);

    const refNorm = String(lBase.ref || "")
      .trim()
      .replace(/\s+/g, "");

    const infoTarifa = tarifasBase[refNorm] || {};
    // PVP base: campo "pvp" o pvp del presupuesto
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

    // Descuentos combinados (multiplicativo)
    const factorTarifa = 1 - dtoTarifa / 100;
    const factorGlobal = 1 - dtoGlobal / 100;
    const factorLinea = 1 - dtoLinea / 100;

    const factorTotal = factorTarifa * factorGlobal * factorLinea;

    const subtotalPvpBase = basePvp * cantidad;
    const pvpTarifaUd = basePvp * factorTarifa; // precio tras tarifa (sin dto global / línea)
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
            ${TARIFAS_2N.map(
              (t) =>
                `<option value="${t.id}" ${
                  t.id === l.tarifaId ? "selected" : ""
                }>${t.label}</option>`
            ).join("")}
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

  // 8) Resumen grande y compacto (todo vs PVP + márgenes)
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

  // Cadena de márgenes
  const precioDist = totalFinal * (1 + mgnDist / 100);
  const precioSubdist = precioDist * (1 + mgnSubdist / 100);
  const precioInte = precioSubdist * (1 + mgnInte / 100);
  const precioConst = precioInte * (1 + mgnConst / 100);

  resumenMini.innerHTML = `
    <div style="margin-bottom:0.5rem;">
      <div style="font-weight:600; margin-bottom:0.25rem;">Resumen económico (referencia PVP)</div>
      <div style="font-size:0.86rem;">
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
          Total simulado (tarifa + dto global + dto línea):
          <strong>${totalFinal.toFixed(2)} €</strong>
          <span style="color:#6b7280;">
            (${dtoTotalEf.toFixed(1)} % dto total vs PVP)
          </span>
        </div>
        <div style="font-size:0.8rem; color:#4b5563; margin-top:0.15rem;">
          Descuento extra sobre el precio de tarifa (dto global + línea):
          <strong>${dtoExtraEf.toFixed(1)} %</strong>
        </div>
      </div>
    </div>

    <div style="border-top:1px solid #e5e7eb; padding-top:0.5rem; margin-top:0.35rem;">
      <div style="font-weight:600; margin-bottom:0.25rem; font-size:0.86rem;">
        Cadena de márgenes hasta promotor
      </div>
      <div style="font-size:0.84rem;">
        <div>
          Base simulada (sin márgenes actores):
          <strong>${totalFinal.toFixed(2)} €</strong>
        </div>
        <div>
          Distribuidor (${mgnDist.toFixed(1)} %):
          <strong>${precioDist.toFixed(2)} €</strong>
        </div>
        <div>
          Subdistribuidor (${mgnSubdist.toFixed(1)} %):
          <strong>${precioSubdist.toFixed(2)} €</strong>
        </div>
        <div>
          Integrador (${mgnInte.toFixed(1)} %):
          <strong>${precioInte.toFixed(2)} €</strong>
        </div>
        <div>
          Constructora (${mgnConst.toFixed(1)} %):
          <strong>${precioConst.toFixed(2)} €</strong>
          <span style="color:#4b5563;">(precio estimado al promotor)</span>
        </div>
      </div>
    </div>
  `;
}

// ===============================
// Exponer global
// ===============================
window.renderSimuladorView = renderSimuladorView;
