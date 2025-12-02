// js/ui_simulador.js
// Página de SIMULADOR de márgenes y tarifas

window.appState = window.appState || {};
appState.simulador = appState.simulador || {
  ref: "",
  descripcion: "",
  pvpBase: 0,
  cantidad: 1,
  roles: null, // se rellena con DEFAULT_SIM_ROLES
};

// Márgenes por defecto sacados de la PLANTILLA 4.0 (hoja TARIFA, fila 0)
const DEFAULT_SIM_ROLES = [
  { id: "nfrd",   label: "NFR Distribuidor",          descuento: 55 },
  { id: "rnfr",   label: "RNFR Reseller",             descuento: 50 },
  { id: "vad",    label: "VAD / Mayorista",           descuento: 39 },
  { id: "bbd",    label: "BBD / Proyecto",            descuento: 39 },
  { id: "rp2",    label: "RP2",                       descuento: 28 },
  { id: "rp1",    label: "RP1 (PVP recomendado)",     descuento: 10 },
];

// ===============================================
// Render principal de la vista SIMULADOR
// ===============================================
function renderSimuladorView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  const sim = appState.simulador || {};
  if (!sim.roles) {
    // Clonamos la config por defecto
    sim.roles = DEFAULT_SIM_ROLES.map((r) => ({ ...r }));
  }

  container.innerHTML = `
    <div class="presupuesto-layout">

      <!-- COLUMNA IZQUIERDA: parámetros de simulación -->
      <div class="presupuesto-left-column">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Simulador de márgenes</div>
              <div class="card-subtitle">
                Juega con referencias, descuentos y márgenes para cada rol
                partiendo de la tarifa oficial 2N.
              </div>
            </div>
            <span class="badge-step">Herramienta de apoyo</span>
          </div>

          <div class="card-body">
            <div class="form-group">
              <label>Referencia 2N</label>
              <div style="display:flex; gap:0.5rem;">
                <input id="simRef" type="text" class="input" style="flex:1;"
                  placeholder="Ej: 9155101" />
                <button id="simBuscarRef" class="btn btn-secondary">
                  Buscar
                </button>
              </div>
              <p style="font-size:0.78rem; color:#6b7280; margin-top:0.25rem;">
                Si la referencia existe en la tarifa (Firestore), se cargarán automáticamente
                la descripción y el PVP base.
              </p>
            </div>

            <div class="form-group mt-2">
              <label>Descripción</label>
              <textarea id="simDescripcion" rows="2"
                placeholder="Descripción del producto"></textarea>
            </div>

            <div class="form-grid mt-2">
              <div class="form-group">
                <label>PVP base (PRECIO UNITARIO)</label>
                <input id="simPvpBase" type="number" min="0" step="0.01" />
                <p style="font-size:0.78rem; color:#6b7280; margin-top:0.15rem;">
                  Es el PVP lista de tarifa. Desde aquí se calculan los distintos precios netos.
                </p>
              </div>
              <div class="form-group">
                <label>Cantidad</label>
                <input id="simCantidad" type="number" min="1" value="1" />
              </div>
            </div>

            <div class="form-group mt-3">
              <label>Márgenes por rol</label>
              <p style="font-size:0.78rem; color:#6b7280; margin-bottom:0.35rem;">
                Valores por defecto basados en tu PLANTILLA 4.0 (hoja TARIFA). 
                Puedes modificarlos para simular distintos escenarios.
              </p>
              <table class="table" style="font-size:0.8rem;">
                <thead>
                  <tr>
                    <th>Rol / nivel de tarifa</th>
                    <th style="width:100px;">Dto. desde PVP</th>
                  </tr>
                </thead>
                <tbody id="simRolesTbody">
                  ${sim.roles
                    .map(
                      (r, idx) => `
                    <tr>
                      <td>${r.label}</td>
                      <td>
                        <div style="display:flex; align-items:center; gap:0.25rem;">
                          <input type="number" min="0" max="95" step="0.5"
                            class="sim-role-discount input"
                            data-index="${idx}"
                            value="${r.descuento}" />
                          <span>%</span>
                        </div>
                      </td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>

            <button id="simResetRoles" class="btn btn-secondary btn-sm mt-2">
              Restablecer márgenes por defecto
            </button>
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA: resultados -->
      <div class="presupuesto-right-column">
        <div class="card">
          <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
            <div class="card-title">
              Resultado de la simulación
            </div>
          </div>
          <div class="card-body" id="simResultado">
            Introduce una referencia o un PVP base para ver aquí el detalle.
          </div>
        </div>
      </div>

    </div>
  `;

  // Precargar estado si existía algo
  document.getElementById("simRef").value = sim.ref || "";
  document.getElementById("simDescripcion").value = sim.descripcion || "";
  document.getElementById("simPvpBase").value =
    sim.pvpBase != null ? sim.pvpBase : "";
  document.getElementById("simCantidad").value = sim.cantidad || 1;

  // Eventos básicos
  const btnBuscar = document.getElementById("simBuscarRef");
  if (btnBuscar) btnBuscar.addEventListener("click", onSimBuscarRef);

  const inpPvpBase = document.getElementById("simPvpBase");
  const inpCantidad = document.getElementById("simCantidad");
  const inpDesc = document.getElementById("simDescripcion");
  const inpRef = document.getElementById("simRef");

  if (inpPvpBase) inpPvpBase.addEventListener("input", onSimInputsChange);
  if (inpCantidad) inpCantidad.addEventListener("input", onSimInputsChange);
  if (inpDesc) inpDesc.addEventListener("input", onSimInputsChange);
  if (inpRef) inpRef.addEventListener("input", onSimInputsChange);

  // Cambios en descuentos por rol
  document.querySelectorAll(".sim-role-discount").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.index);
      const val = Number(e.target.value) || 0;
      const sim = appState.simulador;
      if (!sim.roles || !sim.roles[idx]) return;
      sim.roles[idx].descuento = val;
      recalcularSimulador();
    });
  });

  const btnReset = document.getElementById("simResetRoles");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      const sim = appState.simulador;
      sim.roles = DEFAULT_SIM_ROLES.map((r) => ({ ...r }));
      renderSimuladorView(); // volvemos a pintar con valores por defecto
    });
  }

  // Cálculo inicial (si hubiera estado guardado)
  recalcularSimulador();
}

// ===============================================
// Gestión de cambios en inputs simples
// ===============================================
function onSimInputsChange() {
  const sim = appState.simulador || {};
  sim.ref = (document.getElementById("simRef").value || "").trim();
  sim.descripcion =
    (document.getElementById("simDescripcion").value || "").trim();
  sim.pvpBase = Number(
    document.getElementById("simPvpBase").value || 0
  );
  sim.cantidad = Number(
    document.getElementById("simCantidad").value || 1
  );
  appState.simulador = sim;
  recalcularSimulador();
}

// ===============================================
// Buscar referencia en Firestore (tarifa 2N)
// reutiliza cargarTarifasDesdeFirestore / lógica de normalización
// ===============================================
async function onSimBuscarRef() {
  const refInput = document.getElementById("simRef");
  if (!refInput) return;

  const raw = (refInput.value || "").trim();
  if (!raw) return;

  const producto = await simBuscarProductoEnTarifa(raw);
  if (!producto) {
    alert("No se ha encontrado esa referencia en la tarifa.");
    return;
  }

  const sim = appState.simulador || {};
  sim.ref = raw;
  sim.descripcion = producto.descripcion || "";
  sim.pvpBase = Number(producto.pvp) || 0;
  appState.simulador = sim;

  document.getElementById("simDescripcion").value = sim.descripcion;
  document.getElementById("simPvpBase").value = sim.pvpBase.toFixed(2);

  recalcularSimulador();
}

async function simObtenerTarifas() {
  // Si ya tienes la función global de presupuesto, la aprovechamos
  if (typeof cargarTarifasDesdeFirestore === "function") {
    return await cargarTarifasDesdeFirestore();
  }

  // Fallback: misma lógica que en ui_presupuesto, pero sólo si hiciera falta
  if (appState.tarifasCache) return appState.tarifasCache;

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
    const ref = docSnap.id;
    const pvp = Number(d.pvp) || 0;
    if (!pvp) return;
    result[ref] = {
      pvp,
      descripcion:
        d.descripcion ||
        d.desc ||
        d.nombre ||
        d.title ||
        d.titulo ||
        "",
    };
  });

  appState.tarifasCache = result;
  return result;
}

async function simBuscarProductoEnTarifa(refRaw) {
  const tarifas = await simObtenerTarifas();
  if (!tarifas) return null;

  const refOriginal = String(refRaw || "").trim();
  let ref = refOriginal.replace(/\s+/g, "");

  // Normalización tipo 9xxxxxxx0/00
  if (/^9\d{7}$/.test(ref)) {
    ref = ref.slice(0, 7);
  }

  const candidatos = [];
  if (refOriginal) candidatos.push(refOriginal.replace(/\s+/g, ""));
  if (ref) candidatos.push(ref);

  if (ref.length === 7) {
    candidatos.push(ref + "0");
    candidatos.push(ref + "00");
  } else if (ref.length === 8) {
    candidatos.push(ref.slice(0, 7));
  }

  const candidatosUnicos = [...new Set(candidatos)];

  for (const key of candidatosUnicos) {
    if (tarifas[key]) return tarifas[key];
  }

  return null;
}

// ===============================================
// Recalcular tabla del simulador
// ===============================================
function recalcularSimulador() {
  const cont = document.getElementById("simResultado");
  if (!cont) return;

  const sim = appState.simulador || {};
  const pvpBase = Number(sim.pvpBase) || 0;
  const cantidad = Number(sim.cantidad) || 1;
  const roles = sim.roles || [];

  if (!pvpBase || !roles.length) {
    cont.textContent =
      "Introduce un PVP base o busca una referencia para ver la simulación.";
    return;
  }

  // Calculamos precios por rol
  const filas = roles.map((r) => {
    const dto = Number(r.descuento) || 0;
    const factor = 1 - dto / 100;
    const neto = pvpBase * factor;
    const total = neto * cantidad;
    const margenEuro = pvpBase - neto;
    return {
      label: r.label,
      dto,
      neto,
      total,
      margenEuro,
      margenPct: dto,
    };
  });

  let html = `
    <div style="font-size:0.85rem; color:#4b5563; margin-bottom:0.5rem;">
      Ref: <strong>${sim.ref || "-"}</strong> · 
      Descripción: <strong>${sim.descripcion || "Sin descripción"}</strong><br/>
      PVP base (PRECIO UNITARIO): <strong>${pvpBase.toFixed(
        2
      )} €</strong> · Cantidad: <strong>${cantidad}</strong>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Rol / nivel</th>
          <th style="width:90px;">Dto. %</th>
          <th style="width:110px;">Neto ud. (€)</th>
          <th style="width:120px;">Margen vs PVP</th>
          <th style="width:120px;">Importe total (€)</th>
        </tr>
      </thead>
      <tbody>
  `;

  filas.forEach((f) => {
    html += `
      <tr>
        <td>${f.label}</td>
        <td>${f.dto.toFixed(1)} %</td>
        <td>${f.neto.toFixed(2)} €</td>
        <td>${f.margenEuro.toFixed(2)} € (${f.margenPct.toFixed(1)} %)</td>
        <td>${f.total.toFixed(2)} €</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>

    <p style="font-size:0.8rem; color:#6b7280; margin-top:0.75rem;">
      Este simulador replica la lógica de tu Excel PLANTILLA 4.0:
      partiendo del PRECIO UNITARIO (PVP lista) aplica descuentos para
      cada nivel de tarifa (NFR, RNFR, VAD, BBD, RP2, RP1). Puedes modificar
      los porcentajes para ver rápidamente el impacto en precio y margen.
    </p>
  `;

  cont.innerHTML = html;
}

console.log(
  "%cUI Simulador cargado (ui_simulador.js)",
  "color:#0ea5e9; font-weight:600;"
);
window.renderSimuladorView = renderSimuladorView;
