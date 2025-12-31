// js/ui_simulador.js
// SIMULADOR de tarifas / descuentos a partir del presupuesto actual
// FIX: precios por nivel calculados desde tarifas_tipos (grupos A/B/C/D) + PVP Firestore

window.appState = window.appState || {};
appState.simulador = appState.simulador || {
  // NUEVO: tipo de tarifa seleccionado (tarifas_tipos)
  tipoTarifaId: null,

  tarifaDefecto: "DIST_PRICE", // nivel por defecto
  dtoGlobal: 0,
  lineasSimuladas: [],
  lineDtoEdited: {},

  mgnDist: 0,
  mgnSubdist: 0,
  mgnInte: 0,
  mgnConst: 0,

  actorTab: "2N",
};

// Cache tarifas base + índice
appState.tarifasBaseSimCache = appState.tarifasBaseSimCache || null;
appState.tarifasBaseSimIndex = appState.tarifasBaseSimIndex || null;

// ===============================
// Helpers del presupuesto (expuestos en ui_presupuesto.js)
// ===============================
const getPresupuestoActual =
  typeof window.getPresupuestoActual === "function" ? window.getPresupuestoActual : null;

// ===============================
// Niveles (lo que el simulador muestra/elige)
// ===============================
const NIVELES = [
  { id: "NFR_DIST",     label: "NFR Distributor",        level: "nfrDist" },
  { id: "NFR_RESELLER", label: "NFR Reseller",           level: "nfrRes" },
  { id: "DIST_PRICE",   label: "Distributor Price",      level: "dist" },
  { id: "RRP2",         label: "RP2",                    level: "rp2" },
  { id: "RRP1",         label: "RP1",                    level: "rp1" },
  { id: "MSRP",         label: "MSRP (PVP)",             level: "msrp" },
  // Si quieres VAD en simulador, descomenta:
  // { id: "VAD_MSRP",     label: "VAD MSRP",               level: "vadMsrp" },
];

const NIVEL_MAP = NIVELES.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {});

// ===============================
// Clasificación por grupo (idéntico enfoque que ui_tarifas.js)
// ===============================
const GROUP_PATTERNS = {
  GRUPO_D: ["my2n", "subscription", "suscripción", "spare part", "spare parts", "repuesto", "repuestos"],
  GRUPO_C: ["fortis", "indoor view", "indoor touch", "indoor compact", "indoor talk", "indoor clip", "ip one", "ip uni", "ip base", "ip vario", "sip audio"],
  GRUPO_B: ["accessory", "accessories", "accesorio", "accesorios", "installation accessory", "installation accessories", "power supply", "fuente de alimentación", "psu", "mounting frame", "mounting accessories", "flush box", "backplate", "frame"],
  // GRUPO_A: resto
};

function clasificarGrupoPorDescripcion(descripcionRaw) {
  const desc = (descripcionRaw || "").toString().toLowerCase();
  if (!desc) return "GRUPO_A";
  for (const gid of ["GRUPO_D", "GRUPO_C", "GRUPO_B"]) {
    const patterns = GROUP_PATTERNS[gid] || [];
    if (patterns.some((p) => desc.includes(p))) return gid;
  }
  return "GRUPO_A";
}

// ===============================
// Helpers cálculo
// ===============================
function calcDtoVsPvp(pvpBase, precio) {
  const b = Number(pvpBase) || 0;
  const p = Number(precio) || 0;
  return b > 0 ? (1 - p / b) * 100 : 0;
}

function aplicarMargenSobreVenta(cost, marginPct) {
  const m = Number(marginPct) || 0;
  if (m <= 0) return cost;
  const f = m / 100;
  if (f >= 0.99) return cost / 0.01;
  return cost / (1 - f);
}

function getLabelActor(tab) {
  switch (tab) {
    case "2N": return "2N";
    case "DIST": return "Distribuidor";
    case "SUBDIST": return "Subdistribuidor";
    case "INTE": return "Instalador";
    case "CONST": return "Constructora";
    default: return "2N";
  }
}

function getFactorActor(tab, mgnDist, mgnSubdist, mgnInte, mgnConst) {
  const step = (pct) => aplicarMargenSobreVenta(1, pct);

  const f2n   = 1;
  const fDist = f2n * step(mgnDist);
  const fSub  = fDist * step(mgnSubdist);
  const fInte = fSub  * step(mgnInte);
  const fConst= fInte * step(mgnConst);

  switch (tab) {
    case "2N":      return f2n;
    case "DIST":    return fDist;
    case "SUBDIST": return fSub;
    case "INTE":    return fInte;
    case "CONST":   return fConst;
    default:        return f2n;
  }
}

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
// Tarifa base (PVP) desde Firestore
// Preferir helper global de ui_tarifas.js si existe (para coherencia)
// ===============================
async function getTarifasBase2N() {
  if (typeof window.getTarifasBase2N === "function") {
    const t = await window.getTarifasBase2N();
    // construye índice 1 vez
    if (!appState.tarifasBaseSimCache) {
      appState.tarifasBaseSimCache = t || {};
      appState.tarifasBaseSimIndex = buildTarifasIndex(appState.tarifasBaseSimCache);
    }
    return t || {};
  }

  // fallback legacy
  if (appState.tarifasBaseSimCache) return appState.tarifasBaseSimCache;

  if (typeof cargarTarifasDesdeFirestore !== "function") {
    console.warn("[Simulador] cargarTarifasDesdeFirestore no está disponible.");
    appState.tarifasBaseSimCache = {};
    appState.tarifasBaseSimIndex = {};
    return appState.tarifasBaseSimCache;
  }

  const tarifas = await cargarTarifasDesdeFirestore();
  appState.tarifasBaseSimCache = tarifas || {};
  appState.tarifasBaseSimIndex = buildTarifasIndex(appState.tarifasBaseSimCache);
  return appState.tarifasBaseSimCache;
}

function _normalizeKeyForIndex(k) {
  return String(k || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function buildTarifasIndex(tarifasBase) {
  const idx = {};
  if (!tarifasBase || typeof tarifasBase !== "object") return idx;

  Object.keys(tarifasBase).forEach((k) => {
    const norm = _normalizeKeyForIndex(k);
    if (!norm) return;
    if (!idx[norm]) idx[norm] = tarifasBase[k];
  });

  return idx;
}

function lookupTarifaInfoIndexed(tarifasIndex, ref) {
  if (!tarifasIndex) return null;
  const norm = _normalizeKeyForIndex(ref);
  if (!norm) return null;
  return tarifasIndex[norm] || null;
}

// ===============================
// Tipos de tarifa (tarifas_tipos)
// ===============================
async function ensureTarifasTiposLoaded() {
  if (appState.tarifasTipos && Object.keys(appState.tarifasTipos).length) return appState.tarifasTipos;
  if (typeof window.loadTarifasTiposFromFirestore === "function") {
    await window.loadTarifasTiposFromFirestore();
  }
  return appState.tarifasTipos || {};
}

function getTipoTarifaSeleccionadoId(tipos) {
  const all = Object.values(tipos || {});
  if (!all.length) return null;

  // default preferido: ES_BBD
  const prefer = all.find((t) => String(t.id || "") === "ES_BBD");
  if (prefer) return prefer.id;

  // si ui_tarifas ya tiene seleccionado, úsalo
  if (appState.tarifasTipoSeleccionadoId && tipos[appState.tarifasTipoSeleccionadoId]) {
    return appState.tarifasTipoSeleccionadoId;
  }

  // primero por orden
  all.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  return all[0].id || null;
}

// Calcula precio del nivel elegido desde PVP + dto del grupo del tipo
function calcPrecioDesdeTipo(tipo, groupId, levelKey, pvp) {
  const PVP = Number(pvp) || 0;
  if (PVP <= 0) return 0;

  const grupos = (tipo && tipo.grupos) || {};
  const dtoG = (grupos && grupos[groupId]) ? grupos[groupId] : {};

  if (levelKey === "msrp") return PVP;

  // VAD: si no existe dto.vad, usa dto.dist (como tu export)
  if (levelKey === "vadMsrp") {
    const vadDto = (dtoG && dtoG.vad !== undefined) ? dtoG.vad : dtoG.dist;
    const d = Number(vadDto || 0) || 0;
    return PVP * (1 - d);
  }

  const d = Number((dtoG && dtoG[levelKey]) || 0) || 0;
  return PVP * (1 - d);
}

// ===============================
// Leer configuración de líneas desde DOM (dto línea)
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
// RENDER
// ===============================
async function renderSimuladorView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  const tipos = await ensureTarifasTiposLoaded();
  const tipoDefault = getTipoTarifaSeleccionadoId(tipos);
  if (!appState.simulador.tipoTarifaId) appState.simulador.tipoTarifaId = tipoDefault;

  const tipoOptions = Object.values(tipos || {})
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .map((t) => `<option value="${t.id}">${t.nombre || t.id}</option>`)
    .join("");

  const nivelOptions = NIVELES.map(
    (t) => `<option value="${t.id}">${t.label}</option>`
  ).join("");

  container.innerHTML = `
    <div class="simulador-layout" style="display:flex; gap:1.5rem; align-items:flex-start;">

      <div class="simulador-left-column" style="flex:0 0 380px; max-width:400px;">

        <div class="card" style="margin-bottom:0.75rem;">
          <div class="card-header" style="padding-bottom:0.5rem;">
            <div>
              <div class="card-title">1 · Simulador de tarifas</div>
              <div class="card-subtitle" style="font-size:0.8rem;">
                Tipo de tarifa (grupos) + nivel (dist/rp2/rp1/…).
              </div>
            </div>
            <span class="badge-step">Paso 3 de 3</span>
          </div>

          <div class="card-body" style="padding-top:0.5rem; padding-bottom:0.75rem;">
            <p style="font-size:0.75rem; color:#6b7280; margin-bottom:0.5rem;">
              Precios = <strong>PVP</strong> (tarifas/v1/productos) + <strong>dto por grupo</strong> (tarifas_tipos).
            </p>

            <div class="form-grid">
              <div class="form-group" style="margin-bottom:0.5rem;">
                <label style="font-size:0.8rem;">Tipo de tarifa (A/B/C/D)</label>
                <select id="simTipoTarifa" class="input" style="height:32px; font-size:0.85rem;">
                  ${tipoOptions || `<option value="">(sin tipos cargados)</option>`}
                </select>
              </div>

              <div class="form-group" style="margin-bottom:0.5rem;">
                <label style="font-size:0.8rem;">Nivel por defecto</label>
                <select id="simTarifaDefecto" class="input" style="height:32px; font-size:0.85rem;">
                  ${nivelOptions}
                </select>
              </div>

              <div class="form-group" style="margin-bottom:0.5rem;">
                <label style="font-size:0.8rem;">Descuento global adicional (%)</label>
                <input id="simDtoGlobal" type="number" min="0" max="90" value="0"
                       style="height:32px; font-size:0.85rem;" />
                <p style="font-size:0.72rem; color:#6b7280; margin-top:0.2rem;">
                  Se aplica <strong>sobre el precio del nivel</strong> y se copia a "Dto línea".
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

        <div class="card" style="margin-bottom:0.75rem;">
          <div class="card-header"
               style="padding-bottom:0.35rem; display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
            <div class="card-title" style="font-size:0.95rem;">2 · Resumen (referencia PVP)</div>
            <div style="display:flex; gap:0.35rem;">
              <button id="btnSimPdf"
                style="padding:0.25rem 0.75rem;font-size:0.78rem;border-radius:999px;border:1px solid #d1d5db;background:#ffffff;color:#374151;cursor:pointer;">
                Exportar PDF
              </button>
              <button id="btnSimExcel"
                style="padding:0.25rem 0.75rem;font-size:0.78rem;border-radius:999px;border:1px solid #d1d5db;background:#ffffff;color:#374151;cursor:pointer;">
                Exportar Excel
              </button>
            </div>
          </div>
          <div class="card-body" id="simResumenCard"
               style="font-size:0.85rem; color:#111827; padding-top:0.5rem; padding-bottom:0.6rem;">
            No se ha calculado todavía la simulación.
          </div>
        </div>

        <div class="card">
          <div class="card-header" style="padding-bottom:0.35rem;">
            <div class="card-title" style="font-size:0.95rem;">3 · Cadena de márgenes hasta constructora</div>
          </div>
          <div class="card-body" style="font-size:0.84rem; color:#111827; padding-top:0.5rem; padding-bottom:0.6rem;">
            <div class="form-group" style="margin-bottom:0.5rem;">
              <label style="font-size:0.8rem;">Márgenes por actor (beneficio sobre precio de venta)</label>
              <div class="form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr)); gap:0.4rem;">
                <div>
                  <div style="font-size:0.72rem; color:#6b7280;">Distribuidor (%)</div>
                  <input id="simMgnDist" type="number" min="0" max="100" step="0.5"
                         style="width:100%; height:28px; font-size:0.8rem;" />
                </div>
                <div>
                  <div style="font-size:0.72rem; color:#6b7280;">Subdistribuidor (%)</div>
                  <input id="simMgnSubdist" type="number" min="0" max="100" step="0.5"
                         style="width:100%; height:28px; font-size:0.8rem;" />
                </div>
                <div>
                  <div style="font-size:0.72rem; color:#6b7280;">Instalador (%)</div>
                  <input id="simMgnInte" type="number" min="0" max="100" step="0.5"
                         style="width:100%; height:28px; font-size:0.8rem;" />
                </div>
                <div>
                  <div style="font-size:0.72rem; color:#6b7280;">Constructora (%)</div>
                  <input id="simMgnConst" type="number" min="0" max="100" step="0.5"
                         style="width:100%; height:28px; font-size:0.8rem;" />
                </div>
              </div>
            </div>

            <div id="simCadenaCard" style="margin-top:0.25rem; font-size:0.82rem;">
              Introduce márgenes para ver la cadena.
            </div>
          </div>
        </div>

      </div>

      <div class="simulador-right-column" style="flex:1 1 auto; min-width:0;">
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
                <button class="sim-tab" data-tab="2N">2N</button>
                <button class="sim-tab" data-tab="DIST">Distribuidor</button>
                <button class="sim-tab" data-tab="SUBDIST">Subdistribuidor</button>
                <button class="sim-tab" data-tab="INTE">Instalador</button>
                <button class="sim-tab" data-tab="CONST">Constructora</button>
              </div>

              <div style="display:flex; gap:0.35rem;">
                <button id="btnSimActorPdf"
                  style="padding:0.25rem 0.75rem;font-size:0.78rem;border-radius:999px;border:1px solid #d1d5db;background:#ffffff;color:#374151;cursor:pointer;">
                  PDF
                </button>
                <button id="btnSimActorExcel"
                  style="padding:0.25rem 0.75rem;font-size:0.78rem;border-radius:999px;border:1px solid #d1d5db;background:#ffffff;color:#374151;cursor:pointer;">
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

  // init inputs
  const selTipoTarifa = document.getElementById("simTipoTarifa");
  const selNivel = document.getElementById("simTarifaDefecto");
  const inpDtoGlobal = document.getElementById("simDtoGlobal");
  const inpMgnDist = document.getElementById("simMgnDist");
  const inpMgnSubdist = document.getElementById("simMgnSubdist");
  const inpMgnInte = document.getElementById("simMgnInte");
  const inpMgnConst = document.getElementById("simMgnConst");

  if (selTipoTarifa) selTipoTarifa.value = appState.simulador.tipoTarifaId || tipoDefault || "";
  if (selNivel) selNivel.value = appState.simulador.tarifaDefecto || "DIST_PRICE";
  if (inpDtoGlobal) inpDtoGlobal.value = appState.simulador.dtoGlobal || 0;
  if (inpMgnDist) inpMgnDist.value = appState.simulador.mgnDist || 0;
  if (inpMgnSubdist) inpMgnSubdist.value = appState.simulador.mgnSubdist || 0;
  if (inpMgnInte) inpMgnInte.value = appState.simulador.mgnInte || 0;
  if (inpMgnConst) inpMgnConst.value = appState.simulador.mgnConst || 0;

  const btnRecalc = document.getElementById("btnSimRecalcular");
  if (btnRecalc) btnRecalc.addEventListener("click", () => recalcularSimulador());

  if (selTipoTarifa) {
    selTipoTarifa.addEventListener("change", () => {
      appState.simulador.tipoTarifaId = selTipoTarifa.value || null;
      appState.simulador.lineDtoEdited = {};
      recalcularSimulador();
    });
  }

  if (selNivel) {
    selNivel.addEventListener("change", () => {
      appState.simulador.tarifaDefecto = selNivel.value || "DIST_PRICE";
      appState.simulador.lineDtoEdited = {};
      recalcularSimulador();
    });
  }

  if (inpDtoGlobal) inpDtoGlobal.addEventListener("change", () => recalcularSimulador());
  if (inpMgnDist) inpMgnDist.addEventListener("change", () => recalcularSimulador());
  if (inpMgnSubdist) inpMgnSubdist.addEventListener("change", () => recalcularSimulador());
  if (inpMgnInte) inpMgnInte.addEventListener("change", () => recalcularSimulador());
  if (inpMgnConst) inpMgnConst.addEventListener("change", () => recalcularSimulador());

  const btnPdf = document.getElementById("btnSimPdf");
  if (btnPdf) btnPdf.addEventListener("click", async () => exportarSimuladorPDF(appState.simulador.actorTab || "2N"));

  const btnExcel = document.getElementById("btnSimExcel");
  if (btnExcel) btnExcel.addEventListener("click", () => exportarSimuladorExcel(appState.simulador.actorTab || "2N"));

  const btnActorPdf = document.getElementById("btnSimActorPdf");
  if (btnActorPdf) btnActorPdf.addEventListener("click", async () => exportarSimuladorPDF(appState.simulador.actorTab || "2N"));

  const btnActorExcel = document.getElementById("btnSimActorExcel");
  if (btnActorExcel) btnActorExcel.addEventListener("click", () => exportarSimuladorExcel(appState.simulador.actorTab || "2N"));

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

  recalcularSimulador();
}

// ===============================
// SIMULACIÓN
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
    detalle.textContent = "No hay líneas de presupuesto. Ve a Presupuesto y genera una oferta.";
    resumenCard.textContent = "Sin datos de presupuesto, no se puede realizar la simulación.";
    cadenaCard.textContent = "Sin datos de simulación, no se puede calcular la cadena de márgenes.";
    if (countLabel) countLabel.textContent = "0 líneas simuladas";
    return;
  }

  const tipos = await ensureTarifasTiposLoaded();
  const tipoId = appState.simulador.tipoTarifaId || getTipoTarifaSeleccionadoId(tipos);
  const tipo = (tipoId && tipos && tipos[tipoId]) ? tipos[tipoId] : null;

  if (!tipo) {
    detalle.textContent = "No hay tipos de tarifa cargados (tarifas_tipos).";
    resumenCard.textContent = "No se puede simular sin un tipo de tarifa.";
    cadenaCard.textContent = "—";
    if (countLabel) countLabel.textContent = "0 líneas simuladas";
    return;
  }

  const selNivel = document.getElementById("simTarifaDefecto");
  const inpDtoGlobal = document.getElementById("simDtoGlobal");
  const inpMgnDist = document.getElementById("simMgnDist");
  const inpMgnSubdist = document.getElementById("simMgnSubdist");
  const inpMgnInte = document.getElementById("simMgnInte");
  const inpMgnConst = document.getElementById("simMgnConst");

  const tarifaDefecto = (selNivel && selNivel.value) || appState.simulador.tarifaDefecto || "DIST_PRICE";
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

  const actorTab = appState.simulador.actorTab || "2N";
  const esTab2N = actorTab === "2N";

  const configPrev = esTab2N ? leerConfigLineasDesdeDOM() : {};
  const editedMap = appState.simulador.lineDtoEdited || {};

  const tarifasBase = await getTarifasBase2N();
  const tarifasIndex = appState.tarifasBaseSimIndex || buildTarifasIndex(tarifasBase);
  appState.tarifasBaseSimIndex = tarifasIndex;

  let totalPvpBase = 0;
  let totalBaseTarifa = 0;
  let totalFinal2N = 0;

  const nivel = NIVEL_MAP[tarifaDefecto] || NIVEL_MAP["DIST_PRICE"];
  const levelKey = nivel ? nivel.level : "dist";

  const lineasSim = lineasBase.map((lBase, index) => {
    const key = buildLineaKey(lBase, index);

    const info = lookupTarifaInfoIndexed(tarifasIndex, lBase.ref) || {};
    const refFinal = String(lBase.ref || "").trim().replace(/\s+/g, "");

    const basePvp = Number(info.pvp) || Number(lBase.pvp || 0) || 0;
    const cantidad = Number(lBase.cantidad || 0) || 0;

    const desc = lBase.descripcion || info.descripcion || info.desc || info.Nombre || info.name || "Producto sin descripción";
    const gid = clasificarGrupoPorDescripcion(desc);

    // PRECIO del nivel desde tipo (PVP + dto grupo)
    const pvpTarifaUd = calcPrecioDesdeTipo(tipo, gid, levelKey, basePvp);

    // dto tarifa real (vs PVP)
    const dtoTarifaReal = calcDtoVsPvp(basePvp, pvpTarifaUd);

    // dto línea editable solo en 2N
    const cfg = configPrev[key] || {};
    let dtoLinea;
    if (esTab2N && editedMap[key]) dtoLinea = Number(cfg.dtoLinea || 0) || 0;
    else dtoLinea = dtoGlobal;

    const factorLinea = 1 - dtoLinea / 100;
    const pvpFinalUd = pvpTarifaUd * factorLinea;

    const subtotalPvpBase = basePvp * cantidad;
    const subtotalTarifa = pvpTarifaUd * cantidad;
    const subtotalFinal = pvpFinalUd * cantidad;

    totalPvpBase += subtotalPvpBase;
    totalBaseTarifa += subtotalTarifa;
    totalFinal2N += subtotalFinal;

    return {
      key,
      ref: refFinal || "-",
      descripcion: desc,
      seccion: lBase.seccion || "",
      titulo: lBase.titulo || "",
      cantidad,
      basePvp,
      tarifaId: tarifaDefecto,
      dtoTarifa: dtoTarifaReal,
      dtoLinea,
      pvpTarifaUd,
      pvpFinalUd,
      subtotalTarifa,
      subtotalFinal,
      __grupo: gid,
    };
  });

  appState.simulador.lineasSimuladas = lineasSim;
  if (countLabel) countLabel.textContent = `${lineasSim.length} líneas simuladas`;

  const actorLabel = getLabelActor(actorTab);
  const actorFactor = getFactorActor(actorTab, mgnDist, mgnSubdist, mgnInte, mgnConst);

  const totalActor = totalFinal2N * actorFactor;
  const dtoActorTotal = totalPvpBase > 0 ? (1 - totalActor / totalPvpBase) * 100 : 0;

  // ===== tabla =====
  let html = `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:0.75rem; margin-bottom:0.5rem; flex-wrap:wrap;">
      <div style="font-size:0.9rem; color:#111827;">
        Vista: <strong>${actorLabel}</strong>
        <div style="font-size:0.78rem; color:#6b7280; margin-top:0.15rem;">
          Tipo: <strong>${tipo.nombre || tipo.id}</strong> · Nivel: <strong>${nivel.label}</strong><br/>
          Total ${actorLabel}: <strong>${totalActor.toFixed(2)} €</strong>
          <span style="color:#6b7280;">(dto vs PVP: ${dtoActorTotal.toFixed(1)} %)</span>
        </div>
      </div>
      <div style="font-size:0.78rem; color:#6b7280;">
        Factor aplicado: <strong>x${actorFactor.toFixed(4)}</strong>
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
    const dtoVsPvpLinea = l.basePvp > 0 ? (1 - precioActorUd / l.basePvp) * 100 : 0;

    const dtoLineaCell = esTab2N
      ? `
        <input
          type="number"
          class="input sim-dto-line"
          data-key="${l.key}"
          min="0" max="90" step="0.5"
          value="${Number(l.dtoLinea || 0).toFixed(1)}"
          style="width:80px; font-size:0.78rem; padding:0.15rem 0.25rem;"
        />
      `
      : `<span style="color:#6b7280;">${Number(l.dtoLinea || 0).toFixed(1)} %</span>`;

    html += `
      <tr data-key="${l.key}">
        <td>${l.ref}</td>
        <td>
          ${l.descripcion}
          ${
            l.seccion || l.titulo
              ? `<div style="font-size:0.75rem; color:#6b7280; margin-top:0.15rem;">
                   ${l.seccion ? `<strong>${l.seccion}</strong>` : ""}${l.seccion && l.titulo ? " · " : ""}${l.titulo || ""}
                 </div>`
              : ""
          }
        </td>
        <td>${l.cantidad}</td>
        <td>${Number(l.dtoTarifa || 0).toFixed(1)} %</td>
        <td>${dtoLineaCell}</td>
        <td>${Number(l.basePvp || 0).toFixed(2)} €</td>
        <td>${precioActorUd.toFixed(2)} €</td>
        <td>${dtoVsPvpLinea.toFixed(1)} %</td>
        <td>${importeActor.toFixed(2)} €</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  detalle.innerHTML = html;

  // tabs style
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

  // listeners dto línea
  if (esTab2N) {
    detalle.querySelectorAll(".sim-dto-line").forEach((input) => {
      input.addEventListener("change", (e) => {
        const k = e.target.dataset.key;
        if (k) {
          appState.simulador.lineDtoEdited = appState.simulador.lineDtoEdited || {};
          appState.simulador.lineDtoEdited[k] = true;
        }
        recalcularSimulador();
      });
    });
  }

  // ===== resumen =====
  const dtoTarifaEf = totalPvpBase > 0 ? (1 - totalBaseTarifa / totalPvpBase) * 100 : 0;
  const dtoTotalEf = totalPvpBase > 0 ? (1 - totalFinal2N / totalPvpBase) * 100 : 0;
  const dtoExtraEf = totalBaseTarifa > 0 ? (1 - totalFinal2N / totalBaseTarifa) * 100 : 0;

  resumenCard.innerHTML = `
    <div style="font-size:0.84rem;">
      <div>Tipo: <strong>${tipo.nombre || tipo.id}</strong> · Nivel: <strong>${nivel.label}</strong></div>
      <div>PVP base total: <strong>${totalPvpBase.toFixed(2)} €</strong></div>
      <div>
        Total tras nivel:
        <strong>${totalBaseTarifa.toFixed(2)} €</strong>
        <span style="color:#6b7280;">(${dtoTarifaEf.toFixed(1)} % dto vs PVP)</span>
      </div>
      <div>
        Total 2N (nivel + dto adicional):
        <strong>${totalFinal2N.toFixed(2)} €</strong>
        <span style="color:#6b7280;">(${dtoTotalEf.toFixed(1)} % dto vs PVP)</span>
      </div>
      <div style="font-size:0.78rem; color:#4b5563; margin-top:0.15rem;">
        Dto extra sobre el nivel (dto adicional de línea): <strong>${dtoExtraEf.toFixed(1)} %</strong>
      </div>
      <div style="font-size:0.78rem; color:#4b5563; margin-top:0.25rem;">
        <strong>Total ${actorLabel} (pestaña activa):</strong>
        ${totalActor.toFixed(2)} €
        <span style="color:#6b7280;">(dto vs PVP: ${dtoActorTotal.toFixed(1)} %)</span>
      </div>
    </div>
  `;

  // ===== cadena =====
  const precio2N = totalFinal2N;
  const precioDist    = aplicarMargenSobreVenta(precio2N,      mgnDist);
  const precioSubdist = aplicarMargenSobreVenta(precioDist,    mgnSubdist);
  const precioInte    = aplicarMargenSobreVenta(precioSubdist, mgnInte);
  const precioConst   = aplicarMargenSobreVenta(precioInte,    mgnConst);

  const desc2N    = totalPvpBase > 0 ? (1 - precio2N / totalPvpBase) * 100 : 0;
  const descDist  = totalPvpBase > 0 ? (1 - precioDist / totalPvpBase) * 100 : 0;
  const descSub   = totalPvpBase > 0 ? (1 - precioSubdist / totalPvpBase) * 100 : 0;
  const descInte  = totalPvpBase > 0 ? (1 - precioInte / totalPvpBase) * 100 : 0;
  const descConst = totalPvpBase > 0 ? (1 - precioConst / totalPvpBase) * 100 : 0;

  cadenaCard.innerHTML = `
    <div style="font-size:0.82rem;">
      <div style="margin-bottom:0.18rem;"><strong>2N (precio simulado):</strong> ${precio2N.toFixed(2)} € <span style="color:#6b7280;">(${desc2N.toFixed(1)} % vs PVP)</span></div>
      <div style="margin-bottom:0.18rem;"><strong>Distribuidor (${mgnDist.toFixed(1)} %):</strong> ${precioDist.toFixed(2)} € <span style="color:#6b7280;">(${descDist.toFixed(1)} % vs PVP)</span></div>
      <div style="margin-bottom:0.18rem;"><strong>Subdistribuidor (${mgnSubdist.toFixed(1)} %):</strong> ${precioSubdist.toFixed(2)} € <span style="color:#6b7280;">(${descSub.toFixed(1)} % vs PVP)</span></div>
      <div style="margin-bottom:0.18rem;"><strong>Instalador (${mgnInte.toFixed(1)} %):</strong> ${precioInte.toFixed(2)} € <span style="color:#6b7280;">(${descInte.toFixed(1)} % vs PVP)</span></div>
      <div><strong>Constructora (${mgnConst.toFixed(1)} %):</strong> ${precioConst.toFixed(2)} € <span style="color:#6b7280;">(${descConst.toFixed(1)} % vs PVP)</span></div>
    </div>
  `;
}

// ===============================
// EXPORT PDF/EXCEL (mantengo tu lógica original)
// ===============================
async function exportarSimuladorPDF(actorTab) {
  await recalcularSimulador();

  const lineas = appState.simulador.lineasSimuladas || [];
  if (!lineas.length) return alert("No hay datos de simulación para exportar a PDF.");

  const presu = (typeof getPresupuestoActual === "function" && getPresupuestoActual()) || {};
  const nombreProyecto = presu.nombre || "Proyecto sin nombre";
  const fechaPresu = presu.fecha || "";

  const tab = actorTab || appState.simulador.actorTab || "2N";
  const actorLabel = getLabelActor(tab);

  const mgnDist = Number(appState.simulador.mgnDist || 0);
  const mgnSubdist = Number(appState.simulador.mgnSubdist || 0);
  const mgnInte = Number(appState.simulador.mgnInte || 0);
  const mgnConst = Number(appState.simulador.mgnConst || 0);
  const actorFactor = getFactorActor(tab, mgnDist, mgnSubdist, mgnInte, mgnConst);

  let totalPvpBase = 0;
  let totalActor = 0;
  lineas.forEach((l) => {
    totalPvpBase += (Number(l.basePvp) || 0) * (Number(l.cantidad) || 0);
    totalActor += (Number(l.subtotalFinal) || 0) * actorFactor;
  });
  const dtoActorTotal = totalPvpBase > 0 ? (1 - totalActor / totalPvpBase) * 100 : 0;

  const jsPDFGlobal = window.jspdf || window.jsPDF;
  if (!jsPDFGlobal) return alert("No está disponible la librería jsPDF.");

  const jsPDFCtor = jsPDFGlobal.jsPDF || jsPDFGlobal;
  const doc = new jsPDFCtor("p", "mm", "a4");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Simulación · ${actorLabel}`, 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const fechaTexto = fechaPresu || new Date().toLocaleDateString();
  doc.text(`Proyecto: ${nombreProyecto}`, 14, 23);
  doc.text(`Fecha: ${fechaTexto}`, 14, 28);

  let y = 36;
  doc.setFont("helvetica", "bold");
  doc.text("Totales", 14, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.text(`PVP base total: ${totalPvpBase.toFixed(2)} €`, 14, y);
  y += 5;
  doc.text(`Total ${actorLabel}: ${totalActor.toFixed(2)} €  (dto vs PVP: ${dtoActorTotal.toFixed(1)} %)`, 14, y);
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
    const importe = Number(l.subtotalFinal || 0) * actorFactor;
    const dtoVsPvp = Number(l.basePvp) > 0 ? (1 - precioUd / Number(l.basePvp)) * 100 : 0;
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

  const autoTable = doc.autoTable || (jsPDFGlobal.autoTable && jsPDFGlobal.autoTable.bind(doc));
  if (!autoTable) {
    alert("No está disponible jsPDF-autoTable.");
    return doc.save(`simulacion_${actorLabel}.pdf`);
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

function exportarSimuladorExcel(actorTab) {
  const XLSX = window.XLSX;
  if (!XLSX) return alert("No está disponible XLSX (SheetJS).");

  const lineas = appState.simulador.lineasSimuladas || [];
  if (!lineas.length) return alert("No hay datos de simulación para exportar a Excel.");

  const presu = (typeof getPresupuestoActual === "function" && getPresupuestoActual()) || {};
  const nombreProyecto = presu.nombre || "Proyecto sin nombre";
  const fechaPresu = presu.fecha || "";

  const tab = actorTab || appState.simulador.actorTab || "2N";
  const actorLabel = getLabelActor(tab);

  const mgnDist = Number(appState.simulador.mgnDist || 0);
  const mgnSubdist = Number(appState.simulador.mgnSubdist || 0);
  const mgnInte = Number(appState.simulador.mgnInte || 0);
  const mgnConst = Number(appState.simulador.mgnConst || 0);
  const actorFactor = getFactorActor(tab, mgnDist, mgnSubdist, mgnInte, mgnConst);

  let totalPvpBase = 0;
  let totalActor = 0;
  lineas.forEach((l) => {
    totalPvpBase += (Number(l.basePvp) || 0) * (Number(l.cantidad) || 0);
    totalActor += (Number(l.subtotalFinal) || 0) * actorFactor;
  });
  const dtoActorTotal = totalPvpBase > 0 ? (1 - totalActor / totalPvpBase) * 100 : 0;

  const rows = [];
  rows.push([`Simulación · ${actorLabel}`]);
  rows.push([`Proyecto: ${nombreProyecto}`]);
  rows.push([`Fecha: ${fechaPresu || new Date().toLocaleDateString()}`]);
  rows.push([`PVP base total: ${totalPvpBase.toFixed(2)} €`]);
  rows.push([`Total ${actorLabel}: ${totalActor.toFixed(2)} €`, `Dto vs PVP: ${dtoActorTotal.toFixed(1)} %`]);
  rows.push([]);

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
    const importe = Number(l.subtotalFinal || 0) * actorFactor;
    const dtoVsPvp = Number(l.basePvp) > 0 ? (1 - precioUd / Number(l.basePvp)) * 100 : 0;

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
// Exponer
// ===============================
window.renderSimuladorView = renderSimuladorView;
window.exportarSimuladorPDF = exportarSimuladorPDF;
window.exportarSimuladorExcel = exportarSimuladorExcel;

console.log("%cUI Simulador · FIX tarifas_tipos + PVP", "color:#22c55e; font-weight:bold;");
