// js/ui_doc_prescripcion.js
// Página de PRESCRIPCIÓN / MEDICIONES
// - 3 columnas: capítulos (izq), detalle (centro), plantillas de texto (dcha)
// - Plantillas de prescripción completas (estructura de capítulos) en Firestore: prescripcion_templates
// - Plantillas de texto de medición (videportero, accesos, monitores, etc.) en Firestore: prescripcion_bloques
// - Carga perezosa: solo una lectura por colección y sesión

window.appState = window.appState || {};
appState.documentacion = appState.documentacion || {
  mediaLibrary: [],
  mediaLoaded: false,
};

appState.prescripcion = appState.prescripcion || {
  capitulos: [],            // [{id, codigo, titulo, textoMedicion, partidas: [...] }]
  selectedCapId: null,
  templates: [],            // plantillas de estructura de capítulos
  templatesLoaded: false,
  textBlocks: [],           // plantillas de texto de medición (bloques)
  textBlocksLoaded: false,
};

// ==============================
// Helpers comunes
// ==============================

function getDocPrescripcionAppContent() {
  if (typeof window.getDocAppContent === "function") {
    return window.getDocAppContent();
  }
  if (typeof window.getAppContent === "function") {
    return window.getAppContent();
  }
  return document.getElementById("appContent");
}

function getFirestoreInstancePres() {
  return (
    window.db ||
    (window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore())
  );
}

function getAuthInstancePres() {
  return (
    window.auth ||
    (window.firebase &&
      window.firebase.auth &&
      window.firebase.auth())
  );
}

function ensurePrescripcionState() {
  appState.prescripcion = appState.prescripcion || {};
  const st = appState.prescripcion;
  st.capitulos = st.capitulos || [];
  st.templates = st.templates || [];
  st.textBlocks = st.textBlocks || [];
  if (!st.selectedCapId && st.capitulos.length > 0) {
    st.selectedCapId = st.capitulos[0].id;
  }
}

function createEmptyCapitulo() {
  const timestamp = Date.now();
  return {
    id: "cap_" + timestamp + "_" + Math.floor(Math.random() * 10000),
    codigo: "2N." + String((appState.prescripcion.capitulos.length + 1)).padStart(2, "0"),
    titulo: "Nuevo capítulo de prescripción",
    textoMedicion: "",
    partidas: [], // [{id, ref, desc, unidad, cantidad, pvp}]
  };
}

function createEmptyPartida() {
  return {
    id: "par_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
    ref: "",
    desc: "",
    unidad: "Ud",
    cantidad: 1,
    pvp: 0,
  };
}

// ==============================
// Plantillas de estructura (prescripcion_templates)
// ==============================

async function loadPresTemplatesIfNeeded() {
  ensurePrescripcionState();
  if (appState.prescripcion.templatesLoaded) return;

  const db = getFirestoreInstancePres();
  const auth = getAuthInstancePres();
  if (!db) {
    console.warn("[PRESCRIPCION] Firestore no disponible para plantillas.");
    return;
  }

  try {
    let query = db.collection("prescripcion_templates");
    if (auth && auth.currentUser) {
      query = query.where("uid", "==", auth.currentUser.uid);
    }

    const snap = await query.get();
    const templates = [];
    snap.forEach((doc) => {
      const data = doc.data() || {};
      templates.push({
        id: doc.id,
        name: data.name || "(sin nombre)",
        description: data.description || "",
        capitulos: Array.isArray(data.capitulos) ? data.capitulos : [],
        updatedAt: data.updatedAt || data.createdAt || null,
      });
    });

    appState.prescripcion.templates = templates;
    appState.prescripcion.templatesLoaded = true;
    console.log("[PRESCRIPCION] Plantillas de estructura cargadas:", templates.length);
  } catch (e) {
    console.error("[PRESCRIPCION] Error cargando plantillas:", e);
  }
}

async function saveCurrentPrescripcionAsTemplate() {
  ensurePrescripcionState();
  const db = getFirestoreInstancePres();
  const auth = getAuthInstancePres();

  if (!db) {
    alert("No se puede guardar la plantilla: Firestore no está disponible.");
    return;
  }

  const name = window.prompt("Nombre de la plantilla de prescripción (estructura de capítulos):");
  if (!name) return;

  const description =
    window.prompt("Descripción breve de la plantilla (opcional):") || "";

  const payload = {
    name: name.trim(),
    description: description.trim(),
    capitulos: appState.prescripcion.capitulos || [],
    uid: auth && auth.currentUser ? auth.currentUser.uid : null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    const docRef = await db.collection("prescripcion_templates").add(payload);
    const template = { id: docRef.id, ...payload };
    appState.prescripcion.templates.push(template);
    appState.prescripcion.templatesLoaded = true;
    alert("✅ Plantilla de estructura guardada correctamente.");
    renderDocPrescripcionView();
  } catch (e) {
    console.error("[PRESCRIPCION] Error guardando plantilla:", e);
    alert("Error al guardar la plantilla. Revisa la consola para más detalles.");
  }
}

function applyPresTemplateById(templateId) {
  ensurePrescripcionState();
  const tpl = (appState.prescripcion.templates || []).find(
    (t) => t.id === templateId
  );
  if (!tpl) {
    alert("No se ha encontrado la plantilla seleccionada.");
    return;
  }

  const clonedCaps = (tpl.capitulos || []).map((c, idx) => ({
    id:
      c.id ||
      "cap_tpl_" + idx + "_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
    codigo: c.codigo || "2N." + String(idx + 1).padStart(2, "0"),
    titulo: c.titulo || "Capítulo de plantilla",
    textoMedicion: c.textoMedicion || "",
    partidas: Array.isArray(c.partidas)
      ? c.partidas.map((p, j) => ({
          id:
            p.id ||
            "par_tpl_" +
              idx +
              "_" +
              j +
              "_" +
              Date.now() +
              "_" +
              Math.floor(Math.random() * 10000),
          ref: p.ref || "",
          desc: p.desc || "",
          unidad: p.unidad || "Ud",
          cantidad: typeof p.cantidad === "number" ? p.cantidad : 1,
          pvp: typeof p.pvp === "number" ? p.pvp : 0,
        }))
      : [],
  }));

  appState.prescripcion.capitulos = clonedCaps;
  appState.prescripcion.selectedCapId =
    clonedCaps.length > 0 ? clonedCaps[0].id : null;

  alert("✅ Plantilla de estructura aplicada a la prescripción actual.");
  renderDocPrescripcionView();
}

// ==============================
// Plantillas de texto (prescripcion_bloques)
// ==============================

async function loadPresTextBlocksIfNeeded() {
  ensurePrescripcionState();
  if (appState.prescripcion.textBlocksLoaded) return;

  const db = getFirestoreInstancePres();
  const auth = getAuthInstancePres();
  if (!db) {
    console.warn("[PRESCRIPCION] Firestore no disponible para bloques de texto.");
    return;
  }

  try {
    let query = db.collection("prescripcion_bloques");
    if (auth && auth.currentUser) {
      query = query.where("uid", "==", auth.currentUser.uid);
    }

    const snap = await query.get();
    const blocks = [];
    snap.forEach((doc) => {
      const data = doc.data() || {};
      blocks.push({
        id: doc.id,
        name: data.name || "(sin nombre)",
        category: data.category || "general", // ej: videoportero, accesos, monitores...
        texto: data.texto || "",
        updatedAt: data.updatedAt || data.createdAt || null,
      });
    });

    appState.prescripcion.textBlocks = blocks;
    appState.prescripcion.textBlocksLoaded = true;
    console.log("[PRESCRIPCION] Bloques de texto cargados:", blocks.length);
  } catch (e) {
    console.error("[PRESCRIPCION] Error cargando bloques de texto:", e);
  }
}

async function savePresTextTemplate(name, category, texto) {
  ensurePrescripcionState();
  const db = getFirestoreInstancePres();
  const auth = getAuthInstancePres();

  if (!db) {
    alert("No se puede guardar la plantilla de texto: Firestore no está disponible.");
    return;
  }

  const payload = {
    name: name.trim(),
    category: (category || "general").trim() || "general",
    texto: texto || "",
    uid: auth && auth.currentUser ? auth.currentUser.uid : null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    const docRef = await db.collection("prescripcion_bloques").add(payload);
    const block = { id: docRef.id, ...payload };
    appState.prescripcion.textBlocks.push(block);
    appState.prescripcion.textBlocksLoaded = true;
    alert("✅ Plantilla de texto guardada correctamente.");
    renderDocPrescripcionView();
  } catch (e) {
    console.error("[PRESCRIPCION] Error guardando plantilla de texto:", e);
    alert("Error al guardar la plantilla de texto. Revisa la consola para más detalles.");
  }
}

async function deletePresTextTemplate(blockId) {
  ensurePrescripcionState();
  const db = getFirestoreInstancePres();
  if (!db) {
    alert("No se puede borrar la plantilla de texto: Firestore no está disponible.");
    return;
  }

  try {
    await db.collection("prescripcion_bloques").doc(blockId).delete();
    appState.prescripcion.textBlocks = (appState.prescripcion.textBlocks || []).filter(
      (b) => b.id !== blockId
    );
    alert("✅ Plantilla de texto eliminada.");
    renderDocPrescripcionView();
  } catch (e) {
    console.error("[PRESCRIPCION] Error borrando plantilla de texto:", e);
    alert("Error al borrar la plantilla de texto. Revisa la consola para más detalles.");
  }
}

// ==============================
// Export (stubs) – siguiente hito
// ==============================

function exportPrescripcionPDF() {
  console.log("[PRESCRIPCION] Export PDF – pendiente de implementar");
  alert("Exportación PDF de mediciones se implementará en el siguiente hito.");
}

function exportPrescripcionBC3() {
  console.log("[PRESCRIPCION] Export BC3 – pendiente de implementar");
  alert("Exportación BC3 se implementará en el siguiente hito.");
}

// ==============================
// Render principal
// ==============================

async function renderDocPrescripcionView() {
  const container = getDocPrescripcionAppContent();
  if (!container) return;

  ensurePrescripcionState();
  await loadPresTemplatesIfNeeded();
  await loadPresTextBlocksIfNeeded();

  const state = appState.prescripcion;
  const capitulos = state.capitulos || [];
  const selectedId = state.selectedCapId;
  const selectedCap = capitulos.find((c) => c.id === selectedId) || null;

  // ===== Barra de plantillas de estructura (arriba) =====

  const templates = state.templates || [];
  const templatesOptions =
    templates.length > 0
      ? templates
          .map((t) => {
            const label = t.updatedAt
              ? `${t.name} (${new Date(t.updatedAt).toLocaleDateString()})`
              : t.name;
            return `<option value="${t.id}">${label}</option>`;
          })
          .join("")
      : "";

  const templatesBarHTML = `
    <div class="card" style="margin-bottom:0.75rem;">
      <div class="card-header">
        <div>
          <div class="card-title">Plantillas de prescripción (estructura)</div>
          <div class="card-subtitle">
            Guarda y reutiliza estructuras de capítulos de mediciones para futuros proyectos.
          </div>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button id="presBtnExportPDF" class="btn btn-xs btn-outline">📄 Exportar mediciones (PDF)</button>
          <button id="presBtnExportBC3" class="btn btn-xs btn-outline">📦 Exportar BC3</button>
        </div>
      </div>
      <div class="card-body">
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
          <div style="display:flex; flex-direction:column; min-width:220px;">
            <label style="font-size:0.8rem; color:#6b7280; margin-bottom:0.15rem;">Seleccionar plantilla</label>
            <div style="display:flex; gap:0.5rem;">
              <select id="presTemplateSelect" class="form-control" style="min-width:220px;">
                <option value="">(Sin plantilla)</option>
                ${templatesOptions}
              </select>
              <button id="presBtnApplyTemplate" class="btn btn-secondary btn-sm">Aplicar</button>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; min-width:200px;">
            <label style="font-size:0.8rem; color:#6b7280; margin-bottom:0.15rem;">Guardar prescripción actual</label>
            <button id="presBtnSaveTemplate" class="btn btn-primary btn-sm">
              💾 Guardar como plantilla de estructura
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // ===== Columna izquierda: Capítulos =====

  const capitulosListHTML =
    capitulos.length > 0
      ? capitulos
          .map((cap) => {
            const isActive = cap.id === selectedId;
            return `
              <div
                class="pres-capitulo-item ${isActive ? "active" : ""}"
                data-pres-cap-id="${cap.id}"
                style="
                  padding:0.45rem 0.6rem;
                  border-radius:0.35rem;
                  border:1px solid ${isActive ? "#0ea5e9" : "#e5e7eb"};
                  background:${isActive ? "#e0f2fe" : "#ffffff"};
                  cursor:pointer;
                  margin-bottom:0.4rem;
                "
              >
                <div style="font-size:0.8rem; font-weight:600; color:#0f172a;">
                  ${cap.codigo || ""} – ${cap.titulo || ""}
                </div>
                <div style="font-size:0.75rem; color:#6b7280; margin-top:0.1rem;">
                  ${
                    (cap.partidas && cap.partidas.length) || 0
                  } partidas · ${
              (cap.textoMedicion || "").length > 0 ? "Con texto" : "Sin texto"
            }
                </div>
              </div>
            `;
          })
          .join("")
      : `
        <p class="text-muted" style="font-size:0.85rem;">
          Aún no hay capítulos de prescripción. Crea uno nuevo para empezar a definir las mediciones.
        </p>
      `;

  // ===== Columna central: Detalle de capítulo =====

  let detalleHTML = "";
  if (!selectedCap) {
    detalleHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Detalle de capítulo</div>
            <div class="card-subtitle">
              Selecciona un capítulo en la columna izquierda o crea uno nuevo.
            </div>
          </div>
        </div>
        <div class="card-body">
          <p class="text-muted" style="font-size:0.9rem;">
            Cada capítulo debería corresponder a una sección del presupuesto (videportero, control de accesos,
            monitores, etc.). Aquí podrás definir el texto de medición y las referencias con PVP asociadas.
          </p>
        </div>
      </div>
    `;
  } else {
    const partidas = selectedCap.partidas || [];
    const partidasRowsHTML =
      partidas.length > 0
        ? partidas
            .map((p) => {
              const importe =
                (Number(p.cantidad) || 0) * (Number(p.pvp) || 0);
              return `
                <tr data-pres-partida-id="${p.id}">
                  <td>
                    <input
                      type="text"
                      class="form-control pres-input-ref"
                      value="${p.ref || ""}"
                      placeholder="1120101, IP Style, etc."
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      class="form-control pres-input-desc"
                      value="${p.desc || ""}"
                      placeholder="Descripción corta"
                    />
                  </td>
                  <td style="width:70px;">
                    <input
                      type="text"
                      class="form-control pres-input-unidad"
                      value="${p.unidad || "Ud"}"
                      style="text-align:center;"
                    />
                  </td>
                  <td style="width:80px;">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      class="form-control pres-input-cantidad"
                      value="${p.cantidad != null ? p.cantidad : 1}"
                      style="text-align:right;"
                    />
                  </td>
                  <td style="width:100px;">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      class="form-control pres-input-pvp"
                      value="${p.pvp != null ? p.pvp : 0}"
                      style="text-align:right;"
                    />
                  </td>
                  <td style="width:110px; text-align:right; font-variant-numeric:tabular-nums;">
                    ${importe.toFixed(2)} €
                  </td>
                  <td style="width:40px; text-align:center;">
                    <button type="button" class="btn btn-xs btn-outline pres-btn-del-partida">✖</button>
                  </td>
                </tr>
              `;
            })
            .join("")
        : `
          <tr>
            <td colspan="7" style="text-align:center; font-size:0.85rem; color:#6b7280;">
              No hay referencias añadidas en este capítulo.
            </td>
          </tr>
        `;

    detalleHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Detalle de capítulo</div>
            <div class="card-subtitle">
              Define el código, título, texto de medición y las partidas con PVP asociadas.
            </div>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button id="presBtnDeleteCap" class="btn btn-xs btn-outline">🗑️ Eliminar capítulo</button>
          </div>
        </div>
        <div class="card-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Código de capítulo</label>
              <input
                id="presCapCodigo"
                type="text"
                class="form-control"
                value="${selectedCap.codigo || ""}"
                placeholder="Ej. 2N.01, 2N.0101..."
              />
            </div>
            <div class="form-group">
              <label>Título de capítulo</label>
              <input
                id="presCapTitulo"
                type="text"
                class="form-control"
                value="${selectedCap.titulo || ""}"
                placeholder="Ej. Videportero y control de accesos"
              />
            </div>
          </div>

          <div class="form-group" style="margin-top:0.75rem;">
            <label>Texto de medición</label>
            <textarea
              id="presCapTexto"
              class="form-control"
              rows="8"
              placeholder="Describe aquí el sistema según lenguaje de mediciones para ingenierías..."
            >${selectedCap.textoMedicion || ""}</textarea>
            <p style="font-size:0.78rem; color:#6b7280; margin-top:0.25rem;">
              Puedes arrastrar y soltar bloques de texto desde la columna derecha o pulsar en “Insertar en texto”.
            </p>
          </div>

          <div style="margin-top:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
              <div style="font-weight:600; font-size:0.9rem; color:#111827;">
                Referencias y PVP asociados al capítulo
              </div>
              <div style="display:flex; gap:0.5rem;">
                <!-- Próximo hito: Importar desde presupuesto -->
                <button id="presBtnAddPartida" class="btn btn-xs btn-primary">
                  ➕ Añadir referencia
                </button>
              </div>
            </div>

            <div class="table-responsive" style="max-width:100%; overflow:auto;">
              <table class="table table-compact">
                <thead>
                  <tr>
                    <th style="min-width:140px;">Referencia / Código</th>
                    <th style="min-width:220px;">Descripción</th>
                    <th style="width:70px;">Ud</th>
                    <th style="width:80px; text-align:right;">Cant.</th>
                    <th style="width:100px; text-align:right;">PVP</th>
                    <th style="width:110px; text-align:right;">Importe</th>
                    <th style="width:40px;"></th>
                  </tr>
                </thead>
                <tbody id="presPartidasBody">
                  ${partidasRowsHTML}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ===== Columna derecha: Plantillas de texto (bloques) =====

  const textBlocks = state.textBlocks || [];
  const categoriesSet = new Set(
    textBlocks.map((b) => (b.category || "general").toLowerCase())
  );
  const categories = ["todas", ...Array.from(categoriesSet)];
  const categoryOptions = categories
    .map(
      (c) =>
        `<option value="${c}">${c === "todas" ? "Todas las categorías" : c}</option>`
    )
    .join("");

  const blocksListHTML =
    textBlocks.length > 0
      ? textBlocks
          .map((b) => {
            const cat = (b.category || "general").toLowerCase();
            const shortText =
              (b.texto || "").length > 140
                ? (b.texto || "").slice(0, 140) + "..."
                : b.texto || "";
            return `
              <div
                class="pres-block-item"
                data-pres-block-id="${b.id}"
                data-pres-block-cat="${cat}"
                draggable="true"
                style="
                  border:1px solid #e5e7eb;
                  border-radius:0.4rem;
                  padding:0.45rem 0.55rem;
                  margin-bottom:0.45rem;
                  background:#ffffff;
                  cursor:grab;
                "
              >
                <div style="display:flex; justify-content:space-between; gap:0.5rem; align-items:flex-start;">
                  <div>
                    <div style="font-size:0.78rem; font-weight:600; color:#0f172a;">
                      ${b.name || "(sin nombre)"}
                    </div>
                    <div style="font-size:0.7rem; color:#6b7280; margin-top:0.15rem;">
                      <span class="doc-gestion-pill">${cat}</span>
                    </div>
                  </div>
                  <div style="display:flex; flex-direction:column; gap:0.25rem; align-items:flex-end;">
                    <button
                      type="button"
                      class="btn btn-xs btn-outline pres-block-insert-btn"
                      title="Insertar en el texto de medición"
                    >
                      ⤵ Insertar
                    </button>
                    <button
                      type="button"
                      class="btn btn-xs btn-ghost pres-block-delete-btn"
                      title="Eliminar plantilla de texto"
                    >
                      ✖
                    </button>
                  </div>
                </div>
                <div style="font-size:0.74rem; color:#374151; margin-top:0.35rem; white-space:pre-wrap;">
                  ${shortText}
                </div>
              </div>
            `;
          })
          .join("")
      : `
        <p class="text-muted" style="font-size:0.85rem;">
          Todavía no has creado plantillas de texto. Usa el botón
          <strong>“Nueva plantilla de texto”</strong> para guardar textos tipo
          de videportero, control de accesos, monitores, etc.
        </p>
      `;

  const rightColumnHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Plantillas de texto de prescripción</div>
          <div class="card-subtitle">
            Textos tipo para videportero, control de accesos, monitores, etc. Arrastra o inserta sobre el capítulo.
          </div>
        </div>
        <div>
          <button id="presBtnNewTextTpl" class="btn btn-xs btn-primary">
            ➕ Nueva plantilla de texto
          </button>
        </div>
      </div>
      <div class="card-body">
        <div style="margin-bottom:0.5rem;">
          <label style="font-size:0.78rem; color:#6b7280; margin-bottom:0.15rem; display:block;">
            Filtrar por categoría
          </label>
          <select id="presBlocksFilter" class="form-control" style="max-width:100%;">
            ${categoryOptions}
          </select>
        </div>

        <div id="presBlocksList">
          ${blocksListHTML}
        </div>
      </div>
    </div>
  `;

  // ===== Modal flotante para nueva plantilla de texto =====

  const modalHTML = `
    <div
      id="presTextTplModal"
      style="
        position:fixed;
        inset:0;
        background:rgba(15,23,42,0.45);
        display:none;
        align-items:center;
        justify-content:center;
        z-index:9999;
      "
    >
      <div
        style="
          background:#ffffff;
          border-radius:0.75rem;
          max-width:640px;
          width:100%;
          margin:1rem;
          box-shadow:0 20px 40px rgba(15,23,42,0.35);
        "
      >
        <div style="padding:0.9rem 1rem 0.6rem; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600; font-size:0.95rem; color:#111827;">Nueva plantilla de texto</div>
            <div style="font-size:0.8rem; color:#6b7280;">
              Guarda un texto tipo para reutilizarlo en las mediciones (videportero, control de accesos, monitores, etc.).
            </div>
          </div>
          <button id="presTplCloseX" class="btn btn-xs btn-ghost" style="font-size:1rem;">✖</button>
        </div>

        <div style="padding:0.9rem 1rem 0.75rem;">
          <div class="form-group">
            <label>Nombre de la plantilla</label>
            <input
              id="presTplName"
              type="text"
              class="form-control"
              placeholder="Ej. Videportero IP Style – Pliego base"
            />
          </div>

          <div class="form-group">
            <label>Categoría</label>
            <input
              id="presTplCategory"
              type="text"
              class="form-control"
              placeholder="Ej. videoportero, accesos, monitores..."
            />
            <p style="font-size:0.75rem; color:#6b7280; margin-top:0.15rem;">
              La categoría te ayudará a filtrar (ej. “videoportero”, “control accesos”, “monitores vivienda”).
            </p>
          </div>

          <div class="form-group">
            <label>Texto de medición</label>
            <textarea
              id="presTplTexto"
              class="form-control"
              rows="8"
              placeholder="Introduce aquí el texto técnico/comercial de la medición..."
            ></textarea>
          </div>
        </div>

        <div style="padding:0.75rem 1rem 0.9rem; border-top:1px solid #e5e7eb; display:flex; justify-content:flex-end; gap:0.5rem;">
          <button id="presTplCancelBtn" class="btn btn-secondary btn-sm">Cancelar</button>
          <button id="presTplSaveBtn" class="btn btn-primary btn-sm">Guardar plantilla de texto</button>
        </div>
      </div>
    </div>
  `;

  // ===== Montar todo =====

  container.innerHTML = `
    ${modalHTML}

    <div class="proyecto-layout" style="display:flex; flex-direction:column; gap:0.75rem;">
      ${templatesBarHTML}

      <div
        style="
          display:grid;
          grid-template-columns: minmax(240px, 0.8fr) minmax(360px, 1.4fr) minmax(260px, 1.1fr);
          gap:1rem;
          align-items:flex-start;
        "
      >
        <!-- Columna izquierda: Capítulos -->
        <div>
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Capítulos de prescripción</div>
                <div class="card-subtitle">
                  Cada capítulo puede corresponder a una sección del presupuesto (videportero, accesos, monitores...).
                </div>
              </div>
              <div style="display:flex; gap:0.5rem;">
                <button id="presBtnAddCap" class="btn btn-xs btn-primary">➕ Nuevo capítulo</button>
              </div>
            </div>
            <div class="card-body">
              ${capitulosListHTML}
            </div>
          </div>
        </div>

        <!-- Columna central: Detalle del capítulo -->
        <div>
          ${detalleHTML}
        </div>

        <!-- Columna derecha: Plantillas de texto -->
        <div>
          ${rightColumnHTML}
        </div>
      </div>
    </div>
  `;

  attachDocPrescripcionHandlers();
}

// ==============================
// Handlers
// ==============================

function attachDocPrescripcionHandlers() {
  const container = getDocPrescripcionAppContent();
  if (!container) return;

  const state = appState.prescripcion;
  const capitulos = state.capitulos || [];
  const selectedId = state.selectedCapId;
  const selectedCapIndex = capitulos.findIndex((c) => c.id === selectedId);
  const selectedCap =
    selectedCapIndex >= 0 ? capitulos[selectedCapIndex] : null;

  // ---- Botones barra superior (estructura) ----

  const btnSaveTpl = container.querySelector("#presBtnSaveTemplate");
  if (btnSaveTpl) {
    btnSaveTpl.addEventListener("click", () => {
      saveCurrentPrescripcionAsTemplate().catch((e) =>
        console.error("Error guardando plantilla:", e)
      );
    });
  }

  const btnApplyTpl = container.querySelector("#presBtnApplyTemplate");
  if (btnApplyTpl) {
    btnApplyTpl.addEventListener("click", () => {
      const select = container.querySelector("#presTemplateSelect");
      const tplId = select ? select.value : "";
      if (!tplId) {
        alert("Selecciona una plantilla antes de aplicar.");
        return;
      }
      applyPresTemplateById(tplId);
    });
  }

  const btnExportPDF = container.querySelector("#presBtnExportPDF");
  if (btnExportPDF) {
    btnExportPDF.addEventListener("click", () => {
      exportPrescripcionPDF();
    });
  }

  const btnExportBC3 = container.querySelector("#presBtnExportBC3");
  if (btnExportBC3) {
    btnExportBC3.addEventListener("click", () => {
      exportPrescripcionBC3();
    });
  }

  // ---- Añadir / seleccionar capítulo ----

  const btnAddCap = container.querySelector("#presBtnAddCap");
  if (btnAddCap) {
    btnAddCap.addEventListener("click", () => {
      const newCap = createEmptyCapitulo();
      capitulos.push(newCap);
      state.capitulos = capitulos;
      state.selectedCapId = newCap.id;
      renderDocPrescripcionView();
    });
  }

  container
    .querySelectorAll("[data-pres-cap-id]")
    .forEach((item) => {
      item.addEventListener("click", () => {
        const capId = item.getAttribute("data-pres-cap-id");
        if (!capId) return;
        state.selectedCapId = capId;
        renderDocPrescripcionView();
      });
    });

  if (!selectedCap) {
    // No hay capítulo seleccionado → nada más que hacer
    setupTextBlocksHandlers(container, null);
    setupTextTemplateModalHandlers(container);
    return;
  }

  // ---- Eliminar capítulo ----

  const btnDeleteCap = container.querySelector("#presBtnDeleteCap");
  if (btnDeleteCap) {
    btnDeleteCap.addEventListener("click", () => {
      const ok = window.confirm(
        "¿Seguro que quieres eliminar este capítulo de prescripción?"
      );
      if (!ok) return;

      const newCaps = capitulos.filter((c) => c.id !== selectedCap.id);
      state.capitulos = newCaps;
      state.selectedCapId = newCaps[0] ? newCaps[0].id : null;
      renderDocPrescripcionView();
    });
  }

  // ---- Código / título / texto del capítulo ----

  const inputCodigo = container.querySelector("#presCapCodigo");
  if (inputCodigo) {
    inputCodigo.addEventListener("input", () => {
      selectedCap.codigo = inputCodigo.value;
    });
  }

  const inputTitulo = container.querySelector("#presCapTitulo");
  if (inputTitulo) {
    inputTitulo.addEventListener("input", () => {
      selectedCap.titulo = inputTitulo.value;
    });
  }

  const inputTexto = container.querySelector("#presCapTexto");
  if (inputTexto) {
    inputTexto.addEventListener("input", () => {
      selectedCap.textoMedicion = inputTexto.value;
    });
  }

  // ---- Partidas del capítulo ----

  const btnAddPartida = container.querySelector("#presBtnAddPartida");
  if (btnAddPartida) {
    btnAddPartida.addEventListener("click", () => {
      const newPar = createEmptyPartida();
      selectedCap.partidas = selectedCap.partidas || [];
      selectedCap.partidas.push(newPar);
      renderDocPrescripcionView();
    });
  }

  const tbody = container.querySelector("#presPartidasBody");
  if (tbody) {
    tbody.querySelectorAll("tr[data-pres-partida-id]").forEach((row) => {
      const parId = row.getAttribute("data-pres-partida-id");
      const partida =
        selectedCap.partidas &&
        selectedCap.partidas.find((p) => p.id === parId);
      if (!partida) return;

      const inputRef = row.querySelector(".pres-input-ref");
      const inputDesc = row.querySelector(".pres-input-desc");
      const inputUnidad = row.querySelector(".pres-input-unidad");
      const inputCant = row.querySelector(".pres-input-cantidad");
      const inputPvp = row.querySelector(".pres-input-pvp");
      const btnDel = row.querySelector(".pres-btn-del-partida");

      if (inputRef) {
        inputRef.addEventListener("input", () => {
          partida.ref = inputRef.value;
        });
      }
      if (inputDesc) {
        inputDesc.addEventListener("input", () => {
          partida.desc = inputDesc.value;
        });
      }
      if (inputUnidad) {
        inputUnidad.addEventListener("input", () => {
          partida.unidad = inputUnidad.value;
        });
      }
      if (inputCant) {
        inputCant.addEventListener("input", () => {
          partida.cantidad = Number(inputCant.value) || 0;
        });
      }
      if (inputPvp) {
        inputPvp.addEventListener("input", () => {
          partida.pvp = Number(inputPvp.value) || 0;
        });
      }
      if (btnDel) {
        btnDel.addEventListener("click", () => {
          const ok = window.confirm(
            "¿Eliminar esta referencia del capítulo?"
          );
          if (!ok) return;
          selectedCap.partidas = (selectedCap.partidas || []).filter(
            (p) => p.id !== parId
          );
          renderDocPrescripcionView();
        });
      }
    });
  }

  // ---- Bloques de texto (columna derecha) ----

  setupTextBlocksHandlers(container, inputTexto);
  setupTextTemplateModalHandlers(container);
}

// ==============================
// Handlers: bloques de texto + modal
// ==============================

function setupTextBlocksHandlers(container, capTextoTextarea) {
  const filterSelect = container.querySelector("#presBlocksFilter");
  const blocksContainer = container.querySelector("#presBlocksList");
  const blocks = appState.prescripcion.textBlocks || [];

  // Filtrado por categoría
  if (filterSelect && blocksContainer) {
    filterSelect.addEventListener("change", () => {
      const catFilter = filterSelect.value || "todas";
      blocksContainer
        .querySelectorAll(".pres-block-item")
        .forEach((item) => {
          const cat = item.getAttribute("data-pres-block-cat") || "general";
          if (
            catFilter === "todas" ||
            catFilter === "" ||
            cat === catFilter
          ) {
            item.style.display = "";
          } else {
            item.style.display = "none";
          }
        });
    });
  }

  // Insertar / eliminar / drag & drop
  if (!blocksContainer) return;

  blocksContainer
    .querySelectorAll(".pres-block-item")
    .forEach((item) => {
      const blockId = item.getAttribute("data-pres-block-id");
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;

      const insertBtn = item.querySelector(".pres-block-insert-btn");
      const deleteBtn = item.querySelector(".pres-block-delete-btn");

      if (insertBtn && capTextoTextarea) {
        insertBtn.addEventListener("click", () => {
          const current = capTextoTextarea.value || "";
          const separator =
            current && !current.endsWith("\n") ? "\n\n" : "";
          capTextoTextarea.value = current + separator + (block.texto || "");
          capTextoTextarea.dispatchEvent(new Event("input"));
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          const ok = window.confirm(
            "¿Eliminar esta plantilla de texto de forma permanente?"
          );
          if (!ok) return;
          deletePresTextTemplate(blockId).catch((e) =>
            console.error("Error borrando plantilla de texto:", e)
          );
        });
      }

      // Drag & drop de texto
      item.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("text/plain", block.texto || "");
        ev.dataTransfer.effectAllowed = "copy";
      });
    });

  // Zona de drop en el textarea
  if (capTextoTextarea) {
    capTextoTextarea.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "copy";
    });
    capTextoTextarea.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const text = ev.dataTransfer.getData("text/plain") || "";
      if (!text) return;
      const current = capTextoTextarea.value || "";
      const separator = current && !current.endsWith("\n") ? "\n\n" : "";
      capTextoTextarea.value = current + separator + text;
      capTextoTextarea.dispatchEvent(new Event("input"));
    });
  }

  // Botón Nueva plantilla de texto
  const btnNewTextTpl = container.querySelector("#presBtnNewTextTpl");
  if (btnNewTextTpl) {
    btnNewTextTpl.addEventListener("click", () => {
      const modal = container.querySelector("#presTextTplModal");
      if (modal) {
        modal.style.display = "flex";
        const nameInput = modal.querySelector("#presTplName");
        if (nameInput) nameInput.focus();
      }
    });
  }
}

function setupTextTemplateModalHandlers(container) {
  const modal = container.querySelector("#presTextTplModal");
  if (!modal) return;

  const close = () => {
    modal.style.display = "none";
  };

  const inputName = modal.querySelector("#presTplName");
  const inputCat = modal.querySelector("#presTplCategory");
  const inputTexto = modal.querySelector("#presTplTexto");

  const btnCloseX = modal.querySelector("#presTplCloseX");
  const btnCancel = modal.querySelector("#presTplCancelBtn");
  const btnSave = modal.querySelector("#presTplSaveBtn");

  if (btnCloseX) btnCloseX.addEventListener("click", close);
  if (btnCancel) btnCancel.addEventListener("click", close);

  if (btnSave) {
    btnSave.addEventListener("click", () => {
      const name = (inputName && inputName.value) || "";
      const cat = (inputCat && inputCat.value) || "";
      const txt = (inputTexto && inputTexto.value) || "";

      if (!name.trim()) {
        alert("Introduce un nombre para la plantilla de texto.");
        return;
      }
      if (!txt.trim()) {
        alert("Introduce un texto para la plantilla.");
        return;
      }

      savePresTextTemplate(name, cat, txt).catch((e) =>
        console.error("Error guardando plantilla de texto:", e)
      );
      // El propio render posterior cerrará el modal, pero lo cerramos por UX inmediata
      close();
    });
  }

  // Cerrar modal si se hace click fuera
  modal.addEventListener("click", (ev) => {
    if (ev.target === modal) {
      close();
    }
  });
}

console.log(
  "%cUI Prescripción / Mediciones inicializada (ui_doc_prescripcion.js)",
  "color:#22c55e; font-weight:600;"
);
