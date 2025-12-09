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
  mediaLibrary: [], // [{id, nombre, type, mimeType, url, storagePath, folderName, docCategory,...}]
  mediaLoaded: false,
  sectionMedia: {}, // mapa: sectionKey -> [mediaId]
  selectedFichasMediaIds: [], // fichas técnicas seleccionadas desde la biblioteca
  mediaSearchTerm: "", // término de búsqueda para documentación gráfica
  fichasSearchTerm: "", // término de búsqueda para fichas técnicas
  includedSections: {}, // mapa: sectionKey -> true/false (incluir en PDF técnico)
  logoData: null, // cache logo para PDF
  sectionTitles: {}, // títulos personalizados por sección
};

// ======================================================
// PERSISTENCIA LOCAL
// ======================================================

const DOC_STORAGE_KEY = "docState_v1";

// Cargar estado guardado
(function loadDocStateFromLocalStorage() {
  try {
    const raw = window.localStorage && localStorage.getItem(DOC_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    appState.documentacion = {
      ...appState.documentacion,
      ...saved,
    };
  } catch (e) {
    console.error("Error cargando estado de documentación:", e);
  }
})();

// Guardar estado relevante
function saveDocStateToLocalStorage() {
  try {
    if (!window.localStorage) return;
    const toSave = {
      idioma: appState.documentacion.idioma,
      secciones: appState.documentacion.secciones,
      customBlocks: appState.documentacion.customBlocks,
      fichasIncluidas: appState.documentacion.fichasIncluidas,
      modo: appState.documentacion.modo,
      sectionMedia: appState.documentacion.sectionMedia,
      selectedFichasMediaIds: appState.documentacion.selectedFichasMediaIds,
      mediaSearchTerm: appState.documentacion.mediaSearchTerm || "",
      fichasSearchTerm: appState.documentacion.fichasSearchTerm || "",
      includedSections: appState.documentacion.includedSections || {},
      sectionTitles: appState.documentacion.sectionTitles || {},
    };
    localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error("Error guardando estado documentación:", e);
  }
}

// ======================================================
// CONFIGURACIÓN BASE
// ======================================================

const DOC_LANGS = {
  es: { code: "es", label: "Castellano" },
  en: { code: "en", label: "English" },
  pt: { code: "pt", label: "Português (PT)" },
};

// 🔵 NUEVA SECCIÓN incorporada en el orden
const DOC_SECTION_ORDER = [
  "presentacion_empresa",
  "resumen",
  "sistema",
  "equipos",
  "infraestructura",
  "servicios",
  "normativa_red",
  "normativa_lpd",
  "normativa_ciber",
  "otros",
];

// Logo por defecto
const DOC_LOGO_DEFAULT_URL = "img/logo_2n.svg";

// Imagen portada técnica
const DOC_TECH_COVER_URL = "img/PortadaTecnica.jpg";

// ======================================================
// PLANTILLAS BASE
// ======================================================

const DOC_BASE_TEMPLATES = {
  es: {
    resumen:
      "El presente documento describe la solución de videoportero IP y control de accesos propuesta para el proyecto {{NOMBRE_PROYECTO}}, promovido por {{PROMOTORA}}.",
    sistema:
      "La solución se basa en un sistema de videoportero IP totalmente distribuido...",
    equipos:
      "La solución incluye los siguientes equipos principales:\n\n{{LISTADO_EQUIPOS}}",
    infraestructura:
      "Toda la infraestructura de comunicaciones se apoya en una red IP basada en cableado estructurado...",
    servicios:
      "La solución puede complementarse con servicios cloud para gestión remota...",
    normativa_red:
      "Normativa RED (Radio Equipment Directive) – 1 de agosto de 2025...",
    normativa_lpd:
      "Protección de datos (LPD / GDPR)...",
    normativa_ciber:
      "Ciberseguridad y certificaciones 2N...",
    otros:
      "En caso de requerirlo, se podrán añadir servicios adicionales o integraciones.",
  },

  en: {
    resumen: "This document describes the proposed IP intercom and access system...",
    sistema: "The solution is based on a fully distributed IP video door system...",
    equipos: "The solution includes the following main devices:\n\n{{LISTADO_EQUIPOS}}",
    infraestructura: "All communication infrastructure is based on an IP network...",
    servicios: "Cloud services can be added to enhance...",
    normativa_red: "RED Directive compliance...",
    normativa_lpd: "GDPR compliance information...",
    normativa_ciber: "Cybersecurity and Axis Group practices...",
    otros: "Additional notes and optional integrations.",
  },

  pt: {
    resumen: "O presente documento descreve a solução proposta de videoporteiro IP...",
    sistema: "A solução baseia-se num sistema de videoporteiro IP totalmente distribuído...",
    equipos: "A solução inclui os seguintes equipamentos principais:\n\n{{LISTADO_EQUIPOS}}",
    infraestructura: "A infraestrutura de comunicações assenta numa rede IP com cablagem...",
    servicios: "A solução pode ser complementada com serviços cloud...",
    normativa_red: "Norma RED e requisitos de cibersegurança...",
    normativa_lpd: "Informações sobre RGPD...",
    normativa_ciber: "Práticas de cibersegurança e Axis...",
    otros: "Notas adicionais.",
  },
};
// ======================================================
// HELPERS DE TOKENS Y GENERACIÓN AUTOMÁTICA
// ======================================================

function buildDocTokens() {
  const proyecto = appState.proyecto || {};
  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

  const nombreProyecto =
    proyecto.nombre ||
    proyecto.nombreProyecto ||
    (presupuesto && presupuesto.nombreProyecto) ||
    "el proyecto";

  const promotora =
    proyecto.promotora ||
    proyecto.cliente ||
    (presupuesto && presupuesto.cliente) ||
    "la propiedad";

  let listado = "";

  if (presupuesto && Array.isArray(presupuesto.lineas)) {
    const eq = presupuesto.lineas
      .map((l) => {
        const ref = l.ref || l.referencia || "";
        const desc = l.descripcion || "";
        const qty = l.cantidad || 1;
        return `• ${ref} – ${desc} (x${qty})`;
      })
      .join("\n");

    listado = eq;
  }

  return {
    "{{NOMBRE_PROYECTO}}": nombreProyecto,
    "{{PROMOTORA}}": promotora,
    "{{LISTADO_EQUIPOS}}": listado,
  };
}

function applyTokensToTemplate(txt, tokens) {
  let out = txt || "";
  if (!txt) return "";
  Object.keys(tokens).forEach((k) => {
    out = out.replace(new RegExp(k, "g"), tokens[k]);
  });
  return out;
}

// ======================================================
// AUTO-GENERACIÓN DE SECCIONES
// ======================================================

function autoGenerateDocumentacion(idioma) {
  const lang = DOC_BASE_TEMPLATES[idioma] ? idioma : "es";
  const base = DOC_BASE_TEMPLATES[lang];
  const tokens = buildDocTokens();

  const nuevas = {};

  DOC_SECTION_ORDER.forEach((key) => {
    if (key === "presentacion_empresa") {
      // texto fijo, no IA, no media
      nuevas[key] =
        appState.documentacion.secciones[key] ||
        "2N lidera el camino en tecnología de control de acceso: ofrecemos las mejores características modernas sin comprometer la confiabilidad y la facilidad de uso.\n\n" +
          "2N tiene más de 30 años de experiencia en el desarrollo de productos innovadores y de alta calidad: después de inventar el primer intercomunicador IP del mundo en 2008 y el primer intercomunicador LTE / 4G diez años después, continuamos empujando los límites y reaccionando a las cambiantes demandas del mercado.\n\n" +
          "Nuestra cartera incluye intercomunicadores, unidades contestadoras, lectores de control de acceso y sistemas de elevación. Juntos, estos productos crean una solución IP avanzada para cualquier proyecto residencial.\n\n" +
          "En 2N nos tomamos el diseño tan en serio como la innovación, y los Red Dot e iF Design Awards lo demuestran.\n\n" +
          "Historia de la empresa:\n" +
          "2N fue fundada en 1991 en Praga. En 2016 se unió al Grupo Axis, aumentando estabilidad e innovación.";
    } else {
      const tpl = base[key] || "";
      nuevas[key] = applyTokensToTemplate(tpl, tokens);
    }
  });

  appState.documentacion.secciones = nuevas;
  appState.documentacion.ultimaAutoGen = new Date().toISOString();

  saveDocStateToLocalStorage();
}

// ======================================================
// UTILIDADES
// ======================================================

function docEscapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getSectionTitle(key) {
  const titles = appState.documentacion.sectionTitles || {};
  const custom = titles[key];
  if (custom && custom.trim().length) return custom.trim();

  switch (key) {
    case "presentacion_empresa":
      return "Presentación de la empresa";
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
    case "normativa_red":
      return "Normativa RED (1 agosto 2025)";
    case "normativa_lpd":
      return "Protección de datos (LPD / GDPR)";
    case "normativa_ciber":
      return "Ciberseguridad y cumplimiento";
    case "otros":
      return "Otros aspectos / observaciones";
    default:
      return key;
  }
}

function getSectionIncluded(key) {
  const m = appState.documentacion.includedSections || {};
  if (typeof m[key] === "boolean") return m[key];
  return true; // por defecto incluidas
}

// ======================================================
// MEDIA: ASIGNACIÓN POR SECCIÓN
// ======================================================

function renderSectionMediaHTML(sectionKey) {
  // ❗ Esta función NO se usa para presentación_empresa
  if (sectionKey === "presentacion_empresa") return "";

  const map = {};
  (appState.documentacion.mediaLibrary || []).forEach((m) => {
    if (m.id) map[m.id] = m;
  });

  const ids =
    appState.documentacion.sectionMedia?.[sectionKey] || [];

  if (!ids.length) return "";

  return ids
    .map((id) => {
      const m = map[id];
      if (!m) return "";

      const isImage =
        (m.mimeType || "").startsWith("image/") ||
        (m.type || "") === "image" ||
        /\.(png|jpg|jpeg|webp|gif)$/i.test(m.url || "");

      const caption = m.nombre || "";

      return `
        <div class="doc-section-media-chip">
          <div class="doc-section-media-thumb">
            ${
              isImage
                ? `<img src="${m.url}" alt="${caption}" />`
                : `<div class="doc-section-media-icon">📄</div>`
            }
          </div>
          <div class="doc-section-media-foot">
            <span class="doc-section-media-caption">${caption}</span>
            <button type="button"
              class="doc-section-media-remove"
              data-remove-media-id="${id}"
              title="Quitar de la sección">✕</button>
          </div>
        </div>
      `;
    })
    .join("");
}
// ======================================================
// RENDER DE SECCIONES EN LA PÁGINA
// ======================================================

function renderSectionPresentacionHTML() {
  const key = "presentacion_empresa";
  const title = getSectionTitle(key);
  const included = getSectionIncluded(key);
  const texto = appState.documentacion.secciones[key] || "";

  return `
    <div class="card doc-section-card" data-doc-section="${key}">
      <div class="card-header">
        <div class="doc-section-title-wrap" style="flex:1;max-width:60%">
          <input 
            type="text"
            class="form-control doc-section-title-input"
            data-doc-section-title="${key}"
            value="${docEscapeHtml(title)}"
            placeholder="Presentación de la empresa"
          />
        </div>

        <div class="doc-section-header-actions">
          <label class="doc-section-include-toggle"
            style="font-size:0.75rem;display:flex;align-items:center;gap:0.25rem;margin-right:0.5rem;">
            <input type="checkbox"
              data-doc-section-enable="${key}"
              ${included ? "checked" : ""} />
            Incluir en PDF
          </label>

          <button class="btn btn-xs btn-disabled" disabled
            title="No disponible para IA">
            ✨ IA no disponible
          </button>
        </div>
      </div>

      <div class="card-body">
        <textarea 
          class="form-control doc-section-textarea"
          data-doc-section-text="${key}"
          rows="12">${texto}</textarea>

        <p class="text-muted" style="font-size:0.8rem;margin-top:8px;">
          Esta sección no admite imágenes ni documentos adjuntos.
        </p>
      </div>
    </div>
  `;
}

function renderDocSectionsHTML() {
  const secciones = appState.documentacion.secciones || {};

  return DOC_SECTION_ORDER.map((key) => {
    // 👉 Sección especial
    if (key === "presentacion_empresa") {
      return renderSectionPresentacionHTML();
    }

    // 👉 Secciones estándar
    const contenido = secciones[key] || "";
    const included = getSectionIncluded(key);
    const title = getSectionTitle(key);

    return `
      <div class="card doc-section-card" data-doc-section="${key}">
        <div class="card-header">
          <div class="doc-section-title-wrap" style="flex:1;max-width:60%">
            <input type="text"
              class="form-control doc-section-title-input"
              data-doc-section-title="${key}"
              value="${docEscapeHtml(title)}"
              placeholder="${docEscapeHtml(labelForSection(key))}" />
          </div>

          <div class="doc-section-header-actions">
            <label class="doc-section-include-toggle"
              style="font-size:0.75rem;display:flex;align-items:center;gap:0.25rem;margin-right:0.5rem;">
              <input type="checkbox"
                data-doc-section-enable="${key}"
                ${included ? "checked" : ""} />
              Incluir en PDF
            </label>

            <button class="btn btn-xs btn-outline"
              data-doc-ai-section="${key}">
              ✨ Preguntar a IA
            </button>
          </div>
        </div>

        <div class="card-body">

          <textarea 
            class="form-control doc-section-textarea"
            data-doc-section-text="${key}"
            rows="10">${contenido}</textarea>

          <div class="doc-section-media-drop"
            data-doc-section-drop="${key}">
            <div class="doc-section-media-items">
              ${renderSectionMediaHTML(key)}
            </div>
            <div class="doc-section-media-hint">
              Arrastra aquí imágenes o documentos
            </div>
          </div>

        </div>
      </div>
    `;
  }).join("");
}

// ======================================================
// RENDER FICHAS TÉCNICAS
// ======================================================

function renderDocFichasHTML() {
  const media = appState.documentacion.mediaLibrary || [];

  const fichas = media.filter((m) => {
    const mime = (m.mimeType || "").toLowerCase();
    if (mime === "application/pdf") return true;
    if (mime.includes("word")) return true;
    if ((m.docCategory || "").toLowerCase() === "ficha") return true;
    return false;
  });

  const sel = new Set(appState.documentacion.selectedFichasMediaIds || []);

  if (!fichas.length) {
    return `
      <p class="text-muted" style="font-size:0.85rem">
        Todavía no hay fichas técnicas.
      </p>
    `;
  }

  const term = (appState.documentacion.fichasSearchTerm || "").toLowerCase();

  const filtered = term
    ? fichas.filter((m) =>
        (
          (m.nombre || "") +
          " " +
          (m.folderName || "") +
          " " +
          (m.docCategory || "")
        )
          .toLowerCase()
          .includes(term)
      )
    : fichas;

  if (!filtered.length) {
    return `
      <p class="text-muted" style="font-size:0.85rem">
        No se encontraron fichas que coincidan con la búsqueda.
      </p>
    `;
  }

  const list = filtered
    .map((m) => {
      const checked = sel.has(m.id) ? "checked" : "";
      const label = m.folderName
        ? `<strong>${m.folderName}</strong> – ${m.nombre}`
        : m.nombre;
      return `
        <label class="doc-ficha-item">
          <input type="checkbox" data-doc-ficha-media-id="${m.id}" ${checked} />
          <span>${label}</span>
        </label>
      `;
    })
    .join("");

  return `
    <div class="doc-fichas-section">
      <div class="doc-fichas-block">
        <div class="doc-fichas-title">Fichas técnicas</div>
        <p class="doc-fichas-help">
          Selecciona qué fichas deseas adjuntar al PDF técnico.
        </p>
        <input type="text" id="docFichasSearchInput"
          class="form-control"
          placeholder="Buscar..."
          value="${docEscapeHtml(appState.documentacion.fichasSearchTerm || "")}" />
        <div class="doc-fichas-list doc-fichas-media-list">
          ${list}
        </div>
      </div>
    </div>
  `;
}
// ======================================================
// LIMPIEZA Y FILTRO DE DOCUMENTACIÓN GRÁFICA
// ======================================================

function cleanInvalidMediaItems() {
  const list = appState.documentacion.mediaLibrary || [];
  const cleaned = list.filter((m) => m && m.id && typeof m.id === "string");
  if (cleaned.length !== list.length) {
    appState.documentacion.mediaLibrary = cleaned;
  }
}

function renderDocMediaLibraryHTML() {
  const allMedia = appState.documentacion.mediaLibrary || [];

  if (!allMedia.length) {
    return `
      <p class="text-muted" style="font-size:0.85rem;">
        Todavía no has subido documentación gráfica.
      </p>
    `;
  }

  cleanInvalidMediaItems();

  // Filtrar solo imágenes
  const images = (appState.documentacion.mediaLibrary || []).filter((m) => {
    const mime = (m.mimeType || "").toLowerCase();
    const type = (m.type || "").toLowerCase();
    const url = (m.url || "").split("?")[0].toLowerCase();

    const isMimeImage = mime.startsWith("image/");
    const isTypeImage = type === "image";
    const hasExt = /\.(png|jpg|jpeg|gif|webp)$/i.test(url);

    return isMimeImage || isTypeImage || hasExt;
  });

  if (!images.length) {
    return `
      <p class="text-muted" style="font-size:0.85rem;">
        No hay imágenes disponibles.
      </p>
    `;
  }

  const term = (appState.documentacion.mediaSearchTerm || "")
    .trim()
    .toLowerCase();

  const filtered = term
    ? images.filter((m) => {
        const txt =
          (m.nombre || "") +
          " " +
          (m.folderName || "") +
          " " +
          (m.docCategory || "");
        return txt.toLowerCase().includes(term);
      })
    : images;

  if (!filtered.length) {
    return `<p class="text-muted" style="font-size:0.85rem;">Sin coincidencias.</p>`;
  }

  return `
    <div class="doc-media-list doc-fichas-list">
      ${filtered
        .map((m) => {
          const caption = m.folderName
            ? `${m.folderName} – ${m.nombre}`
            : m.nombre;

          return `
            <div class="doc-media-item doc-media-row" draggable="true"
                 data-media-id="${m.id}">
              <div class="doc-media-row-main">
                <span class="doc-media-row-icon">🖼️</span>
                <span class="doc-media-caption">${caption}</span>
              </div>
              <div class="doc-media-row-actions">
                <button class="btn btn-xs" data-media-view-id="${m.id}">
                  👁 Ver
                </button>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

// ======================================================
// REFRESCAR SOLO GRID DE IMÁGENES
// ======================================================

function refreshDocMediaGridOnly() {
  const container = getDocAppContent();
  if (!container) return;

  const body = container.querySelector(".doc-media-body");
  if (!body) return;

  body.innerHTML = renderDocMediaLibraryHTML();
  attachDocMediaGridHandlers(container);
}

// ======================================================
// PREVISUALIZADOR FLOTANTE DE IMAGEN
// ======================================================

function openDocImageFloatingPreview(item) {
  if (!item || !item.url) return;

  const existing = document.getElementById("docMediaFloatingPreview");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "docMediaFloatingPreview";
  overlay.classList.add("doc-floating-overlay");

  overlay.innerHTML = `
    <div class="doc-floating-content">
      <div class="doc-floating-header">
        <span class="doc-floating-title">${docEscapeHtml(item.nombre)}</span>
        <button id="docMediaFloatingCloseBtn" class="doc-floating-close">✕</button>
      </div>
      <div class="doc-floating-body">
        <img src="${item.url}" class="doc-floating-img" />
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById("docMediaFloatingCloseBtn")
    .addEventListener("click", () => overlay.remove());

  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) overlay.remove();
  });
}

// ======================================================
// HANDLERS PRINCIPALES
// ======================================================

function attachDocumentacionHandlers() {
  const container = getDocAppContent();
  if (!container) return;

  // -------------------------
  // Buscadores
  // -------------------------

  const searchInput = container.querySelector("#docMediaSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      appState.documentacion.mediaSearchTerm = searchInput.value || "";
      saveDocStateToLocalStorage();
      refreshDocMediaGridOnly();
    });
  }

  const fichasSearchInput = container.querySelector("#docFichasSearchInput");
  if (fichasSearchInput) {
    fichasSearchInput.addEventListener("input", () => {
      appState.documentacion.fichasSearchTerm = fichasSearchInput.value || "";
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  }

  // -------------------------
  // Títulos editables
  // -------------------------

  container.querySelectorAll(".doc-section-title-input").forEach((inp) => {
    inp.addEventListener("input", () => {
      const key = inp.getAttribute("data-doc-section-title");
      if (!key) return;

      appState.documentacion.sectionTitles =
        appState.documentacion.sectionTitles || {};
      appState.documentacion.sectionTitles[key] = inp.value || "";

      saveDocStateToLocalStorage();
    });
  });

  // -------------------------
  // Cambios de idioma
  // -------------------------

  container.querySelectorAll("[data-doc-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-doc-lang");
      autoGenerateDocumentacion(lang);
      renderDocumentacionView();
    });
  });

  // -------------------------
  // Modo
  // -------------------------

  const modoComBtn = container.querySelector("#docModoComercialBtn");
  const modoTecBtn = container.querySelector("#docModoTecnicoBtn");

  if (modoComBtn) {
    modoComBtn.addEventListener("click", () => {
      appState.documentacion.modo = "comercial";
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  }

  if (modoTecBtn) {
    modoTecBtn.addEventListener("click", () => {
      appState.documentacion.modo = "tecnica";
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  }
}
// ======================================================
// CONTINUACIÓN DE HANDLERS
// ======================================================

// -------------------------
// Botón regenerar
// -------------------------

function attachDocumentacionHandlers2(container) {
  const regenBtn = container.querySelector("#docRegenerarBtn");
  if (regenBtn) {
    regenBtn.addEventListener("click", () => {
      autoGenerateDocumentacion(appState.documentacion.idioma || "es");
      renderDocumentacionView();
    });
  }

  // -------------------------
  // Textareas de las secciones
  // -------------------------

  container.querySelectorAll(".doc-section-textarea").forEach((ta) => {
    ta.addEventListener("input", () => {
      const secKey = ta.getAttribute("data-doc-section-text");
      if (!secKey) return;

      appState.documentacion.secciones =
        appState.documentacion.secciones || {};
      appState.documentacion.secciones[secKey] = ta.value;

      saveDocStateToLocalStorage();
    });
  });

  // -------------------------
  // Checkbox incluir sección
  // -------------------------

  container.querySelectorAll("[data-doc-section-enable]").forEach((chk) => {
    chk.addEventListener("change", () => {
      const key = chk.getAttribute("data-doc-section-enable");
      if (!key) return;

      appState.documentacion.includedSections =
        appState.documentacion.includedSections || {};
      appState.documentacion.includedSections[key] = chk.checked;

      saveDocStateToLocalStorage();
    });
  });

  // -------------------------
  // Botón IA (excepto presentación_empresa)
  // -------------------------

  container.querySelectorAll("[data-doc-ai-section]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.getAttribute("data-doc-ai-section");
      if (!key || key === "presentacion_empresa") return;

      const nuevo = await askAIForSection(key);
      if (nuevo) {
        appState.documentacion.secciones[key] = nuevo;
        saveDocStateToLocalStorage();
        renderDocumentacionView();
      }
    });
  });

  // -------------------------
  // Selección de fichas técnicas
  // -------------------------

  container.querySelectorAll("[data-doc-ficha-media-id]").forEach((chk) => {
    chk.addEventListener("change", () => {
      const id = chk.getAttribute("data-doc-ficha-media-id");
      if (!id) return;

      const list = appState.documentacion.selectedFichasMediaIds || [];
      const pos = list.indexOf(id);

      if (chk.checked && pos === -1) {
        list.push(id);
      } else if (!chk.checked && pos !== -1) {
        list.splice(pos, 1);
      }

      appState.documentacion.selectedFichasMediaIds = list;

      saveDocStateToLocalStorage();
    });
  });

  // -------------------------
  // Drag & drop para imágenes
  // -------------------------

  container.querySelectorAll("[data-doc-section-drop]").forEach((zone) => {
    zone.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      zone.classList.add("is-drag-over");
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
    });

    zone.addEventListener("dragleave", () =>
      zone.classList.remove("is-drag-over")
    );

    zone.addEventListener("drop", (ev) => {
      ev.preventDefault();
      zone.classList.remove("is-drag-over");

      const mediaId = ev.dataTransfer?.getData("text/plain");
      const sectionKey = zone.getAttribute("data-doc-section-drop");

      if (!mediaId || !sectionKey) return;

      attachMediaToSection(sectionKey, mediaId);
    });
  });

  // -------------------------
  // Botón eliminar imagen
  // -------------------------

  container.querySelectorAll(".doc-section-media-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-media-id");
      const zone = btn.closest("[data-doc-section-drop]");
      const key = zone ? zone.getAttribute("data-doc-section-drop") : null;
      if (!id || !key) return;
      detachMediaFromSection(key, id);
    });
  });

  // -------------------------
  // Handlers del grid izquierdo
  // -------------------------

  attachDocMediaGridHandlers(container);

  // -------------------------
  // Nuevo bloque custom
  // -------------------------

  const nuevoBloqueBtn = container.querySelector("#docNuevoBloqueBtn");
  if (nuevoBloqueBtn) {
    nuevoBloqueBtn.addEventListener("click", openDocCustomModal);
  }

  // -------------------------
  // EXPORTAR PDF
  // -------------------------

  const exportBtn = container.querySelector("#docExportarBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportarDocumentacionPDF().catch((err) =>
        console.error("Error exportando PDF:", err)
      );
    });
  }

  // -------------------------
  // Modal custom
  // -------------------------

  const modal = document.getElementById("docCustomModal");
  const cancelBtn =
    modal && modal.querySelector("#docCustomCancelBtn");
  const saveBtn = modal && modal.querySelector("#docCustomSaveBtn");
  const backdrop = document.getElementById("docModalBackdrop");

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeDocCustomModal);
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", saveDocCustomBlock);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeDocCustomModal);
  }
}

// ======================================================
// HANDLERS PARA EL GRID DE IMÁGENES
// ======================================================

function attachDocMediaGridHandlers(root) {
  const container = root || getDocAppContent();
  if (!container) return;

  // ---- Drag
  container.querySelectorAll(".doc-media-item").forEach((item) => {
    item.addEventListener("dragstart", (ev) => {
      const id = item.getAttribute("data-media-id");
      if (!id || !ev.dataTransfer) return;
      ev.dataTransfer.setData("text/plain", id);
      ev.dataTransfer.effectAllowed = "copy";
    });
  });

  // ---- Ver imagen
  container.querySelectorAll("[data-media-view-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-media-view-id");
      if (!id) return;

      const item = (appState.documentacion.mediaLibrary || []).find(
        (m) => m.id === id
      );
      if (!item) return;

      const mime = (item.mimeType || "").toLowerCase();
      const url = (item.url || "").toLowerCase();

      const isImage =
        mime.startsWith("image/") ||
        /\.(png|jpg|jpeg|gif|webp)$/i.test(url);

      if (isImage) {
        openDocImageFloatingPreview(item);
      } else {
        window.open(item.url, "_blank");
      }
    });
  });
}

// ======================================================
// MODAL PERSONALIZADO
// ======================================================

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

  const section = select.value;
  const text = textarea.value.trim();
  if (!text) return closeDocCustomModal();

  const secciones = appState.documentacion.secciones || {};
  const actual = secciones[section] || "";

  const nuevo =
    actual.trim().length > 0 ? actual.trim() + "\n\n" + text : text;

  secciones[section] = nuevo;

  appState.documentacion.customBlocks =
    appState.documentacion.customBlocks || [];
  appState.documentacion.customBlocks.push({
    section,
    text,
    ts: new Date().toISOString(),
  });

  saveDocStateToLocalStorage();
  closeDocCustomModal();
  renderDocumentacionView();
}
// ======================================================
// IA PARA SECCIONES (hook)
// ======================================================

async function askAIForSection(sectionKey) {
  // No usamos IA en la sección fija “presentacion_empresa”
  if (sectionKey === "presentacion_empresa") {
    return appState.documentacion.secciones["presentacion_empresa"] || "";
  }

  const idioma = appState.documentacion.idioma || "es";
  const secciones = appState.documentacion.secciones || {};
  const texto = secciones[sectionKey] || "";
  const titulo = getSectionTitle(sectionKey);
  const proyecto = appState.proyecto || {};
  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

  const modo = appState.documentacion.modo || "comercial";

  if (typeof window.handleDocSectionAI === "function") {
    try {
      const nuevo = await window.handleDocSectionAI({
        sectionKey,
        idioma,
        titulo,
        texto,
        proyecto,
        presupuesto,
        modo,
      });

      if (typeof nuevo === "string" && nuevo.trim()) {
        return nuevo;
      }
      return texto;
    } catch (e) {
      console.error("Error IA:", e);
      alert("Error al consultar IA. Revisa consola.");
      return texto;
    }
  }

  alert(
    "Falta implementar window.handleDocSectionAI para usar IA en esta sección."
  );
  return texto;
}

// ======================================================
// IMPLEMENTACIÓN POR DEFECTO DE LA IA
// ======================================================

if (typeof window.handleDocSectionAI !== "function") {
  window.handleDocSectionAI = async ({
    sectionKey,
    idioma,
    titulo,
    texto,
    proyecto,
    presupuesto,
    modo,
  }) => {
    const payload = {
      sectionKey,
      idioma,
      titulo,
      texto,
      proyecto,
      presupuesto,
      modo,
    };

    const url = "https://docsectionai-is2pkrfj5a-uc.a.run.app";

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const extra = await resp.text().catch(() => "");
      throw new Error("IA error " + resp.status + ": " + extra);
    }

    const data = await resp.json().catch(() => null);
    if (!data || typeof data.text !== "string") {
      throw new Error("Respuesta IA inválida: falta ‘text’");
    }

    return data.text;
  };
}

// ======================================================
// CARGA DE DOCUMENTACIÓN MEDIA (Firestore + Storage)
// ======================================================

async function ensureDocMediaLoaded() {
  const db =
    window.db ||
    (window.firebase?.firestore ? window.firebase.firestore() : null);

  if (!db) return;

  try {
    const auth =
      window.auth ||
      (window.firebase?.auth ? window.firebase.auth() : null);

    const user = auth?.currentUser || null;
    const uid = user ? user.uid : null;

    let query = db.collection("documentacion_media");
    if (uid) query = query.where("uid", "==", uid);

    const snap = await query.limit(200).get();
    const media = [];

    snap.forEach((d) => media.push({ ...d.data(), id: d.id }));

    appState.documentacion.mediaLibrary = media;
    appState.documentacion.mediaLoaded = true;

    console.log("[DOC] Media cargada:", media.length);
  } catch (e) {
    console.error("Error cargando documentación media:", e);
    appState.documentacion.mediaLoaded = false;
  }
}

function cleanInvalidMediaItems() {
  const list = appState.documentacion.mediaLibrary || [];
  const clean = list.filter(
    (m) => m && m.id && typeof m.id === "string" && m.id.trim() !== ""
  );
  appState.documentacion.mediaLibrary = clean;
}

// ======================================================
// GUARDAR ARCHIVOS EN STORAGE + FIRESTORE
// ======================================================

async function saveMediaFileToStorageAndFirestore(file, options = {}) {
  const name = file.name || "archivo";
  const now = new Date().toISOString();
  const isImg = file.type?.startsWith("image/");
  const type = isImg ? "image" : "file";

  const folderName = options.folderName || "";
  const docCategory = options.docCategory || "imagen";

  const folderSlug = slugifyFolderName(folderName);

  const storage =
    window.storage ||
    (window.firebase?.storage ? window.firebase.storage() : null);
  const db =
    window.db ||
    (window.firebase?.firestore ? window.firebase.firestore() : null);
  const auth =
    window.auth ||
    (window.firebase?.auth ? window.firebase.auth() : null);

  let url = null;
  let storagePath = null;

  let uid = auth?.currentUser?.uid || null;

  if (storage) {
    storagePath =
      "documentacion_media/" +
      (uid || "anon") +
      "/" +
      folderSlug +
      "/" +
      Date.now() +
      "_" +
      name;

    const ref = storage.ref().child(storagePath);
    await ref.put(file);
    url = await ref.getDownloadURL();
  } else {
    url = URL.createObjectURL(file);
  }

  const mediaData = {
    nombre: name,
    type,
    mimeType: file.type,
    url,
    storagePath,
    uploadedAt: now,
    folderName: folderName || null,
    docCategory,
  };

  if (db) {
    const ref = await db.collection("documentacion_media").add({
      ...mediaData,
      uid,
    });

    mediaData.id = ref.id;
  } else {
    mediaData.id =
      "local_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2, 8);
  }

  return mediaData;
}

// ======================================================
// BORRAR MEDIA (Storage + Firestore + estado local)
// ======================================================

async function deleteMediaById(mediaId) {
  const media = appState.documentacion.mediaLibrary || [];
  const item = media.find((m) => m.id === mediaId);
  if (!item) return;

  const storage =
    window.storage ||
    (window.firebase?.storage ? window.firebase.storage() : null);
  const db =
    window.db ||
    (window.firebase?.firestore ? window.firebase.firestore() : null);

  if (storage && item.storagePath) {
    try {
      await storage.ref().child(item.storagePath).delete();
    } catch (e) {
      console.warn("No se pudo borrar en Storage:", e);
    }
  }

  if (db) {
    try {
      await db.collection("documentacion_media").doc(mediaId).delete();
    } catch (e) {
      console.warn("No se pudo borrar en Firestore:", e);
    }
  }

  appState.documentacion.mediaLibrary = media.filter(
    (m) => m.id !== mediaId
  );

  // Quitar de secciones
  const map = appState.documentacion.sectionMedia || {};
  Object.keys(map).forEach((sec) => {
    map[sec] = map[sec].filter((id) => id !== mediaId);
  });

  // Quitar de fichas seleccionadas
  appState.documentacion.selectedFichasMediaIds =
    (appState.documentacion.selectedFichasMediaIds || []).filter(
      (id) => id !== mediaId
    );

  saveDocStateToLocalStorage();
  renderDocumentacionView();
}
// ======================================================
// SLUGIFY DE CARPETAS (para almacenamiento ordenado)
// ======================================================

function slugifyFolderName(name) {
  if (!name) return "general";

  return (
    String(name)
      .toLowerCase()
      .normalize("NFD") // quitar acentos
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "general"
  );
}

// ======================================================
// OBTENER IMÁGENES POR REFERENCIA
// ======================================================

function getImagenRef(ref) {
  if (!ref) return null;

  const clean = String(ref).trim().toUpperCase();

  if (window.DOC_IMAGENES_POR_REF?.[clean]) {
    return window.DOC_IMAGENES_POR_REF[clean];
  }

  return "img/devices/" + clean + ".png";
}

// ======================================================
// CARGAR IMAGEN COMO DATAURL (para PDF)
// ======================================================

function loadImageAsDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      try {
        const maxDim = 1200;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        const max = Math.max(w, h);
        const scale = max > maxDim ? maxDim / max : 1;

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          width: canvas.width,
          height: canvas.height,
        });
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = reject;
    img.src = url;
  });
}

// ======================================================
// LOGO PARA PDF (cacheado)
// ======================================================

async function getDocLogoImage() {
  if (appState.documentacion.logoData) {
    return appState.documentacion.logoData;
  }

  const url =
    window.DOC_LOGO_URL ||
    DOC_LOGO_DEFAULT_URL ||
    "img/logo_2n.svg";

  try {
    const obj = await loadImageAsDataUrl(url);
    appState.documentacion.logoData = obj;
    return obj;
  } catch (e) {
    console.warn("No se pudo cargar el logo:", e);
    return null;
  }
}

// ======================================================
// DIMENSIONES DE PÁGINA PDF
// ======================================================

function getDocPageDimensions(pdf) {
  const size = pdf.internal.pageSize;
  return {
    width: size.getWidth ? size.getWidth() : size.width,
    height: size.getHeight ? size.getHeight() : size.height,
  };
}

// ======================================================
// CABECERA Y PIE PARA PDF TÉCNICO
// ======================================================

function drawTechHeader(pdf, opts = {}) {
  const dims = getDocPageDimensions(pdf);
  const w = dims.width;

  const nombreProyecto = opts.nombreProyecto || "Proyecto";
  const logo = opts.logo || null;

  const marginX = 20;
  const textY = 18;

  let logoBottomY = textY;

  // Logo
  if (logo?.dataUrl) {
    const ratio = logo.width / logo.height || 2.5;
    const logoW = 25;
    const logoH = logoW / ratio;
    const logoX = w - marginX - logoW;
    const logoY = textY - 6;

    try {
      pdf.addImage(logo.dataUrl, "PNG", logoX, logoY, logoW, logoH);
      logoBottomY = logoY + logoH;
    } catch (e) {
      console.warn("No se pudo dibujar logo en header:", e);
    }
  }

  // Título
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(55, 65, 81);
  pdf.text(nombreProyecto, marginX, textY);

  // Línea inferior
  const lineY = Math.max(textY + 2, logoBottomY + 2);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(marginX, lineY, w - marginX, lineY);

  return lineY + 8;
}

function drawTechFooter(pdf, opts = {}) {
  const dims = getDocPageDimensions(pdf);
  const h = dims.height;

  const idioma = opts.idioma || "es";
  let txt =
    idioma === "en"
      ? "IP video intercom & access control solution – 2N®"
      : idioma === "pt"
      ? "Solução IP de videoporteiro e controlo de acessos – 2N®"
      : "Solución IP de videoportero y control de accesos – 2N®";

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text(txt, 20, h - 10);
}

// ======================================================
// CREAR PÁGINA DE CONTENIDO TÉCNICO
// ======================================================

function setupTechContentPage(pdf, opts = {}) {
  const startY = drawTechHeader(pdf, opts);
  drawTechFooter(pdf, opts);
  return startY;
}

// ======================================================
// IMÁGENES POR SECCIÓN (TÉCNICO)
// ======================================================

function getSectionImages(sectionKey) {
  const ids = appState.documentacion.sectionMedia?.[sectionKey] || [];
  const media = appState.documentacion.mediaLibrary || [];

  return ids
    .map((id) => media.find((m) => m.id === id))
    .filter((m) => {
      if (!m?.url) return false;
      const mime = m.mimeType?.toLowerCase() || "";
      const type = m.type?.toLowerCase() || "";
      const url = m.url.toLowerCase();
      return (
        type === "image" ||
        mime.startsWith("image/") ||
        url.endsWith(".png") ||
        url.endsWith(".jpg") ||
        url.endsWith(".jpeg") ||
        url.endsWith(".webp") ||
        url.endsWith(".gif")
      );
    });
}

// ======================================================
// INSERTAR IMÁGENES (TÉCNICO)
// ======================================================

async function insertImagesForSection(doc, sectionKey, y, onNewPage) {
  const images = getSectionImages(sectionKey);
  if (!images.length) return y;

  const dims = getDocPageDimensions(doc);
  const maxY = dims.height - 25;
  const pageW = dims.width;

  for (const m of images) {
    try {
      const img = await loadImageAsDataUrl(m.url);

      const ratio = img.width / img.height || 1.5;
      let w = 60;
      let h = w / ratio;

      if (h > 37.5) {
        h = 37.5;
        w = h * ratio;
      }

      const need = h + 8;
      if (y + need > maxY) {
        y = typeof onNewPage === "function" ? onNewPage() : 25;
      }

      const x = (pageW - w) / 2;
      doc.addImage(img.dataUrl, "PNG", x, y, w, h);

      y += h + 8;
    } catch (e) {
      console.warn("Error imagen sección:", e);
    }
  }

  return y;
}

// ======================================================
// EXPORTAR PDF (selección de modo)
// ======================================================

async function exportarDocumentacionPDF() {
  const modo = appState.documentacion.modo || "comercial";

  if (modo === "tecnica") {
    await exportarPDFTecnico();
  } else {
    await exportarPDFComercial();
  }
}
// ======================================================
// PDF TÉCNICO COMPLETO
// ======================================================

async function exportarPDFTecnico() {
  const jsPDF = window.jspdf.jsPDF;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const idioma = appState.documentacion.idioma || "es";
  const secciones = appState.documentacion.secciones || {};
  const included = appState.documentacion.includedSections || {};

  const proyecto = appState.proyecto || {};
  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

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

  const logo = await getDocLogoImage();
  const dims = getDocPageDimensions(doc);
  const pageW = dims.width;
  const pageH = dims.height;

  // ------------------------------
  // TÍTULO DOCUMENTO
  // ------------------------------
  let titulo = "Memoria de calidades";
  if (idioma === "en") titulo = "Technical specification";
  if (idioma === "pt") titulo = "Memória descritiva";

  // ------------------------------
  // PORTADA CON IMAGEN TÉCNICA
  // ------------------------------
  try {
    const cover = await loadImageAsDataUrl(DOC_TECH_COVER_URL);
    if (cover?.dataUrl) {
      const ratio = cover.width / cover.height;
      const pageRatio = pageW / pageH;

      let w, h, x, y;

      if (ratio > pageRatio) {
        h = pageH;
        w = h * ratio;
        x = (pageW - w) / 2;
        y = 0;
      } else {
        w = pageW;
        h = w / ratio;
        x = 0;
        y = (pageH - h) / 2;
      }

      doc.addImage(cover.dataUrl, "PNG", x, y, w, h);
    }
  } catch (e) {
    console.warn("No se pudo cargar portada técnica:", e);
  }

  // Degradado inferior
  const gradHeight = 70;
  const gradStart = pageH - gradHeight;
  for (let i = 0; i < 6; i++) {
    const y = gradStart + (i * gradHeight) / 6;
    const h = gradHeight / 6 + 0.5;
    const shade = 255 - i * 8;
    doc.setFillColor(shade, shade, shade);
    doc.rect(0, y, pageW, h, "F");
  }

  // Panel blanco inferior
  const panelH = 55;
  const panelY = pageH - panelH;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, panelY, pageW, panelH, "F");

  // TÍTULO PORTADA
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text(titulo, 20, panelY - 5);

  // Subtítulo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Videoportero y control de accesos 2N", 20, panelY + 7);

  // Proyecto + promotora
  let y = panelY + 18;

  doc.setFont("helvetica", "bold");
  doc.text("Proyecto:", 20, y);
  doc.setFont("helvetica", "normal");

  const linesProyecto = doc.splitTextToSize(nombreProyecto, pageW - 60);
  doc.text(linesProyecto, 45, y);
  y += linesProyecto.length * 6 + 4;

  if (promotora) {
    doc.setFont("helvetica", "bold");
    doc.text("Promotor:", 20, y);
    doc.setFont("helvetica", "normal");
    const linesProm = doc.splitTextToSize(promotora, pageW - 60);
    doc.text(linesProm, 45, y);
    y += linesProm.length * 6 + 4;
  }

  // Footer portada
  drawTechFooter(doc, { idioma });

  // ------------------------------
  // PÁGINA 2: ÍNDICE
  // ------------------------------
  doc.addPage();
  const tocPage = doc.getNumberOfPages();
  const tocStartY = setupTechContentPage(doc, {
    idioma,
    nombreProyecto,
    logo,
  });

  const tocEntries = [];

  // ------------------------------
  // NUEVA PÁGINA: PRESENTACIÓN EMPRESA (si está incluida)
  // ------------------------------

  const includePresentacion =
    included["presentacion_empresa"] !== false; // por defecto incluida

  if (includePresentacion) {
    doc.addPage();
    let current = doc.getNumberOfPages();
    y = setupTechContentPage(doc, {
      idioma,
      nombreProyecto,
      logo,
    });

    // Registrar en índice
    tocEntries.push({
      title:
        idioma === "en"
          ? "Company introduction"
          : idioma === "pt"
          ? "Apresentação da empresa"
          : "Presentación de empresa",
      page: current,
    });

    // Título
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    const title =
      idioma === "en"
        ? "Company introduction"
        : idioma === "pt"
        ? "Apresentação da empresa"
        : "Presentación de empresa";

    doc.text(title, 20, y);
    y += 4;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(20, y, pageW - 20, y);
    y += 6;

    // Texto fijo de presentación
    const texto = secciones["presentacion_empresa"] || "";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);

    const lines = doc.splitTextToSize(texto, pageW - 40);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 6;
  }

  // ------------------------------
  // GENERAR TODAS LAS SECCIONES RESTANTES
  // ------------------------------

  doc.addPage();
  let currentPage = doc.getNumberOfPages();
  y = setupTechContentPage(doc, { idioma, nombreProyecto, logo });

  function newPage() {
    doc.addPage();
    currentPage = doc.getNumberOfPages();
    y = setupTechContentPage(doc, { idioma, nombreProyecto, logo });
    return y;
  }

  function ensureSpace(lines) {
    const need = lines * 5 + 12;
    if (y + need > pageH - 25) {
      newPage();
    }
  }

  const sectionKeys = [
    "resumen",
    "sistema",
    "equipos",
    "infraestructura",
    "servicios",
    "normativa_red",
    "normativa_lpd",
    "normativa_ciber",
    "otros",
  ];

  for (const key of sectionKeys) {
    if (key === "presentacion_empresa") continue;
    if (included[key] === false) continue;

    const contenido = (secciones[key] || "").trim();
    const imgs = getSectionImages(key);
    if (!contenido && imgs.length === 0) continue;

    // Índice
    tocEntries.push({ title: getSectionTitle(key), page: currentPage });

    // Título sección
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(getSectionTitle(key), 20, y);
    y += 4;

    doc.setDrawColor(226, 232, 240);
    doc.line(20, y, pageW - 20, y);
    y += 6;

    // Texto
    if (contenido) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);

      const lines = doc.splitTextToSize(contenido, pageW - 40);
      let block = [];
      const maxBlock = 35;

      for (let i = 0; i < lines.length; i++) {
        block.push(lines[i]);
        if (block.length === maxBlock || i === lines.length - 1) {
          ensureSpace(block.length);
          doc.text(block, 20, y);
          y += block.length * 5 + 4;
          block = [];
        }
      }
    }

    // Imágenes
    y = await insertImagesForSection(doc, key, y, newPage);
    y += 4;
  }

// ------------------------------
  // ANEXO – FICHAS TÉCNICAS
  // ------------------------------

  const allMedia = appState.documentacion.mediaLibrary || [];
  const selected = appState.documentacion.selectedFichasMediaIds || [];
  const fichas = allMedia.filter((m) => selected.includes(m.id));

  if (fichas.length > 0) {
    doc.addPage();
    currentPage = doc.getNumberOfPages();
    y = setupTechContentPage(doc, { idioma, nombreProyecto, logo });

    let titulo =
      idioma === "en"
        ? "Appendix – Technical documentation"
        : idioma === "pt"
        ? "Anexo – Documentação técnica"
        : "Anexo – Fichas técnicas adjuntas";

    tocEntries.push({ title: titulo, page: currentPage });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(titulo, 20, y);
    y += 6;

    doc.setDrawColor(226, 232, 240);
    doc.line(20, y, pageW - 20, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    for (const m of fichas) {
      const extra = m.folderName ? " – " + m.folderName : "";
      const text =
        "• " + m.nombre + extra + (m.url ? " (" + m.url + ")" : "");

      const lines = doc.splitTextToSize(text, pageW - 40);
      ensureSpace(lines.length);
      doc.text(lines, 20, y);
      y += lines.length * 4.8 + 2;
    }
  }

  // ------------------------------
  // REESCRIBIR ÍNDICE
  // ------------------------------

  doc.setPage(tocPage);
  let yToc = tocStartY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Contenido", 20, yToc);
  yToc += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);

  for (const entry of tocEntries) {
    if (yToc > pageH - 25) {
      doc.addPage();
      yToc = setupTechContentPage(doc, {
        idioma,
        nombreProyecto,
        logo,
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Contenido (cont.)", 20, yToc);
      yToc += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(55, 65, 81);
    }

    const label = entry.title;
    const pageStr = String(entry.page);
    const textWidth = doc.getTextWidth(pageStr);

    doc.text(label, 25, yToc);
    doc.text(pageStr, pageW - 25 - textWidth, yToc);

    doc.setDrawColor(230, 230, 230);
    doc.line(25, yToc + 1.5, pageW - 25, yToc + 1.5);

    yToc += 7;
  }

  // ------------------------------
  // GUARDAR PDF
  // ------------------------------

  let base =
    idioma === "en"
      ? "technical_specification"
      : idioma === "pt"
      ? "memoria_descritiva"
      : "memoria_calidades";

  const safe = nombreProyecto
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  doc.save(base + "_" + safe + ".pdf");
}
// ======================================================
// EXPORTACIÓN PDF COMERCIAL (MULTIPÁGINA)
// ======================================================

async function exportarPDFComercial() {
  const jsPDF = window.jspdf.jsPDF;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const idioma = appState.documentacion.idioma || "es";
  const secciones = appState.documentacion.secciones || {};

  const proyecto = appState.proyecto || {};
  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

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

  const logo = await getDocLogoImage();

  const dims = getDocPageDimensions(doc);
  const pageW = dims.width;
  const pageH = dims.height;

  const marginX = 20;
  const marginTop = 20;
  const marginBottom = 20;

  // ======================================================
  // HELPERS LOCALES
  // ======================================================

  function drawSalesforceCard({
    x,
    y,
    width,
    title,
    body,
    doc,
    maxBodyWidth,
    minHeight,
  }) {
    const paddingX = 8;
    const paddingTop = 8;
    const paddingBottom = 8;
    const headerHeight = 8;

    const bodyW = maxBodyWidth || width - paddingX * 2;
    const lines = body ? doc.splitTextToSize(body, bodyW) : [];
    const bodyH = lines.length * 4.4;

    let cardH =
      paddingTop + headerHeight + 4 + bodyH + paddingBottom;
    if (minHeight && cardH < minHeight) cardH = minHeight;

    // Sombra
    doc.setFillColor(229, 231, 235);
    doc.roundedRect(x + 1.2, y + 1.8, width, cardH, 3, 3, "F");

    // Tarjeta blanca
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(209, 213, 219);
    doc.roundedRect(x, y, width, cardH, 3, 3, "FD");

    // Título
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    const titleLines = doc.splitTextToSize(title, width - paddingX * 2);
    doc.text(titleLines, x + paddingX, y + paddingTop + 5);

    // Texto
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    const yBody =
      y +
      paddingTop +
      5 +
      titleLines.length * 4.2 +
      3;

    if (lines.length) {
      doc.text(lines, x + paddingX, yBody);
    }

    return {
      bottomY: y + cardH,
      height: cardH,
    };
  }

  // CAPTION LIMPIO (sin extensión)
  function cleanCaption(name) {
    return name.replace(/\.[^/.]+$/, "");
  }

  // Obtener imágenes asignadas a secciones (máx 8)
  function collectSectionImagesWithCaptions() {
    const map = appState.documentacion.sectionMedia || {};
    const media = appState.documentacion.mediaLibrary || [];
    const byId = {};
    media.forEach((m) => (byId[m.id] = m));

    const used = new Set();
    const out = [];

    for (const key of Object.keys(map)) {
      for (const id of map[key]) {
        if (used.has(id)) continue;
        const m = byId[id];
        if (!m?.url) continue;

        const mime = (m.mimeType || "").toLowerCase();
        const type = (m.type || "").toLowerCase();
        const url = m.url.toLowerCase();

        const isImg =
          mime.startsWith("image/") ||
          type === "image" ||
          url.endsWith(".png") ||
          url.endsWith(".jpg") ||
          url.endsWith(".jpeg") ||
          url.endsWith(".webp") ||
          url.endsWith(".gif");

        if (!isImg) continue;

        used.add(id);
        out.push({
          media: m,
          caption: cleanCaption(m.nombre || ""),
        });
      }
    }

    return out.slice(0, 8);
  }

  // ======================================================
  // PÁGINA 1 – PORTADA
  // ======================================================

  try {
    const cover = await loadImageAsDataUrl(DOC_TECH_COVER_URL);
    if (cover?.dataUrl) {
      const ratio = cover.width / cover.height;
      const pageRatio = pageW / pageH;

      let w, h, x, y;

      if (ratio > pageRatio) {
        h = pageH;
        w = h * ratio;
        x = (pageW - w) / 2;
        y = 0;
      } else {
        w = pageW;
        h = w / ratio;
        x = 0;
        y = (pageH - h) / 2;
      }

      doc.addImage(cover.dataUrl, "PNG", x, y, w, h);
    }
  } catch (e) {
    console.warn("Error portada comercial:", e);
  }

  // Degradado inferior
  const gradH = 70;
  const gradStart = pageH - gradH;
  for (let i = 0; i < 6; i++) {
    const y = gradStart + (i * gradH) / 6;
    const h = gradH / 6 + 0.5;
    const shade = 255 - i * 8;
    doc.setFillColor(shade, shade, shade);
    doc.rect(0, y, pageW, h, "F");
  }

  // Panel blanco inferior
  const panelH = 55;
  const panelY = pageH - panelH;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, panelY, pageW, panelH, "F");

  // Título comercial
  let titulo =
    idioma === "en"
      ? "Highlights – IP access & video intercom solution"
      : idioma === "pt"
      ? "Highlights – solução IP de acessos e videoporteiro"
      : "Highlights – solución de accesos y videoportero IP";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  let linesTitulo = doc.splitTextToSize(
    titulo,
    pageW - marginX * 2 - 40
  );
  let y = panelY + 11;
  doc.text(linesTitulo, marginX, y);

  y += linesTitulo.length * 5 + 1;

  // SUBTÍTULO
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  let subtitulo = nombreProyecto;
  if (promotora) subtitulo += " · " + promotora;

  const stLines = doc.splitTextToSize(
    subtitulo,
    pageW - marginX * 2 - 40
  );
  doc.text(stLines, marginX, y);
  y += stLines.length * 4.8 + 2;

  // CLAIM
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);

  let claim =
    idioma === "en"
      ? "Architecture, design and IP technology for a truly premium access experience."
      : idioma === "pt"
      ? "Arquitetura, design e tecnologia IP para uma experiência de acesso verdadeiramente premium."
      : "Arquitectura, diseño y tecnología IP para una experiencia de acceso verdaderamente premium.";

  const claimLines = doc.splitTextToSize(
    claim,
    pageW - marginX * 2 - 40
  );
  doc.text(claimLines, marginX, y);

  // LOGO en esquina inferior derecha
  if (logo?.dataUrl) {
    const ratio = logo.width / logo.height || 2.5;
    const lw = 32;
    const lh = lw / ratio;

    const lx = pageW - marginX - lw;
    const ly = panelY + panelH - lh - 6;

    try {
      doc.addImage(logo.dataUrl, "PNG", lx, ly, lw, lh);
    } catch (e) {
      console.warn("Logo portada comercial:", e);
    }
  }

  // ======================================================
  // PÁGINA 2 – Presentación de Empresa (si activa)
  // ======================================================

  const includePresentacion =
    appState.documentacion.includedSections?.presentacion_empresa !==
    false;

  if (includePresentacion) {
    doc.addPage();
    const dims2 = getDocPageDimensions(doc);

    let y2 = marginTop;

    // Título sección
    const tit =
      idioma === "en"
        ? "Company introduction"
        : idioma === "pt"
        ? "Apresentação da empresa"
        : "Presentación de empresa";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text(tit, marginX, y2);

    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.4);
    doc.line(
      marginX,
      y2 + 2.5,
      dims2.width - marginX,
      y2 + 2.5
    );

    y2 += 12;

    // Texto fijo de presentación
    const texto = secciones["presentacion_empresa"] || "";

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);

    const lines = doc.splitTextToSize(
      texto,
      dims2.width - marginX * 2
    );

    doc.text(lines, marginX, y2);
  }

  // ======================================================
  // PÁGINA 3 – TARJETAS RESUMEN + SISTEMA (vertical)
  // ======================================================

  doc.addPage();

  const dims3 = getDocPageDimensions(doc);
  const pw3 = dims3.width;
  const ph3 = dims3.height;

  let yCards = marginTop;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(31, 41, 55);

  let tit2 =
    idioma === "en"
      ? "Project overview"
      : idioma === "pt"
      ? "Visão geral do projeto"
      : "Visión general del proyecto";

  doc.text(tit2, marginX, yCards);
  doc.setDrawColor(209, 213, 219);
  doc.line(marginX, yCards + 2.5, pw3 - marginX, yCards + 2.5);

  yCards += 10;

  const cardWidth = pw3 - marginX * 2;

  const bloques2 = [];

  if (secciones.resumen?.trim()) {
    bloques2.push({
      title:
        idioma === "en"
          ? "Project summary"
          : idioma === "pt"
          ? "Resumo do projeto"
          : "Resumen del proyecto",
      body: secciones.resumen,
    });
  }

  if (secciones.sistema?.trim()) {
    bloques2.push({
      title:
        idioma === "en"
          ? "System architecture"
          : idioma === "pt"
          ? "Arquitetura do sistema"
          : "Sistema de videoportero y accesos",
      body: secciones.sistema,
    });
  }

  for (const b of bloques2) {
    const r = drawSalesforceCard({
      x: marginX,
      y: yCards,
      width: cardWidth,
      title: b.title,
      body: b.body,
      doc,
      maxBodyWidth: cardWidth - 16,
      minHeight: 45,
    });
    yCards = r.bottomY + 8;
  }

// ======================================================
  // PÁGINA 4 – SERVICIOS, INFRAESTRUCTURA, OTROS
  // ======================================================

  const tieneServicios = secciones.servicios?.trim().length > 0;
  const tieneInfra = secciones.infraestructura?.trim().length > 0;
  const tieneOtros = secciones.otros?.trim().length > 0;

  if (tieneServicios || tieneInfra || tieneOtros) {
    doc.addPage();
    const dims4 = getDocPageDimensions(doc);
    const pw4 = dims4.width;
    const ph4 = dims4.height;

    let y4 = marginTop;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);

    let tit3 =
      idioma === "en"
        ? "Services, operation & infrastructure"
        : idioma === "pt"
        ? "Serviços, operação e infraestrutura"
        : "Servicios, operación e infraestructura";

    doc.text(tit3, marginX, y4);
    doc.setDrawColor(209, 213, 219);
    doc.line(marginX, y4 + 2.5, pw4 - marginX, y4 + 2.5);

    y4 += 10;

    const bloques3 = [];

    if (tieneServicios) {
      bloques3.push({
        title:
          idioma === "en"
            ? "Cloud services & operation"
            : idioma === "pt"
            ? "Serviços cloud e operação"
            : "Servicios cloud y operación",
        body: secciones.servicios,
      });
    }

    if (tieneInfra) {
      bloques3.push({
        title:
          idioma === "en"
            ? "Infrastructure & IP network"
            : idioma === "pt"
            ? "Infraestrutura e rede IP"
            : "Infraestructura y red IP",
        body: secciones.infraestructura,
      });
    }

    if (tieneOtros) {
      bloques3.push({
        title:
          idioma === "en"
            ? "Additional notes & options"
            : idioma === "pt"
            ? "Notas adicionais e opções"
            : "Otros aspectos y opciones",
        body: secciones.otros,
      });
    }

    for (const b of bloques3) {
      const r = drawSalesforceCard({
        x: marginX,
        y: y4,
        width: pw4 - marginX * 2,
        title: b.title,
        body: b.body,
        doc,
        maxBodyWidth: pw4 - marginX * 2 - 16,
        minHeight: 45,
      });

      y4 = r.bottomY + 8;
    }
  }
// ======================================================
// PÁGINA 5 – GALERÍA VISUAL (con pie de foto limpio)
// ======================================================

const galeria = collectSectionImagesWithCaptions();

if (galeria.length) {
  doc.addPage();

  const dimsG = getDocPageDimensions(doc);
  const pwG = dimsG.width;
  const phG = dimsG.height;

  let yG = marginTop;

  // Título Galería
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(31, 41, 55);

  let tituloGaleria =
    idioma === "en"
      ? "Visual gallery of the solution"
      : idioma === "pt"
      ? "Galeria visual da solução"
      : "Galería visual de la solución";

  doc.text(tituloGaleria, marginX, yG);
  doc.setDrawColor(209, 213, 219);
  doc.line(marginX, yG + 2.5, pwG - marginX, yG + 2.5);

  yG += 12;

  const maxW = (pwG - marginX * 2 - 10) / 2; // Dos columnas
  const maxH = 38;
  const rowH = maxH + 20; // Imagen + caption + margen

  for (let i = 0; i < galeria.length; i++) {
    const item = galeria[i];
    const m = item.media;
    const caption = item.caption || "";
    const col = i % 2;

    if (i % 2 === 0 && i !== 0) yG += rowH;

    if (yG + rowH > phG - marginBottom) {
      doc.addPage();
      yG = marginTop;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text(tituloGaleria, marginX, yG);

      doc.setDrawColor(209, 213, 219);
      doc.line(
        marginX,
        yG + 2.5,
        pwG - marginX,
        yG + 2.5
      );

      yG += 12;
    }

    try {
      const imgObj = await loadImageAsDataUrl(m.url);

      const ratio = imgObj.width / imgObj.height || 1.5;
      let w = maxW;
      let h = w / ratio;

      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }

      const xImg =
        marginX + col * (maxW + 10) + (maxW - w) / 2;

      doc.addImage(imgObj.dataUrl, "PNG", xImg, yG, w, h);

      const captionClean = caption;
      const captionLines = doc.splitTextToSize(
        captionClean,
        maxW
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(75, 85, 99);

      doc.text(
        captionLines,
        xImg + w / 2,
        yG + h + 5,
        { align: "center" }
      );
    } catch (e) {
      console.warn("Error imagen galería:", e);
    }
  }

  // Logo en pie de página
  if (logo?.dataUrl) {
    const r = logo.width / logo.height || 2.5;
    const lw = 24;
    const lh = lw / r;

    const lx = pwG - marginX - lw;
    const ly = phG - marginBottom - lh + 4;

    try {
      doc.addImage(logo.dataUrl, "PNG", lx, ly, lw, lh);
    } catch (e) {
      console.warn("Logo galería:", e);
    }
  }
}

// ======================================================
// GUARDAR PDF COMERCIAL
// ======================================================

let baseCom =
  idioma === "en"
    ? "highlights_access_solution"
    : idioma === "pt"
    ? "highlights_acessos"
    : "highlights_accesos";

const safeCom = nombreProyecto
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

doc.save(baseCom + "_" + safeCom + ".pdf");
}

// ======================================================
// RENDER PRINCIPAL DE DOCUMENTACIÓN
// ======================================================

window.renderDocumentacionView = renderDocumentacionView;

// ======================================================
// FIN DEL ARCHIVO (últimas utilidades y handlers)
// ======================================================

// Handlers para drag & drop, clicks, inputs, etc.
// (continúa en la siguiente parte)
// ======================================================
// HANDLERS DE MEDIA GRID (drag, ver imagen, etc.)
// ======================================================

function attachDocMediaGridHandlers(root) {
  const container = root || getDocAppContent();
  if (!container) return;

  // Drag & drop para arrastrar imágenes a secciones
  container.querySelectorAll(".doc-media-item").forEach((item) => {
    item.addEventListener("dragstart", (ev) => {
      const id = item.getAttribute("data-media-id");
      if (!id || !ev.dataTransfer) return;
      ev.dataTransfer.setData("text/plain", id);
      ev.dataTransfer.effectAllowed = "copy";
    });
  });

  // “Ver imagen”
  container.querySelectorAll("[data-media-view-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-media-view-id");
      if (!id) return;

      const item =
        (appState.documentacion.mediaLibrary || []).find(
          (m) => m.id === id
        ) || null;

      if (!item?.url) {
        alert("No se ha encontrado la imagen. Revisa la consola.");
        return;
      }

      const mime = (item.mimeType || "").toLowerCase();
      const type = (item.type || "").toLowerCase();
      const url = item.url.toLowerCase();

      const isImg =
        mime.startsWith("image/") ||
        type === "image" ||
        url.endsWith(".png") ||
        url.endsWith(".jpg") ||
        url.endsWith(".jpeg") ||
        url.endsWith(".webp") ||
        url.endsWith(".gif");

      if (isImg) openDocImageFloatingPreview(item);
      else window.open(item.url, "_blank");
    });
  });
}

// ======================================================
// OVERLAY FLOTANTE PARA VER UNA IMAGEN
// ======================================================

function openDocImageFloatingPreview(item) {
  if (!item?.url) return;

  const prev = document.getElementById("docMediaFloatingPreview");
  if (prev) prev.remove();

  const title =
    item.folderName && item.nombre
      ? item.folderName + " – " + item.nombre
      : item.nombre || "Imagen";

  const overlay = document.createElement("div");
  overlay.id = "docMediaFloatingPreview";
  overlay.style =
    "position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;" +
    "align-items:center;justify-content:center;z-index:999999;";

  overlay.innerHTML = `
    <div style="
      position:relative;
      max-width:90vw;
      max-height:90vh;
      background:#111827;
      padding:12px;
      border-radius:12px;
      box-shadow:0 15px 40px rgba(0,0,0,0.6);
      display:flex;
      flex-direction:column;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="
          color:#e5e7eb;
          font-size:0.9rem;
          font-weight:500;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
          max-width:70vw;
        ">
          ${docEscapeHtml(title)}
        </div>
        <button id="docMediaFloatingCloseBtn"
          style="border:none;background:#374151;color:#f9fafb;border-radius:999px;
          padding:4px 10px;font-size:0.8rem;cursor:pointer;">
          ✕ Cerrar
        </button>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;">
        <img src="${item.url}"
          style="max-width:86vw;max-height:80vh;object-fit:contain;border-radius:6px;background:#000;">
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) overlay.remove();
  });

  document
    .getElementById("docMediaFloatingCloseBtn")
    ?.addEventListener("click", () => overlay.remove());
}

// ======================================================
// AÑADIR MEDIA A UNA SECCIÓN
// ======================================================

function attachMediaToSection(sectionKey, mediaId) {
  appState.documentacion.sectionMedia =
    appState.documentacion.sectionMedia || {};

  const arr = appState.documentacion.sectionMedia[sectionKey] || [];
  if (!arr.includes(mediaId)) arr.push(mediaId);

  appState.documentacion.sectionMedia[sectionKey] = arr;

  saveDocStateToLocalStorage();
  renderDocumentacionView();
}

function detachMediaFromSection(sectionKey, mediaId) {
  const map = appState.documentacion.sectionMedia || {};
  const arr = map[sectionKey] || [];

  map[sectionKey] = arr.filter((id) => id !== mediaId);
  appState.documentacion.sectionMedia = map;

  saveDocStateToLocalStorage();
  renderDocumentacionView();
}

// ======================================================
// EDITOR FLOTANTE DE TEXTO PERSONALIZADO
// ======================================================

function openDocCustomModal() {
  const modal = document.getElementById("docCustomModal");
  const back = document.getElementById("docModalBackdrop");
  if (!modal || !back) return;

  modal.classList.remove("hidden");
  back.classList.remove("hidden");

  const txt = document.getElementById("docCustomText");
  if (txt) txt.value = "";
}

function closeDocCustomModal() {
  const modal = document.getElementById("docCustomModal");
  const back = document.getElementById("docModalBackdrop");

  modal?.classList.add("hidden");
  back?.classList.add("hidden");
}

function saveDocCustomBlock() {
  const select = document.getElementById("docCustomSectionSelect");
  const txt = document.getElementById("docCustomText");
  if (!select || !txt) return;

  const key = select.value;
  const text = txt.value.trim();
  if (!text) {
    closeDocCustomModal();
    return;
  }

  appState.documentacion.secciones =
    appState.documentacion.secciones || {};

  const actual = appState.documentacion.secciones[key] || "";
  const nuevo =
    actual.trim().length > 0
      ? actual.trim() + "\n\n" + text
      : text;

  appState.documentacion.secciones[key] = nuevo;

  appState.documentacion.customBlocks =
    appState.documentacion.customBlocks || [];

  appState.documentacion.customBlocks.push({
    section: key,
    text,
    ts: new Date().toISOString(),
  });

  saveDocStateToLocalStorage();
  closeDocCustomModal();
  renderDocumentacionView();
}
// ======================================================
// MANEJO DE IA POR SECCIÓN (BOTÓN ✨ Preguntar a IA)
// ======================================================

async function askAIForSection(sectionKey) {
  // Esta sección NO usa IA
  if (sectionKey === "presentacion_empresa") {
    return (
      appState.documentacion.secciones["presentacion_empresa"] || ""
    );
  }

  const idioma = appState.documentacion.idioma || "es";
  const secciones = appState.documentacion.secciones || {};
  const textoActual = secciones[sectionKey] || "";
  const titulo = getSectionTitle(sectionKey);
  const proyecto = appState.proyecto || {};
  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

  const modo = appState.documentacion.modo || "comercial";

  if (typeof window.handleDocSectionAI === "function") {
    try {
      const nuevo = await window.handleDocSectionAI({
        sectionKey,
        idioma,
        titulo,
        texto: textoActual,
        proyecto,
        presupuesto,
        modo,
      });

      if (typeof nuevo === "string" && nuevo.trim()) {
        return nuevo;
      }
      return textoActual;
    } catch (e) {
      console.error("Error IA:", e);
      alert("Ha ocurrido un error al consultar la IA.");
      return textoActual;
    }
  }

  alert(
    "Función IA no implementada. Debes añadir window.handleDocSectionAI."
  );
  return textoActual;
}

// ======================================================
// RENDERIZAR SECCIONES EN LA UI
// ======================================================

function labelForSection(key) {
  switch (key) {
    case "presentacion_empresa":
      return "Presentación de empresa";
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
    case "normativa_red":
      return "Normativa RED (1 agosto 2025)";
    case "normativa_lpd":
      return "Protección de datos (LPD / GDPR)";
    case "normativa_ciber":
      return "Ciberseguridad y cumplimiento";
    case "otros":
      return "Otros aspectos / observaciones";
    default:
      return key;
  }
}

function getSectionTitle(key) {
  const titles = appState.documentacion.sectionTitles || {};
  const custom = titles[key];

  if (custom && String(custom).trim().length > 0) {
    return String(custom).trim();
  }
  return labelForSection(key);
}

function renderSectionMediaHTML(sectionKey) {
  const mediaLib = appState.documentacion.mediaLibrary || [];
  const map = {};
  mediaLib.forEach((m) => (map[m.id] = m));

  const ids =
    appState.documentacion.sectionMedia?.[sectionKey] || [];

  if (!ids.length) return "";

  return ids
    .map((id) => {
      const m = map[id];
      if (!m) return "";

      const mime = (m.mimeType || "").toLowerCase();
      const isImg =
        mime.startsWith("image/") ||
        (m.url || "").match(/\.(png|jpg|jpeg|webp|gif)$/i);

      const caption = m.nombre || "";

      return `
        <div class="doc-section-media-chip">
          <div class="doc-section-media-thumb">
            ${
              isImg
                ? `<img src="${m.url}" alt="${caption}">`
                : `<div class="doc-section-media-icon">📄</div>`
            }
          </div>
          <div class="doc-section-media-foot">
            <div class="doc-section-media-caption-wrap">
              <span class="doc-section-media-caption">${caption}</span>
            </div>
            <button
              type="button"
              class="doc-section-media-remove"
              data-remove-media-id="${id}"
            >✕</button>
          </div>
        </div>
      `;
    })
    .join("");
}

// ======================================================
// RENDERIZAR TODAS LAS SECCIONES EN LA PANTALLA
// ======================================================

function renderDocSectionsHTML() {
  const secciones = appState.documentacion.secciones || {};
  const included = appState.documentacion.includedSections || {};

  const order = [
    "presentacion_empresa",
    "resumen",
    "sistema",
    "equipos",
    "infraestructura",
    "servicios",
    "normativa_red",
    "normativa_lpd",
    "normativa_ciber",
    "otros",
  ];

  return order
    .map((key) => {
      const contenido = secciones[key] || "";
      const title = getSectionTitle(key);
      const checked =
        included[key] !== false ? "checked" : "";

      const isReadonly = key === "presentacion_empresa";

      return `
        <div class="card doc-section-card" data-doc-section="${key}">
          <div class="card-header">
            <div class="doc-section-title-wrap" style="flex:1;max-width:60%;">
              <input
                type="text"
                class="form-control doc-section-title-input"
                data-doc-section-title="${key}"
                value="${docEscapeHtml(title)}"
                placeholder="${docEscapeHtml(labelForSection(key))}"
              >
            </div>

            <div class="doc-section-header-actions">
              <label class="doc-section-include-toggle">
                <input type="checkbox"
                  data-doc-section-enable="${key}"
                  ${checked}
                >
                Incluir en PDF
              </label>

              ${
                isReadonly
                  ? ""
                  : `<button class="btn btn-xs btn-outline"
                      data-doc-ai-section="${key}">
                      ✨ Preguntar a IA
                    </button>`
              }
            </div>
          </div>

          <div class="card-body">
            <textarea
              class="form-control doc-section-textarea"
              data-doc-section-text="${key}"
              rows="8"
              ${isReadonly ? "readonly" : ""}
            >${contenido}</textarea>

            ${
              isReadonly
                ? ""
                : `
              <div class="doc-section-media-drop"
                data-doc-section-drop="${key}">
                <div class="doc-section-media-items">
                  ${renderSectionMediaHTML(key)}
                </div>
                <div class="doc-section-media-hint">
                  Arrastra aquí imágenes para adjuntar a esta sección.
                </div>
              </div>
            `
            }
          </div>
        </div>
      `;
    })
    .join("");
}
// ======================================================
// RENDERIZAR FICHAS TÉCNICAS (biblioteca lateral)
// ======================================================

function renderDocFichasHTML() {
  const media = appState.documentacion.mediaLibrary || [];

  // Filtrar solo PDFs, Word o categoría “ficha”
  const fichas = media.filter((m) => {
    const cat = (m.docCategory || "").toLowerCase();
    const mime = (m.mimeType || "").toLowerCase();

    if (cat === "ficha") return true;
    if (mime === "application/pdf") return true;
    if (
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mime === "application/msword"
    )
      return true;

    return false;
  });

  const selected = new Set(
    appState.documentacion.selectedFichasMediaIds || []
  );

  const term =
    (appState.documentacion.fichasSearchTerm || "")
      .trim()
      .toLowerCase();

  const filtered = term
    ? fichas.filter((m) => {
        const t =
          (m.nombre || "") +
          " " +
          (m.folderName || "") +
          " " +
          (m.docCategory || "");
        return t.toLowerCase().includes(term);
      })
    : fichas;

  if (!filtered.length) {
    return `
      <p class="text-muted" style="font-size:0.85rem;">
        No se han encontrado fichas técnicas. Puedes subirlas desde
        <strong>Gestión de documentación</strong>.
      </p>
      <div class="form-group mb-2">
        <input
          type="text"
          id="docFichasSearchInput"
          class="form-control"
          placeholder="Buscar por nombre..."
          value="${appState.documentacion.fichasSearchTerm || ""}"
        >
      </div>
    `;
  }

  const list = filtered
    .map((m) => {
      const checked = selected.has(m.id) ? "checked" : "";
      const main = m.folderName
        ? `<strong>${m.folderName}</strong> – ${m.nombre}`
        : `<strong>${m.nombre}</strong>`;

      return `
        <label class="doc-ficha-item">
          <input type="checkbox"
            data-doc-ficha-media-id="${m.id}"
            ${checked}
          >
          <span class="doc-ficha-main">${main}</span>
        </label>
      `;
    })
    .join("");

  return `
    <div class="doc-fichas-section">
      <div class="doc-fichas-block">
        <div class="doc-fichas-title">Fichas técnicas de biblioteca</div>
        <p class="doc-fichas-help">
          Selecciona las fichas que quieras incluir en el PDF técnico.
        </p>

        <div class="form-group mb-2">
          <input
            type="text"
            id="docFichasSearchInput"
            class="form-control"
            placeholder="Buscar por nombre..."
            value="${appState.documentacion.fichasSearchTerm || ""}"
          >
        </div>

        <div class="doc-fichas-list doc-fichas-media-list">
          ${list}
        </div>
      </div>
    </div>
  `;
}

// ======================================================
// SÓLO MOSTRAR IMÁGENES EN DOCUMENTACIÓN GRÁFICA
// (biblioteca lateral de imágenes)
// ======================================================

function cleanInvalidMediaItems() {
  const list = appState.documentacion.mediaLibrary || [];
  appState.documentacion.mediaLibrary = list.filter(
    (m) => m && m.id && typeof m.id === "string" && m.id.trim()
  );
}

function renderDocMediaLibraryHTML() {
  cleanInvalidMediaItems();

  const all = appState.documentacion.mediaLibrary || [];

  // Filtrar solo imágenes reales
  const images = all.filter((m) => {
    const mime = (m.mimeType || "").toLowerCase();
    const type = (m.type || "").toLowerCase();
    const url = (m.url || "").toLowerCase();

    return (
      mime.startsWith("image/") ||
      type === "image" ||
      url.endsWith(".png") ||
      url.endsWith(".jpg") ||
      url.endsWith(".jpeg") ||
      url.endsWith(".webp") ||
      url.endsWith(".gif")
    );
  });

  if (!images.length) {
    return `
      <p class="text-muted" style="font-size:0.85rem;">
        Todavía no has subido documentación gráfica.
      </p>
    `;
  }

  const term =
    (appState.documentacion.mediaSearchTerm || "")
      .trim()
      .toLowerCase();

  const filtered = term
    ? images.filter((m) => {
        const t =
          (m.nombre || "") +
          " " +
          (m.folderName || "") +
          " " +
          (m.docCategory || "");
        return t.toLowerCase().includes(term);
      })
    : images;

  if (!filtered.length) {
    return `
      <p class="text-muted" style="font-size:0.85rem;">
        No se han encontrado imágenes que coincidan con la búsqueda.
      </p>
    `;
  }

  // Render lista
  return `
    <div class="doc-media-list doc-fichas-list">
      ${filtered
        .map((m) => {
          const caption =
            m.folderName && m.nombre
              ? `${m.folderName} – ${m.nombre}`
              : m.nombre;
          return `
            <div class="doc-media-item doc-media-row"
              draggable="true"
              data-media-id="${m.id}">
              <div class="doc-media-row-main">
                <span class="doc-media-row-icon">🖼️</span>
                <span class="doc-media-caption">${caption}</span>
              </div>
              <div class="doc-media-row-actions">
                <button class="btn btn-xs"
                  data-media-view-id="${m.id}">
                  👁 Ver
                </button>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

// ======================================================
// REFRESCAR SÓLO EL GRID DE MEDIA
// ======================================================

function refreshDocMediaGridOnly() {
  const container = getDocAppContent();
  if (!container) return;

  const body = container.querySelector(".doc-media-body");
  if (!body) return;

  body.innerHTML = renderDocMediaLibraryHTML();

  attachDocMediaGridHandlers(container);
}

// ======================================================
// INPUTS DE LOS BUSCADORES (fichas / imágenes)
// ======================================================

function attachDocSearchHandlers(container) {
  // Buscador imágenes
  const inputImg = container.querySelector("#docMediaSearchInput");
  if (inputImg) {
    inputImg.addEventListener("input", () => {
      appState.documentacion.mediaSearchTerm = inputImg.value || "";
      saveDocStateToLocalStorage();
      refreshDocMediaGridOnly();
    });
  }

  // Buscador fichas técnicas
  const inputFich = container.querySelector("#docFichasSearchInput");
  if (inputFich) {
    inputFich.addEventListener("input", () => {
      appState.documentacion.fichasSearchTerm =
        inputFich.value || "";
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  }
}

// ======================================================
// ACTUALIZAR TITULOS CUSTOM, CHECKBOXES, TEXTAREAS
// ======================================================

function attachDocSectionHandlers(container) {
  // Títulos
  container
    .querySelectorAll(".doc-section-title-input")
    .forEach((inp) => {
      inp.addEventListener("input", () => {
        const key = inp.getAttribute("data-doc-section-title");
        if (!key) return;

        appState.documentacion.sectionTitles =
          appState.documentacion.sectionTitles || {};
        appState.documentacion.sectionTitles[key] =
          inp.value || "";

        saveDocStateToLocalStorage();
      });
    });

  // Textareas
  container
    .querySelectorAll(".doc-section-textarea")
    .forEach((txt) => {
      txt.addEventListener("input", () => {
        const key = txt.getAttribute("data-doc-section-text");
        if (!key) return;

        appState.documentacion.secciones =
          appState.documentacion.secciones || {};
        appState.documentacion.secciones[key] = txt.value;

        saveDocStateToLocalStorage();
      });
    });

  // Checkbox incluir sección
  container
    .querySelectorAll("[data-doc-section-enable]")
    .forEach((chk) => {
      chk.addEventListener("change", () => {
        const key = chk.getAttribute("data-doc-section-enable");
        if (!key) return;

        appState.documentacion.includedSections =
          appState.documentacion.includedSections || {};

        appState.documentacion.includedSections[key] = chk.checked;

        saveDocStateToLocalStorage();
      });
    });

  // Botón IA
  container
    .querySelectorAll("[data-doc-ai-section]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const key = btn.getAttribute("data-doc-ai-section");
        if (!key) return;

        const nuevo = await askAIForSection(key);

        appState.documentacion.secciones[key] = nuevo;
        saveDocStateToLocalStorage();
        renderDocumentacionView();
      });
    });
}
// ======================================================
// HANDLERS DE DRAG & DROP DE MEDIA
// ======================================================

function attachDocMediaGridHandlers(container) {
  // Arrastrar imágenes desde el grid lateral
  container.querySelectorAll(".doc-media-item").forEach((item) => {
    item.addEventListener("dragstart", (ev) => {
      const id = item.getAttribute("data-media-id");
      if (id && ev.dataTransfer) {
        ev.dataTransfer.setData("text/plain", id);
        ev.dataTransfer.effectAllowed = "copy";
      }
    });
  });

  // Ver imagen (overlay flotante)
  container.querySelectorAll("[data-media-view-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-media-view-id");
      if (!id) return;

      const item =
        (appState.documentacion.mediaLibrary || []).find(
          (m) => m.id === id
        );

      if (!item || !item.url) {
        alert("Imagen no encontrada.");
        return;
      }

      const mime = (item.mimeType || "").toLowerCase();
      const url = (item.url || "").toLowerCase();

      const isImg =
        mime.startsWith("image/") ||
        url.endsWith(".png") ||
        url.endsWith(".jpg") ||
        url.endsWith(".jpeg") ||
        url.endsWith(".webp") ||
        url.endsWith(".gif");

      if (isImg) {
        openDocImageFloatingPreview(item);
      } else {
        window.open(item.url, "_blank");
      }
    });
  });

  // Quitar media de sección
  container
    .querySelectorAll(".doc-section-media-remove")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-remove-media-id");
        const zone = btn.closest("[data-doc-section-drop]");
        const sec = zone
          ? zone.getAttribute("data-doc-section-drop")
          : null;

        if (!id || !sec) return;

        detachMediaFromSection(sec, id);
      });
    });
}

// ======================================================
// MODAL PARA AÑADIR BLOQUES CUSTOM
// ======================================================

function openDocCustomModal() {
  const modal = document.getElementById("docCustomModal");
  const back = document.getElementById("docModalBackdrop");

  if (modal) modal.classList.remove("hidden");
  if (back) back.classList.remove("hidden");

  const txt = document.getElementById("docCustomText");
  if (txt) txt.value = "";
}

function closeDocCustomModal() {
  document.getElementById("docCustomModal")?.classList.add("hidden");
  document.getElementById("docModalBackdrop")?.classList.add("hidden");
}

function saveDocCustomBlock() {
  const select = document.getElementById("docCustomSectionSelect");
  const textarea = document.getElementById("docCustomText");

  if (!select || !textarea) return;

  const sec = select.value;
  const text = textarea.value.trim();

  if (!text) {
    closeDocCustomModal();
    return;
  }

  const secs = (appState.documentacion.secciones ||= {});
  secs[sec] =
    secs[sec]?.trim().length > 0
      ? secs[sec].trim() + "\n\n" + text
      : text;

  (appState.documentacion.customBlocks ||= []).push({
    section: sec,
    text,
    ts: new Date().toISOString(),
  });

  saveDocStateToLocalStorage();
  closeDocCustomModal();
  renderDocumentacionView();
}

// ======================================================
// EXPORTAR PDF (Selector según MODO)
// ======================================================

async function exportarDocumentacionPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("jsPDF no está cargado.");
    return;
  }

  const modo = appState.documentacion.modo || "comercial";

  if (modo === "tecnica") {
    await exportarPDFTecnico();
  } else {
    await exportarPDFComercial();
  }
}

// ======================================================
// INSERTAR IMAGENES EN PDF TÉCNICO (con caption sin extensión)
// ======================================================

function getSectionImages(sectionKey) {
  const map = appState.documentacion.sectionMedia || {};
  const ids = map[sectionKey] || [];

  return ids
    .map((id) =>
      (appState.documentacion.mediaLibrary || []).find(
        (m) => m.id === id
      )
    )
    .filter((m) => {
      if (!m?.url) return false;
      const mime = (m.mimeType || "").toLowerCase();
      const url = (m.url || "").toLowerCase();
      return (
        mime.startsWith("image/") ||
        url.endsWith(".png") ||
        url.endsWith(".jpg") ||
        url.endsWith(".jpeg") ||
        url.endsWith(".webp") ||
        url.endsWith(".gif")
      );
    });
}

function removeExtension(name) {
  if (!name) return "";
  return name.replace(/\.[^.]+$/, "");
}

async function insertImagesForSection(doc, sectionKey, y, onNewPage) {
  const images = getSectionImages(sectionKey);
  if (!images.length) return y;

  const dims = getDocPageDimensions(doc);
  const maxY = dims.height - 25;
  const pageWidth = dims.width;

  for (const m of images) {
    try {
      const obj = await loadImageAsDataUrl(m.url);
      const ratio = obj.width / obj.height;

      let imgW = 60;
      let imgH = imgW / ratio;

      if (imgH > 38) {
        imgH = 38;
        imgW = imgH * ratio;
      }

      const needed = imgH + 10;

      if (y + needed > maxY) {
        y = onNewPage();
      }

      const x = (pageWidth - imgW) / 2;
      doc.addImage(obj.dataUrl, "PNG", x, y, imgW, imgH);
      y += imgH + 4;

      // Caption SIN EXTENSIÓN
      const caption = removeExtension(m.nombre || "");

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(caption, pageWidth / 2, y, { align: "center" });

      y += 6;
    } catch (e) {
      console.warn("Error insertando imagen sección:", e);
    }
  }

  return y;
}

// ======================================================
// EXPORTAR PDF COMERCIAL (DISEÑO MULTIPÁGINA + SALESFORCE)
// ======================================================

async function exportarPDFComercial() {
  const jsPDF = window.jspdf.jsPDF;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const idioma = appState.documentacion.idioma || "es";
  const secciones = appState.documentacion.secciones || {};
  const included = appState.documentacion.includedSections || {};
  const proyecto = appState.proyecto || {};

  const nombreProyecto =
    proyecto.nombre ||
    proyecto.nombreProyecto ||
    "Proyecto";

  const promotora =
    proyecto.promotora ||
    proyecto.cliente ||
    "";

  const logo = await getDocLogoImage();
  const dims = getDocPageDimensions(pdf);
  const W = dims.width;
  const H = dims.height;

  //----------------------------------------
  // 1) PORTADA (misma imagen que PDF técnico)
  //----------------------------------------
  try {
    const cover = await loadImageAsDataUrl(DOC_TECH_COVER_URL);

    let cw = W;
    let ch = cw / (cover.width / cover.height);
    let cx = 0;
    let cy = (H - ch) / 2;

    if (ch < H) {
      ch = H;
      cw = ch * (cover.width / cover.height);
      cx = (W - cw) / 2;
      cy = 0;
    }

    pdf.addImage(cover.dataUrl, "PNG", cx, cy, cw, ch);
  } catch (e) {
    console.warn("Portada comercial no cargada:", e);
  }

  // Logo abajo
  if (logo?.dataUrl) {
    const ratio = logo.width / logo.height;
    const lw = 40;
    const lh = lw / ratio;
    const lx = W - lw - 20;
    const ly = H - lh - 20;
    pdf.addImage(logo.dataUrl, "PNG", lx, ly, lw, lh);
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Solución IP de accesos y videoportero", 20, 40);

  pdf.addPage("landscape");
  const dims2 = getDocPageDimensions(pdf);

  let y = 25;

  //----------------------------------------
  // 2) PÁGINA HORIZONTAL — PRESENTACIÓN EMPRESA
  //----------------------------------------

  if (included.presentacion_empresa !== false) {
    const texto =
      secciones.presentacion_empresa || "";

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(30, 30, 30);
    pdf.text("Presentación corporativa", 20, y);
    y += 10;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    const lines = pdf.splitTextToSize(
      texto,
      dims2.width - 40
    );
    pdf.text(lines, 20, y);

    y += lines.length * 6 + 8;
  }

  //----------------------------------------
  // 3) PÁGINA HORIZONTAL — RESUMEN Y SISTEMA (CUADROS)
  //----------------------------------------

  if (
    included.resumen !== false ||
    included.sistema !== false
  ) {
    pdf.addPage("landscape");
    const dW = dims2.width;
    let boxY = 25;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(20, 20, 20);

    const halfW = (dW - 40) / 2;

    // Cuadro Resumen
    if (included.resumen !== false) {
      pdf.text("Resumen del proyecto", 20, boxY);
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(18, boxY + 3, halfW, 80);

      pdf.setFontSize(11);
      const t = pdf.splitTextToSize(
        secciones.resumen || "",
        halfW - 6
      );
      pdf.text(t, 21, boxY + 10);
    }

    // Cuadro Sistema
    if (included.sistema !== false) {
      pdf.text("Sistema", 20 + halfW + 10, boxY);
      pdf.rect(18 + halfW + 10, boxY + 3, halfW, 80);

      pdf.setFontSize(11);
      const t2 = pdf.splitTextToSize(
        secciones.sistema || "",
        halfW - 6
      );
      pdf.text(t2, 21 + halfW + 10, boxY + 10);
    }
  }

  //----------------------------------------
  // 4) GALERÍA DE IMÁGENES (CUADROS HORIZONTALES + PIE SIN EXTENSIÓN)
  //----------------------------------------

  pdf.addPage("landscape");
  let posY = 25;
  const gap = 65;

  const images = appState.documentacion.mediaLibrary.filter((m) => {
    const mime = (m.mimeType || "").toLowerCase();
    const url = (m.url || "").toLowerCase();
    return (
      mime.startsWith("image/") ||
      url.match(/\.(png|jpg|jpeg|webp|gif)$/i)
    );
  });

  for (const m of images) {
    try {
      const obj = await loadImageAsDataUrl(m.url);
      const ratio = obj.width / obj.height;

      let iw = 100;
      let ih = iw / ratio;

      if (ih > 55) {
        ih = 55;
        iw = ih * ratio;
      }

      pdf.addImage(obj.dataUrl, "PNG", 20, posY, iw, ih);

      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);

      const caption = removeExtension(m.nombre);
      pdf.text(caption, 20 + iw / 2, posY + ih + 5, {
        align: "center",
      });

      posY += ih + 20;
      if (posY > 170) {
        pdf.addPage("landscape");
        posY = 25;
      }
    } catch (e) {
      console.warn("Error imagen galería:", e);
    }
  }

  pdf.save(
    "presentacion_comercial_" +
      removeExtension(nombreProyecto).toLowerCase()
        .replace(/[^a-z0-9]+/g, "_") +
      ".pdf"
  );
}

// ======================================================
// EXPONER RENDER
// ======================================================

window.renderDocumentacionView = renderDocumentacionView;
