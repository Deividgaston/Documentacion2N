// js/ui_doc_prescripcion.js
// ========================================================
// PRESCRIPCIÓN 2N (versión premium Notion B3)
// --------------------------------------------------------
// BLOQUE 1 - Estado global, helpers, modal genérico
// ========================================================

window.appState = window.appState || {};
appState.prescripcion = appState.prescripcion || {
  capitulos: [],             // [{ id, nombre, texto, lineas: [...] }]
  selectedCapituloId: null,  
  plantillas: [],            // [{ id, nombre, texto }]
  plantillasLoaded: false,
  extraRefs: [],             // [{ id, codigo, descripcion, unidad, pvp }]
  extraRefsLoaded: false,
  exportLang: "es", // idioma de exportación ("es" | "en" | "pt")
  // NUEVO: términos de búsqueda
  plantillasSearchTerm: "",
  extraRefsSearchTerm: ""
};

// ========================================================
// MODAL GENÉRICO (usa el modal global definido en index.html)
// ========================================================

function openPrescModal({ title, bodyHTML, onSave }) {
  const modal = document.getElementById("prescModal");
  const titleEl = document.getElementById("prescModalTitle");
  const bodyEl = document.getElementById("prescModalBody");
  const btnSave = document.getElementById("prescModalSave");
  const btnClose = document.getElementById("prescModalClose");
  const btnCancel = document.getElementById("prescModalCancel");

  if (!modal) {
    console.warn("[PRESCRIPCIÓN] Modal no encontrado en index.html");
    return;
  }

  titleEl.textContent = title || "";
  bodyEl.innerHTML = bodyHTML || "";
  modal.style.display = "flex";

  const close = () => {
    modal.style.display = "none";
    btnSave.onclick = null;
    btnClose.onclick = null;
    btnCancel.onclick = null;
  };

  btnClose.onclick = close;
  btnCancel.onclick = close;

  btnSave.onclick = async () => {
    if (typeof onSave === "function") await onSave();
    close();
  };
}

// ========================================================
// Helpers de Firestore/Auth (compat con tu arquitectura)
// ========================================================

function getFirestorePresc() {
  if (typeof window.getFirestoreInstance === "function") {
    const db = window.getFirestoreInstance();
    if (db) return db;
  }
  if (window.db) return window.db;

  try {
    return window.firebase.firestore();
  } catch {
    console.warn("[PRESCRIPCIÓN] Firestore no disponible");
    return null;
  }
}

function getAuthPresc() {
  if (typeof window.getAuthInstance === "function") {
    const a = window.getAuthInstance();
    if (a) return a;
  }
  if (window.auth) return window.auth;

  try {
    return window.firebase.auth();
  } catch {
    return null;
  }
}

// ========================================================
// Obtener el contenedor principal (como en Doc / Gestión Doc)
// ========================================================

function getPrescripcionAppContent() {
  if (typeof window.getDocAppContent === "function") return window.getDocAppContent();
  if (typeof window.getAppContent === "function") return window.getAppContent();
  return document.getElementById("appContent");
}

// ========================================================
// Obtener presupuesto actual (para generar secciones)
// ========================================================

function getPresupuestoActualSafe() {
  if (typeof window.getPresupuestoActual === "function") {
    try { return window.getPresupuestoActual(); }
    catch(e) {
      console.error("[PRESCRIPCIÓN] Error obteniendo presupuesto:", e);
      return null;
    }
  }
  console.warn("[PRESCRIPCIÓN] getPresupuestoActual no existe");
  return null;
}

// ========================================================
// BLOQUE 2 - Secciones del presupuesto para Prescripción
// ========================================================

// Añadimos estructura para secciones si no existe
appState.prescripcion.sectionsFromBudget =
  appState.prescripcion.sectionsFromBudget || [];

/**
 * Convierte las líneas del presupuesto en secciones agregadas
 */
function buildPrescSectionsFromPresupuesto() {
  const presu = getPresupuestoActualSafe();
  if (!presu) {
    console.warn("[PRESCRIPCIÓN] No hay presupuesto cargado para generar secciones.");
    appState.prescripcion.sectionsFromBudget = [];
    return [];
  }

  const seccionesMap = presu.secciones || presu.sections || {};
  const lineas = presu.lineas || presu.lines || presu.lineItems || [];

  const bySection = {};

  lineas.forEach((l) => {
    const secId =
      l.seccionId ||
      l.sectionId ||
      l.seccion ||
      l.capituloId ||
      l.chapterId ||
      "SIN_SECCION";

    if (!bySection[secId]) {
      const def = seccionesMap[secId] || seccionesMap[String(secId)] || {};
      const nombreSec =
        def.nombre ||
        def.name ||
        def.titulo ||
        def.title ||
        (secId === "SIN_SECCION" ? "Sin sección" : String(secId));

      bySection[secId] = {
        id: "sec-" + String(secId),
        rawId: secId,
        nombre: nombreSec,
        totalRefs: 0,
        totalImporte: 0,
        refs: []
      };
    }

    const cantidad =
      l.cantidad ||
      l.qty ||
      l.unidades ||
      l.cant ||
      1;

    const pvp =
      typeof l.pvp === "number"
        ? l.pvp
        : typeof l.precio === "number"
        ? l.precio
        : typeof l.price === "number"
        ? l.price
        : 0;

    const unidad =
      l.unidad ||
      l.ud ||
      l.unit ||
      "Ud";

    const importe = (Number(cantidad) || 0) * (Number(pvp) || 0);

    bySection[secId].refs.push({
      codigo: l.codigo || l.ref || l.sku || "",
      descripcion:
        l.descripcion ||
        l.desc ||
        l.concepto ||
        l.nombre ||
        l.title ||
        "",
      unidad,
      cantidad: Number(cantidad) || 0,
      pvp,
      importe
    });

    bySection[secId].totalRefs += 1;
    bySection[secId].totalImporte += importe;
  });

  const sectionsArr = Object.values(bySection).sort((a, b) =>
    (a.nombre || "").toString().localeCompare((b.nombre || "").toString(), "es")
  );

  appState.prescripcion.sectionsFromBudget = sectionsArr;

  console.log(
    "[PRESCRIPCIÓN] Secciones generadas desde presupuesto:",
    sectionsArr.length
  );

  return sectionsArr;
}

/**
 * Helper para asegurar que las secciones están construidas
 */
function ensurePrescSectionsFromBudget() {
  if (!appState.prescripcion.sectionsFromBudget ||
      !appState.prescripcion.sectionsFromBudget.length) {
    return buildPrescSectionsFromPresupuesto();
  }
  return appState.prescripcion.sectionsFromBudget;
}

// ========================================================
// BLOQUE 3 - Render básico de la vista Prescripción
// ========================================================

function renderDocPrescripcionView() {
  const container = getPrescripcionAppContent();
  if (!container) return;

  // Aseguramos secciones cargadas
  ensurePrescSectionsFromBudget();

  // Aseguramos plantillas / referencias extra
  appState.prescripcion.plantillas = appState.prescripcion.plantillas || [];
  appState.prescripcion.extraRefs = appState.prescripcion.extraRefs || [];

  const currentLang = appState.prescripcion.exportLang || "es";

  container.innerHTML = `
    <div class="presc-root" style="display:flex; flex-direction:column; height:100%;">

      <!-- CABECERA SUPERIOR -->
      <div class="card" style="margin-bottom:1rem;">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
          <div>
            <div class="card-title">Prescripción técnica del proyecto</div>
            <div class="card-subtitle">
              Arrastra secciones del presupuesto para generar capítulos. Usa referencias extra o plantillas si lo necesitas.
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.35rem; align-items:flex-end;">
            <div style="display:flex; gap:0.35rem; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
              <span style="font-size:0.75rem; color:#6b7280;">Idioma exportación</span>
              <select id="prescExportLang" class="form-control form-control-sm" style="min-width:140px; font-size:0.75rem;">
                <option value="es" ${currentLang === "es" ? "selected" : ""}>Castellano</option>
                <option value="en" ${currentLang === "en" ? "selected" : ""}>English</option>
                <option value="pt" ${currentLang === "pt" ? "selected" : ""}>Português</option>
              </select>
            </div>

            <div style="display:flex; gap:0.35rem; flex-wrap:wrap; justify-content:flex-end;">
              <button id="prescReloadSectionsBtn" class="btn btn-outline btn-sm">
                🔄 Regenerar secciones
              </button>
              <button id="prescAddManualCapBtn" class="btn btn-primary btn-sm">
                ➕ Añadir capítulo
              </button>
              <button id="prescExportExcelBtn" class="btn btn-sm btn-outline">
                ⬇️ Excel
              </button>
              <button id="prescExportPdfBtn" class="btn btn-sm btn-outline">
                ⬇️ PDF
              </button>
              <button id="prescExportBc3Btn" class="btn btn-sm btn-outline">
                ⬇️ BC3
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- LAYOUT 3 COLUMNAS -->
      <div class="presc-layout" 
           style="display:grid; grid-template-columns:1fr 1.4fr 1.2fr; gap:1rem; height:60vh; min-height:400px;">

        <!-- COLUMNA 1: Secciones del presupuesto -->
        <div class="card" style="display:flex; flex-direction:column; overflow:hidden;">
          <div class="card-header">
            <div class="card-title">Secciones del presupuesto</div>
            <div class="card-subtitle">Arrastra una sección para crear o actualizar un capítulo</div>
          </div>
          <div id="prescSectionsList" class="card-body" style="flex:1; overflow:auto; padding:0.75rem;">
          </div>
        </div>

        <!-- COLUMNA 2: Capítulo seleccionado -->
        <div class="card" style="display:flex; flex-direction:column; overflow:hidden;">
          <div class="card-header">
            <div class="card-title">Capítulo seleccionado</div>
            <div class="card-subtitle">Nombre, texto descriptivo y referencias del capítulo</div>
          </div>

          <div id="prescCapituloContent" class="card-body" 
               style="flex:1; overflow:auto;">
          </div>
        </div>

        <!-- COLUMNA 3: Plantillas + Referencias extra -->
        <div style="display:flex; flex-direction:column; gap:1rem; height:100%;">
          
          <!-- Plantillas -->
          <div class="card" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
            <div class="card-header">
              <div class="card-title">Plantillas</div>
              <div class="card-subtitle">Arrastra y suelta para rellenar texto técnico</div>
            </div>
            <div id="prescPlantillasList" class="card-body" style="flex:1; overflow:auto;">
            </div>
          </div>

          <!-- Referencias extra -->
          <div class="card" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
            <div class="card-header">
              <div class="card-title">Referencias extra</div>
              <div class="card-subtitle">Switches, cable, mano de obra…</div>
            </div>
            <div id="prescExtraRefsList" class="card-body" style="flex:1; overflow:auto;">
            </div>
          </div>
        </div>
      </div>

      <!-- PREVISUALIZACIÓN inferior -->
      <div class="card" style="margin-top:1rem;">
        <div class="card-header">
          <div class="card-title">Previsualización de la prescripción</div>
          <div class="card-subtitle">Capítulos añadidos, totales y desglose desplegable</div>
        </div>

        <div id="prescPreview" class="card-body">
        </div>
      </div>

    </div>
  `;

  // Handlers cabecera
  const btnAddCap = container.querySelector("#prescAddManualCapBtn");
  if (btnAddCap) {
    btnAddCap.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      createManualCapitulo();
      renderDocPrescripcionView();
    });
  }

  const btnReloadSections = container.querySelector("#prescReloadSectionsBtn");
  if (btnReloadSections) {
    btnReloadSections.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      buildPrescSectionsFromPresupuesto();
      renderDocPrescripcionView();
    });
  }

  // Selector idioma
  const langSelect = container.querySelector("#prescExportLang");
  if (langSelect) {
    langSelect.value = appState.prescripcion.exportLang || "es";
    langSelect.addEventListener("change", () => {
      appState.prescripcion.exportLang = langSelect.value || "es";
      console.log("[PRESCRIPCIÓN] Idioma exportación:", appState.prescripcion.exportLang);
    });
  }

  // Botones exportación
  const btnExportExcel = container.querySelector("#prescExportExcelBtn");
  if (btnExportExcel) {
    btnExportExcel.addEventListener("click", () => {
      handlePrescExport("excel");
    });
  }

  const btnExportPdf = container.querySelector("#prescExportPdfBtn");
  if (btnExportPdf) {
    btnExportPdf.addEventListener("click", () => {
      handlePrescExport("pdf");
    });
  }

  const btnExportBc3 = container.querySelector("#prescExportBc3Btn");
  if (btnExportBc3) {
    btnExportBc3.addEventListener("click", () => {
      handlePrescExport("bc3");
    });
  }

  // Rellenar sub-vistas
  renderPrescSectionsList();
  renderPrescCapituloContent();
  attachPrescDropZone();
  renderPrescPlantillasList();
  renderPrescExtraRefsList();
  renderPrescPreview();
}

// ========================================================
// BLOQUE 4 - Secciones Notion Premium (arrastrables)
// ========================================================

function renderPrescSectionsList() {
  const container = document.getElementById("prescSectionsList");
  if (!container) return;

  const sections = ensurePrescSectionsFromBudget();
  if (!sections.length) {
    container.innerHTML = `
      <p class="text-muted" style="padding:0.5rem; font-size:0.8rem;">
        No hay secciones en el presupuesto actual.
      </p>
    `;
    return;
  }

  container.innerHTML = sections
    .map((sec) => {
      const preview = sec.refs
        .slice(0, 3)
        .map((r) => `${r.descripcion || ""} x${r.cantidad}`)
        .join(" • ");

      return `
        <div class="presc-section-card"
             draggable="true"
             data-section-id="${sec.id}"
             title="Arrastra esta sección para crear o actualizar un capítulo">
          <div class="presc-section-title">${sec.nombre}</div>
          <div class="presc-section-preview">
            ${preview ? preview : "<i>Sin referencias</i>"}
          </div>
        </div>
      `;
    })
    .join("");

  attachPrescSectionsDragHandlers();
}

// Estilos cards secciones
(function injectPrescSectionStyles() {
  if (document.getElementById("presc-section-styles")) return;

  const style = document.createElement("style");
  style.id = "presc-section-styles";

  style.innerHTML = `
    .presc-section-card {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 0.75rem 1rem;
      margin-bottom: 0.75rem;
      background: #ffffff;
      cursor: grab;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      transition: all 0.15s ease;
    }

    .presc-section-card:hover {
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
      transform: translateY(-1px);
    }

    .presc-section-card:active {
      cursor: grabbing;
      transform: scale(0.98);
    }

    .presc-section-title {
      font-size: 0.95rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
      color: #111827;
    }

    .presc-section-preview {
      font-size: 0.78rem;
      color: #6b7280;
      line-height: 1.25;
    }
  `;

  document.head.appendChild(style);
})();

// Drag handlers secciones
function attachPrescSectionsDragHandlers() {
  document
    .querySelectorAll(".presc-section-card[draggable='true']")
    .forEach((el) => {
      el.addEventListener("dragstart", (ev) => {
        const secId = el.getAttribute("data-section-id");
        ev.dataTransfer.setData("text/presc-section-id", secId);
        el.style.opacity = "0.6";
      });

      el.addEventListener("dragend", () => {
        el.style.opacity = "1";
      });
    });
}

// ========================================================
// BLOQUE 5 - Lógica DROP sección → capítulo
// ========================================================

function attachPrescDropZone() {
  const dropZone = document.getElementById("prescCapituloContent");
  if (!dropZone) return;

  dropZone.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    dropZone.style.background = "#f9fafb";
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.style.background = "transparent";
  });

  dropZone.addEventListener("drop", (ev) => {
    ev.preventDefault();
    dropZone.style.background = "transparent";

    const secId = ev.dataTransfer.getData("text/presc-section-id");
    if (!secId) return;

    handleSectionDrop(secId);
  });
}

function handleSectionDrop(secId) {
  const sections = ensurePrescSectionsFromBudget();
  const sec = sections.find((s) => s.id === secId);
  
  if (!sec) {
    console.warn("[PRESCRIPCIÓN] Sección no encontrada:", secId);
    return;
  }

  const capActual = getSelectedCapitulo();

  if (!capActual) {
    createChapterFromSection(sec);
    return;
  }

  askOverwriteOrAppend(sec, capActual);
}

function createChapterFromSection(sec) {
  const newId = "cap-" + Date.now();

  appState.prescripcion.capitulos.push({
    id: newId,
    nombre: sec.nombre,
    texto: "",
    lineas: cloneSectionRefs(sec)
  });

  appState.prescripcion.selectedCapituloId = newId;

  renderDocPrescripcionView();
}

function cloneSectionRefs(sec) {
  return sec.refs.map((r) => ({
    id: "sec-ref-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    tipo: "budget",
    codigo: r.codigo,
    descripcion: r.descripcion,
    unidad: r.unidad,
    cantidad: r.cantidad,
    pvp: r.pvp,
    importe: r.importe,
    extraRefId: null
  }));
}

function askOverwriteOrAppend(sec, cap) {
  openPrescModal({
    title: "¿Qué quieres hacer?",
    bodyHTML: `
      <p style="margin-bottom:0.75rem;">
        Has soltado la sección <strong>${sec.nombre}</strong> sobre el capítulo 
        <strong>${cap.nombre || "(sin título)"}</strong>.
      </p>

      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        <label><input type="radio" name="secAction" value="overwrite" checked> 
          <strong>Sobrescribir capítulo</strong> (renombra y sustituye referencias)
        </label>

        <label><input type="radio" name="secAction" value="append"> 
          <strong>Añadir referencias</strong> (mantiene nombre y añade las referencias nuevas)
        </label>
      </div>
    `,
    onSave: () => {
      const action = document.querySelector("input[name='secAction']:checked")?.value;

      if (action === "overwrite") {
        overwriteChapterWithSection(cap, sec);
      } else {
        appendSectionToChapter(cap, sec);
      }

      renderDocPrescripcionView();
    }
  });
}

function overwriteChapterWithSection(cap, sec) {
  cap.nombre = sec.nombre;
  cap.texto = "";
  cap.lineas = cloneSectionRefs(sec);
}

function appendSectionToChapter(cap, sec) {
  const existing = cap.lineas || [];
  const newOnes = cloneSectionRefs(sec);

  newOnes.forEach((r) => {
    const dup = existing.find(
      (ex) =>
        ex.codigo === r.codigo &&
        ex.descripcion === r.descripcion &&
        ex.unidad === r.unidad &&
        ex.pvp === r.pvp
    );

    if (!dup) existing.push(r);
  });

  cap.lineas = existing;
}

// Observador para que la dropzone siempre esté conectada
(function setupDropZoneInterval() {
  const observer = new MutationObserver(() => {
    attachPrescDropZone();
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();

// ========================================================
// BLOQUE 6 - Capítulos: helpers + render columna central
// ========================================================

function ensurePrescCapitulosArray() {
  if (!appState.prescripcion) appState.prescripcion = {};
  if (!Array.isArray(appState.prescripcion.capitulos)) {
    appState.prescripcion.capitulos = [];
  }
}

function getSelectedCapitulo() {
  ensurePrescCapitulosArray();
  const caps = appState.prescripcion.capitulos;
  if (!caps.length) return null;

  let selId = appState.prescripcion.selectedCapituloId;
  if (!selId) {
    selId = caps[0].id;
    appState.prescripcion.selectedCapituloId = selId;
  }

  return caps.find((c) => c.id === selId) || caps[0] || null;
}

function setSelectedCapitulo(id) {
  appState.prescripcion.selectedCapituloId = id || null;
}

function createManualCapitulo() {
  ensurePrescCapitulosArray();

  const id = "manual-" + Date.now();
  const nuevo = {
    id,
    nombre: "Capítulo manual",
    texto: "",
    lineas: []
  };

  appState.prescripcion.capitulos.push(nuevo);
  appState.prescripcion.selectedCapituloId = id;

  console.log("[PRESCRIPCIÓN] Capítulo manual creado:", nuevo);
}

function deleteCapituloById(capId) {
  ensurePrescCapitulosArray();
  const caps = appState.prescripcion.capitulos || [];
  const idx = caps.findIndex((c) => c.id === capId);
  if (idx === -1) {
    console.warn("[PRESCRIPCIÓN] No se encontró el capítulo a borrar:", capId);
    return;
  }

  const ok = window.confirm("¿Seguro que quieres eliminar este capítulo de la prescripción?");
  if (!ok) return;

  console.log("[PRESCRIPCIÓN] Borrando capítulo:", caps[idx]);

  caps.splice(idx, 1);

  if (appState.prescripcion.selectedCapituloId === capId) {
    if (caps.length) {
      appState.prescripcion.selectedCapituloId = caps[0].id;
    } else {
      appState.prescripcion.selectedCapituloId = null;
    }
  }

  if (appState.prescripcion.previewExpanded &&
      appState.prescripcion.previewExpanded[capId]) {
    delete appState.prescripcion.previewExpanded[capId];
  }
}

// Render columna central
function renderPrescCapituloContent() {
  const container = document.getElementById("prescCapituloContent");
  if (!container) return;

  const cap = getSelectedCapitulo();
  if (!cap) {
    container.innerHTML = `
      <p class="text-muted" style="font-size:0.85rem;">
        Aún no hay capítulos creados. Puedes:
      </p>
      <ul class="text-muted" style="font-size:0.8rem; padding-left:1.2rem;">
        <li>Crear un capítulo manual con el botón <strong>"Añadir capítulo"</strong>.</li>
        <li>Arrastrar una sección del presupuesto a esta zona para generar un capítulo automáticamente.</li>
      </ul>
    `;
    return;
  }

  const lineas = cap.lineas || [];

  let refsHTML = "";
  if (!lineas.length) {
    refsHTML = `
      <p class="text-muted" style="font-size:0.8rem;">
        Este capítulo no tiene referencias todavía. Arrastra una sección del presupuesto o añade referencias extra desde la derecha.
      </p>
    `;
  } else {
    refsHTML = `
      <div style="max-height:28vh; overflow:auto;">
        <table class="table table-compact" style="width:100%; font-size:0.8rem; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;">Código</th>
              <th style="text-align:left;">Descripción</th>
              <th style="text-align:center;">Ud</th>
              <th style="text-align:right;">Cant.</th>
              <th style="text-align:right;">PVP</th>
              <th style="text-align:right;">Importe</th>
              <th style="width:2.5rem;"></th>
            </tr>
          </thead>
          <tbody>
            ${lineas
              .map((l) => {
                const isExtra = l.tipo === "extra";
                const cod = l.codigo || "";
                const desc = l.descripcion || "";
                const unidad = l.unidad || "Ud";
                const cant = Number(l.cantidad) || 0;
                const pvp = typeof l.pvp === "number" ? l.pvp : 0;
                const importe = cant * pvp;

                return `
                  <tr data-presc-line-id="${l.id}">
                    <td>${cod}</td>
                    <td>${desc}</td>
                    <td style="text-align:center;">${unidad}</td>
                    <td style="text-align:right;">
                      ${
                        isExtra
                          ? `<input type="number" min="0" step="0.01" 
                                   class="presc-line-qty-input" 
                                   value="${cant}" 
                                   style="width:4rem; text-align:right; font-size:0.78rem;" />`
                          : cant
                      }
                    </td>
                    <td style="text-align:right;">${pvp.toFixed(2)} €</td>
                    <td style="text-align:right;">${importe.toFixed(2)} €</td>
                    <td style="text-align:center;">
                      ${
                        isExtra
                          ? `<button type="button" 
                                     class="btn btn-xs btn-outline presc-line-del-btn"
                                     title="Quitar referencia extra">
                               ✖
                             </button>`
                          : ""
                      }
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.75rem; height:100%;">
      
      <!-- Título del capítulo -->
      <div class="form-group">
        <label>Título del capítulo</label>
        <input id="prescCapTitulo" 
               type="text" 
               class="form-control"
               value="${(cap.nombre || "").replace(/"/g, "&quot;")}" />
      </div>

      <!-- Texto descriptivo -->
      <div class="form-group" style="flex:1; display:flex; flex-direction:column; min-height:0;">
        <label>Texto descriptivo (mediciones)</label>
        <textarea id="prescCapTexto"
                  class="form-control"
                  style="flex:1; min-height:120px; resize:none;"
                  placeholder="Aquí puedes escribir o pegar el texto técnico de mediciones del capítulo...">${cap.texto || ""}</textarea>
      </div>

      <!-- Tabla de referencias -->
      <div class="form-group">
        <label>Referencias del capítulo</label>
        ${refsHTML}
      </div>

      <!-- Botones de acción del capítulo -->
      <div class="form-group" style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem;">
        <button type="button" id="prescCapNuevoBtn" class="btn btn-xs btn-outline">
          ➕ Añadir capítulo
        </button>
        <button type="button" id="prescCapGuardarBtn" class="btn btn-xs btn-primary">
          💾 Guardar
        </button>
      </div>
    </div>
  `;

  const tituloInput = container.querySelector("#prescCapTitulo");
  if (tituloInput) {
    tituloInput.addEventListener("input", (ev) => {
      cap.nombre = ev.target.value || "";
    });
  }

  const textoArea = container.querySelector("#prescCapTexto");
  if (textoArea) {
    textoArea.addEventListener("input", (ev) => {
      cap.texto = ev.target.value || "";
    });
  }

  const rows = container.querySelectorAll("tr[data-presc-line-id]");
  rows.forEach((row) => {
    const lineId = row.getAttribute("data-presc-line-id");
    const linea = cap.lineas.find((l) => l.id === lineId);
    if (!linea) return;

    if (linea.tipo === "extra") {
      const qtyInput = row.querySelector(".presc-line-qty-input");
      const delBtn = row.querySelector(".presc-line-del-btn");

      if (qtyInput) {
        qtyInput.addEventListener("input", () => {
          linea.cantidad = Number(qtyInput.value) || 0;
        });
      }

      if (delBtn) {
        delBtn.addEventListener("click", () => {
          cap.lineas = cap.lineas.filter((l) => l.id !== lineId);
          renderDocPrescripcionView();
        });
      }
    }
  });

  const btnNuevoCap = container.querySelector("#prescCapNuevoBtn");
  if (btnNuevoCap) {
    btnNuevoCap.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      createManualCapitulo();
      renderDocPrescripcionView();
    });
  }

  const btnGuardarCap = container.querySelector("#prescCapGuardarBtn");
  if (btnGuardarCap) {
    btnGuardarCap.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      // Ya está guardado en estado; creamos uno nuevo en blanco
      createManualCapitulo();
      renderDocPrescripcionView();
    });
  }
}

// ========================================================
// BLOQUE 7 - Plantillas + Referencias extra
// ========================================================

// Firestore: PLANTILLAS
async function ensurePrescPlantillasLoaded() {
  appState.prescripcion.plantillas = appState.prescripcion.plantillas || [];
  if (appState.prescripcion.plantillasLoaded) return;

  const db = getFirestorePresc();
  const auth = getAuthPresc();
  if (!db) {
    console.warn("[PRESCRIPCIÓN] Firestore no disponible para plantillas, solo local.");
    appState.prescripcion.plantillasLoaded = true;
    return;
  }

  let uid = null;
  if (auth && auth.currentUser) uid = auth.currentUser.uid;

  try {
    let q = db.collection("prescripcion_plantillas");
    if (uid) q = q.where("uid", "==", uid);

    const snap = await q.get();
    const list = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      list.push({
        id: doc.id,
        nombre: d.nombre || "(sin nombre)",
        texto: d.texto || ""
      });
    });

    appState.prescripcion.plantillas = list;
    appState.prescripcion.plantillasLoaded = true;
    console.log("[PRESCRIPCIÓN] Plantillas cargadas:", list.length);
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error cargando plantillas:", e);
    appState.prescripcion.plantillasLoaded = true;
  }
}

async function createPrescPlantilla(nombre, texto) {
  nombre = (nombre || "").trim();
  texto = texto || "";
  if (!nombre) {
    alert("La plantilla necesita un nombre.");
    return;
  }

  const db = getFirestorePresc();
  const auth = getAuthPresc();

  let newItem = {
    id: "local-" + Date.now(),
    nombre,
    texto
  };

  appState.prescripcion.plantillas = [
    newItem,
    ...(appState.prescripcion.plantillas || [])
  ];

  if (!db) return;

  try {
    let uid = null;
    if (auth && auth.currentUser) uid = auth.currentUser.uid;

    const docRef = await db.collection("prescripcion_plantillas").add({
      uid: uid || null,
      nombre,
      texto,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    newItem.id = docRef.id;
    appState.prescripcion.plantillas[0] = newItem;
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error creando plantilla:", e);
  }
}

async function updatePrescPlantilla(id, nombre, texto) {
  if (!id) return;
  nombre = (nombre || "").trim();
  texto = texto || "";

  const list = appState.prescripcion.plantillas || [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], nombre, texto };
    appState.prescripcion.plantillas = list;
  }

  const db = getFirestorePresc();
  if (!db) return;

  try {
    await db.collection("prescripcion_plantillas").doc(id).update({
      nombre,
      texto,
      updatedAt: Date.now()
    });
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error actualizando plantilla:", e);
  }
}

async function deletePrescPlantilla(id) {
  if (!id) return;
  const ok = window.confirm("¿Seguro que quieres borrar esta plantilla?");
  if (!ok) return;

  appState.prescripcion.plantillas =
    (appState.prescripcion.plantillas || []).filter((p) => p.id !== id);

  const db = getFirestorePresc();
  if (!db) return;

  try {
    await db.collection("prescripcion_plantillas").doc(id).delete();
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error borrando plantilla:", e);
  }
}

// Firestore: REFERENCIAS EXTRA
async function ensureExtraRefsLoaded() {
  appState.prescripcion.extraRefs = appState.prescripcion.extraRefs || [];
  if (appState.prescripcion.extraRefsLoaded) return;

  const db = getFirestorePresc();
  const auth = getAuthPresc();
  if (!db) {
    console.warn("[PRESCRIPCIÓN] Firestore no disponible para refs extra, solo local.");
    appState.prescripcion.extraRefsLoaded = true;
    return;
  }

  let uid = null;
  if (auth && auth.currentUser) uid = auth.currentUser.uid;

  try {
    let q = db.collection("prescripcion_referencias_extra");
    if (uid) q = q.where("uid", "==", uid);

    const snap = await q.get();
    const list = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      list.push({
        id: doc.id,
        codigo: d.codigo || "",
        descripcion: d.descripcion || "",
        unidad: d.unidad || "Ud",
        pvp: typeof d.pvp === "number" ? d.pvp : 0
      });
    });

    appState.prescripcion.extraRefs = list;
    appState.prescripcion.extraRefsLoaded = true;
    console.log("[PRESCRIPCIÓN] Refs extra cargadas:", list.length);
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error cargando refs extra:", e);
    appState.prescripcion.extraRefsLoaded = true;
  }
}

async function createExtraRef(codigo, descripcion, unidad, pvp) {
  codigo = (codigo || "").trim();
  descripcion = (descripcion || "").trim();
  unidad = (unidad || "Ud").trim() || "Ud";
  pvp = Number(pvp) || 0;

  if (!codigo && !descripcion) {
    alert("La referencia necesita al menos código o descripción.");
    return;
  }

  const db = getFirestorePresc();
  const auth = getAuthPresc();

  let newItem = {
    id: "local-" + Date.now(),
    codigo,
    descripcion,
    unidad,
    pvp
  };

  appState.prescripcion.extraRefs = [
    newItem,
    ...(appState.prescripcion.extraRefs || [])
  ];

  if (!db) return;

  try {
    let uid = null;
    if (auth && auth.currentUser) uid = auth.currentUser.uid;

    const docRef = await db.collection("prescripcion_referencias_extra").add({
      uid: uid || null,
      codigo,
      descripcion,
      unidad,
      pvp,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    newItem.id = docRef.id;
    appState.prescripcion.extraRefs[0] = newItem;
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error creando ref extra:", e);
  }
}

async function updateExtraRef(id, codigo, descripcion, unidad, pvp) {
  if (!id) return;
  codigo = (codigo || "").trim();
  descripcion = (descripcion || "").trim();
  unidad = (unidad || "Ud").trim() || "Ud";
  pvp = Number(pvp) || 0;

  const list = appState.prescripcion.extraRefs || [];
  const idx = list.findIndex((r) => r.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], codigo, descripcion, unidad, pvp };
    appState.prescripcion.extraRefs = list;
  }

  const db = getFirestorePresc();
  if (!db) return;

  try {
    await db.collection("prescripcion_referencias_extra").doc(id).update({
      codigo,
      descripcion,
      unidad,
      pvp,
      updatedAt: Date.now()
    });
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error actualizando ref extra:", e);
  }
}

async function deleteExtraRef(id) {
  if (!id) return;
  const ok = window.confirm("¿Seguro que quieres borrar esta referencia extra?");
  if (!ok) return;

  appState.prescripcion.extraRefs =
    (appState.prescripcion.extraRefs || []).filter((r) => r.id !== id);

  const db = getFirestorePresc();
  if (!db) return;

  try {
    await db.collection("prescripcion_referencias_extra").doc(id).delete();
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error borrando ref extra:", e);
  }
}

async function duplicateExtraRef(id) {
  const list = appState.prescripcion.extraRefs || [];
  const r = list.find((x) => x.id === id);
  if (!r) return;

  const nuevoCodigo = r.codigo ? r.codigo + "_COPY" : "";
  await createExtraRef(nuevoCodigo, r.descripcion, r.unidad, r.pvp);
}

function addExtraRefToCurrentCap(extraId) {
  const cap = getSelectedCapitulo();
  if (!cap) {
    alert("Selecciona o crea un capítulo primero.");
    return;
  }
  const list = appState.prescripcion.extraRefs || [];
  const r = list.find((x) => x.id === extraId);
  if (!r) return;

  cap.lineas = cap.lineas || [];
  cap.lineas.push({
    id: "extra-" + extraId + "-" + Date.now(),
    tipo: "extra",
    codigo: r.codigo,
    descripcion: r.descripcion,
    unidad: r.unidad || "Ud",
    cantidad: 1,
    pvp: r.pvp || 0,
    importe: (r.pvp || 0) * 1,
    extraRefId: extraId
  });
}

// ========================================================
// Render PLANTILLAS (con buscador)
// ========================================================
async function renderPrescPlantillasList() {
  const container = document.getElementById("prescPlantillasList");
  if (!container) return;

  await ensurePrescPlantillasLoaded();
  const plantillas = appState.prescripcion.plantillas || [];
  const searchTerm = (appState.prescripcion.plantillasSearchTerm || "").toLowerCase();

  const filtered = plantillas.filter((p) => {
    if (!searchTerm) return true;
    const base =
      (p.nombre || "") + " " +
      (p.texto || "");
    return base.toLowerCase().includes(searchTerm);
  });

  if (!plantillas.length) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
        <input id="prescPlantillasSearch" 
               type="text" 
               class="form-control form-control-sm" 
               placeholder="Buscar plantilla..."
               value="${appState.prescripcion.plantillasSearchTerm || ""}"
               style="font-size:0.75rem; max-width:60%;">
        <button id="prescNewPlantillaBtn" class="btn btn-xs btn-primary">➕ Nueva plantilla</button>
      </div>
      <p class="text-muted" style="font-size:0.8rem;">
        Aún no tienes plantillas. Crea tu primera plantilla de texto técnico.
      </p>
    `;
  } else {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
        <input id="prescPlantillasSearch" 
               type="text" 
               class="form-control form-control-sm" 
               placeholder="Buscar plantilla..."
               value="${appState.prescripcion.plantillasSearchTerm || ""}"
               style="font-size:0.75rem; max-width:60%;">
        <button id="prescNewPlantillaBtn" class="btn btn-xs btn-primary">➕ Nueva plantilla</button>
      </div>
      <div>
        ${filtered
          .map((p) => {
            const preview =
              (p.texto || "")
                .split("\n")
                .slice(0, 3)
                .join(" ")
                .slice(0, 220) +
              (p.texto && p.texto.length > 220 ? "..." : "");

            return `
              <div class="presc-plantilla-item"
                   draggable="true"
                   data-presc-plantilla-id="${p.id}">
                <div class="presc-plantilla-header">
                  <span class="presc-plantilla-name">📄 ${p.nombre}</span>
                  <span class="presc-plantilla-actions">
                    <button class="btn btn-xs btn-outline" data-presc-plantilla-edit="${p.id}">✏️</button>
                    <button class="btn btn-xs" data-presc-plantilla-del="${p.id}">🗑️</button>
                  </span>
                </div>
                <div class="presc-plantilla-preview">
                  ${preview || "<i>(sin texto)</i>"}
                </div>
                <div class="presc-plantilla-footer">
                  <button class="btn btn-xs" data-presc-plantilla-apply="${p.id}">
                    ➕ Aplicar al capítulo
                  </button>
                </div>
              </div>
            `;
          })
          .join("") || `
            <p class="text-muted" style="font-size:0.8rem;">
              No hay plantillas que coincidan con la búsqueda.
            </p>
          `}
      </div>
    `;
  }

  // Buscador plantillas
  const searchInput = container.querySelector("#prescPlantillasSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      appState.prescripcion.plantillasSearchTerm = e.target.value || "";
      renderPrescPlantillasList();
    });
  }

  // Botón nueva plantilla
  const btnNew = container.querySelector("#prescNewPlantillaBtn");
  if (btnNew) {
    btnNew.addEventListener("click", () => {
      openPrescModal({
        title: "Nueva plantilla de prescripción",
        bodyHTML: `
          <div class="form-group">
            <label>Nombre</label>
            <input id="tplNombre" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Texto</label>
            <textarea id="tplTexto" rows="8" class="form-control"></textarea>
          </div>
        `,
        onSave: async () => {
          const nombre = (document.getElementById("tplNombre").value || "").trim();
          const texto = document.getElementById("tplTexto").value || "";
          await createPrescPlantilla(nombre, texto);
          renderDocPrescripcionView();
        }
      });
    });
  }

  // Drag plantillas
  container
    .querySelectorAll(".presc-plantilla-item[draggable='true']")
    .forEach((el) => {
      el.addEventListener("dragstart", (ev) => {
        const id = el.getAttribute("data-presc-plantilla-id");
        ev.dataTransfer.setData("text/presc-plantilla-id", id);
        el.style.opacity = "0.6";
      });
      el.addEventListener("dragend", () => {
        el.style.opacity = "1";
      });
    });

  // Aplicar al capítulo
  container
    .querySelectorAll("[data-presc-plantilla-apply]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-presc-plantilla-apply");
        const plantillasList = appState.prescripcion.plantillas || [];
        const tpl = plantillasList.find((p) => p.id === id);
        if (!tpl) return;

        const cap = getSelectedCapitulo();
        if (!cap) {
          alert("Selecciona o crea un capítulo primero.");
          return;
        }

        cap.texto = tpl.texto || "";
        const ta = document.getElementById("prescCapTexto");
        if (ta) ta.value = cap.texto;
      });
    });

  // Editar plantilla
  container
    .querySelectorAll("[data-presc-plantilla-edit]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-presc-plantilla-edit");
        const plantillasList = appState.prescripcion.plantillas || [];
        const tpl = plantillasList.find((p) => p.id === id);
        if (!tpl) return;

        openPrescModal({
          title: "Editar plantilla",
          bodyHTML: `
            <div class="form-group">
              <label>Nombre</label>
              <input id="tplNombre" type="text" class="form-control" value="${(tpl.nombre || "").replace(/"/g, "&quot;")}" />
            </div>
            <div class="form-group">
              <label>Texto</label>
              <textarea id="tplTexto" rows="8" class="form-control">${tpl.texto || ""}</textarea>
            </div>
          `,
          onSave: async () => {
            const nombre = (document.getElementById("tplNombre").value || "").trim();
            const texto = document.getElementById("tplTexto").value || "";
            await updatePrescPlantilla(id, nombre, texto);
            renderDocPrescripcionView();
          }
        });
      });
    });

  // Borrar plantilla
  container
    .querySelectorAll("[data-presc-plantilla-del]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-presc-plantilla-del");
        await deletePrescPlantilla(id);
        renderDocPrescripcionView();
      });
    });

  // Drop desde plantillas al textarea del capítulo
  const capTextarea = document.getElementById("prescCapTexto");
  if (capTextarea) {
    capTextarea.addEventListener("dragover", (ev) => {
      if (ev.dataTransfer.types.includes("text/presc-plantilla-id")) {
        ev.preventDefault();
      }
    });

    capTextarea.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const id = ev.dataTransfer.getData("text/presc-plantilla-id");
      if (!id) return;

      const plantillasList = appState.prescripcion.plantillas || [];
      const tpl = plantillasList.find((p) => p.id === id);
      if (!tpl) return;

      const cap = getSelectedCapitulo();
      if (!cap) return;

      cap.texto = tpl.texto || "";
      capTextarea.value = cap.texto;
    });
  }
}

// ========================================================
// Render REFERENCIAS EXTRA (con buscador)
// ========================================================
async function renderPrescExtraRefsList() {
  const container = document.getElementById("prescExtraRefsList");
  if (!container) return;

  await ensureExtraRefsLoaded();
  const refs = appState.prescripcion.extraRefs || [];
  const searchTerm = (appState.prescripcion.extraRefsSearchTerm || "").toLowerCase();

  const filtered = refs.filter((r) => {
    if (!searchTerm) return true;
    const base =
      (r.codigo || "") + " " +
      (r.descripcion || "");
    return base.toLowerCase().includes(searchTerm);
  });

  if (!refs.length) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
        <input id="prescExtraRefsSearch" 
               type="text" 
               class="form-control form-control-sm" 
               placeholder="Buscar referencia..."
               value="${appState.prescripcion.extraRefsSearchTerm || ""}"
               style="font-size:0.75rem; max-width:60%;">
        <button id="prescNewExtraRefBtn" class="btn btn-xs btn-secondary">➕ Nueva referencia extra</button>
      </div>
      <p class="text-muted" style="font-size:0.8rem;">
        Aún no tienes referencias extra. Crea materiales, mano de obra, etc.
      </p>
    `;
  } else {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
        <input id="prescExtraRefsSearch" 
               type="text" 
               class="form-control form-control-sm" 
               placeholder="Buscar referencia..."
               value="${appState.prescripcion.extraRefsSearchTerm || ""}"
               style="font-size:0.75rem; max-width:60%;">
        <button id="prescNewExtraRefBtn" class="btn btn-xs btn-secondary">➕ Nueva referencia extra</button>
      </div>
      <div>
        ${filtered
          .map((r) => {
            const cod = r.codigo || "";
            const desc = r.descripcion || "";
            const unidad = r.unidad || "Ud";
            const pvp =
              typeof r.pvp === "number" ? r.pvp.toFixed(2) : "0.00";

            return `
              <div class="presc-extra-item" data-presc-extra-id="${r.id}">
                <div class="presc-extra-main">
                  <div class="presc-extra-line1">
                    <span class="presc-extra-code">${cod}</span>
                    <span class="presc-extra-price">${pvp} € / ${unidad}</span>
                  </div>
                  <div class="presc-extra-desc">
                    ${desc || "<i>(sin descripción)</i>"}
                  </div>
                </div>
                <div class="presc-extra-actions">
                  <button class="btn btn-xs" data-presc-extra-add="${r.id}">➕ Añadir al capítulo</button>
                  <button class="btn btn-xs btn-outline" data-presc-extra-dup="${r.id}">⧉</button>
                  <button class="btn btn-xs btn-outline" data-presc-extra-edit="${r.id}">✏️</button>
                  <button class="btn btn-xs" data-presc-extra-del="${r.id}">🗑️</button>
                </div>
              </div>
            `;
          })
          .join("") || `
            <p class="text-muted" style="font-size:0.8rem;">
              No hay referencias que coincidan con la búsqueda.
            </p>
          `}
      </div>
    `;
  }

  // Buscador refs extra
  const searchInput = container.querySelector("#prescExtraRefsSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      appState.prescripcion.extraRefsSearchTerm = e.target.value || "";
      renderPrescExtraRefsList();
    });
  }

  // Botón nueva ref extra
  const btnNew = container.querySelector("#prescNewExtraRefBtn");
  if (btnNew) {
    btnNew.addEventListener("click", () => {
      openPrescModal({
        title: "Nueva referencia extra",
        bodyHTML: `
          <div class="form-group">
            <label>Código</label>
            <input id="extCodigo" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <textarea id="extDesc" rows="3" class="form-control"></textarea>
          </div>
          <div class="form-group">
            <label>Unidad de medida</label>
            <select id="extUnidad" class="form-control">
              <option value="Ud">Ud (unidad)</option>
              <option value="m">m (metro)</option>
              <option value="m²">m² (metro cuadrado)</option>
              <option value="h">h (hora)</option>
              <option value="m³">m³ (metro cúbico)</option>
              <option value="kg">kg</option>
            </select>
          </div>
          <div class="form-group">
            <label>PVP</label>
            <input id="extPvp" type="number" class="form-control" value="0" />
          </div>
        `,
        onSave: async () => {
          const codigo = (document.getElementById("extCodigo").value || "").trim();
          const descripcion = (document.getElementById("extDesc").value || "").trim();
          const unidad = (document.getElementById("extUnidad").value || "Ud").trim() || "Ud";
          const pvp = Number(document.getElementById("extPvp").value || 0);
          await createExtraRef(codigo, descripcion, unidad, pvp);
          renderDocPrescripcionView();
        }
      });
    });
  }

  // Acciones sobre cada ref extra
  container
    .querySelectorAll("[data-presc-extra-add]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-presc-extra-add");
        addExtraRefToCurrentCap(id);
        renderDocPrescripcionView();
      });
    });

  container
    .querySelectorAll("[data-presc-extra-dup]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-presc-extra-dup");
        await duplicateExtraRef(id);
        renderDocPrescripcionView();
      });
    });

  container
    .querySelectorAll("[data-presc-extra-edit]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-presc-extra-edit");
        const list = appState.prescripcion.extraRefs || [];
        const r = list.find((x) => x.id === id);
        if (!r) return;

        openPrescModal({
          title: "Editar referencia extra",
          bodyHTML: `
            <div class="form-group">
              <label>Código</label>
              <input id="extCodigo" type="text" class="form-control"
                     value="${(r.codigo || "").replace(/"/g, "&quot;")}" />
            </div>
            <div class="form-group">
              <label>Descripción</label>
              <textarea id="extDesc" rows="3" class="form-control">${r.descripcion || ""}</textarea>
            </div>
            <div class="form-group">
              <label>Unidad de medida</label>
              <select id="extUnidad" class="form-control">
                <option value="Ud" ${r.unidad === "Ud" ? "selected" : ""}>Ud (unidad)</option>
                <option value="m" ${r.unidad === "m" ? "selected" : ""}>m (metro)</option>
                <option value="m²" ${r.unidad === "m²" ? "selected" : ""}>m² (metro cuadrado)</option>
                <option value="h" ${r.unidad === "h" ? "selected" : ""}>h (hora)</option>
                <option value="m³" ${r.unidad === "m³" ? "selected" : ""}>m³ (metro cúbico)</option>
                <option value="kg" ${r.unidad === "kg" ? "selected" : ""}>kg</option>
              </select>
            </div>
            <div class="form-group">
              <label>PVP</label>
              <input id="extPvp" type="number" class="form-control" value="${r.pvp || 0}" />
            </div>
          `,
          onSave: async () => {
            const codigo = (document.getElementById("extCodigo").value || "").trim();
            const descripcion = (document.getElementById("extDesc").value || "").trim();
            const unidad = (document.getElementById("extUnidad").value || "Ud").trim() || "Ud";
            const pvp = Number(document.getElementById("extPvp").value || 0);
            await updateExtraRef(id, codigo, descripcion, unidad, pvp);
            renderDocPrescripcionView();
          }
        });
      });
    });

  container
    .querySelectorAll("[data-presc-extra-del]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-presc-extra-del");
        await deleteExtraRef(id);
        renderDocPrescripcionView();
      });
    });
}

// Estilos plantillas y refs extra
(function injectPrescTemplatesAndExtraStyles() {
  if (document.getElementById("presc-templates-extra-styles")) return;
  const style = document.createElement("style");
  style.id = "presc-templates-extra-styles";
  style.innerHTML = `
    .presc-plantilla-item {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.5rem;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      font-size: 0.78rem;
      cursor: grab;
      transition: box-shadow 0.15s ease, transform 0.15s ease;
    }
    .presc-plantilla-item:hover {
      box-shadow: 0 2px 4px rgba(0,0,0,0.08);
      transform: translateY(-1px);
    }
    .presc-plantilla-header {
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:0.25rem;
    }
    .presc-plantilla-name {
      font-weight:600;
      color:#111827;
    }
    .presc-plantilla-actions button {
      font-size:0.7rem;
    }
    .presc-plantilla-preview {
      color:#6b7280;
      margin-bottom:0.35rem;
    }
    .presc-plantilla-footer {
      text-align:right;
    }

    .presc-extra-item {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.5rem;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
      font-size:0.78rem;
    }
    .presc-extra-main {
      margin-bottom:0.35rem;
    }
    .presc-extra-line1 {
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:0.1rem;
    }
    .presc-extra-code {
      font-weight:600;
      color:#111827;
    }
    .presc-extra-price {
      color:#111827;
      font-weight:500;
    }
    .presc-extra-desc {
      color:#6b7280;
      font-size:0.76rem;
    }
    .presc-extra-actions {
      display:flex;
      flex-wrap:wrap;
      gap:0.25rem;
      justify-content:flex-end;
    }
  `;
  document.head.appendChild(style);
})();

// ========================================================
// BLOQUE 8 - Previsualización de capítulos
// ========================================================

function renderPrescPreview() {
  const container = document.getElementById("prescPreview");
  if (!container) return;

  ensurePrescCapitulosArray();
  const caps = appState.prescripcion.capitulos || [];

  if (!caps.length) {
    container.innerHTML = `
      <p class="text-muted" style="font-size:0.8rem;">
        Aún no hay capítulos en la prescripción. Crea uno manual o arrastra una sección del presupuesto.
      </p>
    `;
    return;
  }

  const extraRefs = appState.prescripcion.extraRefs || [];
  appState.prescripcion.previewExpanded = appState.prescripcion.previewExpanded || {};
  const expanded = appState.prescripcion.previewExpanded;

  let totalGlobal = 0;

  const rowsHTML = caps
    .map((cap) => {
      const lineas = cap.lineas || [];

      let totalCap = 0;
      lineas.forEach((l) => {
        const cant = Number(l.cantidad) || 0;
        const pvp = Number(l.pvp) || 0;
        totalCap += cant * pvp;
      });
      totalGlobal += totalCap;

      const isExpanded = !!expanded[cap.id];

      let detailsHTML = "";
      if (isExpanded && lineas.length) {
        const detailRows = lineas
          .map((l) => {
            const cod = l.codigo || "";
            const desc = l.descripcion || "";
            const cant = Number(l.cantidad) || 0;
            const pvp = Number(l.pvp) || 0;
            const importe = cant * pvp;

            let unidad = l.unidad || "Ud";
            if (l.tipo === "extra" && l.extraRefId && extraRefs.length) {
              const ref = extraRefs.find((r) => r.id === l.extraRefId);
              if (ref) unidad = ref.unidad || unidad;
            }

            return `
              <tr>
                <td>${cod}</td>
                <td>${desc}</td>
                <td style="text-align:center;">${unidad}</td>
                <td style="text-align:right;">${cant}</td>
                <td style="text-align:right;">${pvp.toFixed(2)} €</td>
                <td style="text-align:right;">${importe.toFixed(2)} €</td>
              </tr>
            `;
          })
          .join("");

        detailsHTML = `
          <tr class="presc-preview-cap-details-row" data-cap-id="${cap.id}">
            <td colspan="5" style="padding:0.4rem 0.6rem 0.6rem 2.2rem;">
              <div style="max-height:24vh; overflow:auto;">
                <table class="table table-compact" 
                       style="width:100%; font-size:0.78rem; border-collapse:collapse; border-top:1px solid #e5e7eb;">
                  <thead>
                    <tr>
                      <th style="text-align:left;">Código</th>
                      <th style="text-align:left;">Descripción</th>
                      <th style="text-align:center;">Ud</th>
                      <th style="text-align:right;">Cant.</th>
                      <th style="text-align:right;">PVP</th>
                      <th style="text-align:right;">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${detailRows}
                  </tbody>
                </table>
              </div>
              <div style="text-align:right; margin-top:4px; font-weight:600;">
                Subtotal capítulo: ${totalCap.toFixed(2)} €
              </div>
            </td>
          </tr>
        `;
      }

      return `
        <tr class="presc-preview-cap-row" data-cap-id="${cap.id}">
          <td style="width:1.8rem; text-align:center; cursor:pointer;">
            ${isExpanded ? "▾" : "▸"}
          </td>
          <td style="cursor:pointer;">
            ${cap.nombre || "(sin título)"}
          </td>
          <td style="text-align:right;">${lineas.length}</td>
          <td style="text-align:right;">${totalCap.toFixed(2)} €</td>
          <td style="text-align:center; white-space:nowrap;">
            <button type="button"
                    class="btn btn-xs btn-outline presc-preview-cap-edit"
                    data-cap-id="${cap.id}"
                    title="Editar capítulo">
              ✏️
            </button>
            <button type="button"
                    class="btn btn-xs btn-outline presc-preview-cap-del"
                    data-cap-id="${cap.id}"
                    title="Eliminar capítulo">
              🗑️
            </button>
          </td>
        </tr>
        ${detailsHTML}
      `;
    })
    .join("");

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
      <div style="font-size:0.8rem; color:#6b7280;">
        Doble clic sobre un capítulo para desplegar u ocultar sus referencias.
      </div>
    </div>

    <div style="max-height:32vh; overflow:auto;">
      <table class="table table-compact"
             style="width:100%; font-size:0.8rem; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="width:1.8rem;"></th>
            <th style="text-align:left;">Capítulo</th>
            <th style="text-align:right;">Nº refs</th>
            <th style="text-align:right;">Total capítulo</th>
            <th style="width:4.5rem;"></th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>
    </div>

    <div style="text-align:right; margin-top:0.4rem; font-weight:600;">
      Total prescripción: ${totalGlobal.toFixed(2)} €
    </div>
  `;

  container
    .querySelectorAll(".presc-preview-cap-row")
    .forEach((row) => {
      row.addEventListener("dblclick", () => {
        const capId = row.getAttribute("data-cap-id");
        if (!capId) return;

        appState.prescripcion.previewExpanded =
          appState.prescripcion.previewExpanded || {};
        const exp = appState.prescripcion.previewExpanded;

        exp[capId] = !exp[capId];
        renderPrescPreview();
      });
    });

  container
    .querySelectorAll(".presc-preview-cap-edit")
    .forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const capId = btn.getAttribute("data-cap-id");
        if (!capId) return;
        setSelectedCapitulo(capId);
        renderPrescCapituloContent();
      });
    });

  container
    .querySelectorAll(".presc-preview-cap-del")
    .forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const capId = btn.getAttribute("data-cap-id");
        if (!capId) return;
        deleteCapituloById(capId);
        renderDocPrescripcionView();
      });
    });
}

// Estilos tabla preview
(function injectPrescPreviewStyles() {
  if (document.getElementById("presc-preview-styles")) return;
  const style = document.createElement("style");
  style.id = "presc-preview-styles";
  style.innerHTML = `
    #prescPreview table thead tr {
      border-bottom: 1px solid #e5e7eb;
    }
    #prescPreview table tbody tr.presc-preview-cap-row:hover {
      background:#f9fafb;
    }
  `;
  document.head.appendChild(style);
})();

// ========================================================
// BLOQUE 9 - Exportación Excel / PDF / BC3 con idioma
// ========================================================

const PRESC_EXPORT_LABELS = {
  es: {
    chapter: "Capítulo",
    code: "Código",
    description: "Descripción",
    unit: "Ud",
    qty: "Cant.",
    price: "PVP",
    amount: "Importe",
    title: "Prescripción técnica del proyecto",
    total: "Total capítulo",
    project: "Proyecto"
  },
  en: {
    chapter: "Chapter",
    code: "Code",
    description: "Description",
    unit: "Unit",
    qty: "Qty",
    price: "Price",
    amount: "Amount",
    title: "Project technical specification",
    total: "Chapter total",
    project: "Project"
  },
  pt: {
    chapter: "Capítulo",
    code: "Código",
    description: "Descrição",
    unit: "Unid",
    qty: "Qtd.",
    price: "PVP",
    amount: "Montante",
    title: "Especificação técnica do projeto",
    total: "Total capítulo",
    project: "Projeto"
  }
};

function buildPrescExportModel(lang) {
  ensurePrescCapitulosArray();
  const caps = appState.prescripcion.capitulos || [];
  const language = lang || appState.prescripcion.exportLang || "es";

  const result = {
    language,
    capitulos: []
  };

  caps.forEach((cap, idx) => {
    const lineas = cap.lineas || [];
    const capData = {
      index: idx + 1,
      id: cap.id,
      nombre: cap.nombre || "",
      texto: cap.texto || "",
      lineas: []
    };

    lineas.forEach((l) => {
      const cant = Number(l.cantidad) || 0;
      const pvp = Number(l.pvp) || 0;
      capData.lineas.push({
        id: l.id,
        tipo: l.tipo || "budget",
        codigo: l.codigo || "",
        descripcion: l.descripcion || "",
        unidad: l.unidad || "Ud",
        cantidad: cant,
        pvp,
        importe: cant * pvp
      });
    });

    result.capitulos.push(capData);
  });

  return result;
}

function handlePrescExport(format) {
  const lang = appState.prescripcion.exportLang || "es";
  const model = buildPrescExportModel(lang);

  if (!model || !model.capitulos || !model.capitulos.length) {
    alert("No hay capítulos para exportar.");
    return;
  }

  if (format === "excel" && typeof window.exportPrescripcionToExcel === "function") {
    window.exportPrescripcionToExcel(model, lang);
    return;
  }
  if (format === "pdf" && typeof window.exportPrescripcionToPdf === "function") {
    window.exportPrescripcionToPdf(model, lang);
    return;
  }
  if (format === "bc3" && typeof window.exportPrescripcionToBc3 === "function") {
    window.exportPrescripcionToBc3(model, lang);
    return;
  }

  if (format === "excel") {
    const csv = prescExportToCSV(model, lang);
    downloadTextFile(csv, `prescripcion_${lang}.csv`, "text/csv;charset=utf-8;");
  } else if (format === "bc3") {
    const bc3 = prescExportToBC3(model, lang);
    downloadTextFile(bc3, `prescripcion_${lang}.bc3`, "text/plain;charset=utf-8;");
  } else if (format === "pdf") {
    openPrescPrintWindow(model, lang);
  }
}

function prescExportToCSV(model, lang) {
  const labels = PRESC_EXPORT_LABELS[lang] || PRESC_EXPORT_LABELS.es;
  const sep = ";";

  const header = [
    labels.chapter,
    labels.code,
    labels.description,
    labels.unit,
    labels.qty,
    labels.price,
    labels.amount
  ].join(sep);

  const lines = [header];

  model.capitulos.forEach((cap) => {
    cap.lineas.forEach((l) => {
      const row = [
        (cap.nombre || "").replace(/;/g, ","),
        (l.codigo || "").replace(/;/g, ","),
        (l.descripcion || "").replace(/;/g, ","),
        l.unidad || "",
        String(l.cantidad || 0),
        String(l.pvp || 0),
        String(l.importe || 0)
      ].join(sep);
      lines.push(row);
    });
  });

  return lines.join("\n");
}

function prescExportToBC3(model, lang) {
  const labels = PRESC_EXPORT_LABELS[lang] || PRESC_EXPORT_LABELS.es;
  const lines = [];

  lines.push("~V|FIEBDC-3|PRESCRIPCION2N||");
  lines.push(`~K|PRESCRIPCION|${labels.project}||`);

  model.capitulos.forEach((cap, idx) => {
    const capCode = `CAP${String(idx + 1).padStart(3, "0")}`;
    const capDesc = (cap.nombre || "").replace(/\|/g, " ");

    lines.push(`~C|${capCode}|${capDesc}|1||`);

    cap.lineas.forEach((l, i) => {
      const refCode = (l.codigo || `REF${String(i + 1).padStart(4, "0")}`).replace(/\|/g, " ");
      const desc = (l.descripcion || "").replace(/\|/g, " ");
      const unit = (l.unidad || "Ud").replace(/\|/g, " ");
      const qty = l.cantidad || 0;
      const price = l.pvp || 0;

      lines.push(`~L|${refCode}|${desc}|${unit}|${qty}|${price}||`);
    });
  });

  return lines.join("\n");
}

function openPrescPrintWindow(model, lang) {
  const labels = PRESC_EXPORT_LABELS[lang] || PRESC_EXPORT_LABELS.es;

  const win = window.open("", "_blank");
  if (!win) {
    alert("No se pudo abrir la ventana de impresión. Revisa el bloqueador de ventanas emergentes.");
    return;
  }

  const style = `
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 16px; }
      h1 { font-size: 18px; margin-bottom: 8px; }
      h2 { font-size: 14px; margin-top: 16px; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; }
      th { background: #f3f4f6; text-align: left; }
      .cap-title { margin-top: 16px; font-weight: 600; }
      .small { font-size: 10px; color: #6b7280; }
    </style>
  `;

  let html = `
    <html>
      <head>
        <meta charset="utf-8" />
        ${style}
      </head>
      <body>
        <h1>${labels.title}</h1>
        <p class="small">${labels.project}: ${document.title || ""}</p>
  `;
  model.capitulos.forEach((cap, idx) => {
    html += `
      <h2>${labels.chapter} ${idx + 1} - ${cap.nombre || ""}</h2>
    `;

    if (cap.texto) {
      html += `<p>${(cap.texto || "").replace(/\n/g, "<br>")}</p>`;
    }

    if (cap.lineas && cap.lineas.length) {
      html += `
        <table>
          <thead>
            <tr>
              <th>${labels.code}</th>
              <th>${labels.description}</th>
              <th>${labels.unit}</th>
              <th style="text-align:right;">${labels.qty}</th>
              <th style="text-align:right;">${labels.price}</th>
              <th style="text-align:right;">${labels.amount}</th>
            </tr>
          </thead>
          <tbody>
      `;

      cap.lineas.forEach((l) => {
        html += `
          <tr>
            <td>${l.codigo || ""}</td>
            <td>${l.descripcion || ""}</td>
            <td>${l.unidad || ""}</td>
            <td style="text-align:right;">${(l.cantidad || 0)}</td>
            <td style="text-align:right;">${(l.pvp || 0).toFixed(2)}</td>
            <td style="text-align:right;">${(l.importe || 0).toFixed(2)}</td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    }
  });

  html += `
        <p class="small">
          Generado desde CRM Prescripción 2N · Idioma: ${lang.toUpperCase()}
        </p>
      </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();

  try {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 500);
  } catch (e) {
    console.warn("[PRESCRIPCIÓN] No se pudo lanzar print automáticamente:", e);
  }
}

function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
