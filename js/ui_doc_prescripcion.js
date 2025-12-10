// js/ui_doc_prescripcion.js
// Página de PRESCRIPCIÓN / MEDICIONES
// - Vista matriz 2 columnas: capítulos a la izquierda, detalle a la derecha
// - Gestión de plantillas de prescripción en Firestore (prescripcion_templates)
// - Sin lecturas repetidas: carga de plantillas solo una vez por sesión

window.appState = window.appState || {};
appState.documentacion = appState.documentacion || {
  mediaLibrary: [],
  mediaLoaded: false,
};

appState.prescripcion = appState.prescripcion || {
  capitulos: [],            // [{id, codigo, titulo, textoMedicion, partidas: [...] }]
  selectedCapId: null,
  templates: [],            // plantillas cargadas desde Firestore
  templatesLoaded: false,
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
  appState.prescripcion.capitulos = appState.prescripcion.capitulos || [];
  appState.prescripcion.templates = appState.prescripcion.templates || [];
  if (!appState.prescripcion.selectedCapId) {
    const first = appState.prescripcion.capitulos[0];
    appState.prescripcion.selectedCapId = first ? first.id : null;
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
// Plantillas en Firestore
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
    console.log("[PRESCRIPCION] Plantillas cargadas:", templates.length);
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

  const name = window.prompt("Nombre de la plantilla de prescripción:");
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
    alert("✅ Plantilla guardada correctamente.");
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

  // Clonamos capítulos para no mutar el original
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

  alert("✅ Plantilla aplicada a la prescripción actual.");
  renderDocPrescripcionView();
}

// ==============================
// Export (stubs) – siguiente hito
// ==============================

function exportPrescripcionPDF() {
  // TODO: siguiente hito → generar PDF de mediciones por capítulos y partidas
  console.log("[PRESCRIPCION] Export PDF – pendiente de implementar");
  alert("Exportación PDF de mediciones se implementará en el siguiente hito.");
}

function exportPrescripcionBC3() {
  // TODO: siguiente hito → generar fichero BC3 desde appState.prescripcion
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

  const state = appState.prescripcion;
  const capitulos = state.capitulos || [];
  const selectedId = state.selectedCapId;
  const selectedCap = capitulos.find((c) => c.id === selectedId) || null;

  // Selector de plantillas
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
          <div class="card-title">Plantillas de prescripción</div>
          <div class="card-subtitle">
            Guarda y reutiliza estructuras de capítulos y textos de mediciones para futuros proyectos.
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
            <label style="font-size:0.8rem; color:#6b7280; margin-bottom:0.15rem;">Guardar la prescripción actual</label>
            <button id="presBtnSaveTemplate" class="btn btn-primary btn-sm">
              💾 Guardar como plantilla
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Lista de capítulos (columna izquierda)
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

  // Detalle del capítulo seleccionado (columna derecha)
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
            Aquí podrás editar el código, el título, el texto de medición y las referencias con PVP
            asociadas a cada capítulo.
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
              rows="6"
              placeholder="Describe aquí el sistema según lenguaje de mediciones para ingenierías..."
            >${selectedCap.textoMedicion || ""}</textarea>
            <p style="font-size:0.78rem; color:#6b7280; margin-top:0.25rem;">
              Podrás reutilizar textos base desde plantillas o copiar/pegar de otras obras.
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

  container.innerHTML = `
    <div class="proyecto-layout" style="display:flex; flex-direction:column; gap:0.75rem;">
      ${templatesBarHTML}

      <div
        style="
          display:grid;
          grid-template-columns: minmax(260px, 0.9fr) minmax(360px, 1.6fr);
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
                  Estructura las mediciones por capítulos para ingeniería (videportero, accesos, vivienda, etc.).
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

        <!-- Columna derecha: Detalle -->
        <div>
          ${detalleHTML}
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

  // Plantillas
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

  // Añadir capítulo
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

  // Seleccionar capítulo
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

  // Si no hay capítulo seleccionado, no seguimos
  if (!selectedCap) return;

  // Eliminar capítulo
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

  // Código de capítulo
  const inputCodigo = container.querySelector("#presCapCodigo");
  if (inputCodigo) {
    inputCodigo.addEventListener("input", () => {
      selectedCap.codigo = inputCodigo.value;
    });
  }

  // Título de capítulo
  const inputTitulo = container.querySelector("#presCapTitulo");
  if (inputTitulo) {
    inputTitulo.addEventListener("input", () => {
      selectedCap.titulo = inputTitulo.value;
    });
  }

  // Texto de medición
  const inputTexto = container.querySelector("#presCapTexto");
  if (inputTexto) {
    inputTexto.addEventListener("input", () => {
      selectedCap.textoMedicion = inputTexto.value;
    });
  }

  // Añadir partida
  const btnAddPartida = container.querySelector("#presBtnAddPartida");
  if (btnAddPartida) {
    btnAddPartida.addEventListener("click", () => {
      const newPar = createEmptyPartida();
      selectedCap.partidas = selectedCap.partidas || [];
      selectedCap.partidas.push(newPar);
      renderDocPrescripcionView();
    });
  }

  // Editar / borrar partidas (delegación por fila)
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
}

console.log(
  "%cUI Prescripción / Mediciones inicializada (ui_doc_prescripcion.js)",
  "color:#22c55e; font-weight:600;"
);
