// js/ui_doc_prescripcion.js
// ========================================================
// PRESCRIPCIÓN 2N (versión premium Notion B3)
// --------------------------------------------------------
// PARTE 1
// Estado global, helpers, modal genérico, Firestore/Auth,
// helpers de presupuesto y generación de secciones
// ========================================================

window.appState = window.appState || {};

appState.prescripcion = appState.prescripcion || {
  capitulos: [],             // [{ id, nombre, texto, lineas: [...] }]
  selectedCapituloId: null,
  plantillas: [],            // [{ id, nombre, texto }]
  plantillasLoaded: false,
  extraRefs: [],             // [{ id, codigo, descripcion, unidad, pvp }]
  extraRefsLoaded: false,
  exportLang: "es",           // "es" | "en" | "pt"
  plantillasSearchTerm: "",
  extraRefsSearchTerm: "",
  sectionsFromBudget: []
};

// ========================================================
// Helpers generales
// ========================================================

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttr(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Render mínimo del capítulo seleccionado
function renderPrescCapituloSelected() {
  if (typeof renderPrescCapituloContent === "function") {
    renderPrescCapituloContent();
  }
}

// ========================================================
// MODAL GENÉRICO
// ========================================================

function openPrescModal({ title, bodyHTML, onSave }) {
  const modal = document.getElementById("prescModal");
  if (!modal) {
    console.warn("[PRESCRIPCIÓN] Modal no encontrado");
    return;
  }

  const titleEl = document.getElementById("prescModalTitle");
  const bodyEl = document.getElementById("prescModalBody");
  const btnSave = document.getElementById("prescModalSave");
  const btnClose = document.getElementById("prescModalClose");
  const btnCancel = document.getElementById("prescModalCancel");

  if (titleEl) titleEl.textContent = title || "";
  if (bodyEl) bodyEl.innerHTML = bodyHTML || "";

  modal.style.display = "flex";

  const close = () => {
    modal.style.display = "none";
    if (btnSave) btnSave.onclick = null;
    if (btnClose) btnClose.onclick = null;
    if (btnCancel) btnCancel.onclick = null;
  };

  if (btnClose) btnClose.onclick = close;
  if (btnCancel) btnCancel.onclick = close;

  if (btnSave) {
    btnSave.onclick = async () => {
      try {
        if (typeof onSave === "function") {
          await onSave();
        }
      } catch (e) {
        console.error("[PRESCRIPCIÓN] Error en modal:", e);
        alert("Error al guardar. Revisa la consola.");
      } finally {
        close();
      }
    };
  }
}

// ========================================================
// Helpers Firestore / Auth (compat v8 / compat)
// ========================================================

function getFirestorePresc() {
  try {
    if (typeof window.getFirestoreInstance === "function") {
      const db = window.getFirestoreInstance();
      if (db) return db;
    }
    if (window.db) return window.db;
    if (window.firebase?.firestore) return window.firebase.firestore();
  } catch (e) {
    console.warn("[PRESCRIPCIÓN] Firestore no disponible", e);
  }
  return null;
}

function getAuthPresc() {
  try {
    if (typeof window.getAuthInstance === "function") {
      const a = window.getAuthInstance();
      if (a) return a;
    }
    if (window.auth) return window.auth;
    if (window.firebase?.auth) return window.firebase.auth();
  } catch (_) {}
  return null;
}

// ========================================================
// UID actual (robusto)
// ========================================================

function getCurrentUidPresc() {
  const auth = getAuthPresc();
  if (auth?.currentUser?.uid) return auth.currentUser.uid;

  try {
    if (window.appState?.user?.uid) return window.appState.user.uid;
    if (window.appState?.auth?.uid) return window.appState.auth.uid;
  } catch (_) {}

  return null;
}

function getUserSubcollectionRefPresc(subName) {
  const db = getFirestorePresc();
  const uid = getCurrentUidPresc();
  if (!db || !uid || typeof db.collection !== "function") return null;
  return db.collection("users").doc(uid).collection(subName);
}

// ========================================================
// Contenedor principal
// ========================================================

function getPrescripcionAppContent() {
  if (typeof window.getDocAppContent === "function") return window.getDocAppContent();
  if (typeof window.getAppContent === "function") return window.getAppContent();
  return document.getElementById("appContent");
}

// ========================================================
// Presupuesto actual (safe)
// ========================================================

function getPresupuestoActualSafe() {
  if (typeof window.getPresupuestoActual === "function") {
    try {
      return window.getPresupuestoActual();
    } catch (e) {
      console.error("[PRESCRIPCIÓN] Error presupuesto:", e);
    }
  }
  return null;
}

// ========================================================
// Generación de secciones desde presupuesto
// ========================================================

function buildPrescSectionsFromPresupuesto() {
  const presu = getPresupuestoActualSafe();
  if (!presu) {
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
      const def = seccionesMap[secId] || {};
      bySection[secId] = {
        id: "sec-" + String(secId),
        rawId: secId,
        nombre:
          def.nombre ||
          def.name ||
          def.titulo ||
          def.title ||
          (secId === "SIN_SECCION" ? "Sin sección" : String(secId)),
        refs: [],
        totalRefs: 0,
        totalImporte: 0
      };
    }

    const cantidad = safeNumber(l.cantidad ?? l.qty ?? l.unidades ?? 1);
    const pvp = safeNumber(l.pvp ?? l.precio ?? l.price);
    const unidad = l.unidad ?? l.ud ?? l.unit ?? "Ud";
    const importe = cantidad * pvp;

    bySection[secId].refs.push({
      codigo: l.codigo ?? l.ref ?? l.sku ?? "",
      descripcion:
        l.descripcion ??
        l.desc ??
        l.concepto ??
        l.nombre ??
        l.title ??
        "",
      unidad,
      cantidad,
      pvp,
      importe
    });

    bySection[secId].totalRefs += 1;
    bySection[secId].totalImporte += importe;
  });

  const arr = Object.values(bySection).sort((a, b) =>
    String(a.nombre).localeCompare(String(b.nombre), "es")
  );

  appState.prescripcion.sectionsFromBudget = arr;
  return arr;
}

function ensurePrescSectionsFromBudget() {
  if (!Array.isArray(appState.prescripcion.sectionsFromBudget) ||
      !appState.prescripcion.sectionsFromBudget.length) {
    return buildPrescSectionsFromPresupuesto();
  }
  return appState.prescripcion.sectionsFromBudget;
}

// ========================================================
// FIN PARTE 1
// ========================================================
// ========================================================
// PARTE 2
// Render principal de Prescripción + layout base
// ========================================================

function renderDocPrescripcionView() {
  const container = getPrescripcionAppContent();
  if (!container) return;

  // Asegurar datos base
  ensurePrescSectionsFromBudget();
  appState.prescripcion.plantillas = appState.prescripcion.plantillas || [];
  appState.prescripcion.extraRefs = appState.prescripcion.extraRefs || [];

  const currentLang = appState.prescripcion.exportLang || "es";

  container.innerHTML = `
    <div class="presc-root"
         style="display:flex; flex-direction:column; height:100%; overflow:hidden;">

      <!-- CABECERA -->
      <div class="card" style="margin-bottom:0.75rem;">
        <div class="card-header"
             style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
          <div>
            <div class="card-title">Prescripción técnica del proyecto</div>
            <div class="card-subtitle">
              Genera capítulos desde el presupuesto y completa con plantillas y referencias extra.
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.4rem; align-items:flex-end;">
            <div style="display:flex; gap:0.4rem; align-items:center;">
              <span style="font-size:0.75rem; color:#6b7280;">Idioma</span>
              <select id="prescExportLang"
                      class="form-control form-control-sm"
                      style="min-width:130px; font-size:0.75rem;">
                <option value="es" ${currentLang === "es" ? "selected" : ""}>Castellano</option>
                <option value="en" ${currentLang === "en" ? "selected" : ""}>English</option>
                <option value="pt" ${currentLang === "pt" ? "selected" : ""}>Português</option>
              </select>
            </div>

            <div style="display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end;">
              <button id="prescReloadSectionsBtn" class="btn btn-outline btn-sm">🔄 Secciones</button>
              <button id="prescExportExcelBtn" class="btn btn-sm btn-outline">⬇️ Excel</button>
              <button id="prescExportPdfBtn" class="btn btn-sm btn-outline">⬇️ PDF</button>
              <button id="prescExportBc3Btn" class="btn btn-sm btn-outline">⬇️ BC3</button>
            </div>
          </div>
        </div>
      </div>

       <!-- CUERPO PRINCIPAL (altura reducida ~50% para dar más espacio a la preview) -->
      <div class="presc-layout"
           style="
             flex:0 0 50%;
             display:grid;
             grid-template-columns:1fr 1.4fr 1.2fr;
             gap:0.75rem;
             overflow:hidden;
             min-height:0;
           ">

        <!-- COLUMNA 1: SECCIONES -->
        <div class="card" style="display:flex; flex-direction:column; overflow:hidden;">
          <div class="card-header">
            <div class="card-title">Secciones</div>
            <div class="card-subtitle">Arrastra para crear capítulos</div>
          </div>
          <div id="prescSectionsList"
               class="card-body"
               style="flex:1; overflow:auto; padding:0.75rem;">
          </div>
        </div>

        <!-- COLUMNA 2: CAPÍTULO -->
        <div class="card" style="display:flex; flex-direction:column; overflow:hidden;">
          <div class="card-header"
               style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
            <div>
              <div class="card-title">Capítulo</div>
              <div class="card-subtitle">Texto y referencias</div>
            </div>
            <div style="display:flex; gap:0.25rem;">
              <button id="prescCapNuevoBtn"
                      class="btn btn-xs btn-secondary"
                      title="Nuevo capítulo">＋</button>
              <button id="prescCapGuardarBtn"
                      class="btn btn-xs btn-secondary"
                      title="Guardar capítulo">💾</button>
            </div>
          </div>

          <div id="prescCapituloContent"
               class="card-body"
               style="flex:1; overflow:auto; min-height:0;">
          </div>
        </div>

        <!-- COLUMNA 3: PLANTILLAS / EXTRAS -->
        <div style="display:flex; flex-direction:column; gap:0.75rem; overflow:hidden; min-height:0;">

          <div class="card"
               style="flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden;">
            <div class="card-header">
              <div class="card-title">Plantillas</div>
              <div class="card-subtitle">Texto técnico reutilizable</div>
            </div>
            <div id="prescPlantillasList"
                 class="card-body"
                 style="flex:1; overflow:auto;">
            </div>
          </div>

          <div class="card"
               style="flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden;">
            <div class="card-header">
              <div class="card-title">Referencias extra</div>
              <div class="card-subtitle">Materiales y mano de obra</div>
            </div>
            <div id="prescExtraRefsList"
                 class="card-body"
                 style="flex:1; overflow:auto;">
            </div>
          </div>
        </div>
      </div>


           <!-- PREVIEW (más accesible) -->
      <div class="card" style="flex:1; min-height:0; margin-top:0.75rem; overflow:hidden;">
        <div class="card-header">
          <div class="card-title">Previsualización</div>
          <div class="card-subtitle">Resumen por capítulos</div>
        </div>
        <div id="prescPreview" class="card-body" style="overflow:auto; min-height:0;"></div>
      </div>

  `;

  // =====================
  // HANDLERS CABECERA
  // =====================

  const langSelect = container.querySelector("#prescExportLang");
  if (langSelect) {
    langSelect.addEventListener("change", () => {
      appState.prescripcion.exportLang = langSelect.value || "es";
    });
  }

  container.querySelector("#prescReloadSectionsBtn")?.addEventListener("click", () => {
    buildPrescSectionsFromPresupuesto();
    renderDocPrescripcionView();
  });

  container.querySelector("#prescExportExcelBtn")?.addEventListener("click", () => {
    handlePrescExport("excel");
  });
  container.querySelector("#prescExportPdfBtn")?.addEventListener("click", () => {
    handlePrescExport("pdf");
  });
  container.querySelector("#prescExportBc3Btn")?.addEventListener("click", () => {
    handlePrescExport("bc3");
  });

  container.querySelector("#prescCapNuevoBtn")?.addEventListener("click", () => {
    createManualCapitulo();
    renderDocPrescripcionView();
  });

  container.querySelector("#prescCapGuardarBtn")?.addEventListener("click", () => {
    createManualCapitulo();
    renderDocPrescripcionView();
  });

  // =====================
  // SUB-RENDERS
  // =====================

  renderPrescSectionsList();
  renderPrescCapituloContent();
  attachPrescDropZone();
  renderPrescPlantillasList();
  renderPrescExtraRefsList();
  renderPrescPreview();
}

// ========================================================
// FIN PARTE 2
// ========================================================
// ========================================================
// PARTE 3
// Secciones del presupuesto (columna izquierda) + drag
// ========================================================

function renderPrescSectionsList() {
  const container = document.getElementById("prescSectionsList");
  if (!container) return;

  const sections = ensurePrescSectionsFromBudget();
  if (!sections || !sections.length) {
    container.innerHTML = `
      <p class="text-muted" style="padding:0.5rem; font-size:0.8rem;">
        No hay secciones en el presupuesto actual.
      </p>
    `;
    return;
  }

  container.innerHTML = sections
    .map((sec) => {
      const preview = (sec.refs || [])
        .slice(0, 3)
        .map((r) => `${escapeHtml(r.descripcion || "")} x${safeNumber(r.cantidad)}`)
        .join(" • ");

      return `
        <div class="presc-section-card"
             draggable="true"
             data-section-id="${escapeHtmlAttr(sec.id)}"
             title="Arrastra esta sección para crear o actualizar un capítulo">
          <div class="presc-section-title">${escapeHtml(sec.nombre || "")}</div>
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
// Estilos cards secciones (inyectado 1 vez)
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
      user-select: none;
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
      font-weight: 650;
      margin-bottom: 0.35rem;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
// Drag handlers secciones
// ========================================================
function attachPrescSectionsDragHandlers() {
  document
    .querySelectorAll(".presc-section-card[draggable='true']")
    .forEach((el) => {
      el.addEventListener("dragstart", (ev) => {
        const secId = el.getAttribute("data-section-id") || "";
        try {
          // Custom type (tu enfoque original)
          ev.dataTransfer.setData("text/presc-section-id", secId);
          // Fallback universal (Safari/Chrome): text/plain
          ev.dataTransfer.setData("text/plain", "presc-section-id:" + secId);
          ev.dataTransfer.effectAllowed = "copy";
        } catch (_) {}
        el.style.opacity = "0.6";
      });

      el.addEventListener("dragend", () => {
        el.style.opacity = "1";
      });
    });
}


// ========================================================
// FIN PARTE 3
// ========================================================
// ========================================================
// PARTE 4
// Drop de secciones → capítulos
// ========================================================
function attachPrescDropZone() {
  const dropZone = document.getElementById("prescCapituloContent");
  if (!dropZone) return;

  const canAccept = (dt) => {
    try {
      const types = Array.from(dt?.types || []);
      if (types.includes("text/presc-section-id")) return true;
      if (types.includes("text/presc-plantilla-id")) return true;
      if (types.includes("text/presc-extra-id")) return true;
      if (types.includes("text/plain")) return true; // fallback
    } catch (_) {}
    return false;
  };

  dropZone.addEventListener("dragover", (ev) => {
    if (!canAccept(ev.dataTransfer)) return;
    ev.preventDefault();
    dropZone.style.background = "#f9fafb";
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.style.background = "transparent";
  });

  dropZone.addEventListener("drop", (ev) => {
    ev.preventDefault();
    dropZone.style.background = "transparent";

    const dt = ev.dataTransfer;

    // 1) Sección (custom)
    let secId = "";
    try { secId = dt.getData("text/presc-section-id") || ""; } catch (_) {}
    if (secId) {
      handleSectionDrop(secId);
      renderPrescCapituloContent();
      renderPrescPreview();
      return;
    }

    // 2) Plantilla (custom)
    let tplId = "";
    try { tplId = dt.getData("text/presc-plantilla-id") || ""; } catch (_) {}
    if (tplId) {
      handlePlantillaDrop(tplId);
      renderPrescCapituloContent();
      renderPrescPreview();
      return;
    }

    // 3) Extra ref (custom)
    let extraId = "";
    try { extraId = dt.getData("text/presc-extra-id") || ""; } catch (_) {}
    if (extraId) {
      handleExtraRefDrop(extraId);
      renderPrescCapituloContent();
      renderPrescPreview();
      return;
    }

    // 4) Fallback universal: text/plain
    let plain = "";
    try { plain = dt.getData("text/plain") || ""; } catch (_) {}

    if (plain.startsWith("presc-section-id:")) {
      handleSectionDrop(plain.replace("presc-section-id:", ""));
      renderPrescCapituloContent();
      renderPrescPreview();
      return;
    }
    if (plain.startsWith("presc-plantilla-id:")) {
      handlePlantillaDrop(plain.replace("presc-plantilla-id:", ""));
      renderPrescCapituloContent();
      renderPrescPreview();
      return;
    }
    if (plain.startsWith("presc-extra-id:")) {
      handleExtraRefDrop(plain.replace("presc-extra-id:", ""));
      renderPrescCapituloContent();
      renderPrescPreview();
      return;
    }
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

function ensureCapExistsForDrop() {
  let cap = getSelectedCapitulo();
  if (cap) return cap;
  cap = createManualCapitulo();
  return cap;
}

function handlePlantillaDrop(tplId) {
  const cap = ensureCapExistsForDrop();
  const list = appState.prescripcion.plantillas || [];
  const tpl = list.find((p) => String(p.id) === String(tplId));
  if (!tpl) return;

  const incoming = String(tpl.texto || "");
  if (!incoming) return;

  // si ya hay texto, preguntamos append/overwrite (mínimo, sin modal extra)
  if (String(cap.texto || "").trim()) {
    const ok = confirm("El capítulo ya tiene texto. ¿Quieres AÑADIR la plantilla al final?\n\nAceptar = Añadir\nCancelar = Sobrescribir");
    cap.texto = ok ? (cap.texto + "\n\n" + incoming) : incoming;
  } else {
    cap.texto = incoming;
  }
}

function handleExtraRefDrop(extraId) {
  // Reutiliza tu función existente
  addExtraRefToCurrentCap(extraId);
}


function createChapterFromSection(sec) {
  const id = "cap-" + Date.now();

  appState.prescripcion.capitulos.push({
    id,
    nombre: sec.nombre || "Capítulo",
    texto: "",
    lineas: cloneSectionRefs(sec)
  });

  appState.prescripcion.selectedCapituloId = id;
}

function cloneSectionRefs(sec) {
  return (sec.refs || []).map((r) => ({
    id: "sec-ref-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    tipo: "budget",
    codigo: r.codigo || "",
    descripcion: r.descripcion || "",
    unidad: r.unidad || "Ud",
    cantidad: safeNumber(r.cantidad),
    pvp: safeNumber(r.pvp),
    importe: safeNumber(r.importe),
    extraRefId: null
  }));
}

// ========================================================
// Modal overwrite / append
// ========================================================

function askOverwriteOrAppend(sec, cap) {
  openPrescModal({
    title: "¿Cómo quieres aplicar la sección?",
    bodyHTML: `
      <p style="margin-bottom:0.75rem;">
        Sección <strong>${escapeHtml(sec.nombre)}</strong>
        sobre capítulo <strong>${escapeHtml(cap.nombre || "(sin título)")}</strong>
      </p>
      <label style="display:block; margin-bottom:0.35rem;">
        <input type="radio" name="prescSecAction" value="overwrite" checked>
        Sobrescribir capítulo
      </label>
      <label style="display:block;">
        <input type="radio" name="prescSecAction" value="append">
        Añadir referencias
      </label>
    `,
    onSave: () => {
      const action =
        document.querySelector("input[name='prescSecAction']:checked")?.value ||
        "overwrite";

      if (action === "overwrite") {
        overwriteChapterWithSection(cap, sec);
      } else {
        appendSectionToChapter(cap, sec);
      }
    }
  });
}

function overwriteChapterWithSection(cap, sec) {
  cap.nombre = sec.nombre || cap.nombre;
  cap.texto = "";
  cap.lineas = cloneSectionRefs(sec);
}

function appendSectionToChapter(cap, sec) {
  const existing = cap.lineas || [];
  const incoming = cloneSectionRefs(sec);

  incoming.forEach((r) => {
    const dup = existing.find(
      (ex) =>
        ex.codigo === r.codigo &&
        ex.descripcion === r.descripcion &&
        ex.unidad === r.unidad &&
        safeNumber(ex.pvp) === safeNumber(r.pvp)
    );
    if (!dup) existing.push(r);
  });

  cap.lineas = existing;
}

// ========================================================
// FIN PARTE 4
// ========================================================
// ========================================================
// PARTE 5
// Capítulos: helpers + render columna central
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

// Crea capítulo manual (NO re-render aquí; lo hace el caller)
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
  return nuevo;
}

function deleteCapituloById(capId) {
  ensurePrescCapitulosArray();
  const caps = appState.prescripcion.capitulos || [];
  const idx = caps.findIndex((c) => c.id === capId);
  if (idx === -1) {
    console.warn("[PRESCRIPCIÓN] No se encontró el capítulo a borrar:", capId);
    return false;
  }

  const ok = window.confirm("¿Seguro que quieres eliminar este capítulo de la prescripción?");
  if (!ok) return false;

  caps.splice(idx, 1);

  if (appState.prescripcion.selectedCapituloId === capId) {
    appState.prescripcion.selectedCapituloId = caps.length ? caps[0].id : null;
  }

  // limpieza estados UI opcionales
  if (appState.prescripcion.previewExpanded && appState.prescripcion.previewExpanded[capId]) {
    delete appState.prescripcion.previewExpanded[capId];
  }

  return true;
}

// ========================================================
// Render columna central (Capítulo seleccionado)
// ========================================================

function prescComputeImporte(linea) {
  const qty = safeNumber(linea?.cantidad);
  const pvp = safeNumber(linea?.pvp);
  return qty * pvp;
}

function prescNormalizeLine(linea) {
  if (!linea) return linea;
  if (linea.importe == null || !Number.isFinite(Number(linea.importe))) {
    linea.importe = prescComputeImporte(linea);
  } else {
    // si hay desajuste fuerte, preferimos coherencia qty*pvp
    const calc = prescComputeImporte(linea);
    const cur = safeNumber(linea.importe);
    if (Math.abs(calc - cur) > 0.01) linea.importe = calc;
  }
  return linea;
}

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
        <li>Crear un capítulo manual con el botón <strong>"＋"</strong>.</li>
        <li>Arrastrar una sección del presupuesto a esta zona para generar un capítulo automáticamente.</li>
      </ul>
    `;
    return;
  }

  cap.lineas = Array.isArray(cap.lineas) ? cap.lineas : [];
  cap.lineas.forEach(prescNormalizeLine);

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
      <div style="overflow:auto;">
        <table class="table table-compact" style="width:100%; font-size:0.8rem; border-collapse:collapse; min-width:720px;">
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
                const cod = escapeHtml(l.codigo || "");
                const desc = escapeHtml(l.descripcion || "");
                const unidad = escapeHtml(l.unidad || "Ud");
                const cant = safeNumber(l.cantidad);
                const pvp = safeNumber(l.pvp);
                const importe = prescComputeImporte(l);

                // mantenemos importe actualizado en estado
                l.importe = importe;

                return `
                  <tr data-presc-line-id="${escapeHtmlAttr(l.id)}">
                    <td>${cod}</td>
                    <td>${desc}</td>
                    <td style="text-align:center;">${unidad}</td>
                    <td style="text-align:right;">
                      ${
                        isExtra
                          ? `<input type="number" min="0" step="0.01"
                                   class="presc-line-qty-input"
                                   value="${cant}"
                                   style="width:4.8rem; text-align:right; font-size:0.78rem;" />`
                          : cant
                      }
                    </td>
                    <td style="text-align:right;">${pvp.toFixed(2)} €</td>
                    <td class="presc-line-imp" style="text-align:right;">${importe.toFixed(2)} €</td>
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
      <div class="form-group">
        <label>Título del capítulo</label>
        <input id="prescCapTitulo"
               type="text"
               class="form-control"
               value="${escapeHtmlAttr(cap.nombre || "")}" />
      </div>

      <div class="form-group">
        <label>Texto descriptivo (mediciones)</label>
        <textarea id="prescCapTexto"
                  class="form-control"
                  style="width:100%; min-height:130px; resize:vertical;"
                  placeholder="Aquí puedes escribir o pegar el texto técnico de mediciones del capítulo...">${escapeHtml(cap.texto || "")}</textarea>
      </div>

      <div class="form-group">
        <label>Referencias del capítulo</label>
        ${refsHTML}
      </div>
    </div>
  `;

  // Título
  const tituloInput = container.querySelector("#prescCapTitulo");
  if (tituloInput) {
    tituloInput.addEventListener("input", (ev) => {
      cap.nombre = ev.target.value || "";
      // Si existe preview, refrescamos sólo preview para ver título al instante
      if (typeof renderPrescPreview === "function") renderPrescPreview();
    });
  }

  // Texto
  const textoArea = container.querySelector("#prescCapTexto");
  if (textoArea) {
    textoArea.addEventListener("input", (ev) => {
      cap.texto = ev.target.value || "";
      // Preview opcional
      if (typeof renderPrescPreview === "function") renderPrescPreview();
    });
  }

  // Qty + delete en líneas extra (sin render completo)
  container.querySelectorAll("tr[data-presc-line-id]").forEach((row) => {
    const lineId = row.getAttribute("data-presc-line-id");
    const linea = (cap.lineas || []).find((l) => String(l.id) === String(lineId));
    if (!linea) return;

    if (linea.tipo === "extra") {
      const qtyInput = row.querySelector(".presc-line-qty-input");
      const delBtn = row.querySelector(".presc-line-del-btn");
      const impCell = row.querySelector(".presc-line-imp");

      if (qtyInput) {
        qtyInput.addEventListener("input", () => {
          linea.cantidad = safeNumber(qtyInput.value);
          linea.importe = prescComputeImporte(linea);

          if (impCell) impCell.textContent = linea.importe.toFixed(2) + " €";

          // refrescar total/preview sin re-render completo si existe
          if (typeof renderPrescPreview === "function") renderPrescPreview();
        });
      }

      if (delBtn) {
        delBtn.addEventListener("click", () => {
          cap.lineas = (cap.lineas || []).filter((l) => l.id !== lineId);
          // Re-render solo panel central + preview
          renderPrescCapituloContent();
          if (typeof renderPrescPreview === "function") renderPrescPreview();
        });
      }
    }
  });
}

// ========================================================
// FIN PARTE 5
// ========================================================
// ========================================================
// PARTE 6
// Plantillas + Referencias extra (Firestore + render)
// ========================================================

// ========================================================
// Auth helper: asegurar UID antes de Firestore
// ========================================================

function ensurePrescUidReady(timeoutMs = 15000) {
  return new Promise((resolve) => {
    const uidNow = getCurrentUidPresc();
    if (uidNow) return resolve(uidNow);

    const auth = getAuthPresc();
    if (!auth || typeof auth.onAuthStateChanged !== "function") {
      return resolve(null);
    }

    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(getCurrentUidPresc());
    }, timeoutMs);

    auth.onAuthStateChanged((user) => {
      if (done) return;
      if (user?.uid) {
        done = true;
        clearTimeout(timer);
        resolve(user.uid);
      }
    });
  });
}

// ========================================================
// PLANTILLAS (Firestore)
// ========================================================

async function ensurePrescPlantillasLoaded() {
  await ensurePrescUidReady();
  if (appState.prescripcion.plantillasLoaded) return;

  appState.prescripcion.plantillas = appState.prescripcion.plantillas || [];

  const db = getFirestorePresc();
  if (!db) {
    appState.prescripcion.plantillasLoaded = true;
    return;
  }

  try {
    const ref = getUserSubcollectionRefPresc("prescripcion_plantillas");
    if (!ref) throw new Error("No subcollection ref");

    const snap = await ref.get();
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
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error cargando plantillas:", e);
  } finally {
    appState.prescripcion.plantillasLoaded = true;
  }
}

async function createPrescPlantilla(nombre, texto) {
  await ensurePrescUidReady();
  nombre = (nombre || "").trim();
  texto = texto || "";
  if (!nombre) return alert("La plantilla necesita un nombre.");

  const local = {
    id: "local-" + Date.now(),
    nombre,
    texto
  };

  appState.prescripcion.plantillas.unshift(local);

  const db = getFirestorePresc();
  const ref = getUserSubcollectionRefPresc("prescripcion_plantillas");
  if (!db || !ref) return;

  try {
    const doc = await ref.add({
      nombre,
      texto,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    local.id = doc.id;
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error creando plantilla:", e);
  }
}

async function updatePrescPlantilla(id, nombre, texto) {
  await ensurePrescUidReady();
  const list = appState.prescripcion.plantillas || [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], nombre, texto };
  }

  const ref = getUserSubcollectionRefPresc("prescripcion_plantillas");
  if (!ref) return;

  try {
    await ref.doc(id).update({ nombre, texto, updatedAt: Date.now() });
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error actualizando plantilla:", e);
  }
}

async function deletePrescPlantilla(id) {
  await ensurePrescUidReady();
  if (!confirm("¿Eliminar esta plantilla?")) return;

  appState.prescripcion.plantillas =
    (appState.prescripcion.plantillas || []).filter((p) => p.id !== id);

  const ref = getUserSubcollectionRefPresc("prescripcion_plantillas");
  if (!ref) return;

  try {
    await ref.doc(id).delete();
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error borrando plantilla:", e);
  }
}

// ========================================================
// RENDER PLANTILLAS (fix bug buscador 1 carácter)
// ========================================================

async function renderPrescPlantillasList() {
  const container = document.getElementById("prescPlantillasList");
  if (!container) return;

  await ensurePrescPlantillasLoaded();

  const list = appState.prescripcion.plantillas || [];
  const term = (appState.prescripcion.plantillasSearchTerm || "").toLowerCase();

  const filtered = list.filter((p) =>
    !term ||
    (p.nombre + " " + p.texto).toLowerCase().includes(term)
  );

  container.innerHTML = `
    <div style="display:flex; gap:0.5rem; margin-bottom:0.5rem;">
      <input id="prescPlantillasSearch"
             class="form-control form-control-sm"
             placeholder="Buscar plantilla..."
             value="${escapeHtmlAttr(appState.prescripcion.plantillasSearchTerm || "")}">
      <button id="prescNewPlantillaBtn" class="btn btn-xs btn-secondary">＋</button>
    </div>
    ${filtered.map(p => `
      <div class="presc-plantilla-item" draggable="true" data-id="${escapeHtmlAttr(p.id)}">
        <div style="font-weight:600;">📄 ${escapeHtml(p.nombre)}</div>
        <div style="font-size:0.75rem; color:#6b7280;">
          ${(p.texto || "").slice(0, 140)}${p.texto.length > 140 ? "…" : ""}
        </div>
        <div style="margin-top:0.25rem; text-align:right;">
          <button class="btn btn-xs" data-apply="${escapeHtmlAttr(p.id)}">➕</button>
          <button class="btn btn-xs btn-outline" data-edit="${escapeHtmlAttr(p.id)}">✏️</button>
          <button class="btn btn-xs" data-del="${escapeHtmlAttr(p.id)}">🗑️</button>
        </div>
      </div>
    `).join("")}
  `;

  const search = container.querySelector("#prescPlantillasSearch");
  if (search) {
    search.addEventListener("input", (e) => {
      appState.prescripcion.plantillasSearchTerm = e.target.value || "";
      requestAnimationFrame(renderPrescPlantillasList);
    });
  }

  container.querySelector("#prescNewPlantillaBtn")?.addEventListener("click", () => {
    openPrescModal({
      title: "Nueva plantilla",
      bodyHTML: `
        <input id="tplNombre" class="form-control" placeholder="Nombre">
        <textarea id="tplTexto" class="form-control" rows="6"></textarea>
      `,
      onSave: async () => {
        await createPrescPlantilla(
          document.getElementById("tplNombre").value,
          document.getElementById("tplTexto").value
        );
        renderPrescPlantillasList();
      }
    });
  });

  container.querySelectorAll("[data-apply]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cap = getSelectedCapitulo();
      if (!cap) return;
      const tpl = list.find(p => p.id === btn.dataset.apply);
      if (!tpl) return;
      cap.texto = tpl.texto;
      renderPrescCapituloContent();
    });
  });

  container.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tpl = list.find(p => p.id === btn.dataset.edit);
      if (!tpl) return;
      openPrescModal({
        title: "Editar plantilla",
        bodyHTML: `
          <input id="tplNombre" class="form-control" value="${escapeHtmlAttr(tpl.nombre)}">
          <textarea id="tplTexto" class="form-control" rows="6">${escapeHtml(tpl.texto)}</textarea>
        `,
        onSave: async () => {
          await updatePrescPlantilla(
            tpl.id,
            document.getElementById("tplNombre").value,
            document.getElementById("tplTexto").value
          );
          renderPrescPlantillasList();
        }
      });
    });
  });

  container.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deletePrescPlantilla(btn.dataset.del);
      renderPrescPlantillasList();
    });
  });
    // Drag & drop de plantillas hacia capítulo
  container.querySelectorAll(".presc-plantilla-item[draggable='true']").forEach((el) => {
    el.addEventListener("dragstart", (ev) => {
      const id = el.getAttribute("data-id") || "";
      try {
        ev.dataTransfer.setData("text/presc-plantilla-id", id);
        ev.dataTransfer.setData("text/plain", "presc-plantilla-id:" + id);
        ev.dataTransfer.effectAllowed = "copy";
      } catch (_) {}
      el.style.opacity = "0.6";
    });
    el.addEventListener("dragend", () => {
      el.style.opacity = "1";
    });
  });

}

// ========================================================
// REFERENCIAS EXTRA (Firestore + render)
// ========================================================

async function ensureExtraRefsLoaded() {
  await ensurePrescUidReady();
  if (appState.prescripcion.extraRefsLoaded) return;

  appState.prescripcion.extraRefs = appState.prescripcion.extraRefs || [];

  const ref = getUserSubcollectionRefPresc("prescripcion_referencias_extra");
  if (!ref) {
    appState.prescripcion.extraRefsLoaded = true;
    return;
  }

  try {
    const snap = await ref.get();
    const list = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      list.push({
        id: doc.id,
        codigo: d.codigo || "",
        descripcion: d.descripcion || "",
        unidad: d.unidad || "Ud",
        pvp: safeNumber(d.pvp)
      });
    });
    appState.prescripcion.extraRefs = list;
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error refs extra:", e);
  } finally {
    appState.prescripcion.extraRefsLoaded = true;
  }
}

// El render completo de refs extra sigue en PARTE 7
// ========================================================
// FIN PARTE 6
// ========================================================
// ========================================================
// PARTE 7
// Referencias extra: CRUD + render + buscador + estilos
// ========================================================

// ========================================================
// CRUD REFERENCIAS EXTRA
// ========================================================

async function createExtraRef(codigo, descripcion, unidad, pvp) {
  await ensurePrescUidReady();

  codigo = (codigo || "").trim();
  descripcion = (descripcion || "").trim();
  unidad = (unidad || "Ud").trim() || "Ud";
  pvp = safeNumber(pvp);

  if (!codigo && !descripcion) {
    alert("La referencia necesita al menos código o descripción.");
    return;
  }

  const local = {
    id: "local-" + Date.now(),
    codigo,
    descripcion,
    unidad,
    pvp
  };

  appState.prescripcion.extraRefs = appState.prescripcion.extraRefs || [];
  appState.prescripcion.extraRefs.unshift(local);

  const ref = getUserSubcollectionRefPresc("prescripcion_referencias_extra");
  if (!ref) return;

  try {
    const doc = await ref.add({
      codigo,
      descripcion,
      unidad,
      pvp,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    local.id = doc.id;
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
  pvp = safeNumber(pvp);

  const list = appState.prescripcion.extraRefs || [];
  const idx = list.findIndex((r) => r.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], codigo, descripcion, unidad, pvp };
  }

  const ref = getUserSubcollectionRefPresc("prescripcion_referencias_extra");
  if (!ref) return;

  try {
    await ref.doc(id).update({
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

  const ok = confirm("¿Seguro que quieres borrar esta referencia extra?");
  if (!ok) return;

  appState.prescripcion.extraRefs =
    (appState.prescripcion.extraRefs || []).filter((r) => r.id !== id);

  const ref = getUserSubcollectionRefPresc("prescripcion_referencias_extra");
  if (!ref) return;

  try {
    await ref.doc(id).delete();
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
    codigo: r.codigo || "",
    descripcion: r.descripcion || "",
    unidad: r.unidad || "Ud",
    cantidad: 1,
    pvp: safeNumber(r.pvp),
    importe: safeNumber(r.pvp) * 1,
    extraRefId: extraId
  });
}

// ========================================================
// RENDER REFERENCIAS EXTRA (buscador sin bug “1 carácter”)
// ========================================================

async function renderPrescExtraRefsList() {
  const container = document.getElementById("prescExtraRefsList");
  if (!container) return;

  await ensureExtraRefsLoaded();

  const refs = appState.prescripcion.extraRefs || [];
  const term = (appState.prescripcion.extraRefsSearchTerm || "").toLowerCase();

  const filtered = refs.filter((r) => {
    if (!term) return true;
    const base = ((r.codigo || "") + " " + (r.descripcion || "")).toLowerCase();
    return base.includes(term);
  });

  container.innerHTML = `
    <div style="display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center;">
      <input id="prescExtraRefsSearch"
             class="form-control form-control-sm"
             placeholder="Buscar referencia..."
             value="${escapeHtmlAttr(appState.prescripcion.extraRefsSearchTerm || "")}">
      <button id="prescNewExtraRefBtn" class="btn btn-xs btn-secondary" title="Nueva referencia extra">➕</button>
    </div>

    ${
      filtered.length
        ? filtered
            .map((r) => {
              const cod = r.codigo || "";
              const desc = r.descripcion || "";
              const unidad = r.unidad || "Ud";
              const pvp = safeNumber(r.pvp).toFixed(2);

              return `
                <div class="presc-extra-item" data-id="${escapeHtmlAttr(r.id)}">
                  <div class="presc-extra-main">
                    <div class="presc-extra-line1">
                      <span class="presc-extra-code">${escapeHtml(cod)}</span>
                      <span class="presc-extra-price">${pvp} € / ${escapeHtml(unidad)}</span>
                    </div>
                    <div class="presc-extra-desc">${desc ? escapeHtml(desc) : "<i>(sin descripción)</i>"}</div>
                  </div>

                  <div class="presc-extra-actions">
                    <button class="btn btn-xs" data-add="${escapeHtmlAttr(r.id)}">➕ Añadir</button>
                    <button class="btn btn-xs btn-outline" data-dup="${escapeHtmlAttr(r.id)}">⧉</button>
                    <button class="btn btn-xs btn-outline" data-edit="${escapeHtmlAttr(r.id)}">✏️</button>
                    <button class="btn btn-xs" data-del="${escapeHtmlAttr(r.id)}">🗑️</button>
                  </div>
                </div>
              `;
            })
            .join("")
        : `<p class="text-muted" style="font-size:0.8rem;">No hay referencias que coincidan con la búsqueda.</p>`
    }
  `;

  // Buscador (evita bug de 1 carácter: re-render por RAF)
  const search = container.querySelector("#prescExtraRefsSearch");
  if (search) {
    search.addEventListener("input", (e) => {
      appState.prescripcion.extraRefsSearchTerm = e.target.value || "";
      requestAnimationFrame(renderPrescExtraRefsList);
    });
  }

  // Nueva referencia
  container.querySelector("#prescNewExtraRefBtn")?.addEventListener("click", () => {
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
          <label>Unidad</label>
          <select id="extUnidad" class="form-control">
            <option value="Ud">Ud</option>
            <option value="m">m</option>
            <option value="m²">m²</option>
            <option value="h">h</option>
            <option value="m³">m³</option>
            <option value="kg">kg</option>
          </select>
        </div>
        <div class="form-group">
          <label>PVP</label>
          <input id="extPvp" type="number" class="form-control" value="0" />
        </div>
      `,
      onSave: async () => {
        const codigo = document.getElementById("extCodigo")?.value || "";
        const desc = document.getElementById("extDesc")?.value || "";
        const unidad = document.getElementById("extUnidad")?.value || "Ud";
        const pvp = document.getElementById("extPvp")?.value || 0;
        await createExtraRef(codigo, desc, unidad, pvp);
        renderPrescExtraRefsList();
      }
    });
  });

  // Añadir al capítulo
  container.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      addExtraRefToCurrentCap(btn.dataset.add);
      renderPrescCapituloContent();
      renderPrescPreview();
    });
  });

  // Duplicar
  container.querySelectorAll("[data-dup]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await duplicateExtraRef(btn.dataset.dup);
      renderPrescExtraRefsList();
    });
  });

  // Editar
  container.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.edit;
      const list = appState.prescripcion.extraRefs || [];
      const r = list.find((x) => x.id === id);
      if (!r) return;

      openPrescModal({
        title: "Editar referencia extra",
        bodyHTML: `
          <div class="form-group">
            <label>Código</label>
            <input id="extCodigo" type="text" class="form-control" value="${escapeHtmlAttr(r.codigo || "")}" />
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <textarea id="extDesc" rows="3" class="form-control">${escapeHtml(r.descripcion || "")}</textarea>
          </div>
          <div class="form-group">
            <label>Unidad</label>
            <select id="extUnidad" class="form-control">
              <option value="Ud" ${r.unidad === "Ud" ? "selected" : ""}>Ud</option>
              <option value="m" ${r.unidad === "m" ? "selected" : ""}>m</option>
              <option value="m²" ${r.unidad === "m²" ? "selected" : ""}>m²</option>
              <option value="h" ${r.unidad === "h" ? "selected" : ""}>h</option>
              <option value="m³" ${r.unidad === "m³" ? "selected" : ""}>m³</option>
              <option value="kg" ${r.unidad === "kg" ? "selected" : ""}>kg</option>
            </select>
          </div>
          <div class="form-group">
            <label>PVP</label>
            <input id="extPvp" type="number" class="form-control" value="${safeNumber(r.pvp)}" />
          </div>
        `,
        onSave: async () => {
          const codigo = document.getElementById("extCodigo")?.value || "";
          const desc = document.getElementById("extDesc")?.value || "";
          const unidad = document.getElementById("extUnidad")?.value || "Ud";
          const pvp = document.getElementById("extPvp")?.value || 0;
          await updateExtraRef(id, codigo, desc, unidad, pvp);
          renderPrescExtraRefsList();
          renderPrescCapituloContent();
          renderPrescPreview();
        }
      });
    });
  });

  // Borrar
  container.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteExtraRef(btn.dataset.del);
      renderPrescExtraRefsList();
      renderPrescCapituloContent();
      renderPrescPreview();
    });
  });
}

// ========================================================
// ESTILOS refs extra (solo si no existen)
// ========================================================

(function injectPrescExtraStyles() {
  if (document.getElementById("presc-extra-styles")) return;

  const style = document.createElement("style");
  style.id = "presc-extra-styles";
  style.innerHTML = `
    .presc-extra-item {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 0.6rem 0.75rem;
      margin-bottom: 0.55rem;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      font-size: 0.78rem;
    }
    .presc-extra-line1 {
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:0.15rem;
      gap:0.5rem;
    }
    .presc-extra-code {
      font-weight: 700;
      color: #111827;
      max-width: 55%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .presc-extra-price {
      font-weight: 600;
      color: #111827;
      white-space: nowrap;
    }
    .presc-extra-desc {
      color: #6b7280;
      font-size: 0.76rem;
      line-height: 1.25;
    }
    .presc-extra-actions {
      display:flex;
      justify-content:flex-end;
      gap:0.25rem;
      flex-wrap:wrap;
      margin-top:0.35rem;
    }
  `;
  document.head.appendChild(style);
})();

// ========================================================
// FIN PARTE 7
// ========================================================
// ========================================================
// PARTE 8
// PREVISUALIZACIÓN (compacta, clara, funcional)
// ========================================================

function renderPrescPreview() {
  const container = document.getElementById("prescPreview");
  if (!container) return;

  ensurePrescCapitulosArray();
  const caps = appState.prescripcion.capitulos || [];

  if (!caps.length) {
    container.innerHTML = `
      <p class="text-muted" style="font-size:0.8rem;">
        No hay capítulos todavía.
      </p>
    `;
    return;
  }

  // estado expandido por capítulo
  appState.prescripcion.previewExpanded =
    appState.prescripcion.previewExpanded || {};

  let totalGlobal = 0;

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.5rem;">
      ${caps.map((cap) => {
        const subtotal = (cap.lineas || []).reduce((acc, l) => {
          const imp = l.importe != null
            ? safeNumber(l.importe)
            : safeNumber(l.cantidad) * safeNumber(l.pvp);
          return acc + imp;
        }, 0);

        totalGlobal += subtotal;

        const expanded = !!appState.prescripcion.previewExpanded[cap.id];

        return `
          <div class="presc-prev-card"
               style="border:1px solid #e5e7eb; border-radius:10px; background:#fff;">

            <!-- CABECERA CAPÍTULO -->
            <div class="presc-prev-head"
                 data-cap-id="${escapeHtmlAttr(cap.id)}"
                 title="Doble click para desplegar"
                 style="
                   display:flex;
                   justify-content:space-between;
                   align-items:center;
                   padding:0.45rem 0.65rem;
                   cursor:pointer;
                   font-size:0.8rem;
                   font-weight:600;
                   user-select:none;
                 ">
              <div style="overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">
                ${escapeHtml(cap.nombre || "Capítulo")}
              </div>
              <div style="font-size:0.78rem;">
                ${subtotal.toFixed(2)} €
              </div>
            </div>

            <!-- DETALLE -->
            <div class="presc-prev-body"
                 style="
                   display:${expanded ? "block" : "none"};
                   border-top:1px solid #e5e7eb;
                   padding:0.35rem 0.65rem;
                   font-size:0.75rem;
                   max-height:220px;
                   overflow:auto;
                 ">
              ${
                cap.lineas && cap.lineas.length
                  ? `
                    <table style="width:100%; border-collapse:collapse;">
                      <thead>
                        <tr style="border-bottom:1px solid #e5e7eb;">
                          <th style="text-align:left;">Código</th>
                          <th style="text-align:left;">Descripción</th>
                          <th style="text-align:center;">Ud</th>
                          <th style="text-align:right;">Precio</th>
                          <th style="text-align:right;">Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${cap.lineas.map((l) => {
                          const qty = safeNumber(l.cantidad);
                          const pvp = safeNumber(l.pvp);
                          const imp = safeNumber(
                            l.importe != null ? l.importe : qty * pvp
                          );
                          return `
                            <tr>
                              <td>${escapeHtml(l.codigo || "")}</td>
                              <td>${escapeHtml(l.descripcion || "")}</td>
                              <td style="text-align:center;">${escapeHtml(l.unidad || "Ud")}</td>
                              <td style="text-align:right;">${pvp.toFixed(2)} €</td>
                              <td style="text-align:right;">${imp.toFixed(2)} €</td>
                            </tr>
                          `;
                        }).join("")}
                      </tbody>
                    </table>
                  `
                  : `<div class="text-muted">Sin referencias.</div>`
              }
            </div>
          </div>
        `;
      }).join("")}

      <!-- TOTAL GLOBAL -->
      <div style="
        display:flex;
        justify-content:flex-end;
        font-weight:700;
        font-size:0.85rem;
        padding-top:0.25rem;">
        Total: ${totalGlobal.toFixed(2)} €
      </div>
    </div>
  `;

  // eventos
  container.querySelectorAll(".presc-prev-head").forEach((head) => {
    const capId = head.dataset.capId;

    // doble click: expand / collapse
    head.addEventListener("dblclick", () => {
      appState.prescripcion.previewExpanded[capId] =
        !appState.prescripcion.previewExpanded[capId];
      renderPrescPreview();
    });

    // click simple: seleccionar capítulo
    head.addEventListener("click", () => {
      appState.prescripcion.selectedCapituloId = capId;
      renderPrescCapituloContent();
    });
  });
}

// ========================================================
// FIN PARTE 8
// ========================================================
// ========================================================
// PARTE 9
// EXPORTACIÓN + IDIOMA + GEMINI (modelo limpio)
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
    subtotal: "Subtotal capítulo",
    total: "Total prescripción",
    title: "Prescripción técnica del proyecto",
  },
  en: {
    chapter: "Chapter",
    code: "Code",
    description: "Description",
    unit: "Unit",
    qty: "Qty",
    price: "Price",
    amount: "Amount",
    subtotal: "Chapter subtotal",
    total: "Specification total",
    title: "Project technical specification",
  },
  pt: {
    chapter: "Capítulo",
    code: "Código",
    description: "Descrição",
    unit: "Unid",
    qty: "Qtd.",
    price: "PVP",
    amount: "Montante",
    subtotal: "Subtotal capítulo",
    total: "Total da especificação",
    title: "Especificação técnica do projeto",
  }
};

// ========================================================
// MODELO DE EXPORTACIÓN (NEUTRO, SIN FORMATO)
// ========================================================

async function buildPrescExportModel(lang) {
  ensurePrescCapitulosArray();
  const language = lang || appState.prescripcion.exportLang || "es";

  const model = {
    lang: language,
    labels: PRESC_EXPORT_LABELS[language] || PRESC_EXPORT_LABELS.es,
    chapters: [],
    total: 0
  };

  (appState.prescripcion.capitulos || []).forEach((cap) => {
    let subtotal = 0;

    const lines = (cap.lineas || []).map((l) => {
      const qty = safeNumber(l.cantidad);
      const pvp = safeNumber(l.pvp);
      const imp = l.importe != null ? safeNumber(l.importe) : qty * pvp;
      subtotal += imp;

      return {
        code: l.codigo || "",
        description: l.descripcion || "",
        unit: l.unidad || "Ud",
        qty,
        price: pvp,
        amount: imp
      };
    });

    model.chapters.push({
      title: cap.nombre || "",
      text: cap.texto || "",
      lines,
      subtotal
    });

    model.total += subtotal;
  });

  // Traducción completa SOLO AQUÍ (modelo)
  if (language !== "es") {
    await translatePrescModel(model, language);
  }

  return model;
}

// ========================================================
// TRADUCCIÓN GEMINI (SIN ROMPER FORMATO)
// ========================================================

async function translatePrescModel(model, targetLang) {
  if (typeof window.geminiTranslateBatch !== "function") return;

  const cache = {};
  const texts = [];

  const push = (t) => {
    const s = String(t || "").trim();
    if (!s || cache[s]) return;
    cache[s] = null;
    texts.push(s);
  };

  model.chapters.forEach((c) => {
    push(c.title);
    push(c.text);
    (c.lines || []).forEach((l) => push(l.description));
  });

  if (!texts.length) return;

  let translated = [];
  try {
    translated = await window.geminiTranslateBatch(texts, targetLang);
  } catch (e) {
    console.warn("[PRESC] Error traducción Gemini:", e);
    return;
  }

  texts.forEach((src, i) => {
    cache[src] = translated[i] || src;
  });

  model.chapters = model.chapters.map((c) => ({
    ...c,
    title: cache[c.title] || c.title,
    text: cache[c.text] || c.text,
    lines: (c.lines || []).map((l) => ({
      ...l,
      description: cache[l.description] || l.description
    }))
  }));
}

// ========================================================
// DISPATCH EXPORT
// ========================================================

async function handlePrescExport(type) {
  const lang = appState.prescripcion.exportLang || "es";
  const model = await buildPrescExportModel(lang);

  if (!model.chapters.length) {
    alert("No hay capítulos para exportar.");
    return;
  }

  if (type === "excel" && window.exportPrescripcionToExcel) {
    window.exportPrescripcionToExcel(model);
    return;
  }
  if (type === "pdf" && window.exportPrescripcionToPdf) {
    window.exportPrescripcionToPdf(model);
    return;
  }
  if (type === "bc3" && window.exportPrescripcionToBc3) {
    window.exportPrescripcionToBc3(model);
    return;
  }

  console.warn("[PRESCRIPCIÓN] Exportador no disponible:", type);
}
// ========================================================
// PARTE 10 (FINAL)
// Exporters (XLSX/PDF/BC3) + helpers + window hooks
// ========================================================

// ------------------------
// Moneda / locale helpers
// ------------------------
function prescLangToLocale(lang) {
  if (lang === "en") return "en-GB";
  if (lang === "pt") return "pt-PT";
  return "es-ES";
}

function prescFormatCurrency(value, lang, opts = {}) {
  const locale = prescLangToLocale(lang);
  const v = Number(value);
  const n = Number.isFinite(v) ? v : 0;

  let num;
  try {
    num = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch (_) {
    num = n.toFixed(2);
  }

  const euro = opts.html ? "&nbsp;€" : " €";
  return String(num) + euro;
}

function prescFormatCurrencyHTML(value, lang) {
  // Evita salto de línea entre número y €
  return prescFormatCurrency(value, lang, { html: true });
}

// ------------------------
// Print / PDF (ventana)
// ------------------------
function openPrescPrintWindow(model, lang) {
  const language = lang || model?.lang || appState.prescripcion.exportLang || "es";
  const labels = (model?.labels) || PRESC_EXPORT_LABELS[language] || PRESC_EXPORT_LABELS.es;

  const win = window.open("", "_blank");
  if (!win) {
    alert("No se pudo abrir la ventana de impresión. Revisa el bloqueador de popups.");
    return;
  }

  const style = `
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 16px; color:#111; }
      h1 { font-size: 18px; margin: 0 0 8px; }
      h2 { font-size: 14px; margin: 16px 0 6px; }
      .small { font-size: 10px; color: #6b7280; margin: 0 0 10px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0 14px; }
      th, td { border: 1px solid #d1d5db; padding: 4px 6px; vertical-align: top; }
      th { background: #f3f4f6; text-align: left; }
      .right { text-align:right; }
      .subtotal { font-weight:700; background:#fafafa; }
      .chapterText { margin: 6px 0 10px; white-space: pre-wrap; }
    </style>
  `;

  const chapters = model?.chapters || [];
  const totalGlobal = Number(model?.total) || 0;

  let html = `
    <html>
      <head><meta charset="utf-8" />${style}</head>
      <body>
        <h1>${labels.title || "Prescripción"}</h1>
        <p class="small">${(labels.language || "Idioma")}: ${String(language).toUpperCase()}</p>
  `;

  chapters.forEach((cap, idx) => {
    html += `<h2>${labels.chapter || "Capítulo"} ${idx + 1} — ${escapeHtml(cap.title || "")}</h2>`;

    if (cap.text) {
      html += `<div class="chapterText">${escapeHtml(cap.text).replace(/\n/g, "<br>")}</div>`;
    }

    if (cap.lines && cap.lines.length) {
      html += `
        <table>
          <thead>
            <tr>
              <th style="width:120px;">${labels.code || "Código"}</th>
              <th>${labels.description || "Descripción"}</th>
              <th style="width:70px;">${labels.unit || "Ud"}</th>
              <th class="right" style="width:90px;">${labels.qty || "Cant."}</th>
              <th class="right" style="width:110px;">${labels.price || "PVP"} (€)</th>
              <th class="right" style="width:130px;">${labels.amount || "Importe"} (€)</th>
            </tr>
          </thead>
          <tbody>
      `;

      cap.lines.forEach((l) => {
        html += `
          <tr>
            <td style="font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">${escapeHtml(l.code || "")}</td>
            <td>${escapeHtml(l.description || "")}</td>
            <td>${escapeHtml(l.unit || "")}</td>
            <td class="right">${safeNumber(l.qty)}</td>
            <td class="right">${prescFormatCurrencyHTML(safeNumber(l.price), language)}</td>
            <td class="right">${prescFormatCurrencyHTML(safeNumber(l.amount), language)}</td>
          </tr>
        `;
      });

      html += `
          <tr class="subtotal">
            <td colspan="5" class="right">${labels.subtotal || "Subtotal capítulo"}</td>
            <td class="right">${prescFormatCurrencyHTML(safeNumber(cap.subtotal), language)}</td>
          </tr>
          </tbody>
        </table>
      `;
    }
  });

  html += `
        <p style="text-align:right; font-weight:800; margin-top:12px;">
          ${labels.total || "Total"}: ${prescFormatCurrencyHTML(totalGlobal, language)}
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
    }, 350);
  } catch (e) {
    console.warn("[PRESCRIPCIÓN] print() bloqueado:", e);
  }
}

// ------------------------
// Descargas (texto / BC3)
// ------------------------
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

function downloadBc3File(content, filename) {
  // Forzamos bytes 0..255 (latin1) para Presto clásico
  const s = String(content || "");
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;

  const blob = new Blob([bytes], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.bc3";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ------------------------
// BC3 generator (usa tu función)
// ------------------------
function exportPrescripcionToBc3(model) {
  const lang = model?.lang || appState.prescripcion.exportLang || "es";
  if (typeof prescExportToBC3 !== "function") {
    alert("No existe prescExportToBC3 en el archivo.");
    return;
  }
  const bc3 = prescExportToBC3(
    {
      capitulos: (model.chapters || []).map((c) => ({
        nombre: c.title,
        texto: c.text,
        lineas: (c.lines || []).map((l) => ({
          codigo: l.code,
          descripcion: l.description,
          unidad: l.unit,
          cantidad: l.qty,
          pvp: l.price,
          importe: l.amount
        })),
        subtotal: c.subtotal
      })),
      totalGlobal: model.total
    },
    lang
  );

  downloadBc3File(bc3, `prescripcion_${lang}.bc3`);
}

// ------------------------
// Excel deps (ExcelJS + FileSaver)
// ------------------------
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
  if (window.ExcelJS && window.saveAs) return true;

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
    console.warn("[Presc] No se pudieron cargar deps XLSX", e);
  }

  return !!(window.ExcelJS && window.saveAs);
}

function getPrescProjectDescription() {
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

// ------------------------
// Export XLSX REAL (ExcelJS)
// ------------------------
async function exportPrescripcionToExcel(model) {
  const language = model?.lang || appState.prescripcion.exportLang || "es";
  const labels = model?.labels || PRESC_EXPORT_LABELS[language] || PRESC_EXPORT_LABELS.es;

  const ok = await ensureExcelDepsLoaded();
  if (!ok) {
    alert("No se pudo exportar a Excel (XLSX). Falta ExcelJS/FileSaver.");
    return;
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet((labels.title || "Prescripción").slice(0, 31));

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
  const fmtQty = "#,##0.00";

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
  titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };

  // Descripción proyecto (si existe)
  const projectDesc = String(getPrescProjectDescription() || "").trim();
  if (projectDesc) {
    const descRowTop = ws.addRow([projectDesc]);
    ws.mergeCells(descRowTop.number, 1, descRowTop.number, 7);
    descRowTop.getCell(1).font = { name: "Aptos Narrow", size: 10, italic: true, color: { argb: "FF374151" } };
    descRowTop.getCell(1).alignment = { horizontal: "center", vertical: "top", wrapText: true };

    // Ajuste de altura aproximado (exceljs no tiene autofit real)
    const approxCharsPerLineTop = 110;
    const linesTop = Math.max(1, Math.ceil(projectDesc.length / approxCharsPerLineTop));
    descRowTop.height = Math.min(300, 15 * linesTop + 6);
  }

  ws.addRow([]);

  const info1 = ws.addRow(["Proyecto", projectName]);
  ws.mergeCells(info1.number, 2, info1.number, 7);
  info1.getCell(1).font = { name: "Aptos Narrow", size: 11, bold: true };
  info1.getCell(2).font = { name: "Aptos Narrow", size: 10 };

  const info2 = ws.addRow(["Fecha", today]);
  ws.mergeCells(info2.number, 2, info2.number, 7);
  info2.getCell(1).font = { name: "Aptos Narrow", size: 11, bold: true };
  info2.getCell(2).font = { name: "Aptos Narrow", size: 10 };

  ws.addRow([]);

  // Header tabla
  const headerRow = ws.addRow([
    labels.chapter, labels.code, labels.description, labels.unit,
    labels.qty, labels.price + " (€)", labels.amount + " (€)"
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { name: "Aptos Narrow", size: 11, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    cell.border = borderThin;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  // Capítulos
  (model.chapters || []).forEach((cap) => {
    ws.addRow([]);

    const capRow = ws.addRow([String(cap.title || "").toUpperCase()]);
    ws.mergeCells(capRow.number, 1, capRow.number, 7);
    capRow.getCell(1).font = { name: "Aptos Narrow", size: 11, bold: true, color: { argb: "FF111827" } };
    capRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    capRow.getCell(1).border = borderThin;

    // Texto del capítulo debajo del título (ajuste de altura)
    const capDesc = String(cap.text || "").trim();
    if (capDesc) {
      const descRow = ws.addRow([capDesc]);
      ws.mergeCells(descRow.number, 1, descRow.number, 7);
      descRow.getCell(1).font = { name: "Aptos Narrow", size: 10, italic: true, color: { argb: "FF4B5563" } };
      descRow.getCell(1).alignment = { wrapText: true, vertical: "top" };
      descRow.getCell(1).border = borderThin;

      const approxCharsPerLine = 110;
      const lines = Math.max(1, Math.ceil(capDesc.length / approxCharsPerLine));
      descRow.height = Math.min(300, 15 * lines + 6);
    }

    (cap.lines || []).forEach((l) => {
      const r = ws.addRow([
        cap.title || "",
        l.code || "",
        l.description || "",
        l.unit || "Ud",
        safeNumber(l.qty),
        safeNumber(l.price),
        safeNumber(l.amount),
      ]);

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

    const subRow = ws.addRow([labels.subtotal, "", "", "", "", "", safeNumber(cap.subtotal)]);
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

  const totalRow = ws.addRow([labels.total, "", "", "", "", "", safeNumber(model.total)]);
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

// ------------------------
// Export PDF (usa print)
// ------------------------
function exportPrescripcionToPdf(model) {
  const language = model?.lang || appState.prescripcion.exportLang || "es";
  openPrescPrintWindow(model, language);
}

// ------------------------
// Exponer a window (para handlePrescExport)
// ------------------------
window.exportPrescripcionToExcel = exportPrescripcionToExcel;
window.exportPrescripcionToPdf = exportPrescripcionToPdf;
window.exportPrescripcionToBc3 = exportPrescripcionToBc3;

// (opcional útil para debug desde consola)
window.handlePrescExport = handlePrescExport;
window.buildPrescExportModel = buildPrescExportModel;
// ========================================================
// PARTE 11
// Bootstrap final de Prescripción
// ========================================================

(function initPrescripcionModule() {
  // Evita doble inicialización
  if (window.__prescInitialized) return;
  window.__prescInitialized = true;

  console.log("[PRESCRIPCIÓN] Inicializando módulo de prescripción");

  // Asegurar estructura base
  window.appState = window.appState || {};
  appState.prescripcion = appState.prescripcion || {};

  if (!Array.isArray(appState.prescripcion.capitulos)) {
    appState.prescripcion.capitulos = [];
  }

  if (!Array.isArray(appState.prescripcion.plantillas)) {
    appState.prescripcion.plantillas = [];
  }

  if (!Array.isArray(appState.prescripcion.extraRefs)) {
    appState.prescripcion.extraRefs = [];
  }

  appState.prescripcion.previewExpanded =
    appState.prescripcion.previewExpanded || {};

  // Render diferido: espera a que exista el contenedor
  function tryRenderPrescripcion() {
    const container =
      document.getElementById("appContent") ||
      document.getElementById("docAppContent") ||
      document.querySelector(".app-content");

    if (!container) return false;

    try {
      renderDocPrescripcionView();
      console.log("[PRESCRIPCIÓN] Vista renderizada correctamente");
      return true;
    } catch (e) {
      console.error("[PRESCRIPCIÓN] Error renderizando vista:", e);
      return false;
    }
  }

  // Intento inmediato
  if (tryRenderPrescripcion()) return;

  // Reintento con observer (navegación SPA)
  const obs = new MutationObserver(() => {
    if (tryRenderPrescripcion()) {
      obs.disconnect();
    }
  });

  obs.observe(document.body, {
    childList: true,
    subtree: true
  });
})();

// ========================================================
// FIN ARCHIVO ui_doc_prescripcion.js
// ========================================================
