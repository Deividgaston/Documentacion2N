// js/ui_simulador.js
// SIMULADOR de tarifas / descuentos a partir del presupuesto actual

window.appState = window.appState || {};
appState.simulador = appState.simulador || {
  tarifaDefecto: "DIST_PRICE", // Tarifa global por defecto
  dtoGlobal: 0, // descuento adicional global sobre tarifa
  lineasSimuladas: [], // último resultado
  lineDtoEdited: {}, // mapa: key -> true si el dto de esa línea se ha editado a mano
  mgnDist: 0,
  mgnSubdist: 0,
  mgnInte: 0, // (lo usamos como Instalador)
  mgnConst: 0,
  actorTab: "DIST", // "DIST" | "SUBDIST" | "INTE" | "CONST" | "PROMO"
};

appState.tarifasBaseSimCache = appState.tarifasBaseSimCache || null;

// Helpers del presupuesto (expuestos en ui_presupuesto.js)
const getPresupuestoActual =
  typeof window.getPresupuestoActual === "function"
    ? window.getPresupuestoActual
    : null;

/**
 * TARIFAS DEFINIDAS (alineadas con tu Excel/Firestore)
 * dto = descuento sobre el PVP base (campo pvp).
 */
const TARIFAS_2N = [
  { id: "NFR_DIST", label: "NFR Distributor (EUR)", dto: 55 },
  { id: "NFR_RESELLER", label: "NFR Reseller (EUR)", dto: 50 },
  { id: "DIST_PRICE", label: "Distributor Price (EUR)", dto: 39 },
  { id: "RRP2", label: "Recommended Reseller Price 2 (EUR)", dto: 28 },
  { id: "RRP1", label: "Recommended Reseller Price 1 (EUR)", dto: 10 },
  { id: "MSRP", label: "MSRP (EUR)", dto: 0 },
];

// Mapa id -> objeto tarifa
const TARIFAS_MAP = TARIFAS_2N.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {});

console.log(
  "%cUI Simulador · v4.5 · tabs por actor + dto vs PVP + export por pestaña",
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
// Leer configuración de líneas desde el DOM (solo Dto línea)
// ===============================
function leerConfigLineasDesdeDOM() {
  const detalle = document.getElementById("simDetalle");
  const config = {};
  if (!detalle) return config;

  detalle.querySelectorAll("tr[data-key]").forEach((row) => {
    const key = row.dataset.key;
    if (!key) return;

    const inpDtoLinea = row.querySelector(".sim-dto-line");
    const dtoLinea = Number(inpDtoLinea && inpDtoLinea.value) || 0;

    config[key] = { dtoLinea };
  });

  return config;
}

// ===============================
// Helpers: actor tabs
// (cadena por suma porcentual sobre el anterior: multiplicativo 1+pct)
// ===============================
function getLabelActor(tab) {
  switch (tab) {
    case "DIST":
      return "Distribuidor";
    case "SUBDIST":
      return "Subdistribuidor";
    case "INTE":
      return "Instalador";
    case "CONST":
      return "Constructora";
    case "PROMO":
      return "Promotor";
    default:
      return "Distribuidor";
  }
}

function getFactorActor(tab, mgnDist, mgnSubdist, mgnInte, mgnConst) {
  // DIST = x(1+mgnDist)
  // SUBDIST = DIST * (1+mgnSubdist)
  // INTE/Instalador = SUBDIST * (1+mgnInte)
  // CONST = INTE * (1+mgnConst)
  // PROMO = CONST (sin margen extra en UI)
  const fDist = 1 + (Number(mgnDist) || 0) / 100;
  const fSub = fDist * (1 + (Number(mgnSubdist) || 0) / 100);
  const fInte = fSub * (1 + (Number(mgnInte) || 0) / 100);
  const fConst = fInte * (1 + (Number(mgnConst) || 0) / 100);

  switch (tab) {
    case "DIST":
      return fDist;
    case "SUBDIST":
      return fSub;
    case "INTE":
      return fInte;
    case "CONST":
      return fConst;
    case "PROMO":
      return fConst;
    default:
      return fDist;
  }
}

function calcDtoVsPvp(pvpBase, precio) {
  const b = Number(pvpBase) || 0;
  const p = Number(precio) || 0;
  if (b <= 0) return 0;
  return (1 - p / b) * 100;
}

// ===============================
// RENDER PRINCIPAL (2 columnas: 3 bloques izq + tabla dcha)
// ===============================
function renderSimuladorView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  const tarifaOptions = TARIFAS_2N.map(
    (t) => `<option value="${t.id}">${t.label}</option>`
  ).join("");

  container.innerHTML = `
    <div class="simulador-layout"
         style="display:flex; gap:1.5rem; align-items:flex-start;">

      <!-- COLUMNA IZQUIERDA (3 bloques pequeños) -->
      <div class="simulador-left-column"
           style="flex:0 0 380px; max-width:400px;">

        <!-- BLOQUE 1 · SIMULADOR (configuración) -->
        <div class="card" style="margin-bottom:0.75rem;">
          <div class="card-header" style="padding-bottom:0.5rem;">
            <div>
              <div class="card-title">1 · Simulador de tarifas</div>
              <div class="card-subtitle" style="font-size:0.8rem;">
                Selecciona la tarifa 2N y un descuento adicional por defecto.
              </div>
            </div>
            <span class="badge-step">Paso 3 de 3</span>
          </div>

          <div class="card-body" style="padding-top:0.5rem; padding-bottom:0.75rem;">
            <p style="font-size:0.75rem; color:#6b7280; margin-bottom:0.5rem;">
              Se usan las líneas del <strong>presupuesto actual</strong>
              (referencias, descripciones y cantidades).
            </p>

            <div class="form-grid">
              <div class="form-group" style="margin-bottom:0.5rem;">
                <label style="font-size:0.8rem;">Tarifa 2N por defecto</label>
                <select id="simTarifaDefecto" class="input" style="height:32px; font-size:0.85rem;">
                  ${tarifaOptions}
                </select>
              </div>

              <div class="form-group" style="margin-bottom:0.5rem;">
                <label style="font-size:0.8rem;">Descuento global adicional (%)</label>
                <input id="simDtoGlobal" type="number" min="0" max="90" value="0"
                       style="height:32px; font-size:0.85rem;" />
                <p style="font-size:0.72rem; color:#6b7280; margin-top:0.2rem;">
                  Se aplica <strong>sobre el precio de tarifa</strong> y se copia al campo
                  "Dto línea" (puedes ajustarlo por referencia).
                </p>
              </div>
            </div>

            <button id="btnSimRecalcular"
              class="btn btn-primary w-full"
              style="margin-top:0.35rem; height:34px; font-size:0.85rem;">
              Recalcular simulación
            </button>
          </div>
        </div>

        <!-- BLOQUE 2 · RESUMEN -->
        <div class="card" style="margin-bottom:0.75rem;">
          <div class="card-header"
               style="padding-bottom:0.35rem; display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
            <div class="card-title" style="font-size:0.95rem;">2 · Resumen (referencia PVP)</div>
            <div style="display:flex; gap:0.35rem;">
              <button id="btnSimPdf"
                style="
                  padding:0.25rem 0.75rem;
                  font-size:0.78rem;
                  border-radius:999px;
                  border:1px solid #d1d5db;
                  background:#ffffff;
                  color:#374151;
                  cursor:pointer;
                ">
                Exportar PDF
              </button>
              <button id="btnSimExcel"
                style="
                  padding:0.25rem 0.75rem;
                  font-size:0.78rem;
                  border-radius:999px;
                  border:1px solid #d1d5db;
                  background:#ffffff;
                  color:#374151;
                  cursor:pointer;
                ">
                Exportar Excel
              </button>
            </div>
          </div>
          <div class="card-body" id="simResumenCard"
               style="font-size:0.85rem; color:#111827; padding-top:0.5rem; padding-bottom:0.6rem;">
            No se ha calculado todavía la simulación.
          </div>
        </div>

        <!-- BLOQUE 3 · CADENA ACTORES -->
        <div class="card">
          <div class="card-header" style="padding-bottom:0.35rem;">
            <div class="card-title" style="font-size:0.95rem;">3 · Cadena de márgenes hasta promotor</div>
          </div>
          <div class="card-body" style="font-size:0.84rem; color:#111827; padding-top:0.5rem; padding-bottom:0.6rem;">
            <div class="form-group" style="margin-bottom:0.5rem;">
              <label style="font-size:0.8rem;">Márgenes por actor (se suman respecto al anterior)</label>
              <div class="form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr)); gap:0.4rem;">
                <div>
                  <div style="font-size:0.72rem; color:#6b7280;">Distribuidor (%)</div>
                  <input id="simMgnDist" type="number" min="0" max="200" step="0.5"
                         style="width:100%; height:28px; font-size:0.8rem;" />
                </div>
                <div>
                  <div style="font-size:0.72rem; color:#6b7280;">Subdistribuidor (%)</div>
                  <input id="simMgnSubdist" type="number" min="0" max="200" step="0.5"
                         style="width:100%; height:28px; font-size:0.8rem;" />
                </div>
                <div>
                  <div style="font-size:0.72rem; color:#6b7280;">Instalador (%)</div>
                  <input id="simMgnInte" type="number" min="0" max="200" step="0.5"
                         style="width:100%; height:28px; font-size:0.8rem;" />
                </div>
                <div>
                  <div style="font-size:0.72rem; color:#6b7280;">Constructora (%)</div>
                  <input id="simMgnConst" type="number" min="0" max="200" step="0.5"
                         style="width:100%; height:28px; font-size:0.8rem;" />
                </div>
              </div>
            </div>

            <div id="simCadenaCard" style="margin-top:0.25rem; font-size:0.82rem;">
              Introduce márgenes para ver el precio final al promotor.
            </div>
          </div>
        </div>

      </div>

      <!-- COLUMNA DERECHA: Tabla de simulación por línea -->
      <div class="simulador-right-column"
           style="flex:1 1 auto; min-width:0;">
        <div class="card">
          <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap;">
            <div class="card-title">
              Líneas simuladas
              <span id="simLineCount" style="font-size:0.8rem; color:#6b7280; font-weight:400;">
                0 líneas simuladas
              </span>
            </div>

            <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
              <div id="simActorTabs" style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                <button class="sim-tab" data-tab="DIST">Distribuidor</button>
                <button class="sim-tab" data-tab="SUBDIST">Subdistribuidor</button>
                <button class="sim-tab" data-tab="INTE">Instalador</button>
                <button class="sim-tab" data-tab="CONST">Constructora</button>
                <button class="sim-tab" data-tab="PROMO">Promotor</button>
              </div>

              <div style="display:flex; gap:0.35rem;">
                <button id="btnSimActorPdf"
                  style="
                    padding:0.25rem 0.75rem;
                    font-size:0.78rem;
                    border-radius:999px;
                    border:1px solid #d1d5db;
                    background:#ffffff;
                    color:#374151;
                    cursor:pointer;
                  ">
                  PDF
                </button>
                <button id="btnSimActorExcel"
                  style="
                    padding:0.25rem 0.75rem;
                    font-size:0.78rem;
                    border-radius:999px;
                    border-radius:999px;
                    border:1px solid #d1d5db;
                    background:#ffffff;
                    color:#374151;
                    cursor:pointer;
                  ">
                  Excel
                </button>
              </div>
            </div>
          </div>

          <div class="card-body" id="simDetalle">
            No hay datos de presupuesto para simular. Genera primero un presupuesto.
          </div>
        </div>
      </div>

    </div>
  `;

  // Inicializar controles con estado previo
  const selTarifaDefecto = document.getElementById("simTarifaDefecto");
  const inpDtoGlobal = document.getElementById("simDtoGlobal");
  const inpMgnDist = document.getElementById("simMgnDist");
  const inpMgnSubdist = document.getElementById("simMgnSubdist");
  const inpMgnInte = document.getElementById("simMgnInte");
  const inpMgnConst = document.getElementById("simMgnConst");

  if (selTarifaDefecto) {
    selTarifaDefecto.value = appState.simulador.tarifaDefecto || "DIST_PRICE";
  }
  if (inpDtoGlobal) {
    inpDtoGlobal.value = appState.simulador.dtoGlobal || 0;
  }
  if (inpMgnDist) inpMgnDist.value = appState.simulador.mgnDist || 0;
  if (inpMgnSubdist) inpMgnSubdist.value = appState.simulador.mgnSubdist || 0;
  if (inpMgnInte) inpMgnInte.value = appState.simulador.mgnInte || 0;
  if (inpMgnConst) inpMgnConst.value = appState.simulador.mgnConst || 0;

  const btnRecalc = document.getElementById("btnSimRecalcular");
  if (btnRecalc) btnRecalc.addEventListener("click", () => recalcularSimulador());

  if (selTarifaDefecto) {
    selTarifaDefecto.addEventListener("change", () => {
      appState.simulador.lineDtoEdited = {};
      recalcularSimulador();
    });
  }
  if (inpDtoGlobal) inpDtoGlobal.addEventListener("change", () => recalcularSimulador());
  if (inpMgnDist) inpMgnDist.addEventListener("change", () => recalcularSimulador());
  if (inpMgnSubdist) inpMgnSubdist.addEventListener("change", () => recalcularSimulador());
  if (inpMgnInte) inpMgnInte.addEventListener("change", () => recalcularSimulador());
  if (inpMgnConst) inpMgnConst.addEventListener("change", () => recalcularSimulador());

  // Botones izquierda: exportan la pestaña activa
  const btnPdf = document.getElementById("btnSimPdf");
  if (btnPdf) {
    btnPdf.addEventListener("click", async () => {
      await exportarSimuladorPDF(appState.simulador.actorTab || "DIST");
    });
  }
  const btnExcel = document.getElementById("btnSimExcel");
  if (btnExcel) {
    btnExcel.addEventListener("click", () => {
      exportarSimuladorExcel(appState.simulador.actorTab || "DIST");
    });
  }

  // Botones derecha por pestaña (requerido)
  const btnActorPdf = document.getElementById("btnSimActorPdf");
  if (btnActorPdf) {
    btnActorPdf.addEventListener("click", async () => {
      await exportarSimuladorPDF(appState.simulador.actorTab || "DIST");
    });
  }
  const btnActorExcel = document.getElementById("btnSimActorExcel");
  if (btnActorExcel) {
    btnActorExcel.addEventListener("click", () => {
      exportarSimuladorExcel(appState.simulador.actorTab || "DIST");
    });
  }

  // Tabs actor
  const tabs = document.getElementById("simActorTabs");
  if (tabs) {
    tabs.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest(".sim-tab") : null;
      const tab = btn && btn.dataset ? btn.dataset.tab : null;
      if (!tab) return;
      appState.simulador.actorTab = tab;
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

  const presu =
    (typeof getPresupuestoActual === "function" && getPresupuestoActual()) || null;

  const lineasBase = presu && presu.lineas ? presu.lineas : [];
  if (!lineasBase.length) {
    detalle.textContent =
      "No hay líneas de presupuesto. Ve a la pestaña de Presupuesto, genera una oferta y vuelve.";
    resumenCard.textContent =
      "Sin datos de presupuesto, no se puede realizar la simulación.";
    cadenaCard.textContent =
      "Sin datos de simulación, no se puede calcular la cadena de márgenes.";
    if (countLabel) countLabel.textContent = "0 líneas simuladas";
    return;
  }

  const selTarifaDefecto = document.getElementById("simTarifaDefecto");
  const inpDtoGlobal = document.getElementById("simDtoGlobal");
  const inpMgnDist = document.getElementById("simMgnDist");
  const inpMgnSubdist = document.getElementById("simMgnSubdist");
  const inpMgnInte = document.getElementById("simMgnInte");
  const inpMgnConst = document.getElementById("simMgnConst");

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

  const configPrev = leerConfigLineasDesdeDOM();
  const editedMap = appState.simulador.lineDtoEdited || {};
  const tarifasBase = await getTarifasBase2N();

  let totalPvpBase = 0;
  let totalBaseTarifa = 0;
  let totalFinal2N = 0;

  const lineasSim = lineasBase.map((lBase, index) => {
    const key = buildLineaKey(lBase, index);

    const refNorm = String(lBase.ref || "").trim().replace(/\s+/g, "");
    const infoTarifa = tarifasBase[refNorm] || {};
    const basePvp = Number(infoTarifa.pvp) || Number(lBase.pvp || 0) || 0;
    const cantidad = Number(lBase.cantidad || 0) || 0;

    const cfg = configPrev[key] || {};

    // Tarifa por línea eliminada (siempre global)
    const tarifaId = tarifaDefecto;

    // Dto línea editable
    let dtoLinea;
    if (editedMap[key]) dtoLinea = Number(cfg.dtoLinea || 0) || 0;
    else dtoLinea = dtoGlobal;

    const objTarifa = TARIFAS_MAP[tarifaId] || TARIFAS_MAP["DIST_PRICE"];
    const dtoTarifa = objTarifa ? objTarifa.dto || 0 : 0;

    const factorTarifa = 1 - dtoTarifa / 100;
    const factorLinea = 1 - dtoLinea / 100;

    const subtotalPvpBase = basePvp * cantidad;
    const pvpTarifaUd = basePvp * factorTarifa;
    const pvpFinalUd = basePvp * factorTarifa * factorLinea;
    const subtotalTarifa = pvpTarifaUd * cantidad;
    const subtotalFinal = pvpFinalUd * cantidad;

    totalPvpBase += subtotalPvpBase;
    totalBaseTarifa += subtotalTarifa;
    totalFinal2N += subtotalFinal;

    return {
      key,
      ref: refNorm || lBase.ref || "-",
      descripcion:
        lBase.descripcion || infoTarifa.descripcion || "Producto sin descripción",
      seccion: lBase.seccion || "",
      titulo: lBase.titulo || "",
      cantidad,
      basePvp,
      tarifaId,
      dtoTarifa,
      dtoLinea,
      pvpTarifaUd,
      pvpFinalUd, // precio 2N tras tarifa + dto adicional
      subtotalTarifa,
      subtotalFinal, // total 2N por línea
    };
  });

  appState.simulador.lineasSimuladas = lineasSim;

  if (countLabel) countLabel.textContent = `${lineasSim.length} líneas simuladas`;

  // ===== pestaña activa =====
  const actorTab = appState.simulador.actorTab || "DIST";
  const actorLabel = getLabelActor(actorTab);
  const actorFactor = getFactorActor(actorTab, mgnDist, mgnSubdist, mgnInte, mgnConst);

  const totalActor = totalFinal2N * actorFactor;
  const dtoActorTotal = calcDtoVsPvp(totalPvpBase, totalActor);

  // ===== Tabla en la derecha (sin columna Tarifa, y con dto vs PVP por pestaña) =====
  let html = `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:0.75rem; margin-bottom:0.5rem; flex-wrap:wrap;">
      <div style="font-size:0.9rem; color:#111827;">
        Vista: <strong>${actorLabel}</strong>
        <div style="font-size:0.78rem; color:#6b7280; margin-top:0.15rem;">
          Total ${actorLabel}: <strong>${totalActor.toFixed(2)} €</strong>
          <span style="color:#6b7280;">(dto vs PVP: ${dtoActorTotal.toFixed(1)} %)</span>
        </div>
      </div>
      <div style="font-size:0.78rem; color:#6b7280;">
        Factor vs 2N: <strong>x${actorFactor.toFixed(4)}</strong>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th style="width:12%;">Ref.</th>
          <th>Descripción</th>
          <th style="width:8%;">Ud.</th>
          <th style="width:9%;">Dto tarifa</th>
          <th style="width:10%;">Dto línea</th>
          <th style="width:10%;">PVP base</th>
          <th style="width:12%;">Precio ${actorLabel} ud.</th>
          <th style="width:10%;">Dto vs PVP</th>
          <th style="width:12%;">Importe ${actorLabel}</th>
        </tr>
      </thead>
      <tbody>
  `;

  lineasSim.forEach((l) => {
    const precioActorUd = l.pvpFinalUd * actorFactor;
    const importeActor = l.subtotalFinal * actorFactor;
    const dtoVsPvpLinea = calcDtoVsPvp(l.basePvp, precioActorUd);

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
        <td>${Number(l.dtoTarifa || 0).toFixed(1)} %</td>
        <td>
          <input
            type="number"
            class="input sim-dto-line"
            data-key="${l.key}"
            min="0"
            max="90"
            step="0.5"
            value="${Number(l.dtoLinea || 0).toFixed(1)}"
            style="width:80px; font-size:0.78rem; padding:0.15rem 0.25rem;"
          />
        </td>
        <td>${Number(l.basePvp || 0).toFixed(2)} €</td>
        <td>${precioActorUd.toFixed(2)} €</td>
        <td>${dtoVsPvpLinea.toFixed(1)} %</td>
        <td>${importeActor.toFixed(2)} €</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  detalle.innerHTML = html;

  // pintar tabs activos
  const tabsWrap = document.getElementById("simActorTabs");
  if (tabsWrap) {
    tabsWrap.querySelectorAll(".sim-tab").forEach((b) => {
      const active = b.dataset.tab === actorTab;
      b.style.padding = "0.25rem 0.6rem";
      b.style.fontSize = "0.78rem";
      b.style.borderRadius = "999px";
      b.style.border = active ? "1px solid #111827" : "1px solid #d1d5db";
      b.style.background = active ? "#111827" : "#ffffff";
      b.style.color = active ? "#ffffff" : "#374151";
      b.style.cursor = "pointer";
    });
  }

  // dto línea editable
  detalle.querySelectorAll(".sim-dto-line").forEach((input) => {
    input.addEventListener("change", (e) => {
      const key = e.target.dataset.key;
      if (key) {
        appState.simulador.lineDtoEdited = appState.simulador.lineDtoEdited || {};
        appState.simulador.lineDtoEdited[key] = true;
      }
      recalcularSimulador();
    });
  });

  // ===== BLOQUE 2: Resumen (referencia PVP) =====
  const tarifaLabel = TARIFAS_MAP[tarifaDefecto]?.label || tarifaDefecto;

  const dtoTarifaEf =
    totalPvpBase > 0 ? (1 - totalBaseTarifa / totalPvpBase) * 100 : 0;

  const dtoTotalEf2N =
    totalPvpBase > 0 ? (1 - totalFinal2N / totalPvpBase) * 100 : 0;

  const dtoExtraEf =
    totalBaseTarifa > 0 ? (1 - totalFinal2N / totalBaseTarifa) * 100 : 0;

  resumenCard.innerHTML = `
    <div style="font-size:0.84rem;">
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
        Total 2N (tarifa + dto adicional):
        <strong>${totalFinal2N.toFixed(2)} €</strong>
        <span style="color:#6b7280;">
          (${dtoTotalEf2N.toFixed(1)} % dto vs PVP)
        </span>
      </div>
      <div style="font-size:0.78rem; color:#4b5563; margin-top:0.15rem;">
        Descuento extra sobre el precio de tarifa (dto adicional de línea):
        <strong>${dtoExtraEf.toFixed(1)} %</strong>
      </div>
      <div style="font-size:0.78rem; color:#4b5563; margin-top:0.25rem;">
        <strong>Total ${actorLabel} (pestaña activa):</strong>
        ${totalActor.toFixed(2)} €
        <span style="color:#6b7280;">(dto vs PVP: ${dtoActorTotal.toFixed(1)} %)</span>
      </div>
    </div>
  `;

  // ===== BLOQUE 3: Cadena (con suma porcentual respecto al anterior) =====
  const fDist = getFactorActor("DIST", mgnDist, mgnSubdist, mgnInte, mgnConst);
  const fSub = getFactorActor("SUBDIST", mgnDist, mgnSubdist, mgnInte, mgnConst);
  const fInte = getFactorActor("INTE", mgnDist, mgnSubdist, mgnInte, mgnConst);
  const fConst = getFactorActor("CONST", mgnDist, mgnSubdist, mgnInte, mgnConst);

  const precio2N = totalFinal2N;
  const precioDist = totalFinal2N * fDist;
  const precioSubdist = totalFinal2N * fSub;
  const precioInte = totalFinal2N * fInte;
  const precioConst = totalFinal2N * fConst;

  const desc2N = calcDtoVsPvp(totalPvpBase, precio2N);
  const descDist = calcDtoVsPvp(totalPvpBase, precioDist);
  const descSubdist = calcDtoVsPvp(totalPvpBase, precioSubdist);
  const descInte = calcDtoVsPvp(totalPvpBase, precioInte);
  const descConst = calcDtoVsPvp(totalPvpBase, precioConst);

  cadenaCard.innerHTML = `
    <div style="font-size:0.82rem;">
      <div style="margin-bottom:0.18rem;">
        <strong>2N (precio simulado):</strong>
        ${precio2N.toFixed(2)} €
        <span style="color:#6b7280;">(${desc2N.toFixed(1)} % vs PVP)</span>
      </div>
      <div style="margin-bottom:0.18rem;">
        <strong>Distribuidor (+${mgnDist.toFixed(1)} %):</strong>
        ${precioDist.toFixed(2)} €
        <span style="color:#6b7280;">(${descDist.toFixed(1)} % vs PVP)</span>
      </div>
      <div style="margin-bottom:0.18rem;">
        <strong>Subdistribuidor (+${mgnSubdist.toFixed(1)} %):</strong>
        ${precioSubdist.toFixed(2)} €
        <span style="color:#6b7280;">(${descSubdist.toFixed(1)} % vs PVP)</span>
      </div>
      <div style="margin-bottom:0.18rem;">
        <strong>Instalador (+${mgnInte.toFixed(1)} %):</strong>
        ${precioInte.toFixed(2)} €
        <span style="color:#6b7280;">(${descInte.toFixed(1)} % vs PVP)</span>
      </div>
      <div>
        <strong>Constructora (+${mgnConst.toFixed(1)} %):</strong>
        ${precioConst.toFixed(2)} €
        <span style="color:#6b7280;">(${descConst.toFixed(1)} % vs PVP · promotor)</span>
      </div>
    </div>
  `;
}

// ===============================
// EXPORTAR A PDF (por pestaña/actor)
// ===============================
async function exportarSimuladorPDF(actorTab) {
  await recalcularSimulador();

  const lineas = appState.simulador.lineasSimuladas || [];
  if (!lineas.length) {
    alert("No hay datos de simulación para exportar a PDF.");
    return;
  }

  const presu =
    (typeof getPresupuestoActual === "function" && getPresupuestoActual()) || {};

  const nombreProyecto = presu.nombre || "Proyecto sin nombre";
  const fechaPresu = presu.fecha || "";

  const tarifaDefecto = appState.simulador.tarifaDefecto || "DIST_PRICE";
  const tarifaLabel = TARIFAS_MAP[tarifaDefecto]?.label || tarifaDefecto;

  const mgnDist = Number(appState.simulador.mgnDist || 0);
  const mgnSubdist = Number(appState.simulador.mgnSubdist || 0);
  const mgnInte = Number(appState.simulador.mgnInte || 0);
  const mgnConst = Number(appState.simulador.mgnConst || 0);

  const actor = actorTab || appState.simulador.actorTab || "DIST";
  const actorLabel = getLabelActor(actor);
  const actorFactor = getFactorActor(actor, mgnDist, mgnSubdist, mgnInte, mgnConst);

  // Totales base
  let totalPvpBase = 0;
  let totalActor = 0;

  lineas.forEach((l) => {
    totalPvpBase += (Number(l.basePvp) || 0) * (Number(l.cantidad) || 0);
    totalActor += (Number(l.subtotalFinal) || 0) * actorFactor;
  });

  const dtoActorTotal = calcDtoVsPvp(totalPvpBase, totalActor);

  const jsPDFGlobal = window.jspdf || window.jsPDF;
  if (!jsPDFGlobal) {
    alert("No está disponible la librería jsPDF. Revisa la carga de scripts.");
    return;
  }

  const jsPDFCtor = jsPDFGlobal.jsPDF || jsPDFGlobal;
  const doc = new jsPDFCtor("p", "mm", "a4");

  // Cabecera
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Simulación · ${actorLabel}`, 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const fechaTexto = fechaPresu || new Date().toLocaleDateString();
  doc.text(`Proyecto: ${nombreProyecto}`, 14, 23);
  doc.text(`Fecha: ${fechaTexto}`, 14, 28);
  doc.text(`Tarifa base 2N: ${tarifaLabel}`, 14, 33);

  let y = 40;
  doc.setFont("helvetica", "bold");
  doc.text("Totales", 14, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.text(`PVP base total: ${totalPvpBase.toFixed(2)} €`, 14, y);
  y += 5;
  doc.text(
    `Total ${actorLabel}: ${totalActor.toFixed(2)} €  (dto vs PVP: ${dtoActorTotal.toFixed(
      1
    )} %)`,
    14,
    y
  );
  y += 8;

  const head = [[
    "Ref.",
    "Descripción",
    "Ud.",
    "Dto tarifa",
    "Dto línea",
    `Precio ${actorLabel} ud.`,
    "Dto vs PVP",
    `Importe ${actorLabel}`,
  ]];

  const body = lineas.map((l) => {
    const precioUd = Number(l.pvpFinalUd || 0) * actorFactor;
    const dtoVsPvp = calcDtoVsPvp(l.basePvp, precioUd);
    const importe = Number(l.subtotalFinal || 0) * actorFactor;

    return [
      l.ref || "",
      (l.descripcion || "").slice(0, 70),
      String(l.cantidad || ""),
      `${Number(l.dtoTarifa || 0).toFixed(1)} %`,
      `${Number(l.dtoLinea || 0).toFixed(1)} %`,
      `${precioUd.toFixed(2)} €`,
      `${dtoVsPvp.toFixed(1)} %`,
      `${importe.toFixed(2)} €`,
    ];
  });

  const autoTable =
    doc.autoTable ||
    (jsPDFGlobal.autoTable && jsPDFGlobal.autoTable.bind(doc));

  if (!autoTable) {
    alert("No está disponible jsPDF-autoTable. No se puede generar la tabla en el PDF.");
    doc.save(`simulacion_${actorLabel}.pdf`);
    return;
  }

  doc.autoTable({
    startY: y,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2, valign: "middle" },
    headStyles: { fillColor: [17, 24, 39], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 62 },
      2: { cellWidth: 10 },
      3: { cellWidth: 16 },
      4: { cellWidth: 16 },
      5: { cellWidth: 22 },
      6: { cellWidth: 16 },
      7: { cellWidth: 25 },
    },
  });

  const safe = String(actorLabel || "actor").toLowerCase().replace(/\s+/g, "_");
  doc.save(`simulacion_${safe}.pdf`);
}

// ===============================
// EXPORTAR A EXCEL (por pestaña/actor)
// Requiere SheetJS (window.XLSX). Si no está, avisa.
// ===============================
function exportarSimuladorExcel(actorTab) {
  const XLSX = window.XLSX;
  if (!XLSX) {
    alert("No está disponible XLSX (SheetJS). No se puede exportar a Excel.");
    return;
  }

  const lineas = appState.simulador.lineasSimuladas || [];
  if (!lineas.length) {
    alert("No hay datos de simulación para exportar a Excel.");
    return;
  }

  const presu =
    (typeof getPresupuestoActual === "function" && getPresupuestoActual()) || {};

  const nombreProyecto = presu.nombre || "Proyecto sin nombre";
  const fechaPresu = presu.fecha || "";

  const mgnDist = Number(appState.simulador.mgnDist || 0);
  const mgnSubdist = Number(appState.simulador.mgnSubdist || 0);
  const mgnInte = Number(appState.simulador.mgnInte || 0);
  const mgnConst = Number(appState.simulador.mgnConst || 0);

  const actor = actorTab || appState.simulador.actorTab || "DIST";
  const actorLabel = getLabelActor(actor);
  const actorFactor = getFactorActor(actor, mgnDist, mgnSubdist, mgnInte, mgnConst);

  // Totales
  let totalPvpBase = 0;
  let totalActor = 0;
  lineas.forEach((l) => {
    totalPvpBase += (Number(l.basePvp) || 0) * (Number(l.cantidad) || 0);
    totalActor += (Number(l.subtotalFinal) || 0) * actorFactor;
  });
  const dtoActorTotal = calcDtoVsPvp(totalPvpBase, totalActor);

  const rows = [];

  // Cabecera
  rows.push([`Simulación · ${actorLabel}`]);
  rows.push([`Proyecto: ${nombreProyecto}`]);
  rows.push([`Fecha: ${fechaPresu || new Date().toLocaleDateString()}`]);
  rows.push([`PVP base total: ${totalPvpBase.toFixed(2)} €`]);
  rows.push([`Total ${actorLabel}: ${totalActor.toFixed(2)} €`, `Dto vs PVP: ${dtoActorTotal.toFixed(1)} %`]);
  rows.push([]);

  // Tabla
  rows.push([
    "Ref.",
    "Descripción",
    "Ud.",
    "Dto tarifa (%)",
    "Dto línea (%)",
    `Precio ${actorLabel} ud. (€)`,
    "Dto vs PVP (%)",
    `Importe ${actorLabel} (€)`,
  ]);

  lineas.forEach((l) => {
    const precioUd = Number(l.pvpFinalUd || 0) * actorFactor;
    const dtoVsPvp = calcDtoVsPvp(l.basePvp, precioUd);
    const importe = Number(l.subtotalFinal || 0) * actorFactor;

    rows.push([
      l.ref || "",
      l.descripcion || "",
      Number(l.cantidad || 0),
      Number(l.dtoTarifa || 0),
      Number(l.dtoLinea || 0),
      Number(precioUd.toFixed(2)),
      Number(dtoVsPvp.toFixed(1)),
      Number(importe.toFixed(2)),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, actorLabel.slice(0, 31));

  const safe = String(actorLabel || "actor").toLowerCase().replace(/\s+/g, "_");
  XLSX.writeFile(wb, `simulacion_${safe}.xlsx`);
}

// ===============================
// Exponer global
// ===============================
window.renderSimuladorView = renderSimuladorView;
window.exportarSimuladorPDF = exportarSimuladorPDF;
window.exportarSimuladorExcel = exportarSimuladorExcel;
