// js/ui_presupuesto.js
// Generación del presupuesto a partir de los datos del proyecto y la tarifa

window.appState = window.appState || {};
appState.presupuesto = appState.presupuesto || {
  lineas: [],
  resumen: {},
  notas: "",
  sectionNotes: {},      // notas por sección
  extraSections: [],     // secciones manuales añadidas desde la UI
};

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
          <div class="card-header" style="display:flex; align-items:center; justify-content:space-between;">
            <div class="card-title">Detalle del presupuesto</div>
            <button id="btnAddSection" class="btn btn-secondary">
              Añadir sección
            </button>
          </div>
          <div class="card-body" id="presuDetalle">
            No hay líneas de presupuesto generadas.
          </div>
        </div>
      </div>

    </div>
  ";

  document
    .getElementById("btnGenerarPresupuesto")
    .addEventListener("click", generarPresupuesto);

  const btnAddSection = document.getElementById("btnAddSection");
  if (btnAddSection) {
    btnAddSection.addEventListener("click", onAddManualSection);
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
    // 1) REFERENCIA (varios posibles campos)
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

    // Normalización referencia 2N
    const refOriginal = String(refCampo || "").trim();
    let ref = refOriginal.replace(/\s+/g, "");

    // Project Designer -> 8 dígitos, tarifa -> 7
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

    // 2) CANTIDAD
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

    // 3) PRECIO DESDE TARIFA
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

    // 4) SECCIÓN y TÍTULO
    const seccion =
      item.seccion ||
      item.section ||
      item["Sección"] ||
      item["sección"] ||
      item["SECCION"] ||
      "";

    const titulo =
      item.titulo ||
      item.title ||
      item["Título"] ||
      item["titulo"] ||
      item["TITULO"] ||
      item.descripcionTitulo ||
      "";

    // 5) DESCRIPCIÓN
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

  // preservamos notas por sección y secciones extra
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
// Mantiene el ORDEN de las líneas importadas
// ===============================================
function renderResultados(lineas, totalBruto, totalNeto, dto) {
  const detalle = document.getElementById("presuDetalle");
  const resumen = document.getElementById("presuResumen");
  const presu = appState.presupuesto || {};
  const sectionNotes = presu.sectionNotes || {};
  const extraSections = presu.extraSections || [];

  if (!detalle) return;

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

  // Recorremos las líneas en el MISMO orden que vienen del proyecto
  for (const l of lineas) {
    const sec = l.seccion || "Sin sección";
    const tit = l.titulo || "Sin título";

    // Cambio de sección -> fila de cabecera + notas
    if (sec !== currentSection) {
      currentSection = sec;
      currentTitle = null;

      // fila cabecera sección (tipo barra gris PLACA DE CALLE)
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

    // Cambio de título dentro de la sección -> fila gris como subtítulo
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

    const importe = l.subtotal || l.pvp * l.cantidad || 0;

    // Fila de producto, columnas como en la imagen
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

  // Secciones manuales extra (sin líneas, solo bloque y nota)
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

  // Guardar notas por sección en appState al escribir
  const currentSectionNotes = (appState.presupuesto.sectionNotes =
    sectionNotes);

  detalle.querySelectorAll(".section-note").forEach((ta) => {
    ta.addEventListener("input", (e) => {
      const sec = e.target.dataset.section;
      currentSectionNotes[sec] = e.target.value;
    });
  });

  // Notas de secciones manuales
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

  // ==== RESUMEN ECONÓMICO ====
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
