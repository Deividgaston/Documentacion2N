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
// Helpers generales
// ========================================================
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}





// Helpers extra (evita bugs en previsualización / attrs)
function escapeHtmlAttr(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Re-render mínimo cuando cambia el capítulo seleccionado (sin re-render total)
function renderPrescCapituloSelected() {
  // Solo refresca el panel central para evitar parpadeos y mantener rendimiento
  renderPrescCapituloContent();
}
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
    try {
      if (typeof onSave === "function") await onSave();
    } catch (e) {
      console.error("[PRESCRIPCIÓN] Error en modal onSave:", e);
      alert("Ha ocurrido un error al guardar. Revisa la consola para más detalle.");
    } finally {
      close();
    }
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
// Rutas por usuario (guardado en Firestore)
// users/{uid}/prescripcion_plantillas/{id}
// users/{uid}/prescripcion_referencias_extra/{id}
// ========================================================

function getCurrentUidPresc() {
  const auth = getAuthPresc();

  // 1) Firebase Auth estándar
  if (auth && auth.currentUser && auth.currentUser.uid) return auth.currentUser.uid;

  // 2) Fallbacks: algunos módulos guardan el usuario en appState
  try {
    if (window.appState && window.appState.user && window.appState.user.uid) {
      return window.appState.user.uid;
    }
    if (window.appState && window.appState.auth && window.appState.auth.uid) {
      return window.appState.auth.uid;
    }
  } catch (_) {}

  return null;
}

function getUserSubcollectionRefPresc(subName) {
  const db = getFirestorePresc();
  const uid = getCurrentUidPresc();
  if (!db || !uid) return null;

  // Firestore compat (v8 / compat)
  if (typeof db.collection === "function") {
    return db.collection("users").doc(uid).collection(subName);
  }

  console.warn("[PRESCRIPCIÓN] Firestore instance no soporta .collection(); usa compat o adapta tu getFirestoreInstance().");
  return null;
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
    <div class="presc-root" style="display:flex; flex-direction:column; min-height:100vh; height:auto; overflow:auto;">

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
      <div class="presc-layout" style="display:grid; grid-template-columns:1fr 1.4fr 1.2fr; gap:1rem; min-height:480px; overflow:visible;">

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
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem;">
            <div>
              <div class="card-title">Capítulo seleccionado</div>
              <div class="card-subtitle">Nombre, texto descriptivo y referencias del capítulo</div>
            </div>
            <div style="display:flex; gap:0.25rem;">
              <button type="button" id="prescCapNuevoBtn" class="btn btn-xs btn-secondary" title="Añadir capítulo">
                ＋
              </button>
              <button type="button" id="prescCapGuardarBtn" class="btn btn-xs btn-secondary" title="Guardar y crear nuevo capítulo">
                💾
              </button>
            </div>
          </div>

          <div id="prescCapituloContent" class="card-body" 
               style="flex:1; overflow:auto;">
          </div>
        </div>

        <!-- COLUMNA 3: Plantillas -->
        <div style="display:flex; flex-direction:column; gap:1rem; height:100%; overflow:hidden;">

          <!-- Plantillas (altura reducida) -->
          <div class="card" style="height:42%; min-height:220px; display:flex; flex-direction:column; overflow:hidden;">
            <div class="card-header">
              <div class="card-title">Plantillas</div>
              <div class="card-subtitle">Arrastra y suelta para rellenar texto técnico</div>
            </div>
            <div id="prescPlantillasList" class="card-body" style="flex:1; overflow:auto;"></div>
          </div>

          <!-- Referencias extra (mismo tamaño que Plantillas) -->
          <div class="card" style="height:42%; min-height:220px; display:flex; flex-direction:column; overflow:hidden;">
            <div class="card-header">
              <div class="card-title">Referencias extra</div>
              <div class="card-subtitle">Switches, cable, mano de obra…</div>
            </div>
            <div id="prescExtraRefsList" class="card-body" style="flex:1; overflow:auto;"></div>
          </div>
        </div>
      </div>

      <!-- PREVISUALIZACIÓN inferior -->
      <div class="card" style="margin-top:1rem;">
        <div class="card-header">
          <div class="card-title">Previsualización de la prescripción</div>
          <div class="card-subtitle">Capítulos añadidos, totales y desglose desplegable</div>
        </div>

        <div id="prescPreview" class="card-body" style="overflow:visible;">
        </div>
      </div>

    </div>
  `;

  // Handlers cabecera global
  const btnReloadSections = container.querySelector("#prescReloadSectionsBtn");
  if (btnReloadSections) {
    btnReloadSections.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      buildPrescSectionsFromPresupuesto();
      renderDocPrescripcionView();
    });
  }

  // Botones del capítulo seleccionado (iconos en cabecera)
  const btnCapNuevo = container.querySelector("#prescCapNuevoBtn");
  if (btnCapNuevo) {
    btnCapNuevo.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      createManualCapitulo();
      renderDocPrescripcionView();
    });
  }

  const btnCapGuardar = container.querySelector("#prescCapGuardarBtn");
  if (btnCapGuardar) {
    btnCapGuardar.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      // Mantiene el capítulo actual en estado y crea uno nuevo en blanco
      createManualCapitulo();
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
      <div>
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
    <div style="display:flex; flex-direction:column; gap:0.75rem;">

      <!-- Título del capítulo -->
      <div class="form-group">
        <label>Título del capítulo</label>
        <input id="prescCapTitulo" 
               type="text" 
               class="form-control"
               value="${(cap.nombre || "").replace(/"/g, "&quot;")}" />
      </div>

      <!-- Texto descriptivo -->
      <div class="form-group">
        <label>Texto descriptivo (mediciones)</label>
        <textarea id="prescCapTexto"
                  class="form-control"
                  style="width:100%; min-height:130px; resize:vertical;"
                  placeholder="Aquí puedes escribir o pegar el texto técnico de mediciones del capítulo...">${cap.texto || ""}</textarea>
      </div>

      <!-- Tabla de referencias -->
      <div class="form-group">
        <label>Referencias del capítulo</label>
        ${refsHTML}
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
          linea.importe = safeNumber(linea.cantidad) * safeNumber(linea.pvp);
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
}

// ========================================================
// BLOQUE 7 - Plantillas + Referencias extra
// ========================================================

// Firestore: PLANTILLAS
async function ensurePrescPlantillasLoaded() {
  await ensurePrescUidReady();
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
    let q = getUserSubcollectionRefPresc("prescripcion_plantillas");
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
  await ensurePrescUidReady();
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

    const docRef = await getUserSubcollectionRefPresc("prescripcion_plantillas").add({
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
  await ensurePrescUidReady();
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
    await getUserSubcollectionRefPresc("prescripcion_plantillas").doc(id).update({
      nombre,
      texto,
      updatedAt: Date.now()
    });
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error actualizando plantilla:", e);
  }
}

async function deletePrescPlantilla(id) {
  await ensurePrescUidReady();
  if (!id) return;
  const ok = window.confirm("¿Seguro que quieres borrar esta plantilla?");
  if (!ok) return;

  appState.prescripcion.plantillas =
    (appState.prescripcion.plantillas || []).filter((p) => p.id !== id);

  const db = getFirestorePresc();
  if (!db) return;

  try {
    await getUserSubcollectionRefPresc("prescripcion_plantillas").doc(id).delete();
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error borrando plantilla:", e);
  }
}

// Firestore: REFERENCIAS EXTRA
async function ensureExtraRefsLoaded() {
  await ensurePrescUidReady();
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
    let q = getUserSubcollectionRefPresc("prescripcion_referencias_extra");
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
  await ensurePrescUidReady();
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

    const docRef = await getUserSubcollectionRefPresc("prescripcion_referencias_extra").add({
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
  await ensurePrescUidReady();
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
    await getUserSubcollectionRefPresc("prescripcion_referencias_extra").doc(id).update({
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
  await ensurePrescUidReady();
  if (!id) return;
  const ok = window.confirm("¿Seguro que quieres borrar esta referencia extra?");
  if (!ok) return;

  appState.prescripcion.extraRefs =
    (appState.prescripcion.extraRefs || []).filter((r) => r.id !== id);

  const db = getFirestorePresc();
  if (!db) return;

  try {
    await getUserSubcollectionRefPresc("prescripcion_referencias_extra").doc(id).delete();
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
        <button id="prescNewPlantillaBtn" class="btn btn-xs btn-secondary" title="Nueva plantilla">＋</button>
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
        <button id="prescNewPlantillaBtn" class="btn btn-xs btn-secondary" title="Nueva plantilla">＋</button>
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
      const val = e.target.value || "";
      const pos = typeof e.target.selectionStart === "number" ? e.target.selectionStart : val.length;

      appState.prescripcion.plantillasSearchTerm = val;

      // Re-render + restaurar foco/cursor (evita “solo 1 carácter”)
      Promise.resolve(renderPrescPlantillasList()).then(() => {
        requestAnimationFrame(() => {
          const again = document.getElementById("prescPlantillasSearch");
          if (!again) return;
          again.focus();
          try { again.setSelectionRange(pos, pos); } catch (_) {}
        });
      });
    });
  }


  // Botón nueva plantilla (icono)
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
        <button id="prescNewExtraRefBtn" class="btn btn-xs btn-secondary" title="Nueva referencia extra">➕</button>
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
        <button id="prescNewExtraRefBtn" class="btn btn-xs btn-secondary" title="Nueva referencia extra">➕</button>
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
      const val = e.target.value || "";
      const pos = typeof e.target.selectionStart === "number" ? e.target.selectionStart : val.length;

      appState.prescripcion.extraRefsSearchTerm = val;

      // Re-render + restaurar foco/cursor
      Promise.resolve(renderPrescExtraRefsList()).then(() => {
        requestAnimationFrame(() => {
          const again = document.getElementById("prescExtraRefsSearch");
          if (!again) return;
          again.focus();
          try { again.setSelectionRange(pos, pos); } catch (_) {}
        });
      });
    });
  }


  // Botón nueva ref extra (icono)
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
    container.innerHTML = `<div style="color:#6b7280; font-size:0.9rem;">No hay capítulos todavía.</div>`;
    return;
  }

  // Cards grandes, como antes: título + resumen + acciones + desplegable
  let totalGlobal = 0;

  const cards = caps.map((cap, idx) => {
    const subtotal = (cap.lineas || []).reduce((acc, l) => acc + safeNumber(l.importe), 0);
    totalGlobal += subtotal;

    const isSelected = appState.prescripcion.selectedCapituloId === cap.id;

    const linesCount = (cap.lineas || []).length;
    const previewText = String(cap.texto || "").trim();
    const previewLines = previewText ? previewText.split("\n").slice(0, 3).join("<br/>") : "";

    return `
      <div class="presc-preview-card"
           style="border:1px solid #e5e7eb; border-radius:14px; overflow:hidden; background:#fff;">
        <div class="presc-preview-head"
             data-id="${escapeHtmlAttr(cap.id)}"
             style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; padding:0.85rem 0.95rem; cursor:pointer;
                    ${isSelected ? "outline:2px solid #93c5fd;" : ""}">
          <div style="min-width:0;">
            <div style="font-weight:900; font-size:1.05rem; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${escapeHtml(cap.nombre || "Capítulo")}
            </div>
            <div style="font-size:0.82rem; color:#6b7280; margin-top:0.15rem;">
              ${linesCount} líneas · Total ${subtotal.toFixed(2)} €
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:0.35rem;">
            <button class="btn btn-xs btn-secondary presc-preview-open" data-id="${escapeHtmlAttr(cap.id)}" title="Ver detalle">▾</button>
            <button class="btn btn-xs btn-secondary presc-preview-del" data-id="${escapeHtmlAttr(cap.id)}" title="Eliminar">🗑️</button>
          </div>
        </div>

        <div class="presc-preview-body" id="prescPreviewBody_${escapeHtmlAttr(cap.id)}" style="display:none; border-top:1px solid #e5e7eb; padding:0.85rem 0.95rem; background:#fafafa;">
          ${previewText ? `<div style="font-size:0.85rem; color:#374151; margin-bottom:0.75rem;">${previewLines}${previewText.split("\n").length > 3 ? `<div style="color:#6b7280; margin-top:0.25rem;">...</div>` : ""}</div>` : ""}

          ${
            linesCount
              ? `
                <div style="overflow:auto;">
                  <table class="table" style="min-width:720px;">
                    <thead>
                      <tr>
                        <th style="width:120px;">CÓDIGO</th>
                        <th>DESCRIPCIÓN</th>
                        <th style="width:70px;">UD</th>
                        <th style="width:90px; text-align:right;">CANT.</th>
                        <th style="width:110px; text-align:right;">PVP (€)</th>
                        <th style="width:130px; text-align:right;">IMPORTE (€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(cap.lineas || [])
                        .map((l) => {
                          const qty = safeNumber(l.cantidad);
                          const pvp = safeNumber(l.pvp);
                          const imp = safeNumber(l.importe != null ? l.importe : qty * pvp);
                          return `
                            <tr>
                              <td style="font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">${escapeHtml(l.codigo || "")}</td>
                              <td>${escapeHtml(l.descripcion || "")}</td>
                              <td>${escapeHtml(l.unidad || "ud")}</td>
                              <td style="text-align:right;">${qty}</td>
                              <td style="text-align:right;">${pvp.toFixed(2)} €</td>
                              <td style="text-align:right;">${imp.toFixed(2)} €</td>
                            </tr>
                          `;
                        })
                        .join("")}
                    </tbody>
                  </table>
                </div>
              `
              : `<div style="font-size:0.85rem; color:#6b7280;">Sin líneas.</div>`
          }
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.85rem;">
      ${cards.join("")}
      <div style="display:flex; justify-content:flex-end; font-weight:900; font-size:1.05rem; padding-top:0.25rem;">
        Total: ${totalGlobal.toFixed(2)} €
      </div>
    </div>
  `;

  // Selección por click en cabecera
  container.querySelectorAll(".presc-preview-head").forEach((row) => {
    row.addEventListener("click", (e) => {
      const id = row.dataset.id;
      if (!id) return;
      appState.prescripcion.selectedCapituloId = id;
      renderPrescCapituloSelected();
      renderPrescPreview();
    });
  });

  // Toggle detalle
  container.querySelectorAll(".presc-preview-open").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const body = document.getElementById("prescPreviewBody_" + id);
      if (!body) return;
      body.style.display = body.style.display === "none" ? "block" : "none";
    });
  });

  // Delete
  container.querySelectorAll(".presc-preview-del").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!id) return;
      if (!confirm("¿Eliminar este capítulo?")) return;
      appState.prescripcion.capitulos = (appState.prescripcion.capitulos || []).filter((c) => c.id !== id);
      if (appState.prescripcion.selectedCapituloId === id) {
        appState.prescripcion.selectedCapituloId = appState.prescripcion.capitulos.length
          ? appState.prescripcion.capitulos[0].id
          : null;
      }
      renderPrescCapituloSelected();
      renderPrescPreview();
    });
  });
}

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
    grandTotal: "Total prescripción",
    project: "Proyecto",
    date: "Fecha",
    generated: "Generado desde Presupuestos 2N",
    sheet: "Prescripción",
    language: "Idioma",
  
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
    grandTotal: "Specification total",
    project: "Project",
    date: "Date",
    generated: "Generated from Presupuestos 2N",
    sheet: "Specification",
    language: "Language",
  
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
    grandTotal: "Total da especificação",
    project: "Projeto",
    date: "Data",
    generated: "Gerado a partir do Presupuestos 2N",
    sheet: "Especificação",
    language: "Idioma",
  }
};


// ========================================================
// Gemini / IA (traducción) - implementación por defecto
// Reutiliza el mismo patrón que Documentación (Cloud Run)
// ========================================================

function prescSanitizeAIText(t) {
  return String(t || "")
    .replace(/\r/g, "")
    // quitar markdown común
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*#+\s+/gm, "")
    .trim();
}

// Si existe handleDocSectionAI (de Documentación) lo usamos.
// Si no existe, creamos una implementación por defecto con el mismo endpoint.
if (typeof window.handleDocSectionAI !== "function") {
  window.handleDocSectionAI = async ({ sectionKey, idioma, titulo, texto, proyecto, presupuesto, modo }) => {
    const payload = { sectionKey, idioma, titulo, texto, proyecto, presupuesto, modo };
    const url = "https://docsectionai-is2pkrfj5a-uc.a.run.app";
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const extra = await resp.text().catch(() => "");
      throw new Error("IA error " + resp.status + ": " + extra);
    }
    const data = await resp.json().catch(() => null);
    if (!data || typeof data.text !== "string") {
      throw new Error("Respuesta IA inválida: falta 'text'");
    }
    return prescSanitizeAIText(data.text);
  };
}

// Traducción de texto simple usando la misma Cloud Function.
if (typeof window.geminiTranslateText !== "function") {
  window.geminiTranslateText = async (text, targetLang) => {
    const src = String(text || "");
    const lang = targetLang || "es";
    if (!src.trim()) return src;
    // Reutilizamos el generador de Documentación, pero forzando modo translate.
    const out = await window.handleDocSectionAI({
      sectionKey: "translate",
      idioma: lang,
      titulo: "Traduce el texto",
      texto: src,
      proyecto: null,
      presupuesto: null,
      modo: "translate",
    });
    return String(out || src);
  };
}

// Traducción batch (concurrencia limitada + caché simple)
if (typeof window.geminiTranslateBatch !== "function") {
  window.geminiTranslateBatch = async (texts, targetLang) => {
    const arr = Array.isArray(texts) ? texts : [];
    const lang = targetLang || "es";
    const cache = {};
    const out = new Array(arr.length);

    const tasks = arr.map((t, i) => async () => {
      const src = String(t || "");
      const key = lang + "|" + src;
      if (!src.trim()) {
        out[i] = src;
        return;
      }
      if (cache[key]) {
        out[i] = cache[key];
        return;
      }
      const tr = await window.geminiTranslateText(src, lang).catch(() => src);
      cache[key] = String(tr || src);
      out[i] = cache[key];
    });

    // Concurrencia 3 para no saturar
    const limit = 3;
    let cursor = 0;
    async function worker() {
      while (cursor < tasks.length) {
        const my = cursor++;
        await tasks[my]();
      }
    }
    const workers = [];
    for (let w = 0; w < Math.min(limit, tasks.length); w++) workers.push(worker());
    await Promise.all(workers);
    return out;
  };
}

async function buildPrescExportModel(lang) {
  ensurePrescCapitulosArray();
  const language = lang || appState.prescripcion.exportLang || "es";

  const result = {
    language,
    capitulos: [],
    totalGlobal: 0
  };

  (appState.prescripcion.capitulos || []).forEach((cap) => {
    if (!cap) return;

    const capData = {
      nombre: cap.nombre || "",
      texto: cap.texto || "",
      lineas: [],
      subtotal: 0
    };

    (cap.lineas || []).forEach((l) => {
      const qty = safeNumber(l.cantidad);
      const pvp = safeNumber(l.pvp);
      const imp = safeNumber(l.importe != null ? l.importe : qty * pvp);

      capData.lineas.push({
        codigo: l.codigo || "",
        descripcion: l.descripcion || "",
        unidad: l.unidad || "ud",
        cantidad: qty,
        pvp,
        importe: imp
      });

      capData.subtotal += imp;
    });

    result.totalGlobal += capData.subtotal;
    result.capitulos.push(capData);
  });

  // Traducción completa del contenido (capítulos + texto plantilla + descripciones)
  // Requiere que exista una función de traducción Gemini en window:
  // - window.geminiTranslateText(text, targetLang) => Promise<string>
  // Opcional:
  // - window.geminiTranslateBatch(textArray, targetLang) => Promise<string[]>
  if (language !== "es") {
    result.capitulos = await prescTranslateDocumentWithGemini(result.capitulos, language);
  }

  return result;
}

async function prescTranslateDocumentWithGemini(capitulos, targetLang) {
  const hasBatch = typeof window.geminiTranslateBatch === "function";
  const hasSingle = typeof window.geminiTranslateText === "function";

  if (!hasBatch && !hasSingle) {
    alert(
      "No hay traductor Gemini configurado (window.geminiTranslateText / window.geminiTranslateBatch).\n" +
      "Se exportará manteniendo los textos originales."
    );
    return capitulos;
  }

  // Cache en memoria (por sesión) para no repetir traducciones
  window.__prescTrCache = window.__prescTrCache || {};
  const cache = window.__prescTrCache;
  const keyFor = (t) => `${targetLang}::${t}`;

  // Recoger textos únicos a traducir
  const toTranslate = [];
  const pushTxt = (t) => {
    const s = String(t || "").trim();
    if (!s) return;
    const k = keyFor(s);
    if (cache[k]) return;
    if (!toTranslate.includes(s)) toTranslate.push(s);
  };

  capitulos.forEach((cap) => {
    pushTxt(cap.nombre);
    pushTxt(cap.texto);
    (cap.lineas || []).forEach((l) => pushTxt(l.descripcion));
  });

  // Ejecutar traducción
  if (toTranslate.length) {
    if (hasBatch) {
      try {
        const translated = await window.geminiTranslateBatch(toTranslate, targetLang);
        if (Array.isArray(translated) && translated.length === toTranslate.length) {
          toTranslate.forEach((src, i) => {
            cache[keyFor(src)] = String(translated[i] || src);
          });
        }
      } catch (e) {
        console.warn("[Presc] Error geminiTranslateBatch", e);
      }
    }

    // Fallback a single si batch no existe o falló parcialmente
    if (hasSingle) {
      for (const src of toTranslate) {
        const k = keyFor(src);
        if (cache[k]) continue;
        try {
          const tr = await window.geminiTranslateText(src, targetLang);
          cache[k] = String(tr || src);
        } catch (e) {
          console.warn("[Presc] Error geminiTranslateText", e);
          cache[k] = src;
        }
      }
    }
  }

  // Aplicar traducciones
  return capitulos.map((cap) => {
    const nombre = cache[keyFor(String(cap.nombre || "").trim())] || cap.nombre;
    const texto = cache[keyFor(String(cap.texto || "").trim())] || cap.texto;

    const lineas = (cap.lineas || []).map((l) => {
      const descKey = keyFor(String(l.descripcion || "").trim());
      const descripcion = cache[descKey] || l.descripcion;
      return { ...l, descripcion };
    });

    return { ...cap, nombre, texto, lineas };
  });
}

async function handlePrescExport(format) {
  const lang = appState.prescripcion.exportLang || "es";
  const model = await buildPrescExportModel(lang);

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
  downloadBc3File(bc3, `prescripcion_${lang}.bc3`);
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

    // Subtotal de capítulo
    lines.push([
      (cap.nombre || "").replace(/;/g, ","),
      "",
      labels.total,
      "",
      "",
      "",
      (cap.subtotal || 0).toFixed(2)
    ].join(sep));
  });

  // Total global
  lines.push("");
  lines.push([
    "",
    "",
    labels.grandTotal || labels.total,
    "",
    "",
    "",
    (model.totalGlobal || 0).toFixed(2)
  ].join(sep));

  return lines.join("\n");
}

function prescExportToBC3(model, lang) {
  const labels = PRESC_EXPORT_LABELS[lang] || PRESC_EXPORT_LABELS.es;

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const dateStr = `${dd}${mm}${yy}`; // ddmmyy (como tu BC3 manual)

  const lines = [];

  // ==============================
  // HELPERS
  // ==============================
  const sanitize = (s) => {
    s = String(s ?? "");
    // quitar diacríticos (más compatible con ANSI/Presto)
    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (_) {}
    // BC3 separa por |
    s = s.replace(/\|/g, " ");
    return s;
  };

  const sanitizeOneLine = (s) => sanitize(s).replace(/\r?\n/g, " ").trim();

  const fmtNum = (n) => {
    const x = Number(n);
    if (!isFinite(x)) return "0";
    // punto decimal (no coma)
    return String(Math.round(x * 1000000) / 1000000);
  };

  // Presto suele ir fino con códigos <= 8 (en tu manual hay muchos de 7-8)
  // y sin caracteres raros. Si hay colisión, forzamos uniqueness.
  const usedCodes = new Set();
  const makeCode8 = (raw, fallbackPrefix) => {
    let base = sanitizeOneLine(raw || "").replace(/\s+/g, "");
    // deja solo A-Z 0-9 y algunos separadores comunes; luego quitamos separadores
    base = base.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!base) base = fallbackPrefix || "REF";

    // intenta quedarte con los ÚLTIMOS 8 (suele conservar mejor el “identificador” numérico)
    let code = base.length > 8 ? base.slice(-8) : base;

    // si sigue vacío
    if (!code) code = (fallbackPrefix || "REF").slice(0, 3) + "00000";

    // asegurar único (si colisiona, variamos últimos 2-3 dígitos)
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }

    // fallback incremental manteniendo 8 chars
    const prefix = code.slice(0, Math.max(0, 6)); // deja hueco para 2 dígitos
    for (let i = 1; i < 100; i++) {
      const suffix = String(i).padStart(8 - prefix.length, "0").slice(-(8 - prefix.length));
      const c2 = (prefix + suffix).slice(-8);
      if (!usedCodes.has(c2)) {
        usedCodes.add(c2);
        return c2;
      }
    }

    // último recurso: timestamp
    const ts = String(Date.now()).slice(-8);
    if (!usedCodes.has(ts)) usedCodes.add(ts);
    return ts;
  };

  // ==============================
  // ESTRUCTURA “COMO TU MANUAL”
  // ==============================
  // Root / grupo principal
  const rootCode = "PRESC2N##";     // ## raíz
  const mainGroup = "PRESC2N#";     // # grupo principal

  // Cabecera EXACTA estilo Presto 8.8 (como tu bc3 manual)
  lines.push("~V|SOFT S.A.|FIEBDC-3/2002|Presto 8.8||ANSI|");
  // el bloque de 2\2... lo dejamos como en tu ejemplo manual
  lines.push(`~K|${rootCode}|${sanitizeOneLine(labels.project)}|${dateStr}|2\\2\\2\\2\\2\\2\\2\\2\\2\\2|`);

  // ==============================
  // CONCEPTOS (~C)
  // Formato que se ve en tu manual:
  // ~C|COD|UD|RESUMEN|PRECIO|FECHA||TIPO|
  // ==============================
  const caps = (model && Array.isArray(model.capitulos)) ? model.capitulos : [];
  if (!caps.length) return lines.join("\r\n");

  // Totales por capítulo (para que Presto “pinte” bien)
  const capTotals = caps.map((cap) => {
    let t = 0;
    (cap.lineas || []).forEach((l) => {
      const qty = Number(l.cantidad) || 0;
      const price = Number(l.pvp) || 0;
      t += qty * price;
    });
    return t;
  });

  const totalGlobal = capTotals.reduce((a, b) => a + (Number(b) || 0), 0);

  // Root y grupo
  lines.push(`~C|${rootCode}||${sanitizeOneLine(labels.title)}|${fmtNum(totalGlobal)}|${dateStr}||0|`);
  lines.push(`~C|${mainGroup}||${sanitizeOneLine(labels.title)}|${fmtNum(totalGlobal)}|${dateStr}||0|`);

  // ==============================
  // DESCOMPOSICIÓN (~D)
  // ==============================
  const dLines = [];

  // Root -> grupo principal
  dLines.push(`~D|${rootCode}|${mainGroup}\\1\\1\\|`);

  // Para cada capítulo creamos un código tipo 2N.0001 (como tu manual usa 2N.0111, etc.)
  // Importante: el capítulo NO acaba en # (en tu manual, el # es para el grupo).
  const chapCodes = [];

  caps.forEach((cap, idx) => {
    const chapIdx = String(idx + 1).padStart(4, "0"); // 0001..9999
    const chapCode = `2N.${chapIdx}`;                // estilo “manual”
    chapCodes.push(chapCode);

    const chapName = sanitizeOneLine(cap.nombre || `${labels.chapter} ${idx + 1}`);
    const chapTotal = Number(capTotals[idx]) || 0;

    // Capítulo como concepto tipo 0 y Ud (como en tu manual)
    lines.push(`~C|${chapCode}|Ud|${chapName}|${fmtNum(chapTotal)}|${dateStr}||0|`);

    // Textos largos del capítulo con ~T (como tu manual)
    // OJO: Permitimos saltos de línea reales: Presto los traga bien en ~T
    const rawText = (cap.texto || "").toString();
    const textClean = sanitize(rawText).trim();
    if (textClean) {
      lines.push(`~T|${chapCode}|${textClean}`);
    }

    // Grupo principal -> capítulos
    // (lo completamos luego en una sola línea, como el manual)
  });

  // Grupo principal -> todos los capítulos en una sola ~D (como tu manual)
  if (chapCodes.length) {
    const packed = chapCodes.map((c) => `${c}\\1\\1\\`).join("");
    dLines.push(`~D|${mainGroup}|${packed}|`);
  }

  // Capítulo -> sus referencias (también como tu manual: refs sin medición propia)
  // Las refs van como tipo 3
  const mLines = []; // mediciones (ponemos 1 por capítulo, como tu manual)

  caps.forEach((cap, idx) => {
    const chapCode = chapCodes[idx];
    const lineas = cap.lineas || [];

    // Medición del capítulo: 1 ud (igual que tu ejemplo manual)
    // Formato de tu manual: ~M|GRUPO#\CAP|1\2\|1.000||
    mLines.push(`~M|${mainGroup}\\${chapCode}|1\\2\\|1.000||`);

    if (!lineas.length) return;

    const refCodes = [];
    lineas.forEach((l, i) => {
      // Código ref <= 8 y único (CLAVE para que no “pise” y te quede solo la última)
      const raw = l.codigo || "";
      const refCode = makeCode8(raw, "REF" + String(i + 1).padStart(2, "0"));

      const desc = sanitizeOneLine(l.descripcion || refCode);
      const unit = sanitizeOneLine(l.unidad || "Ud") || "Ud";
      const price = Number(l.pvp) || 0;

      // Concepto de partida (tipo 3)
      lines.push(`~C|${refCode}|${unit}|${desc}|${fmtNum(price)}|${dateStr}||3|`);

      refCodes.push(refCode);
    });

    // Descomposición capítulo -> refs (en una ~D como tu manual)
    if (refCodes.length) {
      const packedRefs = refCodes.map((c) => `${c}\\1\\1\\`).join("");
      dLines.push(`~D|${chapCode}|${packedRefs}|`);
    }
  });

  // Añadimos D y M al final
  lines.push(...dLines);
  lines.push(...mLines);

  // CRLF para Windows/Presto
  return lines.join("\r\n");
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

  const totalGlobal =
    typeof model.totalGlobal === "number"
      ? model.totalGlobal
      : (model.capitulos || []).reduce((acc, cap) => {
          const sub = (cap.lineas || []).reduce(
            (s, l) => s + (l.importe != null ? l.importe : (l.cantidad || 0) * (l.pvp || 0)),
            0
          );
          return acc + sub;
        }, 0);

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
              <th style="text-align:right;">${labels.price} (€)</th>
              <th style="text-align:right;">${labels.amount} (€)</th>
            </tr>
          </thead>
          <tbody>
      `;

      let subtotal = 0;

      cap.lineas.forEach((l) => {
        const importe =
          l.importe != null ? l.importe : (l.cantidad || 0) * (l.pvp || 0);
        subtotal += importe;

        html += `
          <tr>
            <td>${l.codigo || ""}</td>
            <td>${l.descripcion || ""}</td>
            <td>${l.unidad || ""}</td>
            <td style="text-align:right;">${(l.cantidad || 0)}</td>
            <td style="text-align:right;">${prescFormatCurrencyHTML((l.pvp || 0), lang)}</td>
            <td style="text-align:right;">${prescFormatCurrencyHTML(importe, lang)}</td>
          </tr>
        `;
      });

      html += `
          <tr>
            <td colspan="5" style="text-align:right; font-weight:600;">${labels.total}</td>
            <td style="text-align:right; font-weight:600;">${prescFormatCurrencyHTML(subtotal, lang)}</td>
          </tr>
          </tbody>
        </table>
      `;
    }
  });

  html += `
        <p style="text-align:right; font-weight:600; margin-top:12px;">
          ${labels.grandTotal}: ${prescFormatCurrencyHTML(totalGlobal, lang)}
        </p>
        <p class="small">
          ${labels.generated} · ${labels.language}: ${lang.toUpperCase()}
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
function downloadTextFileWin1252(content, filename) {
  // Encoder Win-1252 básico (suficiente para ES/PT + €)
  const map = {
    "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87,
    "ˆ": 0x88, "‰": 0x89, "Š": 0x8A, "‹": 0x8B, "Œ": 0x8C, "Ž": 0x8E,
    "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
    "˜": 0x98, "™": 0x99, "š": 0x9A, "›": 0x9B, "œ": 0x9C, "ž": 0x9E, "Ÿ": 0x9F
  };

  const bytes = [];
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const code = content.charCodeAt(i);

    if (map[ch] != null) {
      bytes.push(map[ch]);
    } else if (code <= 0xFF) {
      bytes.push(code);
    } else {
      // fuera de win1252 → reemplazo
      bytes.push(0x3F); // '?'
    }
  }

  const blob = new Blob([new Uint8Array(bytes)], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.bc3";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function formatBc3Date(d) {
  // ddmmyy (como en tu BC3 manual)
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

// Descarga “ANSI/latin1 safe” (Presto 8.8 suele llevarse peor con UTF-8)
function downloadBc3File(content, filename) {
  const s = (content || "").toString();

  // Forzamos bytes 0..255 (latin1). Como ya “safeText” deja ASCII, esto queda estable.
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    bytes[i] = s.charCodeAt(i) & 0xff;
  }

  const blob = new Blob([bytes], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.bc3";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}// ========================================================
// Auth helper: asegurar UID antes de tocar Firestore (evita "solo local")
// ========================================================

function ensurePrescUidReady(timeoutMs = 15000) {
  return new Promise((resolve) => {
    const uidNow = getCurrentUidPresc();
    if (uidNow) return resolve(uidNow);

    const auth = getAuthPresc();
    if (!auth || typeof auth.onAuthStateChanged !== "function") return resolve(null);

    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(getCurrentUidPresc());
    }, Math.max(0, Number(timeoutMs) || 0));

    try {
      auth.onAuthStateChanged((user) => {
        if (done) return;
        if (user && user.uid) {
          done = true;
          clearTimeout(timer);
          resolve(user.uid);
        }
      });
    } catch (_) {
      clearTimeout(timer);
      resolve(getCurrentUidPresc());
    }
  });
}



// ========================================================
// Exportación XLSX (Excel real) + PDF en idioma + moneda EUR
// ========================================================

function prescLangToLocale(lang) {
  if (lang === "en") return "en-GB";
  if (lang === "pt") return "pt-PT";
  return "es-ES";
}

function prescFormatCurrency(value, lang, opts = {}) {
  // Devuelve siempre con símbolo de euro.
  // opts.html=true -> usa &nbsp;€ para evitar salto de línea en PDF/print
  const locale = prescLangToLocale(lang);
  const v = Number(value);
  const n = Number.isFinite(v) ? v : 0;

  let num;
  try {
    num = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch (e) {
    num = n.toFixed(2);
  }

  const euro = opts.html ? "&nbsp;€" : " €";
  return String(num) + euro;
}

function prescFormatCurrencyHTML(value, lang) {
  // Evita salto de línea entre número y € en HTML/PDF
  return prescFormatCurrency(value, lang, { html: true }).replace(/\s€$/, "&nbsp;€");
}


async function prescLoadScriptOnce(url, id) {
  if (id && document.getElementById(id)) return;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    if (id) s.id = id;
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar: " + url));
    document.head.appendChild(s);
  });
}

async function ensureExcelDepsLoaded() {
  // ExcelJS + FileSaver (si ya están en la app, no hace nada)
  if (window.ExcelJS && window.saveAs) return true;

  // Carga dinámica (mínimo impacto)
  try {
    if (!window.ExcelJS) {
      await prescLoadScriptOnce(
        "https://cdn.jsdelivr.net/npm/exceljs/dist/exceljs.min.js",
        "exceljs_cdn"
      );
    }
    if (!window.saveAs) {
      await prescLoadScriptOnce(
        "https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js",
        "filesaver_cdn"
      );
    }
  } catch (e) {
    console.warn("[Presc] No se pudieron cargar dependencias XLSX", e);
  }

  return !!(window.ExcelJS && window.saveAs);
}


function getPrescProjectDescription() {
  // Intenta resolver una descripción del proyecto (si existe en tu appState)
  const p = appState.proyecto || {};
  const pr = appState.presupuesto || {};
  return (
    p.descripcion ||
    p.description ||
    pr.descripcionProyecto ||
    pr.descripcion ||
    pr.projectDescription ||
    ""
  );
}

async function exportPrescripcionToExcel(model, lang) {
  const language = lang || model?.language || appState.prescripcion.exportLang || "es";
  const labels = PRESC_EXPORT_LABELS[language] || PRESC_EXPORT_LABELS.es;

  if (!model || !model.capitulos || !model.capitulos.length) {
    alert("No hay capítulos para exportar.");
    return;
  }

  const ok = await ensureExcelDepsLoaded();
  if (!ok) {
    alert("No se pudo exportar a Excel (XLSX). Falta ExcelJS/FileSaver.");
    return;
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet((labels.sheet || "Prescripción").slice(0, 31));

  // Columnas
  ws.columns = [
    { key: "chapter", width: 22 },
    { key: "code", width: 14 },
    { key: "desc", width: 55 },
    { key: "unit", width: 10 },
    { key: "qty", width: 10 },
    { key: "pvp", width: 14 },
    { key: "amount", width: 16 },
  ];

  const borderThin = {
    top: { style: "thin", color: { argb: "FFCCCCCC" } },
    left: { style: "thin", color: { argb: "FFCCCCCC" } },
    bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
    right: { style: "thin", color: { argb: "FFCCCCCC" } },
  };

  const fmtCurrency = '#,##0.00" €"';
  const fmtQty = "#,##0";

  const projectName =
    (typeof window.getNombreProyectoActual === "function" && window.getNombreProyectoActual()) ||
    (appState.proyecto && appState.proyecto.nombre) ||
    "Proyecto";

  const today = new Date().toISOString().split("T")[0];

  // Título
  const titleRow = ws.addRow([labels.title || "Prescripción"]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, 7);
  titleRow.font = { name: "Aptos Narrow", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1BB1C7" } };

  
  // Descripción debajo del título (si existe)
  const projectDesc = String(getPrescProjectDescription() || "").trim();
  if (projectDesc) {
    const descRowTop = ws.addRow([projectDesc]);
    ws.mergeCells(descRowTop.number, 1, descRowTop.number, 7);
    descRowTop.getCell(1).font = { name: "Aptos Narrow", size: 10, italic: true, color: { argb: "FF374151" } };
    descRowTop.getCell(1).alignment = { horizontal: "center", vertical: "top", wrapText: true };
    const approxCharsPerLineTop = 110;
    const linesTop = Math.max(1, Math.ceil(projectDesc.length / approxCharsPerLineTop));
    descRowTop.height = Math.min(300, 15 * linesTop + 6);
  }

ws.addRow([]);

  const info1 = ws.addRow([labels.project || "Proyecto", projectName]);
  ws.mergeCells(info1.number, 2, info1.number, 7);
  info1.getCell(1).font = { name: "Aptos Narrow", size: 11, bold: true };
  info1.getCell(2).font = { name: "Aptos Narrow", size: 10 };

  const info2 = ws.addRow([labels.date || "Fecha", today]);
  ws.mergeCells(info2.number, 2, info2.number, 7);
  info2.getCell(1).font = { name: "Aptos Narrow", size: 11, bold: true };
  info2.getCell(2).font = { name: "Aptos Narrow", size: 10 };

  ws.addRow([]);

  // Header tabla
  const headerRow = ws.addRow([
    labels.chapter,
    labels.code,
    labels.description,
    labels.unit,
    labels.qty,
    labels.price + " (€)",
    labels.amount + " (€)",
  ]);

  headerRow.eachCell((cell) => {
    cell.font = { name: "Aptos Narrow", size: 11, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5F3F7" } };
    cell.border = borderThin;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  // Capítulos + descripción debajo (requisito)
  (model.capitulos || []).forEach((cap) => {
    ws.addRow([]);

    const capRow = ws.addRow([String(cap.nombre || "").toUpperCase()]);
    ws.mergeCells(capRow.number, 1, capRow.number, 7);
    capRow.getCell(1).font = { name: "Aptos Narrow", size: 11, bold: true, color: { argb: "FF374151" } };
    capRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    capRow.getCell(1).border = borderThin;

    const capDesc = String(cap.texto || "").trim();
    if (capDesc) {
      const descRow = ws.addRow([capDesc]);
      ws.mergeCells(descRow.number, 1, descRow.number, 7);
      descRow.getCell(1).font = { name: "Aptos Narrow", size: 10, italic: true, color: { argb: "FF4B5563" } };
      descRow.getCell(1).alignment = { wrapText: true, vertical: "top" };
      descRow.getCell(1).border = borderThin;
      // Auto-ajustar altura aproximada según texto (ExcelJS no tiene autofit real)
      const approxCharsPerLine = 110; // según ancho combinado
      const lines = Math.max(1, Math.ceil(capDesc.length / approxCharsPerLine));
      descRow.height = Math.min(300, 15 * lines + 6);

    }

    (cap.lineas || []).forEach((l) => {
      const qty = Number(l.cantidad) || 0;
      const pvp = Number(l.pvp) || 0;
      const imp = Number(l.importe) || qty * pvp;

      const r = ws.addRow([cap.nombre || "", l.codigo || "", l.descripcion || "", l.unidad || "ud", qty, pvp, imp]);

      r.eachCell((cell, col) => {
        cell.border = borderThin;
        cell.font = { name: "Aptos Narrow", size: 10 };
        if (col === 5) {
          cell.numFmt = fmtQty;
          cell.alignment = { horizontal: "right", vertical: "top" };
        } else if (col === 6 || col === 7) {
          cell.numFmt = fmtCurrency;
          cell.alignment = { horizontal: "right", vertical: "top" };
        } else if (col === 3) {
          cell.alignment = { wrapText: true, vertical: "top" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "top" };
        }
      });
    });

    const subRow = ws.addRow([labels.total, "", "", "", "", "", Number(cap.subtotal) || 0]);
    subRow.getCell(1).font = { name: "Aptos Narrow", size: 11, bold: true };
    subRow.getCell(7).font = { name: "Aptos Narrow", size: 11, bold: true };
    subRow.eachCell((cell, col) => {
      cell.border = borderThin;
      if (col === 7) {
        cell.numFmt = fmtCurrency;
        cell.alignment = { horizontal: "right", vertical: "middle" };
      }
    });
  });

  ws.addRow([]);

  const totalRow = ws.addRow([labels.grandTotal, "", "", "", "", "", Number(model.totalGlobal) || 0]);
  totalRow.getCell(1).font = { name: "Aptos Narrow", size: 12, bold: true };
  totalRow.getCell(7).font = { name: "Aptos Narrow", size: 12, bold: true };
  totalRow.eachCell((cell, col) => {
    cell.border = borderThin;
    if (col === 7) {
      cell.numFmt = fmtCurrency;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    }
  });

  const safeProject = String(projectName || "Proyecto").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const fileName = `Prescripcion_${safeProject}_${today.replace(/-/g, "")}_${language}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, fileName);
}

function exportPrescripcionToPdf(model, lang) {
  // Usa la ventana de impresión existente, pero garantiza idioma y formato moneda
  const language = lang || model?.language || appState.prescripcion.exportLang || "es";
  openPrescPrintWindow(model, language);
}

function exportPrescripcionToBc3(model, lang) {
  const language = lang || model?.language || appState.prescripcion.exportLang || "es";
  const bc3 = prescExportToBC3(model, language);
  downloadBc3File(bc3, `prescripcion_${language}.bc3`);
}

// Exponer a window para handlePrescExport
window.exportPrescripcionToExcel = exportPrescripcionToExcel;
window.exportPrescripcionToPdf = exportPrescripcionToPdf;
window.exportPrescripcionToBc3 = exportPrescripcionToBc3;
