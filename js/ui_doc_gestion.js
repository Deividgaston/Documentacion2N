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

// Helper: para GESTIÓN usamos SIEMPRE el contenedor ancho general
function getDocGestionAppContent() {
  if (typeof window.getAppContent === "function") {
    return window.getAppContent();
  }
  return document.getElementById("appContent");
}

// ==============================
// Helpers de datos / estado
// ==============================

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

// Cargar documentación para la vista de gestión desde Firestore
async function loadDocMediaForGestion() {
  appState.documentacion = appState.documentacion || {};
  appState.documentacion.mediaLibrary =
    appState.documentacion.mediaLibrary || [];

  if (typeof window.ensureDocMediaLoaded === "function") {
    try {
      const maybePromise = window.ensureDocMediaLoaded();
      if (maybePromise && typeof maybePromise.then === "function") {
        await maybePromise;
      }
    } catch (e) {
      console.error("Error al asegurar carga de media de documentación:", e);
    }
  }
}

// ==============================
// Firestore / Storage helpers
// ==============================

function getFirestoreInstance() {
  return (
    window.db ||
    (window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore())
  );
}

function getStorageInstance() {
  return (
    window.storage ||
    (window.firebase &&
      window.firebase.storage &&
      window.firebase.storage())
  );
}

function getAuthInstance() {
  return (
    window.auth ||
    (window.firebase &&
      window.firebase.auth &&
      window.firebase.auth())
  );
}

// ==============================
// UPDATE METADATOS
// ==============================

async function updateDocMediaMetaById(mediaId, updates) {
  if (!mediaId || !updates || typeof updates !== "object") return;

  appState.documentacion.mediaLibrary =
    appState.documentacion.mediaLibrary || [];
  const mediaLib = appState.documentacion.mediaLibrary;
  const idx = mediaLib.findIndex((m) => m.id === mediaId);
  if (idx !== -1) {
    const current = mediaLib[idx];
    const updated = { ...current, ...updates };
    mediaLib[idx] = updated;
    appState.documentacion.mediaLibrary = mediaLib;
  }

  persistDocStateSafe();

  const db = getFirestoreInstance();
  if (!db) return;

  try {
    await db.collection("documentacion_media").doc(mediaId).update(updates);
    console.log("[DOC-GESTION] Metadatos actualizados en Firestore:", mediaId);
  } catch (e) {
    console.error(
      "Error actualizando metadatos de documentación en Firestore:",
      e
    );
  }
}

// ==============================
// BORRADO INDIVIDUAL
// ==============================

async function deleteDocMediaById(mediaId) {
  if (!mediaId) return false;

  const db = getFirestoreInstance();
  const storage = getStorageInstance();

  if (!db) {
    console.warn(
      "[DOC-GESTION] No hay instancia de Firestore, no se puede borrar:",
      mediaId
    );
    return false;
  }

  let storagePath = null;

  // 1) Leer el documento para obtener storagePath (no dependemos del estado local)
  try {
    const docRef = db.collection("documentacion_media").doc(mediaId);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data() || {};
      storagePath = data.storagePath || null;
    } else {
      console.warn(
        "[DOC-GESTION] Documento a borrar no existe en Firestore:",
        mediaId
      );
    }
  } catch (e) {
    console.error(
      "[DOC-GESTION] Error leyendo documento antes de borrar:",
      mediaId,
      e
    );
  }

  // 2) Borrar en Storage si tenemos ruta
  if (storage && storagePath) {
    try {
      await storage.ref().child(storagePath).delete();
      console.log(
        "[DOC-GESTION] Archivo borrado en Storage:",
        storagePath,
        "(id:",
        mediaId,
        ")"
      );
    } catch (e) {
      console.warn(
        "[DOC-GESTION] Error borrando archivo en Storage (puede no existir):",
        storagePath,
        e
      );
    }
  }

  // 3) Borrar documento en Firestore
  try {
    await db.collection("documentacion_media").doc(mediaId).delete();
    console.log("[DOC-GESTION] Documento borrado en Firestore:", mediaId);
  } catch (e) {
    console.error(
      "[DOC-GESTION] Error borrando documento en Firestore:",
      mediaId,
      e
    );
  }

  // 4) Limpiar estado local
  appState.documentacion.mediaLibrary =
    (appState.documentacion.mediaLibrary || []).filter(
      (m) => m.id !== mediaId
    );

  const map = appState.documentacion.sectionMedia || {};
  Object.keys(map).forEach((sec) => {
    const arr = map[sec] || [];
    map[sec] = arr.filter((id) => id !== mediaId);
  });
  appState.documentacion.sectionMedia = map;

  const sel = appState.documentacion.selectedFichasMediaIds || [];
  appState.documentacion.selectedFichasMediaIds = sel.filter(
    (id) => id !== mediaId
  );

  persistDocStateSafe();

  return true;
}

// ==============================
// BORRADO MASIVO
// ==============================

async function deleteAllDocMedia() {
  const confirmText =
    "⚠️ Esto borrará TODOS los documentos de documentación (imágenes, fichas, certificados, etc.)\n\n" +
    "Se eliminarán de Firestore, de Storage y de la memoria de calidades.\n\n" +
    "¿Quieres continuar?";
  const ok = window.confirm(confirmText);
  if (!ok) return;

  const db = getFirestoreInstance();
  const storage = getStorageInstance();
  const auth = getAuthInstance();

  if (!db) {
    alert("No se ha podido acceder a Firestore para borrar la documentación.");
    return;
  }

  let uid = null;
  if (auth && auth.currentUser) {
    uid = auth.currentUser.uid;
  }

  try {
    let query = db.collection("documentacion_media");
    if (uid) {
      query = query.where("uid", "==", uid);
    }

    const snap = await query.get();
    console.log(
      "[DOC-GESTION] deleteAllDocMedia – encontrados",
      snap.size,
      "documentos"
    );

    if (snap.empty) {
      alert("No hay documentos que borrar.");
      return;
    }

    // Borramos uno a uno para asegurar Storage + Firestore + estado
    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      const mediaId = docSnap.id;
      const storagePath = data.storagePath || null;

      // Storage
      if (storage && storagePath) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await storage.ref().child(storagePath).delete();
          console.log(
            "[DOC-GESTION] [ALL] Borrado en Storage:",
            storagePath,
            "(id:",
            mediaId,
            ")"
          );
        } catch (e) {
          console.warn(
            "[DOC-GESTION] [ALL] Error borrando en Storage (puede no existir):",
            storagePath,
            e
          );
        }
      }

      // Firestore
      try {
        // eslint-disable-next-line no-await-in-loop
        await db.collection("documentacion_media").doc(mediaId).delete();
        console.log(
          "[DOC-GESTION] [ALL] Borrado en Firestore:",
          mediaId
        );
      } catch (e) {
        console.error(
          "[DOC-GESTION] [ALL] Error borrando documento en Firestore:",
          mediaId,
          e
        );
      }
    }

    // Limpiamos estado local
    appState.documentacion.mediaLibrary = [];
    appState.documentacion.sectionMedia = {};
    appState.documentacion.selectedFichasMediaIds = [];
    persistDocStateSafe();

    alert("✅ Biblioteca de documentación vaciada completamente.");
    renderDocGestionView();
  } catch (e) {
    console.error("[DOC-GESTION] Error en deleteAllDocMedia:", e);
    alert(
      "Se ha producido un error al borrar la documentación. Revisa la consola para más detalles."
    );
  }
}

// ==============================
// Render principal
// ==============================

async function renderDocGestionView() {
  const container = getDocGestionAppContent();
  if (!container) return;

  await loadDocMediaForGestion();

  const media = appState.documentacion.mediaLibrary || [];

  const grouped = {
    ficha: [],
    declaracion: [],
    imagen: [],
    certificado: [],
    otros: [],
  };

  media.forEach((m) => {
    const cat = (m.docCategory || "").toLowerCase();
    if (cat === "ficha") grouped.ficha.push(m);
    else if (cat === "declaracion") grouped.declaracion.push(m);
    else if (cat === "imagen") grouped.imagen.push(m);
    else if (cat === "certificado") grouped.certificado.push(m);
    else grouped.otros.push(m);
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

  // Layout tipo Tarifas: izquierda fija, derecha ocupa todo el ancho
  container.innerHTML = `
    <div
      class="proyecto-layout"
      style="
        display:flex;
        gap:1rem;
        align-items:flex-start;
      "
    >
      <!-- Card de gestión / subida (IZQUIERDA) -->
      <div class="card" style="flex:0 0 380px; max-width:390px; min-width:300px;">
        <div class="card-header">
          <div>
            <div class="card-title">Gestión de documentación</div>
            <div class="card-subtitle">
              Sube, clasifica y organiza los documentos del proyecto en cuatro categorías:
              fichas técnicas, declaración de conformidad, imágenes y certificados.
            </div>
          </div>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <span class="chip">Documentación</span>
            <button
              id="docGestionDeleteAllBtn"
              class="btn btn-xs btn-outline"
              type="button"
              title="Borrar todos los documentos de documentación"
            >
              🧹 Vaciar biblioteca
            </button>
          </div>
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

      <!-- Card de listado (DERECHA) -->
      <div class="card" style="flex:1 1 auto; min-width:0;">
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
              Todavía no hay documentos subidos. Usa el formulario de la izquierda para añadirlos.
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

  // Subida
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
      const folderName = (folderInput && folderInput.value) || "";
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;

      if (typeof window.saveMediaFileToStorageAndFirestore !== "function") {
        console.error(
          "saveMediaFileToStorageAndFirestore no está disponible (ui_documentacion.js)."
        );
        alert(
          "No se ha encontrado la función de subida de documentación.\nRevisa ui_documentacion.js."
        );
        return;
      }

      const newItems = [];
      for (const file of files) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const media = await window.saveMediaFileToStorageAndFirestore(file, {
            folderName: folderName.trim(),
            docCategory,
          });
          newItems.push(media);
        } catch (e) {
          console.error(
            "Error subiendo archivo de documentación (gestión):",
            e
          );
        }
      }

      if (newItems.length) {
        appState.documentacion.mediaLibrary = newItems.concat(
          appState.documentacion.mediaLibrary || []
        );
        persistDocStateSafe();
      }

      if (fileInput) fileInput.value = "";

      renderDocGestionView();
    });
  }

  // Borrado MASIVO
  const deleteAllBtn = container.querySelector("#docGestionDeleteAllBtn");
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener("click", () => {
      deleteAllDocMedia().catch((e) =>
        console.error("Error en borrado masivo de documentación:", e)
      );
    });
  }

  // Borrado individual
  container.querySelectorAll("[data-doc-media-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-doc-media-delete");
      if (!id) return;

      const ok = window.confirm("¿Seguro que quieres borrar este documento?");
      if (!ok) return;

      const deleted = await deleteDocMediaById(id);
      if (deleted) {
        alert("✅ Archivo eliminado correctamente.");
        const row = btn.closest(".doc-gestion-row");
        if (row) row.remove();
      }
    });
  });

  // Edición de metadatos
  container.querySelectorAll("[data-doc-media-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-doc-media-edit");
      if (!id) return;

      const mediaLib = appState.documentacion.mediaLibrary || [];
      const item = mediaLib.find((m) => m.id === id);
      const currentFolder = (item && item.folderName) || "";
      const currentCat = (item && item.docCategory) || "ficha";

      const newFolder = window.prompt(
        "Nueva carpeta / descripción:",
        currentFolder
      );
      if (newFolder === null) return;

      const newCat = window.prompt(
        "Nuevo tipo (ficha / declaracion / imagen / certificado):",
        currentCat
      );
      if (newCat === null) return;

      await updateDocMediaMetaById(id, {
        folderName: newFolder.trim(),
        docCategory: newCat.trim().toLowerCase(),
      });

      renderDocGestionView();
    });
  });
}

console.log(
  "%cUI Gestión de documentación inicializada (ui_doc_gestion.js)",
  "color:#06b6d4; font-weight:600;"
);
