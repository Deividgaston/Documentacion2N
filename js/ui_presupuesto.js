// js/ui_presupuesto.js
// Generación del presupuesto a partir de los datos del proyecto y la tarifa

window.appState = window.appState || {};
appState.presupuesto = appState.presupuesto || {
  lineas: [],
  resumen: {},
  notas: "",
};

// ===============================================
// Render de la vista de PRESUPUESTO
// ===============================================
function renderPresupuestoView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  container.innerHTML = `
    <div class="presupuesto-layout grid-2">

      <!-- COLUMNA IZQUIERDA: datos + notas + resumen -->
      <div>
        <!-- DATOS DEL PRESUPUESTO + NOTAS -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Datos del presupuesto</div>
              <div class="card-subtitle">
                Revisa los datos del proyecto, añade notas y genera el presupuesto.
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

            <div class="form-group mt-3">
              <label>Notas del presupuesto</label>
              <textarea id="presuNotas" rows="3"></textarea>
              <p style="font-size:0.78rem; color:#6b7280; margin-top:0.25rem;">
                Estas notas se usarán como observaciones del presupuesto
                (ej. requisitos de red, alimentación, alcances, exclusiones...).
              </p>
            </div>

            <button id="btnGenerarPresupuesto" class="btn btn-primary w-full mt-3">
              Generar / Recalcular presupuesto
            </button>

            <div id="presuMsg" class="alert alert-success mt-3" style="display:none;">
              Presupuesto generado correctamente
            </div>
          </div>
        </div>

        <!-- RESUMEN ECONÓMICO -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Resumen económico</div>
          </div>
          <div class="card-body" id="presuResumen">
            No se ha generado todavía el presupuesto.
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA: DETALLE DEL PRESUPUESTO -->
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
  const presu = appState.presupuesto || {};

  document.getElementById("presuNombre").value =
    p.nombre || presu.nombre || "Proyecto sin nombre";
  document.getElementById("presuCliente").value =
    p.cliente || presu.cliente || "";
  document.getElementById("presuFecha").value =
    p.fecha ||
    presu.fecha ||
    new Date().toISOString().split("T")[0];
  document.getElementById("presuDto").value = presu.resumen?.dto || p.dto || 0;

  const notasPorDefecto =
    "se requiere de switch poe para alimentar los equipos";
  document.getElementById("presuNotas").value =
    presu.notas || p.notas || notasPorDefecto;
}

// ===============================================
// Carga directa de tarifas desde Firestore
// ===============================================
async function cargarTarifasDesdeFirestore() {
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
    result[ref] = pvp;
  });

  console.log(
    "%cTarifa · cargarTarifasDesdeFirestore() -> " +
      Object.keys(result).length +
      " referencias",
    "color:#3b82f6;"
  );

  return result;
}

// ===============================================
// Generación del presupuesto completo
// ===============================================
async function generarPresupuesto() {
  const msg = document.getElementById("presuMsg");
  if (msg) msg.style.display = "none";

  const tarifas = await cargarTarifasDesdeFirestore();

  const proyecto = appState.proyecto || {};
  const lineasProyecto =
    (proyecto.lineas && proyecto.lineas.length ? proyecto.lineas : proyecto.filas) ||
    [];

  console.log(
    "[Presupuesto] tarifas cargadas (reales):",
    Object.keys(tarifas).length
  );
  console.log(
    "[Presupuesto] líneas de proyecto:",
    lineasProyecto.length
  );

  let lineasPresupuesto = [];
  let totalBruto = 0;
  let totalNeto = 0;

  for (const item of lineasProyecto) {
    const refCampo = item.ref || item.referencia;

    if (!item || !refCampo) {
      console.warn("⚠ Línea sin referencia válida:", item);
      continue;
    }

    // =====================================================
    // 🔧 NORMALIZACIÓN DE REFERENCIA 2N
    // =====================================================
    const refOriginal = String(refCampo || "").trim();
    let ref = refOriginal.replace(/\s+/g, "");

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
        desc: item.descripcion || item.titulo,
      });
      continue;
    }

    const subtotal = pvp * cantidad;
    totalBruto += subtotal;

    lineasPresupuesto.push({
      ref,
      descripcion: item.descripcion || item.titulo || "",
      cantidad,
      pvp,
      subtotal,
    });
  }

  const dto = Number(document.getElementById("presuDto").value) || 0;
  const factorDto = dto > 0 ? 1 - dto / 100 : 1;

  totalNeto = totalBruto * factorDto;

  const notas = document.getElementById("presuNotas").value || "";

  appState.presupuesto = {
    lineas: lineasPresupuesto,
    resumen: {
      totalBruto,
      dto,
      totalNeto,
    },
    notas,
    nombre: document.getElementById("presuNombre").value || "",
    cliente: document.getElementById("presuCliente").value || "",
    fecha: document.getElementById("presuFecha").value || "",
  };

  renderResultados(lineasPresupuesto, totalBruto, totalNeto, dto);

  if (msg) {
    msg.textContent = `Presupuesto generado: ${lineasPresupuesto.length} líneas con precio.`;
    msg.style.display = "flex";
  }
}

// ===============================================
// Mostrar resultados en pantalla
// ===============================================
function renderResultados(lineas, totalBruto, totalNeto, dto) {
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

  const subtotal = totalNeto; // base imponible después de dto
  const iva = subtotal * 0.21;
  const totalConIva = subtotal + iva;

  resumen.innerHTML = `
    <div class="metric-card">
      <span class="metric-label">SUBTOTAL (base imponible)</span>
      <span class="metric-value">${subtotal.toFixed(2)} €</span>
    </div>

    <div class="metric-card">
      <span class="metric-label">IVA 21%</span>
      <span class="metric-value">${iva.toFixed(2)} €</span>
    </div>

    <div class="metric-card">
      <span class="metric-label">TOTAL CON IVA</span>
      <span class="metric-value">${totalConIva.toFixed(2)} €</span>
    </div>

    <p style="font-size:0.8rem; color:#6b7280; margin-top:0.5rem;">
      Total bruto sin descuento: <strong>${totalBruto.toFixed(2)} €</strong> ·
      Descuento global aplicado: <strong>${dto}%</strong>
    </p>
  `;
}

console.log("%cUI Presupuesto cargado (ui_presupuesto.js)", "color:#0284c7;");
window.renderPresupuestoView = renderPresupuestoView;
