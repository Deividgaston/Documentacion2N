// js/ui_simulador.js
// SIMULADOR de tarifas por rol a partir del presupuesto actual

window.appState = window.appState || {};
appState.simulador = appState.simulador || {
  rol: "PVP",
  dtoExtra: 0,          // descuento adicional global sobre el rol elegido
  lineasSimuladas: [],  // cache de resultado
};

appState.tarifasRolCache = appState.tarifasRolCache || null;

// Si existen helpers del presupuesto, los usamos
const getPresupuestoActual =
  typeof window.getPresupuestoActual === "function"
    ? window.getPresupuestoActual
    : null;

// ===============================
// CONFIGURACIÓN DE ROLES
// ===============================
const ROLES_TARIFA = [
  { id: "PVP", label: "PVP público" },
  { id: "INSTALADOR", label: "Instalador" },
  { id: "PARTNER", label: "Partner / Integrador" },
  { id: "PROMOTOR", label: "Promotor / BTR" },
];

// Mapeo de campos que habrá en Firestore para cada rol
// Ajusta estos nombres a tu estructura real de Firestore
const ROL_FIELD_MAP = {
  PVP: "pvp_pvp",             // o simplemente "pvp" si quieres
  INSTALADOR: "pvp_instalador",
  PARTNER: "pvp_partner",
  PROMOTOR: "pvp_promotor",
};

console.log(
  "%cUI Simulador · v1 · roles de tarifa",
  "color:#22c55e; font-weight:bold;"
);

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
                Compara cómo cambia el presupuesto según el rol y descuentos adicionales.
              </div>
            </div>
            <span class="badge-step">Paso 3 de 3</span>
          </div>

          <div class="card-body">
            <div class="form-group">
              <label>Fuente de líneas</label>
              <p style="font-size:0.8rem; color:#6b7280; margin-top:0.25rem;">
                Se utilizan las líneas del <strong>presupuesto actual</strong> (ref, descripción y cantidades).
              </p>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label>Rol de tarifa</label>
                <select id="simRol" class="input">
                  ${ROLES_TARIFA.map(
                    (r) =>
                      `<option value="${r.id}">${
                        r.label
                      }</option>`
                  ).join("")}
                </select>
                <p style="font-size:0.75rem; color:#6b7280; margin-top:0.25rem;">
                  Cada rol usa su precio específico desde la base de datos (tarifas 2N por rol).
                </p>
              </div>

              <div class="form-group">
                <label>Descuento adicional (%)</label>
                <input id="simDtoExtra" type="number" min="0" max="90" value="0" />
                <p style="font-size:0.75rem; color:#6b7280; margin-top:0.25rem;">
                  Se aplica sobre el precio del rol seleccionado (ej. promo especial de proyecto).
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

  // Inicializar UI con estado guardado
  const rolSelect = document.getElementById("simRol");
  const dtoExtraInput = document.getElementById("simDtoExtra");

  if (rolSelect) {
    rolSelect.value = appState.simulador.rol || "PVP";
  }
  if (dtoExtraInput) {
    dtoExtraInput.value = appState.simulador.dtoExtra || 0;
  }

  const btnRecalc = document.getElementById("btnSimRecalcular");
  if (btnRecalc) {
    btnRecalc.addEventListener("click", () => {
      recalcularSimulador();
    });
  }

  // Primera carga automática
  recalcularSimulador();
}

// ===============================
// Cargar tarifas con precios por rol
// (una sola lectura a Firestore, cache global)
// ===============================
async function cargarTarifasPorRolDesdeFirestore() {
  if (appState.tarifasRolCache) {
    console.log(
      "%cSimulador · tarifasRol desde caché (" +
        Object.keys(appState.tarifasRolCache).length +
        " refs)",
      "color:#16a34a;"
    );
    return appState.tarifasRolCache;
  }

  const db = firebase.firestore();
  const snap = await db
    .collection("tarifas")
    .doc("v1")
    .collection("productos")
    .get();

  const result = {};

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (!d) return;

    const ref = docSnap.id.replace(/\s+/g, "");
    const basePvp = Number(d.pvp) || 0;

    result[ref] = {
      base: basePvp,
      // Si el campo específico de rol no existe, se cae al base
      PVP: Number(d[ROL_FIELD_MAP.PVP]) || basePvp,
      INSTALADOR: Number(d[ROL_FIELD_MAP.INSTALADOR]) || basePvp,
      PARTNER: Number(d[ROL_FIELD_MAP.PARTNER]) || basePvp,
      PROMOTOR: Number(d[ROL_FIELD_MAP.PROMOTOR]) || basePvp,
      descripcion:
        d.descripcion ||
        d.desc ||
        d.nombre ||
        d.title ||
        d.titulo ||
        "",
    };
  });

  console.log(
    "%cSimulador · tarifasRol cargadas (" +
      Object.keys(result).length +
      " refs)",
    "color:#3b82f6;"
  );

  appState.tarifasRolCache = result;
  return result;
}

// ===============================
// Lógica principal de simulación
// ===============================
async function recalcularSimulador() {
  const detalle = document.getElementById("simDetalle");
  const resumenMini = document.getElementById("simResumenMini");
  const countLabel = document.getElementById("simLineCount");
  if (!detalle || !resumenMini) return;

  // 1) Obtenemos el presupuesto actual como fuente de referencias
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

  // 2) Parámetros de simulación desde la UI
  const rolSelect = document.getElementById("simRol");
  const dtoExtraInput = document.getElementById("simDtoExtra");

  const rol = (rolSelect && rolSelect.value) || "PVP";
  const dtoExtra = Number(dtoExtraInput && dtoExtraInput.value) || 0;

  appState.simulador.rol = rol;
  appState.simulador.dtoExtra = dtoExtra;

  // 3) Cargar tarifas por rol (con caché)
  const tarifasRol = await cargarTarifasPorRolDesdeFirestore();

  // 4) Generar líneas simuladas
  let totalBaseRol = 0;
  let totalFinal = 0;

  const lineasSim = lineasBase.map((lBase) => {
    const refNorm = String(lBase.ref || "")
      .trim()
      .replace(/\s+/g, "");
    const info = tarifasRol[refNorm] || {};

    // Precio base del rol: si no hay para ese rol, usamos base o el PVP del presupuesto
    const precioRol =
      info[rol] != null && !Number.isNaN(info[rol])
        ? Number(info[rol])
        : info.base != null && !Number.isNaN(info.base)
        ? Number(info.base)
        : Number(lBase.pvp || 0);

    const cantidad = Number(lBase.cantidad || 0) || 0;

    const baseRolSubtotal = precioRol * cantidad;
    totalBaseRol += baseRolSubtotal;

    const factorExtra = dtoExtra > 0 ? 1 - dtoExtra / 100 : 1;
    const precioFinalUd = precioRol * factorExtra;
    const subtotalFinal = precioFinalUd * cantidad;
    totalFinal += subtotalFinal;

    return {
      ref: refNorm || lBase.ref || "-",
      descripcion:
        lBase.descripcion ||
        info.descripcion ||
        "Producto sin descripción",
      seccion: lBase.seccion || "",
      titulo: lBase.titulo || "",
      cantidad,
      precioRol,
      precioFinalUd,
      subtotalFinal,
      baseRolSubtotal,
    };
  });

  appState.simulador.lineasSimuladas = lineasSim;

  // 5) Pintar tabla
  if (countLabel) {
    countLabel.textContent = `${lineasSim.length} líneas simuladas`;
  }

  let html = `
    <table class="table">
      <thead>
        <tr>
          <th style="width:14%;">Ref.</th>
          <th>Descripción</th>
          <th style="width:10%;">Ud.</th>
          <th style="width:12%;">Precio ${rol}</th>
          <th style="width:12%;">Dto extra</th>
          <th style="width:12%;">Precio final</th>
          <th style="width:14%;">Importe final</th>
        </tr>
      </thead>
      <tbody>
  `;

  lineasSim.forEach((l) => {
    html += `
      <tr>
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
        <td>${l.precioRol.toFixed(2)} €</td>
        <td>${dtoExtra.toFixed(1)} %</td>
        <td>${l.precioFinalUd.toFixed(2)} €</td>
        <td>${l.subtotalFinal.toFixed(2)} €</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  detalle.innerHTML = html;

  // 6) Resumen mini
  const diff = totalFinal - totalBaseRol;
  const diffPct =
    totalBaseRol > 0 ? (diff / totalBaseRol) * 100 : 0;

  const rolLabel =
    ROLES_TARIFA.find((r) => r.id === rol)?.label || rol;

  resumenMini.innerHTML = `
    <div style="margin-bottom:0.35rem;">
      <strong>Rol seleccionado:</strong> ${rolLabel}
    </div>
    <div>
      Importe total a precios de rol (sin descuento extra):
      <strong>${totalBaseRol.toFixed(2)} €</strong>
    </div>
    <div>
      Importe total con descuento adicional (${dtoExtra.toFixed(
        1
      )}%):
      <strong>${totalFinal.toFixed(2)} €</strong>
    </div>
    <div style="margin-top:0.35rem; font-size:0.8rem; color:${
      diff >= 0 ? "#16a34a" : "#b91c1c"
    };">
      Diferencia vs. precio de rol: 
      <strong>${diff.toFixed(2)} € (${diffPct.toFixed(1)} %)</strong>
    </div>
  `;
}

// ===============================
// Exponer global
// ===============================
window.renderSimuladorView = renderSimuladorView;
