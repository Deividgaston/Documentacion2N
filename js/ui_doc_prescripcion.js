// js/ui_doc_prescripcion.js
// Página de PRESCRIPCIÓN (mediciones / capítulos a partir del presupuesto)
// - Columna izquierda: capítulos (secciones del presupuesto + capítulos manuales)
// - Columna central: texto del capítulo + referencias (líneas del presupuesto + extra)
// - Columna derecha: plantillas de texto + referencias extra reutilizables

window.appState = window.appState || {};
appState.prescripcion = appState.prescripcion || {
  capitulos: [],            // [{ id, nombre, texto, lineas: [{id,tipo,codigo,descripcion,cantidad,pvp,extraRefId}] }]
  selectedCapituloId: null,
  plantillas: [],           // [{ id, nombre, texto }]
  plantillasLoaded: false,
  extraRefs: [],            // [{ id, codigo, descripcion, unidad, pvp }]
  extraRefsLoaded: false,
};

// ==============================
// Modal genérico (usa el HTML global del index)
// ==============================

function openPrescModal({ title, bodyHTML, onSave }) {
  const modal = document.getElementById("prescModal");
  const titleEl = document.getElementById("prescModalTitle");
  const bodyEl = document.getElementById("prescModalBody");
  const saveBtn = document.getElementById("prescModalSave");
  const closeBtn = document.getElementById("prescModalClose");
  const cancelBtn = document.getElementById("prescModalCancel");

  if (!modal || !titleEl || !bodyEl || !saveBtn || !closeBtn || !cancelBtn) {
    console.warn("[PRESCRIPCION] Modal global no encontrado, usando prompt fallback.");
    // fallback mínimo por si falta el HTML
    if (typeof onSave === "function") {
      onSave();
    }
    return;
  }

  titleEl.textContent = title || "";
  bodyEl.innerHTML = bodyHTML || "";

  modal.style.display = "flex";

  const closeModal = () => {
    modal.style.display = "none";
    saveBtn.onclick = null;
    closeBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;

  saveBtn.onclick = async () => {
    if (typeof onSave === "function") {
      await onSave();
    }
    closeModal();
  };
}

// ==============================
// Helpers de contenedor
// ==============================

function getPrescripcionAppContent() {
  if (typeof window.getDocAppContent === "function") {
    return window.getDocAppContent();
  }
  if (typeof window.getAppContent === "function") {
    return window.getAppContent();
  }
  return document.getElementById("appContent");
}

// ==============================
// Helpers Firestore/Auth (compat con el resto del proyecto)
// ==============================

function getFirestorePresc() {
  if (typeof window.getFirestoreInstance === "function") {
    const inst = window.getFirestoreInstance();
    if (inst) return inst;
  }
  if (window.db) return window.db;
  if (window.firebase && window.firebase.firestore) {
    try {
      return window.firebase.firestore();
    } catch (e) {
      console.error("[PRESCRIPCION] Error obteniendo Firestore:", e);
    }
  }
  return null;
}

function getAuthPresc() {
  if (typeof window.getAuthInstance === "function") {
    const inst = window.getAuthInstance();
    if (inst) return inst;
  }
  if (window.auth) return window.auth;
  if (window.firebase && window.firebase.auth) {
    try {
      return window.firebase.auth();
    } catch (e) {
      console.error("[PRESCRIPCION] Error obteniendo Auth:", e);
    }
  }
  return null;
}

// ==============================
// Helpers presupuesto -> capítulos
// ==============================

function getPresupuestoActualSafe() {
  if (typeof window.getPresupuestoActual === "function") {
    try {
      return window.getPresupuestoActual();
    } catch (e) {
      console.error(
        "[PRESCRIPCION] Error obteniendo presupuesto actual:",
        e
      );
      return null;
    }
  }
  console.warn(
    "[PRESCRIPCION] getPresupuestoActual no está definido. Revisa ui_presupuesto.js."
  );
  return null;
}

// Construye capítulos a partir de secciones + líneas del presupuesto
function buildCapitulosFromPresupuesto() {
  const presu = getPresupuestoActualSafe();
  if (!presu) {
    console.warn(
      "[PRESCRIPCION] No hay presupuesto cargado. No se pueden generar capítulos."
    );
    return [];
  }

  const seccionesMap = presu.secciones || presu.sections || {};
  const lineas = presu.lineas || presu.lines || presu.lineItems || [];

  const capitulosBySec = {};

  lineas.forEach((l) => {
    const secId =
      l.seccionId ||
      l.sectionId ||
      l.seccion ||
      l.capituloId ||
      l.chapterId ||
      "SIN_SECCION";

    if (!capitulosBySec[secId]) {
      const def =
        seccionesMap[secId] || seccionesMap[String(secId)] || {};
      const nombreCapitulo =
        def.nombre ||
        def.name ||
        def.titulo ||
        def.title ||
        (secId === "SIN_SECCION" ? "Sin sección" : String(secId));

      capitulosBySec[secId] = {
        id: String(secId),
        nombre: nombreCapitulo,
        texto: "",
        lineas: [],
      };
    }

    capitulosBySec[secId].lineas.push({
      id: l.id || l.key || l.codigo || l.ref || "",
      tipo: "budget", // viene del presupuesto
      codigo: l.codigo || l.ref || l.sku || "",
      descripcion:
        l.descripcion ||
        l.desc ||
        l.concepto ||
        l.nombre ||
        l.title ||
        "",
      cantidad:
        l.cantidad ||
        l.qty ||
        l.unidades ||
        l.cant ||
        1,
      pvp: l.pvp || l.precio || l.price || 0,
      extraRefId: null,
    });
  });

  const capitulos = Object.values(capitulosBySec);
  capitulos.sort((a, b) => {
    const na = (a.nombre || "").toString();
    const nb = (b.nombre || "").toString();
    return na.localeCompare(nb, "es");
  });

  return capitulos;
}

function ensureCapitulosIniciales() {
  appState.prescripcion = appState.prescripcion || {};
  appState.prescripcion.capitulos =
    appState.prescripcion.capitulos || [];

  if (!appState.prescripcion.capitulos.length) {
    const caps = buildCapitulosFromPresupuesto();
    appState.prescripcion.capitulos = caps;
    appState.prescripcion.selectedCapituloId = caps.length
      ? caps[0].id
      : null;
  }
}

function createManualCapitulo() {
  const id = "manual-" + Date.now();
  const nuevo = {
    id,
    nombre: "Capítulo manual",
    texto: "",
    lineas: [], // solo tendrá referencias extra que añadas
  };
  appState.prescripcion.capitulos =
    appState.prescripcion.capitulos || [];
  appState.prescripcion.capitulos.push(nuevo);
  appState.prescripcion.selectedCapituloId = id;
}

function getSelectedCapitulo() {
  const caps = appState.prescripcion.capitulos || [];
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

// ==============================
// Firestore: plantillas de prescripción (texto)
// ==============================

async function ensurePrescripcionPlantillasLoaded() {
  appState.prescripcion = appState.prescripcion || {};
  if (appState.prescripcion.plantillasLoaded) return;

  const db = getFirestorePresc();
  const auth = getAuthPresc();

  if (!db) {
    console.warn(
      "[PRESCRIPCION] No hay instancia de Firestore. Las plantillas serán solo locales."
    );
    appState.prescripcion.plantillasLoaded = true;
    return;
  }

  let uid = null;
  if (auth && auth.currentUser) {
    uid = auth.currentUser.uid;
  }

  try {
    let query = db.collection("prescripcion_plantillas");
    if (uid) {
      query = query.where("uid", "==", uid);
    }

    const snap = await query.get();
    const plantillas = [];
    snap.forEach((doc) => {
      const data = doc.data() || {};
      plantillas.push({
        id: doc.id,
        nombre: data.nombre || "(sin nombre)",
        texto: data.texto || "",
      });
    });

    appState.prescripcion.plantillas = plantillas;
    appState.prescripcion.plantillasLoaded = true;

    console.log(
      "[PRESCRIPCION] Plantillas cargadas:",
      plantillas.length
    );
  } catch (e) {
    console.error(
      "[PRESCRIPCION] Error cargando plantillas desde Firestore:",
      e
    );
    appState.prescripcion.plantillasLoaded = true;
  }
}

async function createPrescripcionPlantilla(nombre, texto) {
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
    texto,
  };

  if (!db) {
    appState.prescripcion.plantillas =
      [newItem].concat(appState.prescripcion.plantillas || []);
    return;
  }

  let uid = null;
  if (auth && auth.currentUser) {
    uid = auth.currentUser.uid;
  }

  try {
    const docRef = await db
      .collection("prescripcion_plantillas")
      .add({
        uid: uid || null,
        nombre,
        texto,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

    newItem.id = docRef.id;
    appState.prescripcion.plantillas =
      [newItem].concat(appState.prescripcion.plantillas || []);
  } catch (e) {
    console.error(
      "[PRESCRIPCION] Error creando plantilla en Firestore:",
      e
    );
    appState.prescripcion.plantillas =
      [newItem].concat(appState.prescripcion.plantillas || []);
  }
}

async function updatePrescripcionPlantilla(id, nombre, texto) {
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
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error(
      "[PRESCRIPCION] Error actualizando plantilla en Firestore:",
      e
    );
  }
}

async function deletePrescripcionPlantilla(id) {
  if (!id) return;

  const ok = window.confirm(
    "¿Seguro que quieres borrar esta plantilla?"
  );
  if (!ok) return;

  appState.prescripcion.plantillas =
    (appState.prescripcion.plantillas || []).filter(
      (p) => p.id !== id
    );

  const db = getFirestorePresc();
  if (!db) return;

  try {
    await db.collection("prescripcion_plantillas").doc(id).delete();
  } catch (e) {
    console.error(
      "[PRESCRIPCION] Error borrando plantilla en Firestore:",
      e
    );
  }
}

// ==============================
// Firestore: referencias extra (material, mano de obra, etc.)
// ==============================

async function ensureExtraRefsLoaded() {
  appState.prescripcion = appState.prescripcion || {};
  if (appState.prescripcion.extraRefsLoaded) return;

  const db = getFirestorePresc();
  const auth = getAuthPresc();

  if (!db) {
    console.warn(
      "[PRESCRIPCION] No hay instancia de Firestore. Referencias extra solo locales."
    );
    appState.prescripcion.extraRefsLoaded = true;
    return;
  }

  let uid = null;
  if (auth && auth.currentUser) {
    uid = auth.currentUser.uid;
  }

  try {
    let query = db.collection("prescripcion_referencias_extra");
    if (uid) {
      query = query.where("uid", "==", uid);
    }

    const snap = await query.get();
    const refs = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      refs.push({
        id: doc.id,
        codigo: d.codigo || "",
        descripcion: d.descripcion || "",
        unidad: d.unidad || "Ud",
        pvp: typeof d.pvp === "number" ? d.pvp : 0,
      });
    });

    appState.prescripcion.extraRefs = refs;
    appState.prescripcion.extraRefsLoaded = true;

    console.log(
      "[PRESCRIPCION] Referencias extra cargadas:",
      refs.length
    );
  } catch (e) {
    console.error(
      "[PRESCRIPCION] Error cargando referencias extra:",
      e
    );
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
    pvp,
  };

  if (!db) {
    appState.prescripcion.extraRefs =
      [newItem].concat(appState.prescripcion.extraRefs || []);
    return;
  }

  let uid = null;
  if (auth && auth.currentUser) {
    uid = auth.currentUser.uid;
  }

  try {
    const docRef = await db
      .collection("prescripcion_referencias_extra")
      .add({
        uid: uid || null,
        codigo,
        descripcion,
        unidad,
        pvp,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    newItem.id = docRef.id;
    appState.prescripcion.extraRefs =
      [newItem].concat(appState.prescripcion.extraRefs || []);
  } catch (e) {
    console.error(
      "[PRESCRIPCION] Error creando referencia extra:",
      e
    );
    appState.prescripcion.extraRefs =
      [newItem].concat(appState.prescripcion.extraRefs || []);
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
    await db
      .collection("prescripcion_referencias_extra")
      .doc(id)
      .update({
        codigo,
        descripcion,
        unidad,
        pvp,
        updatedAt: Date.now(),
      });
  } catch (e) {
    console.error(
      "[PRESCRIPCION] Error actualizando referencia extra:",
      e
    );
  }
}

async function deleteExtraRef(id) {
  if (!id) return;
  const ok = window.confirm(
    "¿Seguro que quieres borrar esta referencia extra?"
  );
  if (!ok) return;

  appState.prescripcion.extraRefs =
    (appState.prescripcion.extraRefs || []).filter(
      (r) => r.id !== id
    );

  const db = getFirestorePresc();
  if (!db) return;

  try {
    await db
      .collection("prescripcion_referencias_extra")
      .doc(id)
      .delete();
  } catch (e) {
    console.error(
      "[PRESCRIPCION] Error borrando referencia extra:",
      e
    );
  }
}

async function duplicateExtraRef(id) {
  const list = appState.prescripcion.extraRefs || [];
  const ref = list.find((r) => r.id === id);
  if (!ref) return;

  const nuevoCodigo =
    ref.codigo ? ref.codigo + "_COPY" : "";
  await createExtraRef(
    nuevoCodigo,
    ref.descripcion,
    ref.unidad,
    ref.pvp
  );
}

// Añadir referencia extra a capítulo actual
function addExtraRefToCurrentCap(extraId) {
  const cap = getSelectedCapitulo();
  if (!cap) {
    alert(
      "Selecciona primero un capítulo en la columna izquierda."
    );
    return;
  }
  const list = appState.prescripcion.extraRefs || [];
  const ref = list.find((r) => r.id === extraId);
  if (!ref) return;

  cap.lineas = cap.lineas || [];
  cap.lineas.push({
    id: "extra-" + extraId + "-" + Date.now(),
    tipo: "extra",
    codigo: ref.codigo || "",
    descripcion: ref.descripcion || "",
    cantidad: 1,
    pvp: ref.pvp || 0,
    extraRefId: extraId,
  });
}

// ==============================
// Export (stubs)
// ==============================

function exportPrescripcionPDF() {
  alert(
    "La exportación PDF de mediciones se implementará en un siguiente hito."
  );
}

function exportPrescripcionBC3() {
  alert(
    "La exportación BC3 se implementará en un siguiente hito."
  );
}

// ==============================
// Render principal
// ==============================

async function renderDocPrescripcionView() {
  const container = getPrescripcionAppContent();
  if (!container) return;

  ensureCapitulosIniciales();
  await ensurePrescripcionPlantillasLoaded();
  await ensureExtraRefsLoaded();

  const caps = appState.prescripcion.capitulos || [];
  const plantillas = appState.prescripcion.plantillas || [];
  const extraRefs = appState.prescripcion.extraRefs || [];
  const capSel = getSelectedCapitulo();

  // --------- Columna izquierda: capítulos ---------
  let capitulosHTML = "";
  if (!caps.length) {
    capitulosHTML = `
      <p class="text-muted" style="font-size:0.85rem;">
        No se han podido generar capítulos desde el presupuesto.<br />
        Asegúrate de tener un presupuesto cargado o crea un capítulo manual.
      </p>
    `;
  } else {
    capitulosHTML = caps
      .map((c) => {
        const isSelected =
          capSel && c.id === capSel.id;
        const lineas = c.lineas || [];
        const totalLineas = lineas.length;
        const totalCant = lineas.reduce(
          (acc, l) => acc + (Number(l.cantidad) || 0),
          0
        );
        const esManual = String(c.id).startsWith("manual-");

        const refsPreview = lineas
          .slice(0, 3)
          .map((l) => {
            const cod = l.codigo || "";
            const desc = l.descripcion || "";
            const cant =
              typeof l.cantidad !== "undefined"
                ? l.cantidad
                : "";
            return `
              <div class="presc-ref-line">
                <span class="presc-ref-code">${cod}</span>
                <span class="presc-ref-desc">${desc}</span>
                <span class="presc-ref-qty">x${cant}</span>
              </div>
            `;
          })
          .join("");

        return `
          <button
            type="button"
            class="presc-capitulo-item ${
              isSelected ? "presc-capitulo-selected" : ""
            }"
            data-presc-cap-id="${c.id}"
          >
            <div class="presc-capitulo-title">
              ${c.nombre || "(sin título)"}${
          esManual ? ' <span class="chip chip-soft">manual</span>' : ""
        }
            </div>
            <div class="presc-capitulo-meta">
              <span>${totalLineas} referencias</span>
              <span>${totalCant} uds</span>
            </div>
            ${
              refsPreview
                ? `<div class="presc-capitulo-refs">${refsPreview}</div>`
                : ""
            }
          </button>
        `;
      })
      .join("");
  }

  // --------- Columna central: texto + referencias ---------
  const textoCap = capSel ? capSel.texto || "" : "";
  const nombreCap = capSel ? capSel.nombre || "" : "";

  let refsCapituloHTML = "";
  if (!capSel || !(capSel.lineas || []).length) {
    refsCapituloHTML = `
      <p class="text-muted" style="font-size:0.8rem;">
        Este capítulo no tiene referencias asociadas todavía.
      </p>
    `;
  } else {
    refsCapituloHTML = `
      <div class="presc-capitulo-ref-table">
        ${(capSel.lineas || [])
          .map((l) => {
            const tipo = l.tipo || "budget";
            const cod = l.codigo || "";
            const desc = l.descripcion || "";
            const cant =
              typeof l.cantidad !== "undefined"
                ? l.cantidad
                : "";
            const pvp =
              typeof l.pvp === "number" ? l.pvp : 0;
            const importe =
              (Number(cant) || 0) * (Number(pvp) || 0);

            const readonly = tipo === "budget";
            return `
              <div class="presc-ref-row" data-presc-ref-row-id="${l.id}">
                <span class="presc-ref-code">${cod}</span>
                <span class="presc-ref-desc">${desc}</span>
                <span class="presc-ref-qty">
                  ${
                    readonly
                      ? `x${cant}`
                      : `<input type="number" min="0" step="0.01"
                               class="presc-ref-qty-input"
                               value="${cant}" />`
                  }
                </span>
                <span class="presc-ref-pvp">${
                  pvp.toFixed(2)
                } €</span>
                <span class="presc-ref-importe">${
                  importe.toFixed(2)
                } €</span>
                <span class="presc-ref-actions">
                  ${
                    readonly
                      ? ""
                      : `<button type="button"
                                 class="btn btn-xs btn-outline presc-ref-del-btn"
                                 title="Quitar referencia extra del capítulo">
                            ✖
                         </button>`
                  }
                </span>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  const columnaCentralHTML = capSel
    ? `
      <div class="form-group">
        <label>Título del capítulo</label>
        <input
          type="text"
          id="prescCapituloTituloInput"
          class="form-control"
          value="${(nombreCap || "").replace(/"/g, "&quot;")}"
        />
      </div>

      <div class="form-group" style="flex:1 1 auto; display:flex; flex-direction:column; min-height:0;">
        <label>Texto de mediciones</label>
        <textarea
          id="prescCapituloTexto"
          class="form-control"
          style="flex:1 1 auto; min-height:0; resize:none;"
          placeholder="Arrastra aquí una plantilla o escribe el texto de mediciones..."
        >${textoCap}</textarea>
        <p style="font-size:0.78rem; color:#6b7280; margin-top:0.25rem;">
          Drag & drop: arrastra una plantilla desde la derecha sobre este cuadro para
          rellenar o sustituir el texto del capítulo.
        </p>
      </div>

      <div class="form-group" style="margin-top:0.75rem;">
        <label>Referencias incluidas en este capítulo</label>
        <div style="max-height:30vh; overflow:auto;">
          ${refsCapituloHTML}
        </div>
      </div>
    `
    : `
      <p class="text-muted" style="font-size:0.85rem;">
        No hay ningún capítulo seleccionado. Selecciona uno en la columna izquierda
        o crea un capítulo manual.
      </p>
    `;

  // --------- Columna derecha: plantillas + referencias extra ---------

  // Plantillas
  let plantillasHTML = "";
  if (!plantillas.length) {
    plantillasHTML = `
      <p class="text-muted" style="font-size:0.85rem;">
        Todavía no tienes plantillas de prescripción.<br />
        Usa el botón "Nueva plantilla" para crear la primera.
      </p>
    `;
  } else {
    plantillasHTML = plantillas
      .map((p) => {
        const preview =
          (p.texto || "")
            .split("\n")
            .slice(0, 3)
            .join(" ")
            .slice(0, 260) + (p.texto && p.texto.length > 260 ? "..." : "");

        return `
          <div
            class="presc-plantilla-item"
            draggable="true"
            data-presc-plantilla-id="${p.id}"
            title="Arrastra esta plantilla al texto del capítulo o haz clic en Aplicar"
          >
            <div class="presc-plantilla-header">
              <div class="presc-plantilla-name">
                📄 ${p.nombre}
              </div>
              <div class="presc-plantilla-actions">
                <button
                  type="button"
                  class="btn btn-xs btn-outline"
                  data-presc-plantilla-edit="${p.id}"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  class="btn btn-xs"
                  data-presc-plantilla-delete="${p.id}"
                >
                  🗑️
                </button>
              </div>
            </div>
            <div class="presc-plantilla-preview">
              ${preview || "<i>(texto vacío)</i>"}
            </div>
            <div class="presc-plantilla-footer">
              <button
                type="button"
                class="btn btn-xs"
                data-presc-plantilla-apply="${p.id}"
              >
                ➕ Aplicar al capítulo
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Referencias extra
  let extraRefsHTML = "";
  if (!extraRefs.length) {
    extraRefsHTML = `
      <p class="text-muted" style="font-size:0.85rem;">
        Aún no hay referencias extra (switches, cableado, mano de obra...).<br/>
        Usa el botón "Nueva referencia extra" para crear la primera.
      </p>
    `;
  } else {
    extraRefsHTML = extraRefs
      .map((r) => {
        const cod = r.codigo || "";
        const desc = r.descripcion || "";
        const unidad = r.unidad || "Ud";
        const pvp =
          typeof r.pvp === "number" ? r.pvp : 0;

        return `
          <div class="presc-extra-item" data-presc-extra-id="${r.id}">
            <div class="presc-extra-main">
              <div class="presc-extra-line1">
                <span class="presc-extra-code">${cod}</span>
                <span class="presc-extra-price">${pvp.toFixed(
                  2
                )} € / ${unidad}</span>
              </div>
              <div class="presc-extra-desc">
                ${desc || "<i>(sin descripción)</i>"}
              </div>
            </div>
            <div class="presc-extra-actions">
              <button type="button" class="btn btn-xs" data-presc-extra-add="${r.id}">
                ➕ Añadir al capítulo
              </button>
              <button type="button" class="btn btn-xs btn-outline" data-presc-extra-dup="${r.id}">
                ⧉
              </button>
              <button type="button" class="btn btn-xs btn-outline" data-presc-extra-edit="${r.id}">
                ✏️
              </button>
              <button type="button" class="btn btn-xs" data-presc-extra-del="${r.id}">
                🗑️
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  container.innerHTML = `
    <div class="presc-root" style="display:flex; flex-direction:column; height:100%; min-height:calc(100vh - 80px);">
      <div class="card" style="margin-bottom:0.75rem; flex:0 0 auto;">
        <div class="card-header">
          <div>
            <div class="card-title">Prescripción: resumen inteligente de documentación</div>
            <div class="card-subtitle">
              Genera mediciones a partir del presupuesto, añade referencias extra y aplica plantillas de texto técnicas.
            </div>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
            <button type="button" id="prescExportPdfBtn" class="btn btn-xs btn-outline">📄 PDF mediciones</button>
            <button type="button" id="prescExportBc3Btn" class="btn btn-xs btn-outline">📦 Exportar BC3</button>
            <button type="button" id="prescNewPlantillaBtn" class="btn btn-xs btn-primary">➕ Nueva plantilla</button>
            <button type="button" id="prescNewExtraRefBtn" class="btn btn-xs btn-secondary">➕ Nueva referencia extra</button>
          </div>
        </div>
      </div>

      <div
        class="proyecto-layout"
        style="
          display:grid;
          grid-template-columns: 1fr 1.5fr 1.4fr;
          gap: 1rem;
          align-items:stretch;
          flex:1 1 auto;
          min-height:0;
          height:100%;
        "
      >
        <!-- Columna 1: Capítulos -->
        <div class="card" style="display:flex; flex-direction:column; min-height:0; height:100%;">
          <div class="card-header">
            <div>
              <div class="card-title">Capítulos de prescripción</div>
              <div class="card-subtitle">
                Se generan desde las secciones del presupuesto o como capítulos manuales.
              </div>
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <button
                type="button"
                id="prescReloadFromBudgetBtn"
                class="btn btn-xs btn-outline"
                title="Regenerar capítulos desde el presupuesto actual"
              >
                🔄 Regenerar
              </button>
              <button
                type="button"
                id="prescNewManualCapBtn"
                class="btn btn-xs btn-primary"
                title="Crear un capítulo manual solo con referencias extra"
              >
                ➕ Capítulo manual
              </button>
            </div>
          </div>
          <div class="card-body presc-capitulos-list" style="flex:1 1 auto; overflow:auto;">
            ${capitulosHTML}
          </div>
        </div>

        <!-- Columna 2: Texto del capítulo -->
        <div class="card" style="display:flex; flex-direction:column; min-height:0; height:100%;">
          <div class="card-header">
            <div>
              <div class="card-title">Texto del capítulo</div>
              <div class="card-subtitle">
                Define el texto de mediciones y visualiza todas las referencias asociadas (2N + extras).
              </div>
            </div>
          </div>
          <div class="card-body" style="flex:1 1 auto; display:flex; flex-direction:column; min-height:0;">
            ${columnaCentralHTML}
          </div>
        </div>

        <!-- Columna 3: Plantillas + referencias extra -->
        <div style="display:flex; flex-direction:column; gap:0.75rem; min-height:0; height:100%;">
          <div class="card" style="flex:1 1 55%; min-height:0; display:flex; flex-direction:column;">
            <div class="card-header">
              <div>
                <div class="card-title">Plantillas de texto</div>
                <div class="card-subtitle">
                  Textos estándar por tipo de sistema (videoportero, accesos, monitores, etc.).
                </div>
              </div>
            </div>
            <div class="card-body presc-plantillas-list" style="flex:1 1 auto; overflow:auto;">
              ${plantillasHTML}
            </div>
          </div>

          <div class="card" style="flex:1 1 45%; min-height:0; display:flex; flex-direction:column;">
            <div class="card-header">
              <div>
                <div class="card-title">Referencias extra (no 2N)</div>
                <div class="card-subtitle">
                  Switches, cableado, mano de obra, etc. Añádelas a cualquier capítulo o crea capítulos solo con ellas.
                </div>
              </div>
            </div>
            <div class="card-body presc-extra-list" style="flex:1 1 auto; overflow:auto;">
              ${extraRefsHTML}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  attachPrescripcionHandlers();
}

// ==============================
// Handlers
// ==============================

function attachPrescripcionHandlers() {
  const container = getPrescripcionAppContent();
  if (!container) return;

  // Acciones superiores
  const pdfBtn = container.querySelector("#prescExportPdfBtn");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", exportPrescripcionPDF);
  }
  const bc3Btn = container.querySelector("#prescExportBc3Btn");
  if (bc3Btn) {
    bc3Btn.addEventListener("click", exportPrescripcionBC3);
  }

  const newPlantillaBtn = container.querySelector("#prescNewPlantillaBtn");
  if (newPlantillaBtn) {
    newPlantillaBtn.addEventListener("click", () => {
      openPrescModal({
        title: "Nueva plantilla",
        bodyHTML: `
          <div class="form-group">
            <label>Nombre</label>
            <input id="tplNombre" type="text" class="form-control">
          </div>
          <div class="form-group">
            <label>Texto</label>
            <textarea id="tplTexto" class="form-control" rows="8"></textarea>
          </div>
        `,
        onSave: async () => {
          const nombre = (document.getElementById("tplNombre").value || "").trim();
          const texto = document.getElementById("tplTexto").value || "";
          await createPrescripcionPlantilla(nombre, texto);
          renderDocPrescripcionView();
        },
      });
    });
  }

  const newExtraBtn = container.querySelector("#prescNewExtraRefBtn");
  if (newExtraBtn) {
    newExtraBtn.addEventListener("click", () => {
      openPrescModal({
        title: "Nueva referencia extra",
        bodyHTML: `
          <div class="form-group">
            <label>Código</label>
            <input id="extCodigo" type="text" class="form-control">
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <textarea id="extDesc" class="form-control" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Unidad</label>
            <input id="extUnidad" type="text" class="form-control" value="Ud">
          </div>
          <div class="form-group">
            <label>PVP</label>
            <input id="extPvp" type="number" class="form-control" value="0">
          </div>
        `,
        onSave: async () => {
          const codigo = (document.getElementById("extCodigo").value || "").trim();
          const descripcion = (document.getElementById("extDesc").value || "").trim();
          const unidad = (document.getElementById("extUnidad").value || "").trim() || "Ud";
          const pvp = Number(document.getElementById("extPvp").value || 0);
          await createExtraRef(codigo, descripcion, unidad, pvp);
          renderDocPrescripcionView();
        },
      });
    });
  }

  // Capítulos: regenerar / nuevo manual
  const reloadBtn = container.querySelector("#prescReloadFromBudgetBtn");
  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      const ok = window.confirm(
        "Esto regenerará los capítulos desde el presupuesto actual.\n\n" +
          "⚠️ Se perderán los textos y referencias extra asociadas a capítulos generados automáticamente.\n\n" +
          "¿Quieres continuar?"
      );
      if (!ok) return;

      const caps = buildCapitulosFromPresupuesto();
      // mantenemos capítulos manuales
      const manuales =
        (appState.prescripcion.capitulos || []).filter((c) =>
          String(c.id).startsWith("manual-")
        );
      appState.prescripcion.capitulos = caps.concat(manuales);
      appState.prescripcion.selectedCapituloId =
        appState.prescripcion.capitulos.length
          ? appState.prescripcion.capitulos[0].id
          : null;

      renderDocPrescripcionView();
    });
  }

  const newManualCapBtn = container.querySelector("#prescNewManualCapBtn");
  if (newManualCapBtn) {
    newManualCapBtn.addEventListener("click", () => {
      createManualCapitulo();
      renderDocPrescripcionView();
    });
  }

  // Selección de capítulo
  container
    .querySelectorAll("[data-presc-cap-id]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-presc-cap-id");
        if (!id) return;
        setSelectedCapitulo(id);
        renderDocPrescripcionView();
      });
    });

  // Edición título capítulo
  const tituloInput = container.querySelector("#prescCapituloTituloInput");
  if (tituloInput) {
    tituloInput.addEventListener("input", (ev) => {
      const cap = getSelectedCapitulo();
      if (!cap) return;
      cap.nombre = ev.target.value || "";
    });
  }

  // Edición texto capítulo
  const textoArea = container.querySelector("#prescCapituloTexto");
  if (textoArea) {
    textoArea.addEventListener("input", (ev) => {
      const cap = getSelectedCapitulo();
      if (!cap) return;
      cap.texto = ev.target.value || "";
    });

    // Drag & drop: permitir soltar una plantilla
    textoArea.addEventListener("dragover", (ev) => {
      ev.preventDefault();
    });

    textoArea.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const plantillaId = ev.dataTransfer.getData(
        "text/presc-plantilla-id"
      );
      if (!plantillaId) return;

      const plantillas =
        appState.prescripcion.plantillas || [];
      const tpl = plantillas.find(
        (p) => p.id === plantillaId
      );
      if (!tpl) return;

      const cap = getSelectedCapitulo();
      if (!cap) return;

      cap.texto = tpl.texto || "";
      textoArea.value = cap.texto;
    });
  }

  // Plantillas: drag, aplicar, editar, borrar
  container
    .querySelectorAll("[data-presc-plantilla-id]")
    .forEach((el) => {
      el.addEventListener("dragstart", (ev) => {
        const id = el.getAttribute(
          "data-presc-plantilla-id"
        );
        if (!id) return;
        ev.dataTransfer.setData(
          "text/presc-plantilla-id",
          id
        );
      });
    });

  container
    .querySelectorAll("[data-presc-plantilla-apply]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute(
          "data-presc-plantilla-apply"
        );
        if (!id) return;

        const plantillas =
          appState.prescripcion.plantillas || [];
        const tpl = plantillas.find((p) => p.id === id);
        if (!tpl) return;

        const cap = getSelectedCapitulo();
        if (!cap) {
          alert(
            "Selecciona primero un capítulo en la columna izquierda."
          );
          return;
        }

        cap.texto = tpl.texto || "";

        const textoAreaLocal =
          container.querySelector(
            "#prescCapituloTexto"
          );
        if (textoAreaLocal) {
          textoAreaLocal.value = cap.texto;
        }
      });
    });

  container
    .querySelectorAll("[data-presc-plantilla-edit]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute(
          "data-presc-plantilla-edit"
        );
        if (!id) return;

        const plantillas =
          appState.prescripcion.plantillas || [];
        const tpl = plantillas.find((p) => p.id === id);
        if (!tpl) return;

        const nombreSafe = (tpl.nombre || "").replace(/"/g, "&quot;");
        const textoSafe = tpl.texto || "";

        openPrescModal({
          title: "Editar plantilla",
          bodyHTML: `
            <div class="form-group">
              <label>Nombre</label>
              <input id="tplNombre" type="text" class="form-control" value="${nombreSafe}">
            </div>
            <div class="form-group">
              <label>Texto</label>
              <textarea id="tplTexto" class="form-control" rows="8">${textoSafe}</textarea>
            </div>
          `,
          onSave: async () => {
            const nuevoNombre = (document.getElementById("tplNombre").value || "").trim();
            const nuevoTexto = document.getElementById("tplTexto").value || "";
            await updatePrescripcionPlantilla(
              id,
              nuevoNombre,
              nuevoTexto
            );
            renderDocPrescripcionView();
          },
        });
      });
    });

  container
    .querySelectorAll("[data-presc-plantilla-delete]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute(
          "data-presc-plantilla-delete"
        );
        if (!id) return;

        await deletePrescripcionPlantilla(id);
        renderDocPrescripcionView();
      });
    });

  // Referencias extra: add / dup / edit / delete
  container
    .querySelectorAll("[data-presc-extra-add]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute(
          "data-presc-extra-add"
        );
        if (!id) return;
        addExtraRefToCurrentCap(id);
        renderDocPrescripcionView();
      });
    });

  container
    .querySelectorAll("[data-presc-extra-dup]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute(
          "data-presc-extra-dup"
        );
        if (!id) return;
        await duplicateExtraRef(id);
        renderDocPrescripcionView();
      });
    });

  container
    .querySelectorAll("[data-presc-extra-edit]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute(
          "data-presc-extra-edit"
        );
        if (!id) return;

        const list = appState.prescripcion.extraRefs || [];
        const ref = list.find((r) => r.id === id);
        if (!ref) return;

        openPrescModal({
          title: "Editar referencia extra",
          bodyHTML: `
            <div class="form-group">
              <label>Código</label>
              <input id="extCodigo" type="text" class="form-control" value="${ref.codigo || ""}">
            </div>
            <div class="form-group">
              <label>Descripción</label>
              <textarea id="extDesc" class="form-control" rows="3">${ref.descripcion || ""}</textarea>
            </div>
            <div class="form-group">
              <label>Unidad</label>
              <input id="extUnidad" type="text" class="form-control" value="${ref.unidad || "Ud"}">
            </div>
            <div class="form-group">
              <label>PVP</label>
              <input id="extPvp" type="number" class="form-control" value="${ref.pvp || 0}">
            </div>
          `,
          onSave: async () => {
            const codigo = (document.getElementById("extCodigo").value || "").trim();
            const descripcion = (document.getElementById("extDesc").value || "").trim();
            const unidad = (document.getElementById("extUnidad").value || "").trim() || "Ud";
            const pvp = Number(document.getElementById("extPvp").value || 0);

            await updateExtraRef(id, codigo, descripcion, unidad, pvp);
            renderDocPrescripcionView();
          },
        });
      });
    });

  container
    .querySelectorAll("[data-presc-extra-del]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute(
          "data-presc-extra-del"
        );
        if (!id) return;

        await deleteExtraRef(id);
        renderDocPrescripcionView();
      });
    });

  // Referencias extra ya añadidas al capítulo (cambiar cantidad / borrar)
  const cap = getSelectedCapitulo();
  if (cap && cap.lineas && cap.lineas.length) {
    const rows = container.querySelectorAll(
      ".presc-ref-row[data-presc-ref-row-id]"
    );
    rows.forEach((row) => {
      const rowId = row.getAttribute(
        "data-presc-ref-row-id"
      );
      const linea = cap.lineas.find((l) => l.id === rowId);
      if (!linea) return;
      const tipo = linea.tipo || "budget";
      if (tipo === "extra") {
        const qtyInput = row.querySelector(".presc-ref-qty-input");
        if (qtyInput) {
          qtyInput.addEventListener("input", () => {
            linea.cantidad = Number(qtyInput.value) || 0;
          });
        }
        const delBtn = row.querySelector(".presc-ref-del-btn");
        if (delBtn) {
          delBtn.addEventListener("click", () => {
            cap.lineas = cap.lineas.filter((l) => l.id !== rowId);
            renderDocPrescripcionView();
          });
        }
      }
    });
  }
}

console.log(
  "%cUI Prescripción inicializada (ui_doc_prescripcion.js)",
  "color:#10b981; font-weight:600;"
);
