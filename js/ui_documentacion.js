// js/ui_documentacion.js
// Página de DOCUMENTACIÓN: memoria de calidades auto-generada + editor flotante

// ======================================================
// ESTADO INICIAL
// ======================================================

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
  includedSections: {}, // mapa: sectionKey -> true/false (incluir en PDF técnico / comercial)
  logoData: null, // cache logo para PDF
  sectionTitles: {}, // títulos personalizados por sección
};

// ======================================================
// HELPERS BÁSICOS DE CONTENEDOR
// ======================================================

// Helpers básicos de contenedor
function getDocAppContent() {
  // Usamos el mismo contenedor que el resto de vistas
  if (typeof window.getAppContent === "function") {
    return window.getAppContent();
  }
  return document.getElementById("appContent");
}

// ======================================================
// PERSISTENCIA LOCAL
// ======================================================

const DOC_STORAGE_KEY = "docState_v1";

// Cargar estado guardado desde localStorage
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

// Guardar estado relevante en localStorage
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

// Orden de las secciones (incluye presentacion_empresa al inicio)
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

// Imagen portada técnica / comercial
const DOC_TECH_COVER_URL = "img/PortadaTecnica.jpg";

// ======================================================
// PLANTILLAS BASE POR IDIOMA
// ======================================================

const DOC_BASE_TEMPLATES = {
  es: {
    resumen:
      "El presente documento describe la solución de videoportero IP y control de accesos propuesta para el proyecto {{NOMBRE_PROYECTO}}, promovido por {{PROMOTORA}}.",
    sistema:
      "La solución se basa en un sistema de videoportero IP totalmente distribuido, con dispositivos 2N en acceso peatonal, zonas comunes y viviendas.",
    equipos:
      "La solución incluye los siguientes equipos principales:\n\n{{LISTADO_EQUIPOS}}",
    infraestructura:
      "Toda la infraestructura de comunicaciones se apoya en una red IP basada en cableado estructurado y electrónica de red gestionable.",
    servicios:
      "La solución puede complementarse con servicios cloud para gestión remota, credenciales móviles, QR temporales y monitorización.",
    normativa_red:
      "Cumplimiento de la Directiva RED (Radio Equipment Directive) y marcado CE aplicable a los equipos 2N y su electrónica asociada.",
    normativa_lpd:
      "Cumplimiento de la normativa de protección de datos (LPD / GDPR), incluyendo principios de minimización, legitimación y deber de información.",
    normativa_ciber:
      "Buenas prácticas de ciberseguridad: dispositivos IP endurecidos, actualizaciones de firmware firmadas, segmentación de red y soporte del Grupo Axis.",
    otros:
      "En caso de requerirlo, se podrán añadir servicios adicionales, integraciones con PMS / domótica y ampliaciones futuras de la solución.",
  },

  en: {
    resumen:
      "This document describes the proposed IP video intercom and access control solution for the project {{NOMBRE_PROYECTO}}, developed by {{PROMOTORA}}.",
    sistema:
      "The solution is based on a fully distributed IP video door entry system, using 2N devices on main entrances, common areas and apartments.",
    equipos:
      "The solution includes the following main devices:\n\n{{LISTADO_EQUIPOS}}",
    infraestructura:
      "All communication infrastructure is based on a structured cabling IP network with managed switches.",
    servicios:
      "The solution can be complemented with cloud services for remote management, mobile credentials, temporary QR codes and monitoring.",
    normativa_red:
      "RED Directive (Radio Equipment Directive) and CE marking compliance for 2N devices and associated network equipment.",
    normativa_lpd:
      "GDPR and data protection compliance, including minimisation, legal basis and information duties.",
    normativa_ciber:
      "Cybersecurity best practices: hardened IP devices, signed firmware updates, network segmentation and Axis Group support.",
    otros:
      "Additional services, PMS / home automation integrations and future extensions of the solution can be added upon request.",
  },

  pt: {
    resumen:
      "O presente documento descreve a solução proposta de videoporteiro IP e controlo de acessos para o projeto {{NOMBRE_PROYECTO}}, promovido por {{PROMOTORA}}.",
    sistema:
      "A solução baseia-se num sistema de videoporteiro IP totalmente distribuído, com dispositivos 2N nas entradas, zonas comuns e frações.",
    equipos:
      "A solução inclui os seguintes equipamentos principais:\n\n{{LISTADO_EQUIPOS}}",
    infraestructura:
      "Toda a infraestrutura de comunicações assenta numa rede IP com cablagem estruturada e switches geríveis.",
    servicios:
      "A solução pode ser complementada com serviços cloud para gestão remota, credenciais móveis, QR temporários e monitorização.",
    normativa_red:
      "Cumprimento da Diretiva RED (Radio Equipment Directive) e marcação CE aplicável aos equipamentos 2N.",
    normativa_lpd:
      "Cumprimento do RGPD e legislação de proteção de dados, incluindo minimização, base legal e dever de informação.",
    normativa_ciber:
      "Boas práticas de cibersegurança: dispositivos IP reforçados, firmware assinado, segmentação de rede e suporte do Grupo Axis.",
    otros:
      "Podem ser adicionados serviços adicionais, integrações com PMS / domótica e futuras ampliações da solução.",
  },
};

// ======================================================
// HELPERS DE TOKENS Y AUTO-GENERACIÓN
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
  if (!txt) return "";
  let out = String(txt);
  Object.keys(tokens).forEach((k) => {
    out = out.replace(new RegExp(k, "g"), tokens[k]);
  });
  return out;
}

// Generar todas las secciones en base a plantillas
function autoGenerateDocumentacion(idioma) {
  const lang = DOC_BASE_TEMPLATES[idioma] ? idioma : "es";
  const base = DOC_BASE_TEMPLATES[lang];
  const tokens = buildDocTokens();

  const nuevas = {};

  DOC_SECTION_ORDER.forEach((key) => {
    if (key === "presentacion_empresa") {
      // Texto fijo por defecto (se puede editar después)
      nuevas[key] =
        appState.documentacion.secciones[key] ||
        "2N lidera el camino en tecnología de control de acceso: ofrecemos las mejores características modernas sin comprometer la confiabilidad y la facilidad de uso.\n\n" +
          "2N tiene más de 30 años de experiencia en el desarrollo de productos innovadores y de alta calidad: después de inventar el primer intercomunicador IP del mundo en 2008 y el primer intercomunicador LTE / 4G diez años después, continuamos empujando los límites y reaccionando a las cambiantes demandas del mercado.\n\n" +
          "Nuestra cartera incluye intercomunicadores, unidades contestadoras, lectores de control de acceso y sistemas de elevación. Juntos, estos productos crean una solución IP avanzada para cualquier proyecto residencial.\n\n" +
          "En 2N nos tomamos el diseño tan en serio como la innovación, y los Red Dot e iF Design Awards lo demuestran.\n\n" +
          "2N fue fundada en 1991 en Praga. En 2016 se unió al Grupo Axis, aumentando estabilidad e innovación.";
    } else {
      const tpl = base[key] || "";
      nuevas[key] = applyTokensToTemplate(tpl, tokens);
    }
  });

  appState.documentacion.secciones = nuevas;
  appState.documentacion.ultimaAutoGen = new Date().toISOString();
  appState.documentacion.idioma = lang;

  saveDocStateToLocalStorage();
}

// ======================================================
// UTILIDADES GENERALES
// ======================================================

function docEscapeHtml(str) {
  if (!str && str !== 0) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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

function getSectionIncluded(key) {
  const m = appState.documentacion.includedSections || {};
  if (typeof m[key] === "boolean") return m[key];
  return true; // por defecto incluidas
}

// ======================================================
// RENDER MEDIA DE SECCIÓN (chips)
// ======================================================

function renderSectionMediaHTML(sectionKey) {
  // La sección presentacion_empresa NO admite media
  if (sectionKey === "presentacion_empresa") return "";

  const mediaLib = appState.documentacion.mediaLibrary || [];
  const map = {};
  mediaLib.forEach((m) => (map[m.id] = m));

  const ids = appState.documentacion.sectionMedia?.[sectionKey] || [];
  if (!ids.length) return "";

  return ids
    .map((id) => {
      const m = map[id];
      if (!m) return "";

      const mime = (m.mimeType || "").toLowerCase();
      const url = (m.url || "").toLowerCase();
      const isImg =
        mime.startsWith("image/") ||
        url.match(/\.(png|jpg|jpeg|webp|gif)$/i);

      const caption = m.nombre || "";

      return `
        <div class="doc-section-media-chip">
          <div class="doc-section-media-thumb">
            ${
              isImg
                ? `<img src="${m.url}" alt="${docEscapeHtml(
                    caption
                  )}">`
                : `<div class="doc-section-media-icon">📄</div>`
            }
          </div>
          <div class="doc-section-media-foot">
            <div class="doc-section-media-caption-wrap">
              <span class="doc-section-media-caption">${docEscapeHtml(
                caption
              )}</span>
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
// RENDER DE SECCIONES (COLUMNA PRINCIPAL)
// ======================================================

function renderDocSectionsHTML() {
  const secciones = appState.documentacion.secciones || {};

  return DOC_SECTION_ORDER.map((key) => {
    const contenido = secciones[key] || "";
    const title = getSectionTitle(key);
    const included = getSectionIncluded(key);
    const isPresentacion = key === "presentacion_empresa";

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
            <label class="doc-section-include-toggle"
              style="font-size:0.75rem;display:flex;align-items:center;gap:0.25rem;margin-right:0.5rem;">
              <input type="checkbox"
                data-doc-section-enable="${key}"
                ${included ? "checked" : ""}>
              Incluir en PDF
            </label>

            ${
              isPresentacion
                ? `<button class="btn btn-xs btn-disabled" disabled
                     title="IA no disponible para esta sección">
                     ✨ IA no disponible
                   </button>`
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
            rows="${isPresentacion ? 12 : 10}"
          >${contenido}</textarea>

          ${
            isPresentacion
              ? `<p class="text-muted" style="font-size:0.8rem;margin-top:8px;">
                   Esta sección no admite imágenes ni documentos adjuntos.
                 </p>`
              : `
                <div class="doc-section-media-drop"
                  data-doc-section-drop="${key}">
                  <div class="doc-section-media-items">
                    ${renderSectionMediaHTML(key)}
                  </div>
                  <div class="doc-section-media-hint">
                    Arrastra aquí imágenes para adjuntar a esta sección
                    (máx. 10).
                  </div>
                </div>
              `
          }
        </div>
      </div>
    `;
  }).join("");
}

// ======================================================
// RENDER FICHAS TÉCNICAS (SIDEBAR)
// ======================================================

function renderDocFichasHTML() {
  const media = appState.documentacion.mediaLibrary || [];

  const fichas = media.filter((m) => {
    const cat = (m.docCategory || "").toLowerCase();
    const mime = (m.mimeType || "").toLowerCase();

    if (cat === "ficha") return true;
    if (mime === "application/pdf") return true;
    if (
      mime === "application/msword" ||
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
      return true;

    return false;
  });

  const selected = new Set(appState.documentacion.selectedFichasMediaIds || []);

  const term = (appState.documentacion.fichasSearchTerm || "")
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
          value="${docEscapeHtml(appState.documentacion.fichasSearchTerm || "")}"
        >
      </div>
    `;
  }

  const list = filtered
    .map((m) => {
      const checked = selected.has(m.id) ? "checked" : "";
      const main = m.folderName
        ? `<strong>${docEscapeHtml(m.folderName)}</strong> – ${docEscapeHtml(
            m.nombre || ""
          )}`
        : `<strong>${docEscapeHtml(m.nombre || "")}</strong>`;

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
            value="${docEscapeHtml(appState.documentacion.fichasSearchTerm || "")}"
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
// SOLO IMÁGENES EN DOCUMENTACIÓN GRÁFICA (SIDEBAR)
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

  const term = (appState.documentacion.mediaSearchTerm || "")
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
                <span class="doc-media-caption">${docEscapeHtml(
                  caption || ""
                )}</span>
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
// AÑADIR / QUITAR MEDIA A UNA SECCIÓN
// (con límite de 10 imágenes por sección)
// ======================================================

function attachMediaToSection(sectionKey, mediaId) {
  if (sectionKey === "presentacion_empresa") return; // no admite media

  appState.documentacion.sectionMedia =
    appState.documentacion.sectionMedia || {};

  const arr = appState.documentacion.sectionMedia[sectionKey] || [];

  // 👉 NUEVA LIMITACIÓN: máximo 10 imágenes por sección
  if (arr.length >= 10 && !arr.includes(mediaId)) {
    alert("Has alcanzado el máximo de 10 imágenes para esta sección.");
    return;
  }

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
// MODAL BLOQUES CUSTOM
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
  const actual = secs[sec] || "";
  const nuevo =
    actual.trim().length > 0 ? actual.trim() + "\n\n" + text : text;

  secs[sec] = nuevo;

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
// IA POR SECCIÓN (hook + implementación por defecto)
// ======================================================

async function askAIForSection(sectionKey) {
  // presentacion_empresa no usa IA
  if (sectionKey === "presentacion_empresa") {
    return appState.documentacion.secciones["presentacion_empresa"] || "";
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
    "Función de IA no implementada. Debes añadir window.handleDocSectionAI."
  );
  return textoActual;
}

// Implementación por defecto de IA (Cloud Run)
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
      throw new Error("Respuesta IA inválida: falta 'text'");
    }

    return data.text;
  };
}

// ======================================================
// FIRESTORE + STORAGE: CARGA / GUARDADO / BORRADO MEDIA
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

// Reutilizable en ui_doc_gestion.js
async function saveMediaFileToStorageAndFirestore(file, options = {}) {
  const name = file.name || "archivo";
  const now = new Date().toISOString();
  const isImg = file.type?.startsWith("image/");
  const type = isImg ? "image" : "file";

  const folderName = options.folderName || "";
  const docCategory = options.docCategory || (isImg ? "imagen" : "ficha");

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
  const uid = auth?.currentUser?.uid || null;

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

// Borrado completo (Storage + Firestore + estado local)
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

  appState.documentacion.mediaLibrary = media.filter((m) => m.id !== mediaId);

  // Quitar de secciones
  const map = appState.documentacion.sectionMedia || {};
  Object.keys(map).forEach((sec) => {
    map[sec] = map[sec].filter((id) => id !== mediaId);
  });

  // Quitar de fichas seleccionadas
  appState.documentacion.selectedFichasMediaIds = (
    appState.documentacion.selectedFichasMediaIds || []
  ).filter((id) => id !== mediaId);

  saveDocStateToLocalStorage();
  renderDocumentacionView();
}

// Slug para carpetas de Storage
function slugifyFolderName(name) {
  if (!name) return "general";

  return (
    String(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "general"
  );
}

// Imagen por referencia (por si quieres usarlo en el futuro)
function getImagenRef(ref) {
  if (!ref) return null;
  const clean = String(ref).trim().toUpperCase();
  if (window.DOC_IMAGENES_POR_REF?.[clean]) {
    return window.DOC_IMAGENES_POR_REF[clean];
  }
  return "img/devices/" + clean + ".png";
}

// ======================================================
// UTILIDADES PDF (jsPDF)
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

function getDocPageDimensions(pdf) {
  const size = pdf.internal.pageSize;
  return {
    width: size.getWidth ? size.getWidth() : size.width,
    height: size.getHeight ? size.getHeight() : size.height,
  };
}

// Header / footer técnico

function drawTechHeader(pdf, opts = {}) {
  const dims = getDocPageDimensions(pdf);
  const w = dims.width;

  const nombreProyecto = opts.nombreProyecto || "Proyecto";
  const logo = opts.logo || null;

  const marginX = 20;
  const textY = 18;

  let logoBottomY = textY;

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

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(55, 65, 81);
  pdf.text(nombreProyecto, marginX, textY);

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

function setupTechContentPage(pdf, opts = {}) {
  const startY = drawTechHeader(pdf, opts);
  drawTechFooter(pdf, opts);
  return startY;
}

// Imágenes asociadas a secciones (solo imágenes válidas)
function getSectionImages(sectionKey) {
  const map = appState.documentacion.sectionMedia || {};
  const ids = map[sectionKey] || [];

  return ids
    .map((id) =>
      (appState.documentacion.mediaLibrary || []).find((m) => m.id === id)
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
        y = typeof onNewPage === "function" ? onNewPage() : 25;
      }

      const x = (pageWidth - imgW) / 2;
      doc.addImage(obj.dataUrl, "PNG", x, y, imgW, imgH);
      y += imgH + 4;

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
// EXPORTAR PDF (selector según modo)
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

  let titulo = "Memoria de calidades";
  if (idioma === "en") titulo = "Technical specification";
  if (idioma === "pt") titulo = "Memória descritiva";

  // ---- Portada técnica con imagen ----
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

  // Degradado + panel blanco
  const gradHeight = 70;
  const gradStart = pageH - gradHeight;
  for (let i = 0; i < 6; i++) {
    const y = gradStart + (i * gradHeight) / 6;
    const h = gradHeight / 6 + 0.5;
    const shade = 255 - i * 8;
    doc.setFillColor(shade, shade, shade);
    doc.rect(0, y, pageW, h, "F");
  }

  const panelH = 55;
  const panelY = pageH - panelH;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, panelY, pageW, panelH, "F");

  // Título portada
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text(titulo, 20, panelY - 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(
    idioma === "en"
      ? "2N video intercom & access control"
      : idioma === "pt"
      ? "Videoporteiro e controlo de acessos 2N"
      : "Videoportero y control de accesos 2N",
    20,
    panelY + 7
  );

  let y = panelY + 18;

  doc.setFont("helvetica", "bold");
  doc.text("Proyecto:", 20, y);
  doc.setFont("helvetica", "normal");

  const linesProyecto = doc.splitTextToSize(nombreProyecto, pageW - 60);
  doc.text(linesProyecto, 45, y);
  y += linesProyecto.length * 6 + 4;

  if (promotora) {
    doc.setFont("helvetica", "bold");
    doc.text(
      idioma === "en"
        ? "Developer:"
        : idioma === "pt"
        ? "Promotor:"
        : "Promotor:",
      20,
      y
    );
    doc.setFont("helvetica", "normal");
    const linesProm = doc.splitTextToSize(promotora, pageW - 60);
    doc.text(linesProm, 45, y);
    y += linesProm.length * 6 + 4;
  }

  drawTechFooter(doc, { idioma });

  // ---- Página índice ----
  doc.addPage();
  const tocPage = doc.getNumberOfPages();
  const tocStartY = setupTechContentPage(doc, {
    idioma,
    nombreProyecto,
    logo,
  });
  const tocEntries = [];
  const pageDims = getDocPageDimensions(doc);
  const pageH2 = pageDims.height;

  // ---- Presentación de empresa (si está incluida) ----
  const includePresentacion =
    included["presentacion_empresa"] !== false;

  if (includePresentacion) {
    doc.addPage();
    let current = doc.getNumberOfPages();
    y = setupTechContentPage(doc, { idioma, nombreProyecto, logo });

    const title =
      idioma === "en"
        ? "Company introduction"
        : idioma === "pt"
        ? "Apresentação da empresa"
        : "Presentación de empresa";

    tocEntries.push({ title, page: current });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(title, 20, y);
    y += 4;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(20, y, pageW - 20, y);
    y += 6;

    const texto = secciones["presentacion_empresa"] || "";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);

    const lines = doc.splitTextToSize(texto, pageW - 40);
    doc.text(lines, 20, y);
  }

  // ---- Secciones técnicas ----
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
    if (y + need > pageH2 - 25) {
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
    if (included[key] === false) continue;

    const contenido = (secciones[key] || "").trim();
    const imgs = getSectionImages(key);
    if (!contenido && imgs.length === 0) continue;

    tocEntries.push({ title: getSectionTitle(key), page: currentPage });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(getSectionTitle(key), 20, y);
    y += 4;

    doc.setDrawColor(226, 232, 240);
    doc.line(20, y, pageW - 20, y);
    y += 6;

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

    y = await insertImagesForSection(doc, key, y, newPage);
    y += 4;
  }

  // ---- Anexo fichas técnicas ----
  const allMedia = appState.documentacion.mediaLibrary || [];
  const selected = appState.documentacion.selectedFichasMediaIds || [];
  const fichas = allMedia.filter((m) => selected.includes(m.id));

  if (fichas.length > 0) {
    doc.addPage();
    currentPage = doc.getNumberOfPages();
    y = setupTechContentPage(doc, { idioma, nombreProyecto, logo });

    let tituloAnexo =
      idioma === "en"
        ? "Appendix – Technical documentation"
        : idioma === "pt"
        ? "Anexo – Documentação técnica"
        : "Anexo – Fichas técnicas adjuntas";

    tocEntries.push({ title: tituloAnexo, page: currentPage });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(tituloAnexo, 20, y);
    y += 6;

    doc.setDrawColor(226, 232, 240);
    doc.line(20, y, pageW - 20, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);

    for (const m of fichas) {
      const extra = m.folderName ? " – " + m.folderName : "";
      const text =
        "• " + (m.nombre || "") + extra + (m.url ? " (" + m.url + ")" : "");

      const lines = doc.splitTextToSize(text, pageW - 40);
      ensureSpace(lines.length);
      doc.text(lines, 20, y);
      y += lines.length * 4.8 + 2;
    }
  }

  // ---- Reescribir índice ----
  doc.setPage(tocPage);
  let yToc = tocStartY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(
    idioma === "en"
      ? "Contents"
      : idioma === "pt"
      ? "Índice"
      : "Contenido",
    20,
    yToc
  );
  yToc += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);

  for (const entry of tocEntries) {
    if (yToc > pageH2 - 25) {
      doc.addPage();
      yToc = setupTechContentPage(doc, {
        idioma,
        nombreProyecto,
        logo,
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(
        idioma === "en"
          ? "Contents (cont.)"
          : idioma === "pt"
          ? "Índice (cont.)"
          : "Contenido (cont.)",
        20,
        yToc
      );
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
// PDF COMERCIAL (estilo Salesforce / highlights)
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
  const nombreProyecto =
    proyecto.nombre || proyecto.nombreProyecto || "Proyecto";
  const promotora = proyecto.promotora || proyecto.cliente || "";
  const logo = await getDocLogoImage();

  const dims = getDocPageDimensions(doc);
  const pageW = dims.width;
  const pageH = dims.height;
  const marginX = 20;
  const marginTop = 20;
  const marginBottom = 20;

  // Helper tarjeta tipo Salesforce
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

    doc.setFillColor(229, 231, 235);
    doc.roundedRect(x + 1.2, y + 1.8, width, cardH, 3, 3, "F");

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(209, 213, 219);
    doc.roundedRect(x, y, width, cardH, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    const titleLines = doc.splitTextToSize(title, width - paddingX * 2);
    doc.text(titleLines, x + paddingX, y + paddingTop + 5);

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
          caption: removeExtension(m.nombre || ""),
        });
      }
    }

    return out.slice(0, 8);
  }

  // ---- Página 1: portada comercial ----
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

  const gradH = 70;
  const gradStart = pageH - gradH;
  for (let i = 0; i < 6; i++) {
    const y = gradStart + (i * gradH) / 6;
    const h = gradH / 6 + 0.5;
    const shade = 255 - i * 8;
    doc.setFillColor(shade, shade, shade);
    doc.rect(0, y, pageW, h, "F");
  }

  const panelH = 55;
  const panelY = pageH - panelH;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, panelY, pageW, panelH, "F");

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

  // ---- Página 2: presentación empresa ----
  const includePresentacion =
    appState.documentacion.includedSections?.presentacion_empresa !==
    false;

  if (includePresentacion) {
    doc.addPage();
    let y2 = marginTop;

    const dims2 = getDocPageDimensions(doc);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);

    const tit =
      idioma === "en"
        ? "Company introduction"
        : idioma === "pt"
        ? "Apresentação de empresa"
        : "Presentación de empresa";

    doc.text(tit, marginX, y2);
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.4);
    doc.line(marginX, y2 + 2.5, dims2.width - marginX, y2 + 2.5);
    y2 += 12;

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

  // ---- Página 3: resumen + sistema (tarjetas) ----
  doc.addPage();
  const dims3 = getDocPageDimensions(doc);
  const pw3 = dims3.width;
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

  // ---- Página 4: servicios / infra / otros ----
  const tieneServicios = secciones.servicios?.trim().length > 0;
  const tieneInfra = secciones.infraestructura?.trim().length > 0;
  const tieneOtros = secciones.otros?.trim().length > 0;

  if (tieneServicios || tieneInfra || tieneOtros) {
    doc.addPage();
    const dims4 = getDocPageDimensions(doc);
    const pw4 = dims4.width;
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

  // ---- Página 5: galería visual (máx 8 imágenes) ----
  const galeria = collectSectionImagesWithCaptions();

  if (galeria.length) {
    doc.addPage();

    const dimsG = getDocPageDimensions(doc);
    const pwG = dimsG.width;
    const phG = dimsG.height;

    let yG = marginTop;

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

    const maxW = (pwG - marginX * 2 - 10) / 2;
    const maxH = 38;
    const rowH = maxH + 20;

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

        const captionLines = doc.splitTextToSize(
          caption,
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
// HANDLERS UI
// ======================================================

function attachDocMediaGridHandlers(root) {
  const container = root || getDocAppContent();
  if (!container) return;

  // Drag
  container.querySelectorAll(".doc-media-item").forEach((item) => {
    item.addEventListener("dragstart", (ev) => {
      const id = item.getAttribute("data-media-id");
      if (id && ev.dataTransfer) {
        ev.dataTransfer.setData("text/plain", id);
        ev.dataTransfer.effectAllowed = "copy";
      }
    });
  });

  // Ver imagen
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

  // Botones quitar media en chips
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

function attachDocSearchHandlers(container) {
  const inputImg = container.querySelector("#docMediaSearchInput");
  if (inputImg) {
    inputImg.addEventListener("input", () => {
      appState.documentacion.mediaSearchTerm = inputImg.value || "";
      saveDocStateToLocalStorage();
      refreshDocMediaGridOnly();
    });
  }

  const inputFich = container.querySelector("#docFichasSearchInput");
  if (inputFich) {
    inputFich.addEventListener("input", () => {
      appState.documentacion.fichasSearchTerm = inputFich.value || "";
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  }
}

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

  // Incluir sección
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

  // Zonas drop de media
  container
    .querySelectorAll("[data-doc-section-drop]")
    .forEach((zone) => {
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
}

function attachDocCustomModalHandlers(container) {
  const nuevoBloqueBtn = container.querySelector("#docNuevoBloqueBtn");
  if (nuevoBloqueBtn) {
    nuevoBloqueBtn.addEventListener("click", openDocCustomModal);
  }

  const modal = document.getElementById("docCustomModal");
  const cancelBtn = modal && modal.querySelector("#docCustomCancelBtn");
  const saveBtn = modal && modal.querySelector("#docCustomSaveBtn");
  const backdrop = document.getElementById("docModalBackdrop");

  if (cancelBtn) cancelBtn.addEventListener("click", closeDocCustomModal);
  if (saveBtn) saveBtn.addEventListener("click", saveDocCustomBlock);
  if (backdrop) backdrop.addEventListener("click", closeDocCustomModal);
}

// Handlers superiores (modo, idioma, regenerar, exportar)
function attachDocumentacionHandlers() {
  const container = getDocAppContent();
  if (!container) return;

  // Buscadores
  attachDocSearchHandlers(container);

  // Secciones
  attachDocSectionHandlers(container);

  // Grid de imágenes
  attachDocMediaGridHandlers(container);

  // Modal custom
  attachDocCustomModalHandlers(container);

  // Cambios de idioma
  container.querySelectorAll("[data-doc-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-doc-lang");
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

  // Regenerar texto base
  const regenBtn = container.querySelector("#docRegenerarBtn");
  if (regenBtn) {
    regenBtn.addEventListener("click", () => {
      autoGenerateDocumentacion(appState.documentacion.idioma || "es");
      renderDocumentacionView();
    });
  }

  // Exportar PDF
  const exportBtn = container.querySelector("#docExportarBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportarDocumentacionPDF().catch((err) =>
        console.error("Error exportando PDF:", err)
      );
    });
  }
}

// ======================================================
// RENDER PRINCIPAL DE LA PÁGINA DE DOCUMENTACIÓN
// ======================================================

async function renderDocumentacionView() {
  const container = getDocAppContent();
  if (!container) return;

  // Primera vez: autogenerar
  if (!appState.documentacion.ultimaAutoGen) {
    autoGenerateDocumentacion(appState.documentacion.idioma || "es");
  }

  // Cargar media una sola vez
  if (!appState.documentacion.mediaLoaded) {
    await ensureDocMediaLoaded();
  }

  const idioma = appState.documentacion.idioma || "es";
  const modo = appState.documentacion.modo || "comercial";

  const langButtons = Object.values(DOC_LANGS)
    .map(
      ({ code, label }) => `
        <button type="button"
          class="btn btn-xs ${
            idioma === code ? "btn-primary" : "btn-outline"
          }"
          data-doc-lang="${code}">
          ${label}
        </button>`
    )
    .join("");

  container.innerHTML = `
    <div class="doc-page">

      <div class="card doc-header-card">
        <div class="card-header">
          <div>
            <div class="card-title">Documentación del proyecto</div>
            <div class="card-subtitle">
              Genera la memoria de calidades y la documentación técnica / comercial.
            </div>
          </div>

          <div class="doc-header-actions">
            <div class="btn-group">
              ${langButtons}
            </div>

            <div class="btn-group" style="margin-left:8px;">
              <button id="docModoComercialBtn"
                class="btn btn-xs ${
                  modo === "comercial" ? "btn-primary" : "btn-outline"
                }">
                Comercial
              </button>
              <button id="docModoTecnicoBtn"
                class="btn btn-xs ${
                  modo === "tecnica" ? "btn-primary" : "btn-outline"
                }">
                Técnica
              </button>
            </div>

            <button id="docRegenerarBtn"
              class="btn btn-xs btn-outline"
              style="margin-left:8px;">
              ♻️ Regenerar texto base
            </button>

            <button id="docExportarBtn"
              class="btn btn-xs btn-primary"
              style="margin-left:8px;">
              ⬇ Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <div class="doc-layout">
        <div class="doc-main">
          ${renderDocSectionsHTML()}
        </div>

        <div class="doc-sidebar">

          <div class="card">
            <div class="card-header">
              <div class="card-title">Documentación gráfica</div>
            </div>
            <div class="card-body">
              <input
                type="text"
                id="docMediaSearchInput"
                class="form-control"
                placeholder="Buscar imágenes..."
                value="${docEscapeHtml(
                  appState.documentacion.mediaSearchTerm || ""
                )}">
              <div class="doc-media-body" style="margin-top:8px;">
                ${renderDocMediaLibraryHTML()}
              </div>
            </div>
          </div>

          <div class="card" style="margin-top:12px;">
            <div class="card-header">
              <div class="card-title">Fichas técnicas</div>
            </div>
            <div class="card-body">
              ${renderDocFichasHTML()}
            </div>
          </div>

          <div class="card" style="margin-top:12px;">
            <div class="card-header">
              <div class="card-title">Bloques personalizados</div>
            </div>
            <div class="card-body">
              <button id="docNuevoBloqueBtn"
                class="btn btn-xs btn-outline">
                ➕ Añadir bloque
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- Modal custom + backdrop -->
      <div id="docModalBackdrop" class="doc-modal-backdrop hidden"></div>
      <div id="docCustomModal" class="doc-modal hidden">
        <!-- Estructura del modal definida en tu HTML principal -->
      </div>
    </div>
  `;

  attachDocumentacionHandlers();
}

// ======================================================
// EXPORTAR FUNCIONES CLAVE EN window
// ======================================================

window.renderDocumentacionView = renderDocumentacionView;
window.ensureDocMediaLoaded = ensureDocMediaLoaded;
window.saveMediaFileToStorageAndFirestore = saveMediaFileToStorageAndFirestore;
window.deleteMediaById = deleteMediaById;
window.exportarDocumentacionPDF = exportarDocumentacionPDF;
