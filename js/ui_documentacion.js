// js/ui_documentacion.js
// Página de DOCUMENTACIÓN: memoria de calidades auto-generada + editor flotante

window.appState = window.appState || {};
appState.documentacion = appState.documentacion || {
  idioma: "es", // "es" | "en" | "pt"
  secciones: {}, // mapa: clave -> texto
  customBlocks: [], // bloques añadidos manualmente
  fichasIncluidas: {}, // mapa: idLinea -> true/false
  ultimaAutoGen: null,
  modo: "comercial", // "comercial" | "tecnica"
  mediaLibrary: [], // [{id, nombre, type, mimeType, url, storagePath, uploadedAt, ...}]
  mediaLoaded: false,
  sectionMedia: {}, // mapa: sectionKey -> [mediaId]
};

// Helper local para obtener el contenedor de la app
function getDocAppContent() {
  if (typeof window.getAppContent === "function") {
    return window.getAppContent();
  }
  return document.getElementById("appContent");
}

// ===========================
// CONFIGURACIÓN BASE
// ===========================

const DOC_LANGS = {
  es: { code: "es", label: "Castellano" },
  en: { code: "en", label: "English" },
  pt: { code: "pt", label: "Português (PT)" },
};

const DOC_SECTION_ORDER = [
  "resumen",
  "sistema",
  "equipos",
  "infraestructura",
  "servicios",
  "normativa",
  "otros",
];

// Plantillas base por idioma y sección (con tokens dinámicos)
const DOC_BASE_TEMPLATES = {
  es: {
    resumen:
      "El presente documento describe la solución de videoportero IP y control de accesos propuesta para el proyecto {{NOMBRE_PROYECTO}}, promovido por {{PROMOTORA}}. La solución se ha diseñado para ofrecer una experiencia de acceso segura, cómoda y escalable para {{NUM_VIVIENDAS}} viviendas y sus zonas comunes.",
    sistema:
      "La solución se basa en un sistema de videoportero IP totalmente distribuido, con dispositivos de la marca 2N conectados sobre red Ethernet. El sistema permite la gestión de llamadas de acceso, control de puertas, integración con app móvil y, opcionalmente, con sistemas de domótica y PMS, garantizando una alta disponibilidad y flexibilidad.",
    equipos:
      "La solución incluye los siguientes equipos principales:\n\n{{LISTADO_EQUIPOS}}\n\nCada equipo se ha seleccionado para cumplir con los requisitos de diseño, funcionalidad y durabilidad del proyecto.",
    infraestructura:
      "Toda la infraestructura de comunicaciones se apoya en una red IP basada en cableado estructurado, armarios de comunicaciones y electrónica de red gestionada. El diseño contempla rutas redundantes, alimentación adecuada (PoE cuando aplica) y espacio de reserva para futuras ampliaciones.",
    servicios:
      "La solución puede complementarse con servicios cloud para gestión remota, apertura desde app móvil, actualizaciones de firmware y monitorización del sistema. Estos servicios permiten mejorar la experiencia del usuario final y facilitar el mantenimiento preventivo.",
    normativa:
      "Todos los equipos seleccionados cumplen con la normativa europea vigente en materia de seguridad eléctrica, compatibilidad electromagnética y normativa de telecomunicaciones. Adicionalmente, se sigue la normativa local aplicable en materia de accesibilidad y seguridad de uso.",
    otros:
      "En caso de requerirlo, se pueden incorporar soluciones adicionales como control de accesos por zonas, integración con CCTV, gestión de visitantes o sistemas de reserva de zonas comunes.",
  },
  en: {
    resumen:
      "This document describes the proposed IP video intercom and access control solution for the project {{NOMBRE_PROYECTO}}, developed by {{PROMOTORA}}. The solution has been designed to provide a secure, convenient and scalable access experience for {{NUM_VIVIENDAS}} units and their common areas.",
    sistema:
      "The solution is based on a fully distributed IP video intercom system using 2N devices connected over an Ethernet network. The system enables call handling, door control, mobile app integration and, optionally, integration with home automation and PMS systems, ensuring high availability and flexibility.",
    equipos:
      "The solution includes the following main devices:\n\n{{LISTADO_EQUIPOS}}\n\nEach device has been selected to meet the project's design, functional and durability requirements.",
    infraestructura:
      "All communication infrastructure is based on an IP network using structured cabling, communication racks and managed network switches. The design considers redundant paths, adequate power supply (PoE when applicable) and spare capacity for future expansions.",
    servicios:
      "The solution can be complemented with cloud services for remote management, mobile app door opening, firmware updates and system monitoring. These services enhance the end-user experience and simplify preventive maintenance.",
    normativa:
      "All selected devices comply with the applicable European regulations regarding electrical safety, electromagnetic compatibility and telecom standards. Additionally, local accessibility and safety-of-use regulations are followed.",
    otros:
      "If required, additional solutions can be added such as zoned access control, CCTV integration, visitor management or common area booking systems.",
  },
  pt: {
    resumen:
      "O presente documento descreve a solução proposta de videoporteiro IP e controlo de acessos para o projeto {{NOMBRE_PROYECTO}}, promovido por {{PROMOTORA}}. A solução foi concebida para oferecer uma experiência de acesso segura, cómoda e escalável para {{NUM_VIVIENDAS}} fracções e respetivas zonas comuns.",
    sistema:
      "A solução baseia-se num sistema de videoporteiro IP totalmente distribuído, com dispositivos 2N ligados através de rede Ethernet. O sistema permite a gestão de chamadas de acesso, controlo de portas, integração com aplicação móvel e, opcionalmente, com sistemas de domótica e PMS, garantindo elevada disponibilidade e flexibilidade.",
    equipos:
      "A solução inclui os seguintes equipamentos principais:\n\n{{LISTADO_EQUIPOS}}\n\nCada equipamento foi selecionado para cumprir os requisitos de desenho, funcionalidade e durabilidade do projeto.",
    infraestructura:
      "Toda a infraestrutura de comunicações assenta numa rede IP com cablagem estruturada, bastidores de comunicações e electrónica de rede gerida. O desenho contempla caminhos redundantes, alimentação adequada (PoE quando aplicável) e capacidade de reserva para futuras ampliações.",
    servicios:
      "A solução pode ser complementada com serviços cloud para gestão remota, abertura de portas através de aplicação móvel, atualizações de firmware e monitorização do sistema. Estes serviços melhoram a experiência do utilizador final e facilitam a manutenção preventiva.",
    normativa:
      "Todos os equipamentos selecionados cumprem a regulamentação europeia aplicável em matéria de segurança elétrica, compatibilidade eletromagnética e normas de telecomunicações. Adicionalmente, é cumprida a regulamentação local em matéria de acessibilidade e segurança de utilização.",
    otros:
      "Se necessário, podem ser incorporadas soluções adicionais como controlo de acessos por zonas, integração com CCTV, gestão de visitantes ou sistemas de reserva de zonas comuns.",
  },
};

// ===========================
// HELPERS DE DATOS
// ===========================

function buildDocTokens() {
  const proyecto = appState.proyecto || {};
  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

  const nombreProyecto =
    proyecto.nombre ||
    proyecto.nombreProyecto ||
    presupuesto?.nombreProyecto ||
    "el proyecto";

  const promotora =
    proyecto.promotora ||
    proyecto.cliente ||
    presupuesto?.cliente ||
    "la propiedad";

  let numViviendas =
    proyecto.numViviendas ||
    proyecto.viviendas ||
    presupuesto?.numViviendas ||
    null;

  if (!numViviendas && Array.isArray(proyecto.filas)) {
    numViviendas = proyecto.filas.length;
  }

  return {
    "{{NOMBRE_PROYECTO}}": nombreProyecto,
    "{{PROMOTORA}}": promotora,
    "{{NUM_VIVIENDAS}}": numViviendas ? String(numViviendas) : "las viviendas",
    "{{LISTADO_EQUIPOS}}": buildListadoEquiposTexto(appState.documentacion.idioma),
  };
}

function buildListadoEquiposTexto(idioma) {
  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

  const lineas = Array.isArray(presupuesto?.lineas) ? presupuesto.lineas : [];

  if (!lineas.length) {
    if (idioma === "en")
      return "No devices have been loaded from the current bill of materials.";
    if (idioma === "pt")
      return "Ainda não foram carregados equipamentos a partir da lista de materiais.";
    return "Todavía no se han cargado equipos desde la lista de materiales.";
  }

  const grupos = {};
  lineas.forEach((l, idx) => {
    const cat = l.familia || l.categoria || l.grupo || "General";
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push({
      idx,
      ref: l.ref || l.codigo || l.code || "",
      desc: l.descripcion || l.descripcionCorta || l.desc || "",
      qty: l.cantidad || l.qty || 1,
    });

    if (!appState.documentacion.fichasIncluidas[idx]) {
      appState.documentacion.fichasIncluidas[idx] = true;
    }
  });

  const partes = [];
  Object.keys(grupos).forEach((cat) => {
    partes.push(`- ${cat}:`);
    grupos[cat].forEach((item) => {
      partes.push(
        `   • ${item.ref ? item.ref + " – " : ""}${item.desc} (x${item.qty})`
      );
    });
    partes.push("");
  });

  return partes.join("\n");
}

function applyTokensToTemplate(template, tokens) {
  let out = template || "";
  Object.keys(tokens).forEach((key) => {
    out = out.replaceAll(key, tokens[key]);
  });
  return out;
}

// ===========================
// AUTO-GENERACIÓN DE SECCIONES
// ===========================

function autoGenerateDocumentacion(idioma) {
  const lang = DOC_LANGS[idioma] ? idioma : "es";
  appState.documentacion.idioma = lang;

  const base = DOC_BASE_TEMPLATES[lang] || DOC_BASE_TEMPLATES.es;
  const tokens = buildDocTokens();
  const secciones = {};

  DOC_SECTION_ORDER.forEach((secKey) => {
    const tpl = base[secKey] || "";
    secciones[secKey] = applyTokensToTemplate(tpl, tokens);
  });

  appState.documentacion.secciones = secciones;
  appState.documentacion.ultimaAutoGen = new Date().toISOString();
}

// ===========================
// RENDER PRINCIPAL
// ===========================

function renderDocumentacionView() {
  const container = getDocAppContent();
  if (!container) return;

  if (!appState.documentacion.ultimaAutoGen) {
    autoGenerateDocumentacion(appState.documentacion.idioma || "es");
  }

  // Cargar documentación gráfica desde Firestore (solo una vez)
  ensureDocMediaLoaded();

  const idiomaActual = appState.documentacion.idioma || "es";
  const modoActual = appState.documentacion.modo || "comercial";

  container.innerHTML = `
    <div class="doc-layout">

      <div class="doc-header card">
        <div class="card-header">
          <div>
            <div class="card-title">Documentación</div>
            <div class="card-subtitle">
              Genera la memoria de calidades de forma automática a partir del proyecto y la lista de materiales. Añade textos personalizados cuando lo necesites.
            </div>
          </div>
        </div>

        <div class="doc-toolbar">
          <div class="doc-lang-switch">
            ${Object.values(DOC_LANGS)
              .map(
                (l) => `
              <button
                class="btn btn-sm ${
                  l.code === idiomaActual ? "btn-primary" : "btn-outline"
                }"
                data-doc-lang="${l.code}"
              >
                ${l.label}
              </button>
            `
              )
              .join("")}
          </div>

          <div class="doc-actions">
            <div class="doc-mode-switch">
              <button
                class="btn btn-sm ${
                  modoActual === "comercial" ? "btn-primary" : "btn-outline"
                }"
                id="docModoComercialBtn"
              >
                🧑‍💼 Comercial
              </button>
              <button
                class="btn btn-sm ${
                  modoActual === "tecnica" ? "btn-primary" : "btn-outline"
                }"
                id="docModoTecnicoBtn"
              >
                🧑‍🔬 Técnica
              </button>
            </div>

            <button class="btn btn-sm" id="docRegenerarBtn">
              🔁 Regenerar contenido automático
            </button>
            <button class="btn btn-sm" id="docNuevoBloqueBtn">
              ✏️ Añadir texto personalizado
            </button>
            <button class="btn btn-sm btn-primary" id="docExportarBtn">
              📄 Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <div class="doc-main">
        <div class="doc-sections">
          ${renderDocSectionsHTML()}
        </div>

        <aside class="doc-side">
          <div class="card doc-media-card">
            <div class="card-header doc-media-header">
              <div>
                <div class="card-title">Documentación gráfica</div>
                <div class="card-subtitle">
                  Sube imágenes y documentos y arrástralos a las secciones de la memoria.
                </div>
              </div>
              <div>
                <button class="btn btn-sm btn-outline" id="docMediaUploadBtn" title="Subir archivos">
                  📁
                </button>
                <input
                  type="file"
                  id="docMediaFileInput"
                  multiple
                  style="display:none"
                  accept="image/*,.pdf,.doc,.docx,.docm"
                />
              </div>
            </div>
            <div class="card-body doc-media-body">
              ${renderDocMediaLibraryHTML()}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Fichas técnicas</div>
              <div class="card-subtitle">Selecciona qué equipos incluir como anexo.</div>
            </div>
            <div class="doc-side-body">
              ${renderDocFichasHTML()}
            </div>
          </div>
        </aside>
      </div>

      <div id="docCustomModal" class="doc-modal hidden">
        <div class="doc-modal-content card">
          <div class="card-header">
            <div class="card-title">Añadir texto a la memoria</div>
            <div class="card-subtitle">Elige sección e introduce el contenido personalizado.</div>
          </div>
          <div class="card-body">
            <div class="form-group mb-2">
              <label>Sección destino</label>
              <select id="docCustomSectionSelect" class="form-control">
                ${DOC_SECTION_ORDER.map(
                  (key) => `<option value="${key}">${labelForSection(key)}</option>`
                ).join("")}
              </select>
            </div>
            <div class="form-group mb-3">
              <label>Texto a añadir</label>
              <textarea id="docCustomText" class="form-control" rows="6"
                placeholder="Escribe aquí el párrafo o bloque que quieras añadir a la memoria..."></textarea>
            </div>
          </div>
          <div class="card-footer doc-modal-footer">
            <button class="btn btn-sm" id="docCustomCancelBtn">Cancelar</button>
            <button class="btn btn-sm btn-primary" id="docCustomSaveBtn">Añadir a la memoria</button>
          </div>
        </div>
      </div>

      <div id="docModalBackdrop" class="doc-backdrop hidden"></div>
    </div>
  `;

  attachDocumentacionHandlers();
}

// ===========================
// RENDER PARCIAL DE SECCIONES
// ===========================

function labelForSection(key) {
  switch (key) {
    case "resumen":
      return "Resumen del proyecto";
    case "sistema":
      return "Sistema de videoportero y accesos";
    case "equipos":
      return "Equipos principales";
    case "infraestructura":
      return "Infraestructura y red IP";
    case "servicios":
      return "Servicios cloud y operación";
    case "normativa":
      return "Normativa y cumplimiento";
    case "otros":
      return "Otros aspectos / observaciones";
    default:
      return key;
  }
}

function renderSectionMediaHTML(sectionKey) {
  const mediaMap = {};
  (appState.documentacion.mediaLibrary || []).forEach((m) => {
    if (m.id) mediaMap[m.id] = m;
  });

  const ids =
    (appState.documentacion.sectionMedia &&
      appState.documentacion.sectionMedia[sectionKey]) ||
    [];

  if (!ids.length) return "";

  return ids
    .map((id) => {
      const m = mediaMap[id];
      if (!m) return "";
      const isImage =
        m.type === "image" || (m.mimeType || "").startsWith("image/");
      const icon = isImage ? "" : "📄";
      const caption = m.nombre || "";
      return `
        <div class="doc-section-media-chip">
          <div class="doc-section-media-thumb">
            ${
              isImage && m.url
                ? `<img src="${m.url}" alt="${caption}" />`
                : `<div class="doc-section-media-icon">${icon}</div>`
            }
          </div>
          <div class="doc-section-media-foot">
            <span class="doc-section-media-caption">${caption}</span>
            <button
              type="button"
              class="doc-section-media-remove"
              data-remove-media-id="${id}"
              title="Quitar de la sección"
            >
              ✕
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderDocSectionsHTML() {
  const secciones = appState.documentacion.secciones || {};
  return DOC_SECTION_ORDER.map((key) => {
    const contenido = secciones[key] || "";
    return `
      <div class="card doc-section-card" data-doc-section="${key}">
        <div class="card-header">
          <div class="card-title">${labelForSection(key)}</div>
        </div>
        <div class="card-body">
          <textarea
            class="form-control doc-section-textarea"
            data-doc-section-text="${key}"
            rows="8"
          >${contenido}</textarea>

          <div class="doc-section-media-drop" data-doc-section-drop="${key}">
            <div class="doc-section-media-items">
              ${renderSectionMediaHTML(key)}
            </div>
            <div class="doc-section-media-hint">
              Arrastra aquí imágenes o documentos desde la columna derecha para adjuntarlos a esta sección.
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderDocFichasHTML() {
  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;
  const lineas = Array.isArray(presupuesto?.lineas) ? presupuesto.lineas : [];

  if (!lineas.length) {
    return `
      <p class="text-muted">
        No se ha encontrado lista de materiales en el presupuesto actual.
      </p>
    `;
  }

  return `
    <div class="doc-fichas-list">
      ${lineas
        .map((l, idx) => {
          const id = `docFichaChk_${idx}`;
          const ref = l.ref || l.codigo || l.code || "";
          const desc = l.descripcion || l.desc || "";
          const checked = appState.documentacion.fichasIncluidas[idx] ? "checked" : "";
          return `
            <label class="doc-ficha-item">
              <input type="checkbox" id="${id}" data-doc-ficha-index="${idx}" ${checked} />
              <span class="doc-ficha-main">
                <strong>${ref}</strong> – ${desc}
              </span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderDocMediaLibraryHTML() {
  const media = appState.documentacion.mediaLibrary || [];
  if (!media.length) {
    return `
      <p class="text-muted" style="font-size:0.85rem;">
        Todavía no has subido documentación gráfica.
        Usa el icono 📁 para añadir imágenes o documentos.
      </p>
    `;
  }

  return `
    <div class="doc-media-grid">
      ${media
        .map((m) => {
          const isImage =
            m.type === "image" || (m.mimeType || "").startsWith("image/");
          const icon = isImage ? "" : "📄";
          return `
            <div class="doc-media-item"
                 draggable="true"
                 data-media-id="${m.id}">
              <div class="doc-media-thumb">
                ${
                  isImage && m.url
                    ? `<img src="${m.url}" alt="${m.nombre}" />`
                    : `<div class="doc-media-icon">${icon}</div>`
                }
              </div>
              <div class="doc-media-caption">
                ${m.nombre}
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

// ===========================
// HANDLERS
// ===========================

function attachDocumentacionHandlers() {
  const container = getDocAppContent();
  if (!container) return;

  // Idiomas
  container.querySelectorAll("[data-doc-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-doc-lang") || "es";
      autoGenerateDocumentacion(lang);
      renderDocumentacionView();
    });
  });

  // Modo comercial / técnico
  const modoComBtn = container.querySelector("#docModoComercialBtn");
  const modoTecBtn = container.querySelector("#docModoTecnicoBtn");

  if (modoComBtn) {
    modoComBtn.addEventListener("click", () => {
      appState.documentacion.modo = "comercial";
      renderDocumentacionView();
    });
  }
  if (modoTecBtn) {
    modoTecBtn.addEventListener("click", () => {
      appState.documentacion.modo = "tecnica";
      renderDocumentacionView();
    });
  }

  // Regenerar automático
  const regenBtn = container.querySelector("#docRegenerarBtn");
  if (regenBtn) {
    regenBtn.addEventListener("click", () => {
      autoGenerateDocumentacion(appState.documentacion.idioma || "es");
      renderDocumentacionView();
    });
  }

  // Textareas de secciones
  container.querySelectorAll(".doc-section-textarea").forEach((ta) => {
    ta.addEventListener("input", () => {
      const secKey = ta.getAttribute("data-doc-section-text");
      if (!secKey) return;
      appState.documentacion.secciones = appState.documentacion.secciones || {};
      appState.documentacion.secciones[secKey] = ta.value;
    });
  });

  // Checkboxes de fichas
  container.querySelectorAll("[data-doc-ficha-index]").forEach((chk) => {
    chk.addEventListener("change", () => {
      const idx = chk.getAttribute("data-doc-ficha-index");
      if (idx == null) return;
      appState.documentacion.fichasIncluidas[idx] = chk.checked;
    });
  });

  // Subida de documentación gráfica
  const uploadBtn = container.querySelector("#docMediaUploadBtn");
  const fileInput = container.querySelector("#docMediaFileInput");
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const files = fileInput.files;
      if (files && files.length) {
        await handleMediaUpload(files);
        fileInput.value = "";
      }
    });
  }

  // Drag & drop desde la librería a las secciones
  container.querySelectorAll(".doc-media-item").forEach((item) => {
    item.addEventListener("dragstart", (ev) => {
      const id = item.getAttribute("data-media-id");
      if (!id) return;
      ev.dataTransfer.setData("text/plain", id);
      ev.dataTransfer.effectAllowed = "copy";
    });
  });

  container.querySelectorAll("[data-doc-section-drop]").forEach((zone) => {
    zone.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      zone.classList.add("is-drag-over");
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
    });
    zone.addEventListener("dragleave", () => {
      zone.classList.remove("is-drag-over");
    });
    zone.addEventListener("drop", (ev) => {
      ev.preventDefault();
      zone.classList.remove("is-drag-over");
      const mediaId = ev.dataTransfer.getData("text/plain");
      const sectionKey = zone.getAttribute("data-doc-section-drop");
      if (!mediaId || !sectionKey) return;
      attachMediaToSection(sectionKey, mediaId);
    });
  });

  // Quitar media de sección
  container.querySelectorAll(".doc-section-media-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mediaId = btn.getAttribute("data-remove-media-id");
      const zone = btn.closest("[data-doc-section-drop]");
      const sectionKey = zone
        ? zone.getAttribute("data-doc-section-drop")
        : null;
      if (!mediaId || !sectionKey) return;
      detachMediaFromSection(sectionKey, mediaId);
    });
  });

  // Nuevo bloque custom
  const nuevoBloqueBtn = container.querySelector("#docNuevoBloqueBtn");
  if (nuevoBloqueBtn) {
    nuevoBloqueBtn.addEventListener("click", openDocCustomModal);
  }

  // Exportar PDF
  const exportBtn = container.querySelector("#docExportarBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportarDocumentacionPDF().catch((err) =>
        console.error("Error exportando PDF documentación:", err)
      );
    });
  }

  // Modal custom
  const modal = document.getElementById("docCustomModal");
  const backdrop = document.getElementById("docModalBackdrop");
  const cancelBtn = modal?.querySelector("#docCustomCancelBtn");
  const saveBtn = modal?.querySelector("#docCustomSaveBtn");

  if (cancelBtn) cancelBtn.addEventListener("click", closeDocCustomModal);
  if (backdrop) backdrop.addEventListener("click", closeDocCustomModal);
  if (saveBtn) saveBtn.addEventListener("click", saveDocCustomBlock);
}

// ===========================
// MODAL EDITOR CUSTOM
// ===========================

function openDocCustomModal() {
  const modal = document.getElementById("docCustomModal");
  const backdrop = document.getElementById("docModalBackdrop");
  if (modal) modal.classList.remove("hidden");
  if (backdrop) backdrop.classList.remove("hidden");

  const txt = document.getElementById("docCustomText");
  if (txt) txt.value = "";
}

function closeDocCustomModal() {
  const modal = document.getElementById("docCustomModal");
  const backdrop = document.getElementById("docModalBackdrop");
  if (modal) modal.classList.add("hidden");
  if (backdrop) backdrop.classList.add("hidden");
}

function saveDocCustomBlock() {
  const select = document.getElementById("docCustomSectionSelect");
  const textarea = document.getElementById("docCustomText");
  if (!select || !textarea) return;

  const secKey = select.value;
  const text = textarea.value.trim();
  if (!text) {
    closeDocCustomModal();
    return;
  }

  appState.documentacion.secciones = appState.documentacion.secciones || {};
  const actual = appState.documentacion.secciones[secKey] || "";
  const nuevo =
    actual.trim().length > 0 ? actual.trim() + "\n\n" + text : text;

  appState.documentacion.secciones[secKey] = nuevo;
  appState.documentacion.customBlocks =
    appState.documentacion.customBlocks || [];
  appState.documentacion.customBlocks.push({
    section: secKey,
    text,
    ts: new Date().toISOString(),
  });

  closeDocCustomModal();
  renderDocumentacionView();
}

// ===========================
// MEDIA: FIRESTORE + STORAGE
// ===========================

async function ensureDocMediaLoaded() {
  if (appState.documentacion.mediaLoaded) return;
  appState.documentacion.mediaLoaded = true;
  appState.documentacion.mediaLibrary =
    appState.documentacion.mediaLibrary || [];

  const db =
    window.db ||
    (window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore());

  if (!db) return;

  try {
    const auth =
      window.auth ||
      (window.firebase &&
        window.firebase.auth &&
        window.firebase.auth());
    const user = auth ? auth.currentUser : null;
    const uid = user ? user.uid : null;

    let query = db.collection("documentacion_media");
    if (uid) query = query.where("uid", "==", uid);

    const snap = await query.orderBy("uploadedAt", "desc").limit(100).get();
    const media = [];
    snap.forEach((doc) => {
      media.push({ id: doc.id, ...doc.data() });
    });
    appState.documentacion.mediaLibrary = media;

    const container = getDocAppContent();
    if (container && container.querySelector(".doc-media-body")) {
      renderDocumentacionView();
    }
  } catch (e) {
    console.error("Error cargando documentación gráfica:", e);
  }
}

async function handleMediaUpload(files) {
  if (!files || !files.length) return;
  const list = Array.from(files);
  const newItems = [];
  for (const file of list) {
    try {
      const media = await saveMediaFileToStorageAndFirestore(file);
      newItems.push(media);
    } catch (e) {
      console.error("Error subiendo archivo de documentación:", e);
    }
  }
  appState.documentacion.mediaLibrary =
    (newItems || []).concat(appState.documentacion.mediaLibrary || []);
  renderDocumentacionView();
}

async function saveMediaFileToStorageAndFirestore(file) {
  const name = file.name || "archivo";
  const nowIso = new Date().toISOString();
  const isImage = file.type.startsWith("image/");
  const type = isImage ? "image" : "file";

  const storage =
    window.storage ||
    (window.firebase &&
      window.firebase.storage &&
      window.firebase.storage());
  const db =
    window.db ||
    (window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore());
  const auth =
    window.auth ||
    (window.firebase &&
      window.firebase.auth &&
      window.firebase.auth());

  let url = null;
  let storagePath = null;
  let uid = null;

  if (auth) {
    const user = auth.currentUser;
    uid = user ? user.uid : null;
  }

  if (storage) {
    storagePath = `documentacion_media/${uid || "anon"}/${Date.now()}_${name}`;
    const ref = storage.ref().child(storagePath);
    await ref.put(file);
    url = await ref.getDownloadURL();
  } else {
    url = URL.createObjectURL(file);
  }

  const mediaData = {
    id: null,
    nombre: name,
    type,
    mimeType: file.type,
    url,
    storagePath,
    uploadedAt: nowIso,
  };

  if (db) {
    const docRef = await db.collection("documentacion_media").add({
      ...mediaData,
      uid: uid || null,
    });
    mediaData.id = docRef.id;
  } else {
    mediaData.id = `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  return mediaData;
}

// ===========================
// IMÁGENES DE DISPOSITIVOS
// ===========================

// Convención: si no hay mapa, usa /img/devices/<REF>.png
function getImagenRef(ref) {
  if (!ref) return null;
  const clean = String(ref).trim().toUpperCase();
  if (window.DOC_IMAGENES_POR_REF && window.DOC_IMAGENES_POR_REF[clean]) {
    return window.DOC_IMAGENES_POR_REF[clean];
  }
  return `img/devices/${clean}.png`;
}

function loadImageAsDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ===========================
// MEDIA ASIGNADA A SECCIONES
// ===========================

function attachMediaToSection(sectionKey, mediaId) {
  appState.documentacion.sectionMedia =
    appState.documentacion.sectionMedia || {};
  const arr = appState.documentacion.sectionMedia[sectionKey] || [];
  if (!arr.includes(mediaId)) {
    arr.push(mediaId);
    appState.documentacion.sectionMedia[sectionKey] = arr;
  }
  renderDocumentacionView();
}

function detachMediaFromSection(sectionKey, mediaId) {
  const map = appState.documentacion.sectionMedia || {};
  const arr = map[sectionKey] || [];
  const idx = arr.indexOf(mediaId);
  if (idx >= 0) {
    arr.splice(idx, 1);
    map[sectionKey] = arr;
    appState.documentacion.sectionMedia = map;
  }
  renderDocumentacionView();
}

// ===========================
// EXPORTAR PDF (modo dual)
// ===========================

async function exportarDocumentacionPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert(
      "No se ha podido cargar jsPDF. Revisa la inclusión de la librería en index.html."
    );
    return;
  }

  const modo = appState.documentacion.modo || "comercial";
  if (modo === "comercial") {
    await exportarPDFComercial();
  } else {
    await exportarPDFTecnico();
  }
}

// ===== Versión técnica: memoria clásica + anexo de fichas =====

async function exportarPDFTecnico() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const idioma = appState.documentacion.idioma || "es";
  const secciones = appState.documentacion.secciones || {};

  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;
  const proyecto = appState.proyecto || {};

  const nombreProyecto =
    proyecto.nombre ||
    proyecto.nombreProyecto ||
    presupuesto?.nombreProyecto ||
    "Proyecto";

  const promotora =
    proyecto.promotora ||
    proyecto.cliente ||
    presupuesto?.cliente ||
    "";

  let tituloDoc = "Memoria de calidades";
  if (idioma === "en") tituloDoc = "Technical specification";
  if (idioma === "pt") tituloDoc = "Memória descritiva";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(tituloDoc, 20, 20);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  let y = 28;

  const headerLines = [];
  headerLines.push(`${nombreProyecto}`);
  if (promotora) headerLines.push(promotora);

  headerLines.forEach((line) => {
    const splitted = doc.splitTextToSize(line, 170);
    doc.text(splitted, 20, y);
    y += splitted.length * 5 + 1;
  });

  y += 4;

  function ensureSpace(linesCount) {
    const needed = linesCount * 5 + 8;
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  }

  DOC_SECTION_ORDER.forEach((key) => {
    const contenido = (secciones[key] || "").trim();
    if (!contenido) return;

    const tituloSeccion = labelForSection(key);

    ensureSpace(3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(tituloSeccion, 20, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const textLines = doc.splitTextToSize(contenido, 170);
    ensureSpace(textLines.length);
    doc.text(textLines, 20, y);
    y += textLines.length * 5 + 4;

    // (Opcional) Aquí podrías añadir una lista de "Figuras adjuntas" por sección,
    // usando appState.documentacion.sectionMedia, si quieres reflejarlo también en el PDF.
  });

  const fichasSeleccionadas = [];
  if (presupuesto && Array.isArray(presupuesto.lineas)) {
    presupuesto.lineas.forEach((l, idx) => {
      if (!appState.documentacion.fichasIncluidas[idx]) return;
      const ref = l.ref || l.codigo || l.code || "";
      const desc = l.descripcion || l.desc || "";
      const qty = l.cantidad || l.qty || 1;
      fichasSeleccionadas.push({ ref, desc, qty });
    });
  }

  if (fichasSeleccionadas.length > 0) {
    doc.addPage();
    y = 20;

    let tituloAnexo = "Anexo – Fichas técnicas";
    if (idioma === "en") tituloAnexo = "Appendix – Technical datasheets";
    if (idioma === "pt") tituloAnexo = "Anexo – Fichas técnicas";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(tituloAnexo, 20, y);
    y += 8;

    if (doc.autoTable) {
      const body = fichasSeleccionadas.map((f) => [
        f.ref,
        f.desc,
        String(f.qty),
      ]);

      doc.autoTable({
        startY: y,
        head: [["Ref.", "Descripción", "Cantidad"]],
        body,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [240, 240, 240] },
        margin: { left: 20, right: 20 },
      });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      fichasSeleccionadas.forEach((f) => {
        const line = `${f.ref}  –  ${f.desc}  (x${f.qty})`;
        const splitted = doc.splitTextToSize(line, 170);
        ensureSpace(splitted.length);
        doc.text(splitted, 20, y);
        y += splitted.length * 5 + 2;
      });
    }
  }

  let filenameBase = "memoria_calidades";
  if (idioma === "en") filenameBase = "technical_specification";
  if (idioma === "pt") filenameBase = "memoria_descritiva";

  const safeName = String(nombreProyecto || "proyecto")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  const filename = `${filenameBase}_${safeName || "2n"}.pdf`;
  doc.save(filename);
}

// ===== Versión comercial: portada + página visual por dispositivo =====

async function exportarPDFComercial() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const idioma = appState.documentacion.idioma || "es";
  const secciones = appState.documentacion.secciones || {};

  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;
  const proyecto = appState.proyecto || {};

  const nombreProyecto =
    proyecto.nombre ||
    proyecto.nombreProyecto ||
    presupuesto?.nombreProyecto ||
    "Proyecto";

  const promotora =
    proyecto.promotora ||
    proyecto.cliente ||
    presupuesto?.cliente ||
    "";

  let tituloDoc = "Solución de accesos y videoportero IP";
  if (idioma === "en") tituloDoc = "IP access and video intercom solution";
  if (idioma === "pt") tituloDoc = "Solução IP de acessos e videoporteiro";

  // Portada
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(tituloDoc, 20, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  let y = 40;

  const headerLines = [];
  headerLines.push(nombreProyecto);
  if (promotora) headerLines.push(promotora);

  headerLines.forEach((line) => {
    const splitted = doc.splitTextToSize(line, 170);
    doc.text(splitted, 20, y);
    y += splitted.length * 6;
  });

  y += 8;

  const resumen = (secciones.resumen || "").trim();
  if (resumen) {
    const resumenLines = doc.splitTextToSize(resumen, 170);
    doc.setFontSize(11);
    doc.text(resumenLines, 20, y);
  }

  // Páginas por dispositivo
  const fichas = [];
  if (presupuesto && Array.isArray(presupuesto.lineas)) {
    presupuesto.lineas.forEach((l, idx) => {
      if (!appState.documentacion.fichasIncluidas[idx]) return;
      const ref = l.ref || l.codigo || l.code || "";
      const desc = l.descripcion || l.desc || "";
      const qty = l.cantidad || l.qty || 1;
      fichas.push({ ref, desc, qty });
    });
  }

  for (const f of fichas) {
    doc.addPage();

    // Título dispositivo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(f.desc || f.ref, 20, 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Ref: ${f.ref}  ·  x${f.qty}`, 20, 32);

    // Imagen grande
    const imgUrl = getImagenRef(f.ref);
    if (imgUrl) {
      try {
        const dataUrl = await loadImageAsDataUrl(imgUrl);
        const imgW = 120;
        const imgH = 75;
        const imgX = (210 - imgW) / 2;
        const imgY = 40;
        doc.addImage(dataUrl, "PNG", imgX, imgY, imgW, imgH);
      } catch (e) {
        console.warn("No se pudo cargar imagen para", f.ref, imgUrl, e);
      }
    }

    // Bullets comerciales
    let bullets = [];
    if (idioma === "en") {
      bullets = [
        "Premium IP video intercom device.",
        "Ideal for high-end residential projects and common areas.",
        "Scalable and fully integrated with access control and mobile app.",
      ];
    } else if (idioma === "pt") {
      bullets = [
        "Dispositivo de videoporteiro IP premium.",
        "Ideal para empreendimentos residenciais de alto padrão e zonas comuns.",
        "Escalável e totalmente integrado com controlo de acessos e app móvel.",
      ];
    } else {
      bullets = [
        "Dispositivo de videoportero IP de gama alta.",
        "Ideal para residenciales premium y zonas comunes representativas.",
        "Escalable e integrado con control de accesos y app móvil.",
      ];
    }

    let yBullets = 125;
    doc.setFontSize(11);
    bullets.forEach((b) => {
      const lines = doc.splitTextToSize("• " + b, 170);
      doc.text(lines, 20, yBullets);
      yBullets += lines.length * 6;
    });
  }

  let filenameBase = "presentacion_accesos";
  if (idioma === "en") filenameBase = "access_solution_presentation";
  if (idioma === "pt") filenameBase = "apresentacao_acessos";

  const safeName = String(nombreProyecto || "proyecto")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  const filename = `${filenameBase}_${safeName || "2n"}.pdf`;
  doc.save(filename);
}

// Exponer función principal al global para poder llamarla desde el router/menu
window.renderDocumentacionView = renderDocumentacionView;
