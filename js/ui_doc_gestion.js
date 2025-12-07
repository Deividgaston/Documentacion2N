// js/ui_doc_gestion.js
// Página de GESTIÓN DE DOCUMENTACIÓN:
// CRUD de ficheros (subir, editar metadatos, borrar) sobre documentacion_media
// Reutiliza helpers de ui_documentacion.js cuando existen (ensureDocMediaLoaded,
// saveMediaFileToStorageAndFirestore, saveDocStateToLocalStorage).

window.appState = window.appState || {};
appState.documentacion = appState.documentacion || {
  mediaLibrary: [],
  mediaLoaded: false,
};

// Helper común del proyecto: usamos el mismo contenedor que el resto de vistas
function getDocGestionAppContent() {
  if (typeof window.getDocAppContent === "function") {
    return window.getDocAppContent();
  }
  if (typeof window.getAppContent === "function") {
    return window.getAppContent();
  }
  return document.getElementById("appContent");
}

// ==============================
// Helpers de datos
// ==============================

// Guardar estado de documentación en localStorage si existe el helper
function persistDocStateSafe() {
  if (typeof window.saveDocStateToLocalStorage === "function") {
    try {
      window.saveDocStateToLocalStorage();
    } catch (e) {
      console.error(
        "Error guardando estado de documentación en localStorage:",
        e
      );
    }
  }
}

// Actualizar metadatos de un documento en Firestore + estado local
async function updateDocMediaMetaById(mediaId, updates) {
  if (!mediaId || !updates || typeof updates !== "object") return;

  appState.documentacion.mediaLibrary =
    appState.documentacion.mediaLibrary || [];
  const mediaLib = appState.documentacion.mediaLibrary;
  const idx = mediaLib.findIndex((m) => m.id === mediaId);
  if (idx === -1) return;

  const current = mediaLib[idx];
  const updated = { ...current, ...updates };
  mediaLib[idx] = updated;
  appState.documentacion.mediaLibrary = mediaLib;

  // Guardar en localStorage
  persistDocStateSafe();

  // Actualizar en Firestore (sin lecturas nuevas, solo update directo)
  const db =
    window.db ||
    (window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore());
  if (!db) return;

  try {
    await db.collection("documentacion_media").doc(mediaId).update(updates);
  } catch (e) {
    console.error("Error actualizando metadatos de documentación en Firestore:", e);
  }
}

// BORRADO COMPLETO: Storage + Firestore + estado local
async function deleteDocMediaById(mediaId) {
  if (!mediaId) return false;

  appState.documentacion.mediaLibrary =
    appState.documentacion.mediaLibrary || [];
  const mediaLib = appState.documentacion.mediaLibrary;
  const idx = mediaLib.findIndex((m) => m.id === mediaId);
  const item = idx !== -1 ? mediaLib[idx] : null;

  const storagePath = item && item.storagePath ? item.storagePath : null;

  // 1) Borrar en Storage (si tenemos path)
  try {
    const storage =
      window.storage ||
      (window.firebase &&
        window.firebase.storage &&
        window.firebase.storage());

    if (storage && storagePath) {
      const ref = storage.ref(storagePath);
      await ref.delete();
    }
  } catch (e) {
    // Si ya no existe en Storage, no pasa nada; lo importante es limpiar Firestore + estado
    console.warn("Error borrando archivo en Storage (puede no existir):", e);
  }

  // 2) Borrar en Firestore (metadatos)
  try {
    const db =
      window.db ||
      (window.firebase &&
        window.firebase.firestore &&
        window.firebase.firestore());
    if (db) {
      await db.collection("documentacion_media").doc(mediaId).delete();
    }
  } catch (e) {
    console.error("Error borrando documento de documentación en Firestore:", e);
  }

  // 3) Quitar de estado local (mediaLibrary) y guardar en localStorage
  if (idx !== -1) {
    mediaLib.splice(idx, 1);
    appState.documentacion.mediaLibrary = mediaLib;
    persistDocStateSafe();
  }

  return true;
}

// ==============================
// Render principal
// ==============================

function renderDocGestionView() {
  const container = getDocGestionAppContent();
  if (!container) return;

  // Una sola lectura a Firestore por sesión: usamos el helper existente
  if (typeof window.ensureDocMediaLoaded === "function") {
    try {
      window.ensureDocMediaLoaded();
    } catch (e) {
      console.error("Error al asegurar carga de media de documentación:", e);
    }
  }

  const media = appState.documentacion.mediaLibrary || [];

  // Agrupación por tipo de documento
  const grouped = {
    ficha: [],
    declaracion: [],
    imagen: [],
    certificado: [],
    otros: [],
  };

  media.forEach((m) => {
    const cat = (m.docCategory || "").toLowerCase();
    if (cat === "ficha") {
      grouped.ficha.push(m);
    } else if (cat === "declaracion") {
      grouped.declaracion.push(m);
    } else if (cat === "imagen") {
      grouped.imagen.push(m);
    } else if (cat === "certificado") {
      grouped.certificado.push(m);
    } else {
      grouped.otros.push(m);
    }
  });

  function renderGroup(title, list) {
    if (!list || !list.length) {
      return `
        <div class="doc-gestion-group">
          <div class="doc-gestion-group-title">${title}</div>
          <p class="text-muted" style="font-size:0.8rem; margin:0.25rem 0 0.75rem;">
            No hay documentos en esta categoría.
          </p>
        </div>
      `;
    }

    const rows = list
      .map((m) => {
        const isImage =
          m.type === "image" || (m.mimeType || "").startsWith("image/");
        const icon = isImage ? "🖼️" : "📄";
        const nombre = m.nombre || "(sin nombre)";
        const carpeta = m.folderName || "";
        const tipo = m.docCategory || "";
        const mime = m.mimeType || "";

        return `
          <div class="doc-gestion-row" data-doc-media-id="${m.id}">
            <div class="doc-gestion-main">
              <div class="doc-gestion-name">
                ${icon} ${nombre}
              </div>
              <div class="doc-gestion-meta">
                ${
                  carpeta
                    ? `<span class="doc-gestion-pill">${carpeta}</span>`
                    : ""
                }
                ${
                  tipo
                    ? `<span class="doc-gestion-pill">Tipo: ${tipo}</span>`
                    : ""
                }
                ${
                  mime
                    ? `<span class="doc-gestion-pill">${mime}</span>`
                    : ""
                }
              </div>
            </div>
            <div class="doc-gestion-actions">
              <button
                type="button"
                class="btn btn-xs btn-outline"
                data-doc-media-edit="${m.id}"
              >
                ✏️ Editar
              </button>
              <button
                type="button"
                class="btn btn-xs"
                data-doc-media-delete="${m.id}"
              >
                🗑️ Borrar
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="doc-gestion-group">
        <div class="doc-gestion-group-title">${title}</div>
        <div class="doc-gestion-list">
          ${rows}
        </div>
      </div>
    `;
  }

  const gruposHTML = `
    ${renderGroup("Fichas técnicas", grouped.ficha)}
    ${renderGroup("Declaración de conformidad", grouped.declaracion)}
    ${renderGroup("Imágenes", grouped.imagen)}
    ${renderGroup("Certificados", grouped.certificado)}
    ${
      grouped.otros && grouped.otros.length
        ? renderGroup("Otros", grouped.otros)
        : ""
    }
  `;

  container.innerHTML = `
    <div class="proyecto-layout">
      <!-- Card de gestión / subida -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Gestión de documentación</div>
            <div class="card-subtitle">
              Sube, clasifica y organiza los documentos del proyecto en cuatro categorías:
              fichas técnicas, declaración de conformidad, imágenes y certificados.
            </div>
          </div>
          <span class="chip">Documentación</span>
        </div>

        <div class="card-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Tipo de documento</label>
              <select id="docGestionTypeSelect" class="form-control">
                <option value="ficha">Fichas técnicas</option>
                <option value="declaracion">Declaración de conformidad</option>
                <option value="imagen">Imágenes</option>
                <option value="certificado">Certificados</option>
              </select>
            </div>

            <div class="form-group">
              <label>Carpeta / Descripción</label>
              <input
                type="text"
                id="docGestionFolderInput"
                class="form-control"
                placeholder="Ej. IP Style, Certificados CE, Declaración 2025..."
              />
            </div>

            <div class="form-group">
              <label>Archivos</label>
              <input
                type="file"
                id="docGestionFileInput"
                multiple
                class="form-control"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              />
              <p style="font-size:0.78rem; color:#6b7280; margin-top:0.25rem;">
                Puedes seleccionar varios archivos a la vez. Se subirán a la categoría seleccionada.
              </p>
            </div>
          </div>

          <div style="margin-top:0.75rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button id="docGestionUploadBtn" class="btn btn-primary">
              ⬆️ Subir documentación
            </button>
          </div>
        </div>
      </div>

      <!-- Card de listado -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Documentos subidos</div>
            <div class="card-subtitle">
              Revisa, edita el tipo o carpeta y elimina documentos. Los cambios afectan
              a toda la app (memoria de calidades incluida).
            </div>
          </div>
        </div>
        <div class="card-body">
          ${
            media.length
              ? gruposHTML
              : `
            <p class="text-muted" style="font-size:0.85rem;">
              Todavía no hay documentos subidos. Usa el formulario anterior para añadirlos.
            </p>
          `
          }
        </div>
      </div>
    </div>
  `;

  attachDocGestionHandlers();
}

// ==============================
// Handlers
// ==============================

function attachDocGestionHandlers() {
  const container = getDocGestionAppContent();
  if (!container) return;

  const uploadBtn = container.querySelector("#docGestionUploadBtn");
  if (uploadBtn) {
    uploadBtn.addEventListener("click", async () => {
      const typeSelect = container.querySelector("#docGestionTypeSelect");
      const folderInput = container.querySelector("#docGestionFolderInput");
      const fileInput = container.querySelector("#docGestionFileInput");

      if (!fileInput || !fileInput.files || !fileInput.files.length) {
        alert("Selecciona al menos un archivo para subir.");
        return;
      }

      const docCategory = typeSelect ? typeSelect.value : "imagen";
      const folderName = (folderInput?.value || "").trim();
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;

      if (typeof window.saveMediaFileToStorageAndFirestore !== "function") {
        console.error(
          "saveMediaFileToStorageAndFirestore no está disponible (ui_documentacion.js)."
        );
        return;
      }

      const newItems = [];
      for (const file of files) {
        try {
          const media = await window.saveMediaFileToStorageAndFirestore(file, {
            folderName,
            docCategory,
          });
          newItems.push(media);
        } catch (e) {
          console.error("Error subiendo archivo de documentación (gestión):", e);
        }
      }

      if (newItems.length) {
        appState.documentacion.mediaLibrary = newItems.concat(
          appState.documentacion.mediaLibrary || []
        );
        persistDocStateSafe();
      }

      if (fileInput) {
        fileInput.value = "";
      }

      // Re-render solo esta vista
      renderDocGestionView();
    });
  }

  // Borrado de documentos (usa la función buena: Storage + Firestore + estado local)
  container.querySelectorAll("[data-doc-media-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-doc-media-delete");
      if (!id) return;

      const ok = window.confirm("¿Seguro que quieres borrar este documento?");
      if (!ok) return;

      await deleteDocMediaById(id);
      renderDocGestionView();
    });
  });

  // Edición de metadatos (tipo + carpeta) con prompts sencillos
  container.querySelectorAll("[data-doc-media-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-doc-media-edit");
      if (!id) return;

      const mediaLib = appState.documentacion.mediaLibrary || [];
      const item = mediaLib.find((m) => m.id === id);
      if (!item) return;

      const currentFolder = item.folderName || "";
      const currentCat = item.docCategory || "";

      const newFolder = window.prompt(
        "Nueva carpeta / descripción:",
        currentFolder
      );
      if (newFolder === null) return; // cancelado

      const newCat = window.prompt(
        'Nuevo tipo (ficha / declaracion / imagen / certificado):',
        currentCat || "ficha"
      );
      if (newCat === null) return; // cancelado

      const trimmedFolder = newFolder.trim();
      const trimmedCat = newCat.trim().toLowerCase();

      await updateDocMediaMetaById(id, {
        folderName: trimmedFolder,
        docCategory: trimmedCat,
      });

      renderDocGestionView();
    });
  });
}

console.log(
  "%cUI Gestión de documentación inicializada (ui_doc_gestion.js)",
  "color:#06b6d4; font-weight:600;"
);
