// js/ui_presupuesto.js
// Generación del presupuesto a partir de los datos del proyecto y la tarifa

window.appState = window.appState || {};
appState.presupuesto = appState.presupuesto || {
  lineas: [],
  resumen: {},
  notas: "",
  sectionNotes: {}, // notas por sección
  extraSections: [], // secciones manuales añadidas desde la UI
};

console.log(
  "%cUI Presupuesto · versión DAVID-01-12",
  "color:#22c55e; font-weight:bold;"
);

// ===============================================
// Render de la vista de PRESUPUESTO
// ===============================================
function renderPresupuestoView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  container.innerHTML = `
    <div class="presupuesto-layout">

      <!-- COLUMNA IZQUIERDA: datos + notas + resumen -->
      <div class="presupuesto-left-column">
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
                Estas notas se usarán como observaciones generales
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

      <!-- COLUMNA DERECHA: DETALLE DEL PRESUPUESTO (SECCIONES) -->
      <div class="presupuesto-right-column">
        <div class="card">
          <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
            <div class="card-title">
              Líneas del presupuesto
              <span id="presuLineCount" style="font-size:0.8rem; color:#6b7280; font-weight:400;">
                0 líneas cargadas desde el proyecto
              </span>
            </div>
            <div class="presu-header-actions" style="display:flex; align-items:center; gap:0.5rem; font-size:0.8rem;">
              <span>Filtro ref:</span>
              <input id="presuFiltroRef" type="text" class="input" style="width:130px;" />
              <button id="btnAddLinea" class="btn btn-secondary">
                Añadir línea
              </button>
              <button id="btnAddSection" class="btn btn-secondary">
                Añadir sección
              </button>
            </div>
          </div>
          <div class="card-body" id="presuDetalle">
            No hay líneas de presupuesto generadas.
          </div>
        </div>
      </div>

    </div>
  `;

  // Botón generar
  const btnGenerar = document.getElementById("btnGenerarPresupuesto");
  if (btnGenerar) {
    btnGenerar.addEventListener("click", generarPresupuesto);
  }

  // Botón añadir sección manual
  const btnAddSection = document.getElementById("btnAddSection");
  if (btnAddSection) {
    btnAddSection.addEventListener("click", onAddManualSection);
  }

  // Botón añadir línea (stub)
  const btnAddLinea = document.getElementById("btnAddLinea");
  if (btnAddLinea) {
    btnAddLinea.addEventListener("click", () => {
      alert("Función 'Añadir línea' pendiente de implementar.");
    });
  }

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
    p.fecha || presu.fecha || new Date().toISOString().split("T")[0];
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
    (proyecto.lineas && proyecto.lineas.length
      ? proyecto.lineas
      : proyecto.filas) || [];

  console.log(
    "[Presupuesto] tarifas cargadas (reales):",
    Object.keys(tarifas).length
  );
  console.log("[Presupuesto] líneas de proyecto:", lineasProyecto.length);

  let lineasPresupuesto = [];
  let totalBruto = 0;
  let totalNeto = 0;

  for (const item of lineasProyecto) {
    const refCampo =
      item.ref ||
      item.referencia ||
      item.numeroPedido ||
      item["numero de pedido"] ||
      item["Número de pedido"] ||
      item.orderingNumber ||
      item["Ordering Number"];

    if (!item || !refCampo) {
      console.warn("⚠ Línea sin referencia válida:", item);
      continue;
    }

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

    const cantidad =
      Number(item.cantidad) ||
      Number(item.qty) ||
      Number(item["Cantidad"]) ||
      Number(item["cantidad"]) ||
      1;

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
      console.warn("⚠ Línea sin precio en tarifa", {
        refOriginal,
        refNormalizada: ref,
        candidatos: candidatosUnicos,
        cantidad,
        desc:
          item.descripcion ||
          item["Nombre del producto"] ||
          item.nombreProducto ||
          item.titulo,
      });
      continue;
    }

    const subtotal = pvp * cantidad;
    totalBruto += subtotal;

    // === sección y título procedentes del Excel/proyecto ===
    const seccion =
      item.seccion ||
      item.section ||
      item.apartado ||
      item.grupo ||
      item["Sección"] ||
      item["SECCION"] ||
      item["Grupo"] ||
      item["Apartado"] ||
      ""; // puede ir vacío

    const titulo =
      item.titulo ||
      item.title ||
      item.subseccion ||
      item["Título"] ||
      item["TITULO"] ||
      item.descripcionTitulo ||
      "";

    const descripcion =
      item.descripcion ||
      item["Nombre del producto"] ||
      item.nombreProducto ||
      item.titulo ||
      "";

    lineasPresupuesto.push({
      ref,
      descripcion,
      cantidad,
      pvp,
      subtotal,
      seccion,
      titulo,
    });
  }

  const dto = Number(document.getElementById("presuDto").value) || 0;
  const factorDto = dto > 0 ? 1 - dto / 100 : 1;

  totalNeto = totalBruto * factorDto;

  const notas = document.getElementById("presuNotas").value || "";

  const prevSectionNotes = appState.presupuesto.sectionNotes || {};
  const prevExtraSections = appState.presupuesto.extraSections || [];

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
    sectionNotes: prevSectionNotes,
    extraSections: prevExtraSections,
  };

  renderResultados(lineasPresupuesto, totalBruto, totalNeto, dto);

  if (msg) {
    msg.textContent = `Presupuesto generado: ${lineasPresupuesto.length} líneas con precio.`;
    msg.style.display = "flex";
  }
}

// ===============================================
// Añadir sección manual (sin líneas) desde la UI
// ===============================================
function onAddManualSection() {
  const nombre = prompt("Nombre de la nueva sección:");
  if (!nombre) return;

  const titulo = prompt("Título dentro de la sección (opcional):") || "";

  const presu = appState.presupuesto || {};
  presu.extraSections = presu.extraSections || [];
  presu.extraSections.push({
    id: Date.now().toString(),
    seccion: nombre,
    titulo,
    nota: "",
  });

  appState.presupuesto = presu;

  if (presu.lineas && presu.resumen) {
    renderResultados(
      presu.lineas,
      presu.resumen.totalBruto || 0,
      presu.resumen.totalNeto || 0,
      presu.resumen.dto || 0
    );
  }
}

// ===============================================
// Mostrar resultados en pantalla (detalle tipo tabla proyecto)
// ===============================================
function renderResultados(lineas, totalBruto, totalNeto, dto) {
  const detalle = document.getElementById("presuDetalle");
  const resumen = document.getElementById("presuResumen");
  const presu = appState.presupuesto || {};
  const sectionNotes = presu.sectionNotes || {};
  const extraSections = presu.extraSections || [];

  if (!detalle) return;

  // Actualizar contador en cabecera derecha
  const countLabel = document.getElementById("presuLineCount");
  if (countLabel) {
    countLabel.textContent = `${
      lineas ? lineas.length : 0
    } líneas cargadas desde el proyecto`;
  }

  if (!lineas || lineas.length === 0) {
    detalle.textContent = "No hay líneas de presupuesto generadas.";
    resumen.textContent = "No se ha generado todavía el presupuesto.";
    return;
  }

  let htmlDetalle = `
    <table class="table">
      <thead>
        <tr>
          <th style="width:48px;">OK</th>
          <th>Ref.</th>
          <th>Sección</th>
          <th>Descripción</th>
          <th style="width:70px;">Ud.</th>
          <th style="width:90px;">PVP</th>
          <th style="width:110px;">Importe</th>
        </tr>
      </thead>
      <tbody>
  `;

  let currentSection = null;
  let currentTitle = null;

  for (const l of lineas) {
    // === NUEVA LÓGICA FLEXIBLE DE SECCIÓN/TÍTULO ===
    const sec =
      l.seccion ||
      l.section ||
      l.apartado ||
      l.grupo ||
      l["Sección"] ||
      l["SECCION"] ||
      l["Grupo"] ||
      l["Apartado"] ||
      l.titulo ||
      l.title ||
      "Sin sección";

    const tit =
      l.titulo ||
      l.title ||
      l.subseccion ||
      l["Título"] ||
      l["TITULO"] ||
      "";

    // ===== Fila de SECCIÓN (azul) + nota de sección =====
    if (sec !== currentSection) {
      currentSection = sec;
      currentTitle = null;

      htmlDetalle += `
        <tr>
          <td colspan="7" style="background:#eef2ff; font-weight:600; text-transform:uppercase;">
            ${sec}
          </td>
        </tr>
        <tr>
          <td colspan="7">
            <textarea
              class="section-note"
              data-section="${sec}"
              rows="2"
              style="width:100%; font-size:0.78rem; resize:vertical;"
              placeholder="Notas de la sección (opcional)"
            >${sectionNotes[sec] || ""}</textarea>
          </td>
        </tr>
      `;
    }

    // ===== Fila de TÍTULO (gris), solo si tenemos valor distinto =====
    if (tit && tit !== currentTitle) {
      currentTitle = tit;
      htmlDetalle += `
        <tr>
          <td colspan="7" style="background:#f3f4f6; font-weight:500;">
            ${tit}
          </td>
        </tr>
      `;
    }

    // ===== Fila de producto =====
    const importe = l.subtotal || l.pvp * l.cantidad || 0;

    htmlDetalle += `
      <tr>
        <td>
          <input type="checkbox" checked />
        </td>
        <td>${l.ref}</td>
        <td>${sec}</td>
        <td>${l.descripcion}</td>
        <td>${l.cantidad}</td>
        <td>${l.pvp.toFixed(2)} €</td>
        <td>${importe.toFixed(2)} €</td>
      </tr>
    `;
  }

  htmlDetalle += `
      </tbody>
    </table>
  `;

  // ===== Secciones adicionales creadas desde la UI =====
  if (extraSections.length) {
    htmlDetalle += `
      <div style="border-top:1px solid #e5e7eb; margin-top:1rem; padding-top:1rem;">
        <div style="font-size:0.85rem; color:#6b7280; margin-bottom:0.5rem;">
          Secciones adicionales
        </div>
    `;

    extraSections.forEach((sec) => {
      htmlDetalle += `
        <div class="section-block" style="margin-bottom:1rem;">
          <div style="font-weight:600; font-size:0.9rem; margin-bottom:0.25rem;">
            ${sec.seccion}
          </div>
          ${
            sec.titulo
              ? `<div style="background:#f3f4f6; padding:0.25rem 0.5rem; font-size:0.8rem; margin-bottom:0.25rem;">
                  ${sec.titulo}
                 </div>`
              : ""
          }
          <div class="form-group">
            <label style="font-size:0.8rem; color:#6b7280;">Notas de la sección</label>
            <textarea class="section-note-extra" data-id="${sec.id}" rows="2"
              style="width:100%;">${sec.nota || ""}</textarea>
          </div>
        </div>
      `;
    });

    htmlDetalle += `</div>`;
  }

  detalle.innerHTML = htmlDetalle;

  // Guardar notas de sección en estado
  const currentSectionNotes = (appState.presupuesto.sectionNotes =
    sectionNotes);

  detalle.querySelectorAll(".section-note").forEach((ta) => {
    ta.addEventListener("input", (e) => {
      const sec = e.target.dataset.section;
      currentSectionNotes[sec] = e.target.value;
    });
  });

  detalle.querySelectorAll(".section-note-extra").forEach((ta) => {
    ta.addEventListener("input", (e) => {
      const id = e.target.dataset.id;
      const presu = appState.presupuesto || {};
      presu.extraSections = presu.extraSections || [];
      const found = presu.extraSections.find((s) => s.id === id);
      if (found) {
        found.nota = e.target.value;
      }
    });
  });

  // ===== Resumen económico con IVA =====
  const subtotal = totalNeto;
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

console.log(
  "%cUI Presupuesto cargado (ui_presupuesto.js)",
  "color:#0284c7;"
);
window.renderPresupuestoView = renderPresupuestoView;
