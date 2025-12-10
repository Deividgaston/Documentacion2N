// js/ui_doc_prescripcion.js
// Página de PRESCRIPCIÓN (mediciones / capítulos a partir del presupuesto)
// - Columna izquierda: capítulos (secciones del presupuesto + referencias y cantidades)
// - Columna central: texto del capítulo seleccionado
// - Columna derecha: plantillas (guardadas en Firestore) que se pueden aplicar por clic o drag&drop

window.appState = window.appState || {};
appState.prescripcion = appState.prescripcion || {
  capitulos: [],            // [{ id, nombre, texto, lineas: [{id,codigo,descripcion,cantidad,pvp}] }]
  selectedCapituloId: null,
  plantillas: [],           // [{ id, nombre, texto }]
  plantillasLoaded: false,
};

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
// Helpers de presupuesto -> capítulos
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

// Intenta ser robusto con el formato del presupuesto
function buildCapitulosFromPresupuesto() {
  const presu = getPresupuestoActualSafe();
  if (!presu) {
    console.warn(
      "[PRESCRIPCION] No hay presupuesto cargado. No se pueden generar capítulos."
    );
    return [];
  }

  console.log(
    "[PRESCRIPCION] Presupuesto actual para construir capítulos:",
    presu
  );

  const seccionesMap = presu.secciones || presu.sections || {};
  const lineas = presu.lineas || presu.lines || presu.lineItems || [];

  const capitulosBySec = {};

  lineas.forEach((l) => {
    // Intentamos localizar la "sección" / "capítulo" de cada línea
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
    });
  });

  // Pasamos a array y ordenamos por algún criterio razonable
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
// Firestore: plantillas de prescripción
// ==============================

async function ensurePrescripcionPlantillasLoaded() {
  appState.prescripcion = appState.prescripcion || {};
  if (appState.prescripcion.plantillasLoaded) return;

  const db =
    typeof getFirestoreInstance === "function"
      ? getFirestoreInstance()
      : null;
  const auth =
    typeof getAuthInstance === "function"
      ? getAuthInstance()
      : null;

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

  const db =
    typeof getFirestoreInstance === "function"
      ? getFirestoreInstance()
      : null;
  const auth =
    typeof getAuthInstance === "function"
      ? getAuthInstance()
      : null;

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
    // Si falla Firestore, al menos mantenemos local
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

  const db =
    typeof getFirestoreInstance === "function"
      ? getFirestoreInstance()
      : null;
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

  const db =
    typeof getFirestoreInstance === "function"
      ? getFirestoreInstance()
      : null;
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
// Render principal
// ==============================

async function renderPrescripcionView() {
  const container = getPrescripcionAppContent();
  if (!container) return;

  ensureCapitulosIniciales();
  await ensurePrescripcionPlantillasLoaded();

  const caps = appState.prescripcion.capitulos || [];
  const plantillas = appState.prescripcion.plantillas || [];
  const capSel = getSelectedCapitulo();

  // Render capítulos (izquierda)
  let capitulosHTML = "";
  if (!caps.length) {
    capitulosHTML = `
      <p class="text-muted" style="font-size:0.85rem;">
        No se han podido generar capítulos desde el presupuesto.<br />
        Asegúrate de tener un presupuesto cargado.
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

        const refsPreview = lineas
          .slice(0, 4)
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
              ${c.nombre || "(sin título)"}
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

  // Texto del capítulo seleccionado (centro)
  const textoCap =
    (capSel && capSel.texto) ||
    "";

  const nombreCap =
    (capSel && capSel.nombre) ||
    "";

  // Plantillas (derecha)
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

  container.innerHTML = `
    <div
      class="proyecto-layout"
      style="
        display:grid;
        grid-template-columns: 1fr 1.4fr 1.2fr;
        gap: 1rem;
        align-items:flex-start;
      "
    >
      <!-- Columna 1: Capítulos -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Capítulos de prescripción</div>
            <div class="card-subtitle">
              Se generan automáticamente a partir de las secciones y referencias del presupuesto.
            </div>
          </div>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <span class="chip">Prescripción</span>
            <button
              type="button"
              id="prescReloadFromBudgetBtn"
              class="btn btn-xs btn-outline"
              title="Regenerar capítulos desde el presupuesto actual"
            >
              🔄 Regenerar
            </button>
          </div>
        </div>
        <div class="card-body presc-capitulos-list">
          ${capitulosHTML}
        </div>
      </div>

      <!-- Columna 2: Texto del capítulo -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              Texto del capítulo
            </div>
            <div class="card-subtitle">
              Selecciona un capítulo a la izquierda y edita aquí el texto de mediciones.
              Puedes arrastrar una plantilla desde la columna derecha.
            </div>
          </div>
        </div>
        <div class="card-body">
          ${
            capSel
              ? `
            <div class="form-group">
              <label>Título del capítulo</label>
              <input
                type="text"
                id="prescCapituloTituloInput"
                class="form-control"
                value="${nombreCap.replace(/"/g, "&quot;")}"
              />
            </div>

            <div class="form-group">
              <label>Texto de mediciones</label>
              <textarea
                id="prescCapituloTexto"
                class="form-control"
                rows="14"
                placeholder="Arrastra aquí una plantilla o escribe el texto de mediciones..."
              >${textoCap}</textarea>
              <p style="font-size:0.78rem; color:#6b7280; margin-top:0.25rem;">
                Drag & drop: arrastra una plantilla desde la derecha sobre este cuadro para
                rellenar el capítulo.
              </p>
            </div>

            <div class="form-group">
              <label>Referencias incluidas en este capítulo</label>
              ${
                (capSel.lineas || []).length
                  ? `
                <div class="presc-capitulo-ref-table">
                  ${(capSel.lineas || [])
                    .map((l) => {
                      const cod = l.codigo || "";
                      const desc = l.descripcion || "";
                      const cant =
                        typeof l.cantidad !== "undefined"
                          ? l.cantidad
                          : "";
                      return `
                        <div class="presc-ref-row">
                          <span class="presc-ref-code">${cod}</span>
                          <span class="presc-ref-desc">${desc}</span>
                          <span class="presc-ref-qty">x${cant}</span>
                        </div>
                      `;
                    })
                    .join("")}
                </div>
              `
                  : `
                <p class="text-muted" style="font-size:0.8rem;">
                  Este capítulo no tiene referencias asociadas en el presupuesto.
                </p>
              `
              }
            </div>
          `
              : `
            <p class="text-muted" style="font-size:0.85rem;">
              No hay ningún capítulo seleccionado. Genera capítulos desde el presupuesto
              o haz clic en uno de la columna izquierda.
            </p>
          `
          }
        </div>
      </div>

      <!-- Columna 3: Plantillas -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Plantillas de prescripción</div>
            <div class="card-subtitle">
              Define textos estándar por tipo de sistema (videoportero, control de accesos, monitores, etc.)
              y aplícalos a los capítulos.
            </div>
          </div>
          <div>
            <button
              type="button"
              id="prescNewPlantillaBtn"
              class="btn btn-sm btn-primary"
            >
              ➕ Nueva plantilla
            </button>
          </div>
        </div>
        <div class="card-body presc-plantillas-list">
          ${plantillasHTML}
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

  // Regenerar capítulos desde presupuesto
  const reloadBtn = container.querySelector("#prescReloadFromBudgetBtn");
  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      const ok = window.confirm(
        "Esto regenerará los capítulos desde el presupuesto actual.\n\n" +
          "⚠️ Se perderán los textos de capítulo que tengas escritos.\n\n" +
          "¿Quieres continuar?"
      );
      if (!ok) return;

      const caps = buildCapitulosFromPresupuesto();
      appState.prescripcion.capitulos = caps;
      appState.prescripcion.selectedCapituloId = caps.length
        ? caps[0].id
        : null;

      renderPrescripcionView();
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
        renderPrescripcionView();
      });
    });

  // Edición título capítulo
  const tituloInput = container.querySelector(
    "#prescCapituloTituloInput"
  );
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

  // Drag start en plantillas
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

  // Crear nueva plantilla (usamos prompts sencillos = cuadro flotante nativo)
  const newBtn = container.querySelector("#prescNewPlantillaBtn");
  if (newBtn) {
    newBtn.addEventListener("click", async () => {
      const nombre = window.prompt(
        "Nombre de la plantilla:",
        ""
      );
      if (nombre === null) return;

      const texto = window.prompt(
        "Texto de la plantilla (puedes editarlo más tarde):",
        ""
      );
      if (texto === null) return;

      await createPrescripcionPlantilla(nombre, texto);
      renderPrescripcionView();
    });
  }

  // Aplicar plantilla al capítulo seleccionado (clic)
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

  // Editar plantilla
  container
    .querySelectorAll("[data-presc-plantilla-edit]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute(
          "data-presc-plantilla-edit"
        );
        if (!id) return;

        const plantillas =
          appState.prescripcion.plantillas || [];
        const tpl = plantillas.find((p) => p.id === id);
        if (!tpl) return;

        const nuevoNombre = window.prompt(
          "Nuevo nombre de la plantilla:",
          tpl.nombre || ""
        );
        if (nuevoNombre === null) return;

        const nuevoTexto = window.prompt(
          "Nuevo texto de la plantilla:",
          tpl.texto || ""
        );
        if (nuevoTexto === null) return;

        await updatePrescripcionPlantilla(
          id,
          nuevoNombre,
          nuevoTexto
        );
        renderPrescripcionView();
      });
    });

  // Borrar plantilla
  container
    .querySelectorAll("[data-presc-plantilla-delete]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute(
          "data-presc-plantilla-delete"
        );
        if (!id) return;

        await deletePrescripcionPlantilla(id);
        renderPrescripcionView();
      });
    });
}

console.log(
  "%cUI Prescripción inicializada (ui_doc_prescripcion.js)",
  "color:#10b981; font-weight:600;"
);
