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
  extraRefsLoaded: false
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
// --------------------------------------------------------
// Construye secciones agregadas a partir del presupuesto actual
// Cada sección será un "bloque Notion premium" arrastrable
// ========================================================

// Añadimos estructura para secciones si no existe
appState.prescripcion.sectionsFromBudget =
  appState.prescripcion.sectionsFromBudget || [];

/**
 * Convierte las líneas del presupuesto en secciones agregadas
 * Estructura de salida:
 * [
 *   {
 *     id: "sec-XXX",
 *     rawId: <id original de la sección>,
 *     nombre: "Videoportero principal",
 *     totalRefs: 3,
 *     totalImporte: 3525,
 *     refs: [
 *       { codigo, descripcion, unidad, cantidad, pvp, importe }
 *     ]
 *   },
 *   ...
 * ]
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

  // Pasamos a array y ordenamos por nombre de sección
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
 * Devuelve siempre el array de secciones actuales
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
// --------------------------------------------------------
// Crea la cabecera, layout 3 columnas y placeholders
// ========================================================

function renderDocPrescripcionView() {
  const container = getPrescripcionAppContent();
  if (!container) return;

  // Aseguramos secciones cargadas
  const sections = ensurePrescSectionsFromBudget();

  // Aseguramos plantillas / referencias extra (si luego se usan)
  appState.prescripcion.plantillas = appState.prescripcion.plantillas || [];
  appState.prescripcion.extraRefs = appState.prescripcion.extraRefs || [];

  // ======================================================
  // Estructura visual general
  // ======================================================
  container.innerHTML = `
    <div class="presc-root" style="display:flex; flex-direction:column; height:100%;">

      <!-- ========== CABECERA SUPERIOR ========== -->
      <div class="card" style="margin-bottom:1rem;">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="card-title">Prescripción técnica del proyecto</div>
            <div class="card-subtitle">
              Arrastra secciones del presupuesto para generar capítulos. Usa referencias extra o plantillas si lo necesitas.
            </div>
          </div>

          <div style="display:flex; gap:0.5rem;">
            <button id="prescAddManualCapBtn" class="btn btn-primary btn-sm">➕ Añadir capítulo</button>
          </div>
        </div>
      </div>

      <!-- ========== LAYOUT 3 COLUMNAS ========== -->
      <div class="presc-layout" 
           style="display:grid; grid-template-columns:1fr 1.4fr 1.2fr; gap:1rem; height:60vh; min-height:400px;">

        <!-- COLUMNA 1: Secciones del presupuesto (cards Notion premium draggable) -->
        <div class="card" style="display:flex; flex-direction:column; overflow:hidden;">
          <div class="card-header">
            <div class="card-title">Secciones del presupuesto</div>
            <div class="card-subtitle">Arrastra una sección para crear o actualizar un capítulo</div>
          </div>
          <div id="prescSectionsList" class="card-body" style="overflow:auto; padding:0.75rem;">
            <!-- Aquí se pintarán las Notion-cards en Bloque 4 -->
          </div>
        </div>

        <!-- COLUMNA 2: Capítulo seleccionado -->
        <div class="card" style="display:flex; flex-direction:column;">
          <div class="card-header">
            <div class="card-title">Capítulo seleccionado</div>
            <div class="card-subtitle">Nombre, texto descriptivo y referencias del capítulo</div>
          </div>

          <div id="prescCapituloContent" class="card-body" 
               style="flex:1; overflow:auto;">
            <!-- Aquí irá el contenido dinámico del capítulo (Bloque 5 y 6) -->
          </div>
        </div>

        <!-- COLUMNA 3: Plantillas + Referencias extra -->
        <div style="display:flex; flex-direction:column; gap:1rem;">
          
          <!-- Plantillas -->
          <div class="card" style="flex:1; overflow:hidden;">
            <div class="card-header">
              <div class="card-title">Plantillas</div>
              <div class="card-subtitle">Arrastra y suelta para rellenar texto técnico</div>
            </div>
            <div id="prescPlantillasList" class="card-body" style="overflow:auto;">
              <!-- Bloque 6 -->
            </div>
          </div>

          <!-- Referencias extra -->
          <div class="card" style="flex:1; overflow:hidden;">
            <div class="card-header">
              <div class="card-title">Referencias extra</div>
              <div class="card-subtitle">Switches, cable, mano de obra…</div>
            </div>
            <div id="prescExtraRefsList" class="card-body" style="overflow:auto;">
              <!-- Bloque 7 -->
            </div>
          </div>
        </div>
      </div>

      <!-- ========== PREVISUALIZACIÓN inferior ========== -->
      <div class="card" style="margin-top:1rem;">
        <div class="card-header">
          <div class="card-title">Previsualización de la prescripción</div>
          <div class="card-subtitle">Capítulos añadidos, totales y desglose desplegable</div>
        </div>

        <div id="prescPreview" class="card-body">
          <!-- Bloque 8 -->
        </div>
      </div>

    </div>
  `;

  // ----------------------------------------------------
  // Handlers iniciales
  // ----------------------------------------------------
  const btnAddCap = container.querySelector("#prescAddManualCapBtn");
  if (btnAddCap) {
    btnAddCap.addEventListener("click", () => {
      createManualCapitulo();
      renderDocPrescripcionView();
    });
  }

  // En los siguientes bloques (4-8) rellenaremos:
  // - Secciones Notion (drag)
  // - Capítulo seleccionado
  // - Plantillas
  // - Referencias extra
  // - Previsualización final
}
// ========================================================
// BLOQUE 4 - Render de SECCIONES Notion Premium (arrastrables)
// ========================================================

function renderPrescSectionsList() {
  const container = document.getElementById("prescSectionsList");
  if (!container) return;

  const sections = ensurePrescSectionsFromBudget();
  if (!sections.length) {
    container.innerHTML = `
      <p class="text-muted" style="padding:0.5rem;">
        No hay secciones en el presupuesto actual.
      </p>
    `;
    return;
  }

  container.innerHTML = sections
    .map((sec) => {
      // Previsualización de las primeras 3 referencias
      const preview = sec.refs
        .slice(0, 3)
        .map(
          (r) =>
            `${r.descripcion || ""} x${r.cantidad}`
        )
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

// ========================================================
// Estilos de las cards NOTION PREMIUM (B3)
// ========================================================

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

// ========================================================
// DRAG HANDLERS de las secciones del presupuesto
// ========================================================

function attachPrescSectionsDragHandlers() {
  document
    .querySelectorAll(".presc-section-card[draggable='true']")
    .forEach((el) => {
      el.addEventListener("dragstart", (ev) => {
        const secId = el.getAttribute("data-section-id");
        ev.dataTransfer.setData("text/presc-section-id", secId);

        // Efecto visual
        el.style.opacity = "0.6";
      });

      el.addEventListener("dragend", (ev) => {
        el.style.opacity = "1";
      });
    });
}
// ========================================================
// BLOQUE 5 - Lógica DROP: arrastrar sección → capítulo
// ========================================================

// Zona drop: el contenedor del capítulo
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

// ========================================================
// Paso 1: Resolver la sección droppeada
// ========================================================
function handleSectionDrop(secId) {
  const sections = ensurePrescSectionsFromBudget();
  const sec = sections.find((s) => s.id === secId);
  
  if (!sec) {
    console.warn("[PRESCRIPCIÓN] Sección no encontrada:", secId);
    return;
  }

  const capActual = getSelectedCapitulo();

  // 1) Si NO hay capítulo actual → crear uno automáticamente
  if (!capActual) {
    createChapterFromSection(sec);
    return;
  }

  // 2) Si hay capítulo → preguntar (Sobrescribir / Añadir)
  askOverwriteOrAppend(sec, capActual);
}

// ========================================================
// Crear capítulo automático desde sección
// ========================================================
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

// ========================================================
// Clonar referencias de la sección
// ========================================================
function cloneSectionRefs(sec) {
  return sec.refs.map((r) => ({
    id: "sec-ref-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    tipo: "budget",  // vienen del presupuesto
    codigo: r.codigo,
    descripcion: r.descripcion,
    unidad: r.unidad,
    cantidad: r.cantidad,
    pvp: r.pvp,
    importe: r.importe,
    extraRefId: null
  }));
}

// ========================================================
// Modal para SOBRESCRIBIR / AÑADIR
// ========================================================
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

// ========================================================
// Sobrescribir capítulo actual
// ========================================================
function overwriteChapterWithSection(cap, sec) {
  cap.nombre = sec.nombre;
  cap.texto = "";
  cap.lineas = cloneSectionRefs(sec);
}

// ========================================================
// Añadir referencias evitando duplicados exactos
// ========================================================
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

// ========================================================
// Llamamos a la dropzone cuando renderizamos
// ========================================================
(function setupDropZoneInterval() {
  // Intentamos conectar la dropzone cuando la página cambia
  const observer = new MutationObserver(() => {
    attachPrescDropZone();
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
