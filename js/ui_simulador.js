// js/ui_simulador.js
// SIMULADOR de tarifas/ descuentos a partir del presupuesto actual

window.appState = window.appState || {};
appState.simulador = appState.simulador || {
  tarifaDefecto: "PVP",
  dtoGlobal: 0,           // descuento adicional global sobre tarifa
  lineasSimuladas: [],    // último resultado
};

appState.tarifasBaseSimCache = appState.tarifasBaseSimCache || null;

// Si existen helpers del presupuesto, los usamos
const getPresupuestoActual =
  typeof window.getPresupuestoActual === "function"
    ? window.getPresupuestoActual
    : null;

/**
 * TARIFAS DEFINIDAS
 * Aquí configuras las tarifas reales que tenéis y el % de descuento
 * que aplica cada una sobre el PVP base de tarifa.
 *
 * Puedes cambiar nombres y descuentos sin tocar el resto del código.
 */
const TARIFAS_2N = [
  { id: "PVP", label: "Tarifa PVP (0%)", dto: 0 },
  { id: "DIST", label: "Distribuidor (-20%)", dto: 20 },
  { id: "INST", label: "Instalador (-30%)", dto: 30 },
  { id: "PROMO", label: "Promoción Obra (-35%)", dto: 35 },
];

// Mapa rápido de tarifa por id
const TARIFAS_MAP = TARIFAS_2N.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {});

console.log(
  "%cUI Simulador · v2 · tarifas + descuentos línea",
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
// Leer configuración de líneas desde el DOM (tarifa + dto línea)
// para mantener los cambios del usuario entre recalculados
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
      (selTarifa && selTarifa.value) || appState.simulador.tarifaDefecto || "PVP";
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
                Ajusta tarifas y descuentos sobre las líneas del presupuesto actual.
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
                <label>Tarifa por defecto</label>
                <select id="simTarifaDefecto" class="input">
                  ${TARIFAS_2N.map(
                    (t) =>
                      `<option value="${t.id}">${t.label}</option>`
                  ).join("")}
                </select>
                <p style="font-size:0.75rem; color:#6b7280; margin-top:0.25rem;">
                  Esta tarifa se aplica por defecto a todas las líneas (luego podrás cambiarla línea a línea).
                </p>
              </div>

              <div class="form-group">
                <label>Descuento global adicional (%)</label>
                <input id="simDtoGlobal" type="number" min="0" max="90" value="0" />
                <p style="font-size:0.75rem; color:#6b7280; margin-top:0.25rem;">
                  Se aplica a todas las líneas <strong>además</strong> del descuento propio de cada tarifa
                  (y además del descuento extra por línea).
                </p>
              </div>
            </div>

            <button id="btnSimRecalcular" class="btn btn-primary w-full mt-3">
              Recalcular simulación
            </button>

            <div class="sim-summary mt-4" id="simResumenMini" style="font-size:0.85rem; color:#4b5563;">
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

  // Inicializar UI con el estado que hubiera
  const selTarifaDefecto = document.getElementById("simTarifaDefecto");
  const inpDtoGlobal = document.getElementById("simDtoGlobal");

  if (selTarifaDefecto) {
    selTarifaDefecto.value =
      appState.simulador.tarifaDefecto || "PVP";
  }
  if (inpDtoGlobal) {
    inpDtoGlobal.value = appState.simulador.dtoGlobal || 0;
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

  const tarifaDefecto =
    (selTarifaDefecto && selTarifaDefecto.value) || "PVP";
  const dtoGlobal = Number(inpDtoGlobal && inpDtoGlobal.value) || 0;

  appState.simulador.tarifaDefecto = tarifaDefecto;
  appState.simulador.dtoGlobal = dtoGlobal;

  // 3) Config de líneas ya modificadas por el usuario (si existe DOM previo)
  const configPrev = leerConfigLineasDesdeDOM();

  // 4) Cargar tarifas base 2N (PVP) desde Firestore
  const tarifasBase = await getTarifasBase2N();

  // 5) Construir nuevas líneas simuladas
  let totalBaseTarifa = 0;
  let totalFinal = 0;

  const lineasSim = lineasBase.map((lBase, index) => {
    const key = buildLineaKey(lBase, index);

    const refNorm = String(lBase.ref || "")
      .trim()
      .replace(/\s+/g, "");

    const infoTarifa = tarifasBase[refNorm] || {};
    const basePvp =
      Number(infoTarifa.pvp) ||
      Number(lBase.pvp || 0) ||
      0;

    const cantidad = Number(lBase.cantidad || 0) || 0;

    // Tarifa/dto línea: si ya existe en configPrev, se respeta; si no, tarifa por defecto y dto línea 0
    const cfg = configPrev[key] || {};
    const tarifaId = cfg.tarifaId || tarifaDefecto;
    const dtoLinea = Number(cfg.dtoLinea || 0) || 0;

    const objTarifa = TARIFAS_MAP[tarifaId] || TARIFAS_MAP["PVP"];
    const dtoTarifa = objTarifa ? objTarifa.dto || 0 : 0;

    // Descuentos combinados (multiplicativo)
    const factorTarifa = 1 - dtoTarifa / 100;
    const factorGlobal = 1 - dtoGlobal / 100;
    const factorLinea = 1 - dtoLinea / 100;

    const factorTotal = factorTarifa * factorGlobal * factorLinea;

    const pvpTarifaUd = basePvp * factorTarifa; // precio tras tarifa (sin dto global/ línea)
    const pvpFinalUd = basePvp * factorTotal;
    const subtotalTarifa = pvpTarifaUd * cantidad;
    const subtotalFinal = pvpFinalUd * cantidad;

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
          <th style="width:15%;">Tarifa</th>
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

  // 7) Listeners por línea (cambio de tarifa o dto línea)
  detalle.querySelectorAll(".sim-tarifa-line").forEach((sel) => {
    sel.addEventListener("change", () => {
      // Recalcular preservando todo lo que haya en DOM
      recalcularSimulador();
    });
  });

  detalle.querySelectorAll(".sim-dto-line").forEach((input) => {
    input.addEventListener("change", () => {
      recalcularSimulador();
    });
  });

  // 8) Resumen mini
  const diff = totalFinal - totalBaseTarifa;
  const diffPct =
    totalBaseTarifa > 0 ? (diff / totalBaseTarifa) * 100 : 0;

  const tarifaLabel =
    TARIFAS_MAP[tarifaDefecto]?.label || tarifaDefecto;

  resumenMini.innerHTML = `
    <div style="margin-bottom:0.35rem;">
      <strong>Tarifa por defecto:</strong> ${tarifaLabel}<br/>
      <strong>Dto global adicional:</strong> ${dtoGlobal.toFixed(1)} %
    </div>
    <div>
      Importe total a precios de tarifa (sin dto línea):
      <strong>${totalBaseTarifa.toFixed(2)} €</strong>
    </div>
    <div>
      Importe total final (tarifa + dto global + dto por línea):
      <strong>${totalFinal.toFixed(2)} €</strong>
    </div>
    <div style="margin-top:0.35rem; font-size:0.8rem; color:${
      diff <= 0 ? "#16a34a" : "#b91c1c"
    };">
      Diferencia vs. solo tarifa: 
      <strong>${diff.toFixed(2)} € (${diffPct.toFixed(1)} %)</strong>
    </div>
  `;
}

// ===============================
// Exponer global
// ===============================
window.renderSimuladorView = renderSimuladorView;
