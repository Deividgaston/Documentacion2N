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

// ✅ Persistencia de “vista actual” para que al refrescar se mantenga (requiere que app.js lo lea)
const LAST_VIEW_KEY = "presupuestos2n_last_view";
function setLastViewSafe(viewId) {
  try {
    localStorage.setItem(LAST_VIEW_KEY, String(viewId || ""));
  } catch (e) {
    // silent
  }
}

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
// Helpers de datos / estado
// ==============================

function persistDocStateSafe() {
  if (typeof window.saveDocStateToLocalStorage === "function") {
    try {
      window.saveDocStateToLocalStorage();
    } catch (e) {
      console.error("Error guardando estado de documentación en localStorage:", e);
    }
  }
}

// Helper: valida si hay ids “buenos”
function hasValidMediaIds(list) {
  if (!Array.isArray(list) || !list.length) return false;
  // tiene que haber al menos 1 item con id string no vacío
  return list.some((m) => m && typeof m.id === "string" && m.id.trim().length > 0);
}

// Cargar documentación para la vista de gestión desde Firestore
async function loadDocMediaForGestion() {
  appState.documentacion = appState.documentacion || {};
  appState.documentacion.mediaLibrary = appState.documentacion.mediaLibrary || [];

  // 1) Si existe el loader “general” de documentación, lo intentamos primero
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

  // 2) ✅ FIX: si no hay datos O si los datos vienen sin "id", cargamos DIRECTO desde raíz
  // (si no, el borrado apunta a docId incorrecto y “no borra” realmente)
  try {
    const lib = appState.documentacion.mediaLibrary || [];
    const okIds = hasValidMediaIds(lib);

    if (!okIds) {
      const db = getFirestoreInstance();
      if (db) {
        const snap = await db.collection("documentacion_media").get();
        const list = [];
        snap.forEach((doc) => {
          const d = doc.data() || {};
          delete d.id; 
          list.push({ ...d, id: doc.id }); // así doc.id SIEMPRE gana
        });
        appState.documentacion.mediaLibrary = list;
      }
    } else {
      // Normalizamos: si hay items con "id" pero alguno viene raro, lo filtramos
      appState.documentacion.mediaLibrary = lib.filter(
        (m) => m && typeof m.id === "string" && m.id.trim().length > 0
      );
    }
  } catch (e) {
    console.error("[DOC-GESTION] Error cargando documentacion_media (raíz):", e);
  } finally {
    appState.documentacion.mediaLoaded = true;
  }
}

// ==============================
// Firestore / Storage helpers
// ==============================

function getFirestoreInstance() {
  return (
    window.db ||
    (window.firebase && window.firebase.firestore && window.firebase.firestore())
  );
}

function getStorageInstance() {
  return (
    window.storage ||
    (window.firebase && window.firebase.storage && window.firebase.storage())
  );
}

function getAuthInstance() {
  return (
    window.auth || (window.firebase && window.firebase.auth && window.firebase.auth())
  );
}

// ==============================
// UPDATE METADATOS
// ==============================

async function updateDocMediaMetaById(mediaId, updates) {
  if (!mediaId || !updates || typeof updates !== "object") return;

  appState.documentacion.mediaLibrary = appState.documentacion.mediaLibrary || [];
  const mediaLib = appState.documentacion.mediaLibrary;

  const idx = mediaLib.findIndex((m) => m && m.id === mediaId);
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
    console.error("Error actualizando metadatos de documentación en Firestore:", e);
  }
}

// ==============================
// BORRADO INDIVIDUAL
// ==============================

async function deleteDocMediaById(mediaId) {
  mediaId = String(mediaId || "").trim();
  if (!mediaId) return false;

  const db = getFirestoreInstance();
  const storage = getStorageInstance();

  if (!db) {
    console.warn("[DOC-GESTION] No hay instancia de Firestore, no se puede borrar:", mediaId);
    return false;
  }

  let storagePath = null;

  // 1) Leer el documento para obtener storagePath
  try {
    const docRef = db.collection("documentacion_media").doc(mediaId);
    const snap = await docRef.get();

    if (snap.exists) {
      const data = snap.data() || {};
      storagePath = data.storagePath || null;
    } else {
      console.warn("[DOC-GESTION] Documento a borrar no existe en Firestore:", mediaId);
      // Si no existe, devolvemos false porque es un id incorrecto (típico si venía sin id real)
      return false;
    }
  } catch (e) {
    console.error("[DOC-GESTION] Error leyendo documento antes de borrar:", mediaId, e);
    return false;
  }

  // 2) Borrar en Storage si tenemos ruta
  if (storage && storagePath) {
    try {
      await storage.ref().child(storagePath).delete();
      console.log("[DOC-GESTION] Archivo borrado en Storage:", storagePath, "(id:", mediaId, ")");
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
    console.error("[DOC-GESTION] Error borrando documento en Firestore:", mediaId, e);
    return false;
  }

  // 4) Limpiar estado local
  appState.documentacion.mediaLibrary = (appState.documentacion.mediaLibrary || []).filter(
    (m) => m && m.id !== mediaId
  );

  const map = appState.documentacion.sectionMedia || {};
  Object.keys(map).forEach((sec) => {
    const arr = map[sec] || [];
    map[sec] = arr.filter((id) => id !== mediaId);
  });
  appState.documentacion.sectionMedia = map;

  const sel = appState.documentacion.selectedFichasMediaIds || [];
  appState.documentacion.selectedFichasMediaIds = sel.filter((id) => id !== mediaId);

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

  if (!db) {
    alert("No se ha podido acceder a Firestore para borrar la documentación.");
    return;
  }

  try {
    // ✅ IMPORTANTE: NO filtramos por uid (tu librería es global en raíz)
    const snap = await db.collection("documentacion_media").get();
    console.log("[DOC-GESTION] deleteAllDocMedia – encontrados", snap.size, "documentos");

    if (snap.empty) {
      alert("No hay documentos que borrar.");
      return;
    }

    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      const mediaId = docSnap.id;
      const storagePath = data.storagePath || null;

      if (storage && storagePath) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await storage.ref().child(storagePath).delete();
          console.log("[DOC-GESTION] [ALL] Borrado en Storage:", storagePath, "(id:", mediaId, ")");
        } catch (e) {
          console.warn(
            "[DOC-GESTION] [ALL] Error borrando en Storage (puede no existir):",
            storagePath,
            e
          );
        }
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        await db.collection("documentacion_media").doc(mediaId).delete();
        console.log("[DOC-GESTION] [ALL] Borrado en Firestore:", mediaId);
      } catch (e) {
        console.error("[DOC-GESTION] [ALL] Error borrando documento en Firestore:", mediaId, e);
      }
    }

    appState.documentacion.mediaLibrary = [];
    appState.documentacion.sectionMedia = {};
    appState.documentacion.selectedFichasMediaIds = [];
    persistDocStateSafe();

    alert("✅ Biblioteca de documentación vaciada completamente.");
    renderDocGestionView();
  } catch (e) {
    console.error("[DOC-GESTION] Error en deleteAllDocMedia:", e);
    alert("Se ha producido un error al borrar la documentación. Revisa la consola para más detalles.");
  }
}

// ==============================
// Render principal
// ==============================

async function renderDocGestionView() {
  // ✅ guardamos “vista actual”
  setLastViewSafe("doc_gestion");

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
        const isImage = m.type === "image" || (m.mimeType || "").startsWith("image/");
        const icon = isImage ? "🖼️" : "📄";
        const nombre = m.nombre || "(sin nombre)";
        const carpeta = m.folderName || "";
        const tipo = m.docCategory || "";
        const mime = m.mimeType || "";
        const id = String(m.id || "").trim();
        const hasId = !!id;

        return `
          <div class="doc-gestion-row" data-doc-media-id="${id}">
            <div class="doc-gestion-main">
              <div class="doc-gestion-name">
                ${icon} ${nombre}
              </div>
              <div class="doc-gestion-meta">
                ${carpeta ? `<span class="doc-gestion-pill">${carpeta}</span>` : ""}
                ${tipo ? `<span class="doc-gestion-pill">Tipo: ${tipo}</span>` : ""}
                ${mime ? `<span class="doc-gestion-pill">${mime}</span>` : ""}
                ${!hasId ? `<span class="doc-gestion-pill" style="border-color:#ef4444;color:#ef4444;">SIN ID</span>` : ""}
              </div>
            </div>
            <div class="doc-gestion-actions">
              <button
                type="button"
                class="btn btn-xs btn-outline"
                data-doc-media-edit="${id}"
                ${!hasId ? "disabled" : ""}
              >
                ✏️ Editar
              </button>
              <button
                type="button"
                class="btn btn-xs"
                data-doc-media-delete="${id}"
                ${!hasId ? "disabled" : ""}
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
    ${grouped.otros && grouped.otros.length ? renderGroup("Otros", grouped.otros) : ""}
  `;

  container.innerHTML = `
    <div class="proyecto-layout doc-gestion-layout"
         style="display:flex; gap:1.25rem; align-items:flex-start;">
      <!-- Card de gestión / subida (IZQUIERDA) -->
      <div class="card doc-gestion-card"
           style="flex:0 0 380px; max-width:380px;">
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
      <div class="card doc-gestion-card"
           style="flex:1 1 auto; min-width:0;">
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
        console.error("saveMediaFileToStorageAndFirestore no está disponible (ui_documentacion.js).");
        alert("No se ha encontrado la función de subida de documentación.\nRevisa ui_documentacion.js.");
        return;
      }

      // ✅ FIX: no confiamos en el objeto devuelto (a veces viene sin id).
      // Subimos y luego recargamos desde Firestore para garantizar doc.id.
      for (const file of files) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await window.saveMediaFileToStorageAndFirestore(file, {
            folderName: folderName.trim(),
            docCategory,
          });
        } catch (e) {
          console.error("Error subiendo archivo de documentación (gestión):", e);
        }
      }

      if (fileInput) fileInput.value = "";

      // Recarga “real” desde Firestore (con ids) y render
      try {
        appState.documentacion.mediaLibrary = [];
        appState.documentacion.mediaLoaded = false;
        await loadDocMediaForGestion();
        persistDocStateSafe();
      } catch (e) {
        console.error("[DOC-GESTION] Error recargando tras subida:", e);
      }

      renderDocGestionView();
    });
  }

  // Borrado MASIVO
  const deleteAllBtn = container.querySelector("#docGestionDeleteAllBtn");
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener("click", () => {
      deleteAllDocMedia().catch((e) => console.error("Error en borrado masivo de documentación:", e));
    });
  }

  // ✅ Borrado individual (más robusto: usa el id del row si el atributo está vacío)
  container.querySelectorAll("[data-doc-media-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;

      let id = String(btn.getAttribute("data-doc-media-delete") || "").trim();
      if (!id) {
        const row = btn.closest(".doc-gestion-row");
        if (row) id = String(row.getAttribute("data-doc-media-id") || "").trim();
      }
      if (!id) {
        alert("No se ha podido determinar el ID del documento a borrar (revisa que venga con 'id').");
        return;
      }

      const ok = window.confirm("¿Seguro que quieres borrar este documento?");
      if (!ok) return;

      const deleted = await deleteDocMediaById(id);
      if (!deleted) {
        alert("No se ha podido borrar (ID inválido o sin permisos). Mira consola para detalles.");
        return;
      }

      alert("✅ Archivo eliminado correctamente.");
      renderDocGestionView(); // refrescamos desde estado real
    });
  });

  // Edición de metadatos
  container.querySelectorAll("[data-doc-media-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;

      const id = String(btn.getAttribute("data-doc-media-edit") || "").trim();
      if (!id) return;

      const mediaLib = appState.documentacion.mediaLibrary || [];
      const item = mediaLib.find((m) => m && m.id === id);
      const currentFolder = (item && item.folderName) || "";
      const currentCat = (item && item.docCategory) || "ficha";

      const newFolder = window.prompt("Nueva carpeta / descripción:", currentFolder);
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
