// js/ui_presupuesto.js
// Generación del presupuesto a partir de los datos del proyecto y la tarifa

window.appState = window.appState || {};
appState.presupuesto = appState.presupuesto || {
  lineas: [],
  resumen: {},
};

// ===============================================
// Render de la vista de PRESUPUESTO
// ===============================================
function renderPresupuestoView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  container.innerHTML = `
    <div class="presupuesto-layout grid-2">

      <!-- COLUMNA IZQUIERDA: datos + resumen -->
      <div>
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Datos del presupuesto</div>
              <div class="card-subtitle">
                Revisa los datos del proyecto y genera el presupuesto.
              </div>
            </div>
            <span class="badge-step">Paso 2 de 3</span>
          </div>

          <div class="card-body">
            <div class="form-grid">

              <div class="form-group">
                <label>Nombre del proyecto</label>
                <input id="presuNombre" type="text" />
              </div>

              <div class="form-group">
                <label>Cliente (opcional)</label>
                <input id="presuCliente" type="text" />
              </div>

              <div class="form-group">
                <label>Fecha presupuesto</label>
                <input id="presuFecha" type="date" />
              </div>

              <div class="form-group">
                <label>Descuento global (%)</label>
                <input id="presuDto" type="number" min="0" max="90" value="0" />
              </div>

            </div>

            <button id="btnGenerarPresupuesto" class="btn btn-primary w-full mt-3">
              Generar / Recalcular presupuesto
            </button>

            <div id="presuMsg" class="alert alert-success mt-3" style="display:none;">
              Presupuesto generado correctamente
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Resumen económico</div>
          </div>
          <div class="card-body" id="presuResumen">
            No se ha generado todavía el presupuesto.
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA: detalle del presupuesto -->
      <div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">Detalle del presupuesto</div>
          </div>
          <div class="card-body" id="presuDetalle">
            No hay líneas de presupuesto generadas.
          </div>
        </div>
      </div>

    </div>
  `;

  document
    .getElementById("btnGenerarPresupuesto")
    .addEventListener("click", generarPresupuesto);

  precargarDatosProyecto();
}

// ===============================================
// Precargar datos del proyecto en el formulario
// ===============================================
function precargarDatosProyecto() {
  const p = appState.proyecto || {};

  document.getElementById("presuNombre").value =
    p.nombre || "Proyecto sin nombre";
  document.getElementById("presuCliente").value = p.cliente || "";
  document.getElementById("presuFecha").value =
    p.fecha || new Date().toISOString().split("T")[0];
  document.getElementById("presuDto").value = p.dto || 0;
}

// ===============================================
// Generación del presupuesto completo
// ===============================================
async function generarPresupuesto() {
  const msg = document.getElementById("presuMsg");
  if (msg) msg.style.display = "none";

  // getTarifas puede devolver { data, lastLoaded } o directamente el mapa
  const tarifasWrapper = await getTarifas();
  const tarifas =
    tarifasWrapper &&
    typeof tarifasWrapper === "object" &&
    tarifasWrapper.data
      ? tarifasWrapper.data
      : tarifasWrapper || {};

  const lineasProyecto = (appState.proyecto && appState.proyecto.lineas) || [];

  let lineasPresupuesto = [];
  let totalBruto = 0;
  let totalNeto = 0;

  for (const item of lineasProyecto) {
    if (!item || !item.ref) {
      console.warn("⚠ Línea sin referencia válida:", item);
      continue;
    }

    // =====================================================
    // 🔧 NORMALIZACIÓN DE REFERENCIA 2N
    // =====================================================
    const refOriginal = String(item.ref || "").trim();
    let ref = refOriginal.replace(/\s+/g, "");

    // Caso habitual Project Designer -> 8 dígitos, tarifa -> 7
    if (/^9\d{7}$/.test(ref)) {
      ref = ref.slice(0, 7);
    }

    // Probamos varias variantes por si la tarifa está en 7 u 8 dígitos
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
    // =====================================================

    const cantidad = Number(item.cantidad || 1);
    if (!cantidad || cantidad <= 0) {
      console.warn("⚠ Cantidad inválida:", item);
      continue;
    }

    let pvp = 0;
    for (const key of candidatosUnicos) {
      if (tarifas[key] != null) {
        pvp = Number(tarifas[key]) || 0;
        if (pvp) break;
      }
    }

    if (!pvp) {
      console.warn("⚠ Línea sin precio o cantidad inválida", {
        refOriginal,
        refNormalizada: ref,
        candidatos: candidatosUnicos,
        cantidad,
        desc: item.descripcion,
      });
      continue;
    }

    const subtotal = pvp * cantidad;
    totalBruto += subtotal;

    lineasPresupuesto.push({
      ref, // mostramos la ref normalizada
      descripcion: item.descripcion || "",
      cantidad,
      pvp,
      subtotal,
    });
  }

  // Calcular descuento global
  const dto = Number(document.getElementById("presuDto").value) || 0;
  const factorDto = dto > 0 ? 1 - dto / 100 : 1;

  totalNeto = totalBruto * factorDto;

  // Guardar en estado
  appState.presupuesto = {
    lineas: lineasPresupuesto,
    resumen: {
      totalBruto,
      dto,
      totalNeto,
    },
  };

  renderResultados(lineasPresupuesto, totalBruto, totalNeto);

  if (msg) {
    msg.textContent = `Presupuesto generado: ${lineasPresupuesto.length} líneas con precio.`;
    msg.style.display = "flex";
  }
}

// ===============================================
// Mostrar resultados en pantalla
// ===============================================
function renderResultados(lineas, totalBruto, totalNeto) {
  const detalle = document.getElementById("presuDetalle");
  const resumen = document.getElementById("presuResumen");

  if (!detalle) return;

  if (!lineas || lineas.length === 0) {
    detalle.textContent = "No hay líneas de presupuesto generadas.";
    resumen.textContent = "No se ha generado todavía el presupuesto.";
    return;
  }

  let html = `
    <table class="table">
      <thead>
        <tr>
          <th>Ref.</th>
          <th>Descripción</th>
          <th>Cant.</th>
          <th>PVP</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const l of lineas) {
    html += `
      <tr>
        <td>${l.ref}</td>
        <td>${l.descripcion}</td>
        <td>${l.cantidad}</td>
        <td>${l.pvp.toFixed(2)} €</td>
        <td>${l.subtotal.toFixed(2)} €</td>
      </tr>
    `;
  }

  html += "</tbody></table>";
  detalle.innerHTML = html;

  resumen.innerHTML = `
    <div class="metric-card">
      <span class="metric-label">TOTAL BRUTO</span>
      <span class="metric-value">${totalBruto.toFixed(2)} €</span>
    </div>

    <div class="metric-card">
      <span class="metric-label">TOTAL NETO</span>
      <span class="metric-value">${totalNeto.toFixed(2)} €</span>
    </div>
  `;
}

console.log("%cUI Presupuesto cargado (ui_presupuesto.js)", "color:#0284c7;");
window.renderPresupuestoView = renderPresupuestoView;
