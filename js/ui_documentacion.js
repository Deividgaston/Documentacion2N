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

const DOC_LOGO_DEFAULT_URL = "img/logo_2n.svg";
const DOC_TECH_COVER_URL = "img/PortadaTecnica.jpg";

// ======================================================
// PLANTILLAS BASE (para IA / autogeneración)
// ======================================================

const DOC_BASE_TEMPLATES = {
  es: {
    resumen:
      "El presente documento describe la solución de videoportero IP y control de accesos propuesta para el proyecto {{NOMBRE_PROYECTO}}, promovido por {{PROMOTORA}}.",
    sistema:
      "La solución se basa en un sistema de videoportero IP totalmente distribuido, con dispositivos 2N conectados a la red informática del edificio...",
    equipos:
      "La solución incluye los siguientes equipos principales:\n\n{{LISTADO_EQUIPOS}}",
    infraestructura:
      "Toda la infraestructura de comunicaciones se apoya en una red IP basada en cableado estructurado y electrónica de red gestionable...",
    servicios:
      "La solución puede complementarse con servicios cloud para gestión remota, monitorización proactiva y actualizaciones de firmware...",
    normativa_red:
      "Los equipos cumplen con la Directiva RED (Radio Equipment Directive) y las normas europeas aplicables en materia de compatibilidad electromagnética...",
    normativa_lpd:
      "La instalación deberá cumplir con la normativa de protección de datos (LPD / GDPR), estableciendo políticas claras de conservación y acceso a las grabaciones...",
    normativa_ciber:
      "Los dispositivos de 2N forman parte del grupo Axis Communications, lo que garantiza un exigente enfoque en ciberseguridad, actualizaciones periódicas y hardening de la solución...",
    otros:
      "En caso de requerirlo, se podrán añadir servicios adicionales, integraciones con plataformas de terceros o funcionalidades específicas para el proyecto.",
  },

  en: {
    resumen:
      "This document describes the proposed IP video intercom and access control solution for project {{NOMBRE_PROYECTO}}, developed by {{PROMOTORA}}.",
    sistema:
      "The solution is based on a fully distributed IP video intercom system, using 2N devices connected to the building’s IT network...",
    equipos:
      "The solution includes the following main devices:\n\n{{LISTADO_EQUIPOS}}",
    infraestructura:
      "All communication infrastructure relies on an IP network with structured cabling and manageable network switches...",
    servicios:
      "The solution can be complemented with cloud services for remote management, proactive monitoring, and firmware updates...",
    normativa_red:
      "The equipment complies with the Radio Equipment Directive (RED) and applicable European EMC standards...",
    normativa_lpd:
      "The system must comply with GDPR and local data protection regulations, including retention and access policies for recordings...",
    normativa_ciber:
      "2N devices are part of Axis Communications Group, following strict cybersecurity practices, regular updates, and hardening guidelines...",
    otros:
      "If required, additional services, third-party integrations, or project-specific features can be added.",
  },

  pt: {
    resumen:
      "O presente documento descreve a solução proposta de videoporteiro IP e controlo de acessos para o projeto {{NOMBRE_PROYECTO}}, promovido por {{PROMOTORA}}.",
    sistema:
      "A solução baseia-se num sistema de videoporteiro IP totalmente distribuído, com dispositivos 2N ligados à rede informática do edifício...",
    equipos:
      "A solução inclui os seguintes equipamentos principais:\n\n{{LISTADO_EQUIPOS}}",
    infraestructura:
      "Toda a infraestrutura de comunicações assenta numa rede IP com cablagem estruturada e switches geríveis...",
    servicios:
      "A solução pode ser complementada com serviços cloud para gestão remota, monitorização proactiva e atualizações de firmware...",
    normativa_red:
      "Os equipamentos cumprem a Diretiva RED (Radio Equipment Directive) e as normas europeias aplicáveis em compatibilidade electromagnética...",
    normativa_lpd:
      "A instalação deve cumprir o RGPD e a legislação local de proteção de dados, definindo políticas claras de conservação e acesso às gravações...",
    normativa_ciber:
      "Os dispositivos 2N fazem parte do grupo Axis Communications, seguindo práticas rigorosas de cibersegurança e atualizações periódicas...",
    otros:
      "Se necessário, podem ser adicionados serviços adicionais, integrações com plataformas de terceiros ou funcionalidades específicas para o projeto.",
  },
};

// ======================================================
// HELPERS PARA TOKENS Y AUTOGENERACIÓN
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
// AUTOGENERACIÓN DE SECCIONES
// ======================================================

function autoGenerateDocumentacion(idioma) {
  const lang = DOC_BASE_TEMPLATES[idioma] ? idioma : "es";
  const base = DOC_BASE_TEMPLATES[lang];
  const tokens = buildDocTokens();

  const nuevas = {};

  DOC_SECTION_ORDER.forEach((key) => {
    const tpl = base[key] || "";
    nuevas[key] = applyTokensToTemplate(tpl, tokens);
  });

  appState.documentacion.secciones = nuevas;
  appState.documentacion.ultimaAutoGen = new Date().toISOString();

  saveDocStateToLocalStorage();
}

// ======================================================
// HELPERS BÁSICOS
// ======================================================

function docEscapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getDocAppContent() {
  if (typeof window.getDocAppContent === "function") {
    return window.getDocAppContent();
  }
  if (typeof window.getAppContent === "function") {
    return window.getAppContent();
  }
  return document.getElementById("appContent");
}

// ======================================================
// LABELS Y TÍTULOS
// ======================================================

function labelForSection(key) {
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

function getSectionTitle(key) {
  const titles = appState.documentacion.sectionTitles || {};
  const custom = titles[key];
  if (custom && custom.trim().length > 0) return custom.trim();
  return labelForSection(key);
}

function getSectionIncluded(key) {
  const m = appState.documentacion.includedSections || {};
  if (typeof m[key] === "boolean") return m[key];
  return true;
}

// ======================================================
// RENDER SECCIONES
// ======================================================

function renderSectionMediaHTML(sectionKey) {
  const mediaLib = appState.documentacion.mediaLibrary || [];
  const map = {};
  mediaLib.forEach((m) => (map[m.id] = m));

  const ids = (appState.documentacion.sectionMedia || {})[sectionKey] || [];
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

function renderDocSectionsHTML() {
  const secciones = appState.documentacion.secciones || {};
  const included = appState.documentacion.includedSections || {};

  return DOC_SECTION_ORDER.map((key) => {
    const contenido = secciones[key] || "";
    const title = getSectionTitle(key);
    const checked = included[key] !== false ? "checked" : "";

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
            rows="8"
          >${contenido}</textarea>

          <div class="doc-section-media-drop"
            data-doc-section-drop="${key}">
            <div class="doc-section-media-items">
              ${renderSectionMediaHTML(key)}
            </div>
            <div class="doc-section-media-hint">
              Arrastra aquí imágenes para adjuntar a esta sección.
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ======================================================
// FICHAS TÉCNICAS
// ======================================================

function renderDocFichasHTML() {
  const media = appState.documentacion.mediaLibrary || [];

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
// DOCUMENTACIÓN GRÁFICA (solo imágenes)
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

function refreshDocMediaGridOnly() {
  const container = getDocAppContent();
  if (!container) return;

  const body = container.querySelector(".doc-media-body");
  if (!body) return;

  body.innerHTML = renderDocMediaLibraryHTML();

  attachDocMediaGridHandlers(container);
}

// ======================================================
// BUSCADORES (fichas / imágenes)
// ======================================================

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
      appState.documentacion.fichasSearchTerm =
        inputFich.value || "";
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  }
}

// ======================================================
// HANDLERS DE SECCIONES
// ======================================================

function attachDocSectionHandlers(container) {
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
// DRAG & DROP MEDIA
// ======================================================

function attachDocMediaGridHandlers(container) {
  container.querySelectorAll(".doc-media-item").forEach((item) => {
    item.addEventListener("dragstart", (ev) => {
      const id = item.getAttribute("data-media-id");
      if (id && ev.dataTransfer) {
        ev.dataTransfer.setData("text/plain", id);
        ev.dataTransfer.effectAllowed = "copy";
      }
    });
  });

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
// OVERLAY PREVIEW IMAGEN
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
// MEDIA ↔ SECCIONES
// ======================================================

function attachMediaToSection(sectionKey, mediaId) {
  appState.documentacion.sectionMedia =
    appState.documentacion.sectionMedia || {};

  const arr = appState.documentacion.sectionMedia[sectionKey] || [];

  // Aquí limitabas a 4; ahora permitimos hasta 10
  if (arr.includes(mediaId)) return;
  if (arr.length >= 10) {
    alert("Puedes adjuntar hasta 10 imágenes por sección.");
    return;
  }

  arr.push(mediaId);
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
// IA POR SECCIÓN (incluye presentacion_empresa)
// ======================================================

async function askAIForSection(sectionKey) {
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

// Implementación por defecto (Cloud Run)
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
// FIRESTORE / STORAGE: CARGA MEDIA
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

// ======================================================
// GUARDAR ARCHIVOS (Storage + Firestore)
// ======================================================

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
// BORRAR MEDIA
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

  const map = appState.documentacion.sectionMedia || {};
  Object.keys(map).forEach((sec) => {
    map[sec] = map[sec].filter((id) => id !== mediaId);
  });

  appState.documentacion.selectedFichasMediaIds =
    (appState.documentacion.selectedFichasMediaIds || []).filter(
      (id) => id !== mediaId
    );

  saveDocStateToLocalStorage();
  renderDocumentacionView();
}

// ======================================================
// UTILS IMÁGENES PARA PDF
// ======================================================

function getImagenRef(ref) {
  if (!ref) return null;
  const clean = String(ref).trim().toUpperCase();
  if (window.DOC_IMAGENES_POR_REF?.[clean]) {
    return window.DOC_IMAGENES_POR_REF[clean];
  }
  return "img/devices/" + clean + ".png";
}

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

// ======================================================
// MEDIDAS PDF / HEADER / FOOTER
// ======================================================

function getDocPageDimensions(pdf) {
  const size = pdf.internal.pageSize;
  return {
    width: size.getWidth ? size.getWidth() : size.width,
    height: size.getHeight ? size.getHeight() : size.height,
  };
}

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

// ======================================================
// IMÁGENES POR SECCIÓN (PDF TÉCNICO)
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
// EXPORTAR PDF (selector modo)
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

  // Portada técnica
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text(titulo, 20, panelY - 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Videoportero y control de accesos 2N", 20, panelY + 7);

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

  drawTechFooter(doc, { idioma });

  // Página de índice
  doc.addPage();
  const tocPage = doc.getNumberOfPages();
  const tocStartY = setupTechContentPage(doc, {
    idioma,
    nombreProyecto,
    logo,
  });

  const tocEntries = [];

  // Presentación de empresa (si está incluida)
  if (included["presentacion_empresa"] !== false) {
    doc.addPage();
    let current = doc.getNumberOfPages();
    y = setupTechContentPage(doc, {
      idioma,
      nombreProyecto,
      logo,
    });

    const title =
      idioma === "en"
        ? "Company introduction"
        : idioma === "pt"
        ? "Apresentação da empresa"
        : "Presentación de empresa";

    tocEntries.push({
      title,
      page: current,
    });

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
    y += lines.length * 5 + 6;
  }

  // Resto de secciones
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

  // Anexo fichas técnicas
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

  // Reescribir índice
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
// EXPORTAR PDF COMERCIAL (diseño multipágina)
// ======================================================

async function exportarPDFComercial() {
  const jsPDF = window.jspdf.jsPDF;

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const idioma = appState.documentacion.idioma || "es";
  const secciones = appState.documentacion.secciones || {};
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

  // Portada
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

  // Página presentación empresa (horizontal)
  pdf.addPage("landscape");
  const dims2 = getDocPageDimensions(pdf);
  let y = 25;

  if (
    appState.documentacion.includedSections?.presentacion_empresa !==
    false
  ) {
    const texto = secciones.presentacion_empresa || "";

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

  // Página resumen + sistema (horizontal)
  pdf.addPage("landscape");
  const dW = dims2.width;
  let boxY = 25;

  const halfW = (dW - 40) / 2;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(20, 20, 20);

  if (secciones.resumen?.trim()) {
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

  if (secciones.sistema?.trim()) {
    pdf.text("Sistema", 20 + halfW + 10, boxY);
    pdf.rect(18 + halfW + 10, boxY + 3, halfW, 80);

    pdf.setFontSize(11);
    const t2 = pdf.splitTextToSize(
      secciones.sistema || "",
      halfW - 6
    );
    pdf.text(t2, 21 + halfW + 10, boxY + 10);
  }

  // Galería visual (limitada a 10 imágenes)
  pdf.addPage("landscape");
  let posY = 25;
  const gap = 65;

  const all = appState.documentacion.mediaLibrary || [];
  const images = all.filter((m) => {
    const mime = (m.mimeType || "").toLowerCase();
    const url = (m.url || "").toLowerCase();
    return (
      mime.startsWith("image/") ||
      url.match(/\.(png|jpg|jpeg|webp|gif)$/i)
    );
  });

  const topImages = images.slice(0, 10); // ← AQUÍ estaba 4, ahora 10

  for (const m of topImages) {
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

      posY += ih + gap;
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
// RENDER PRINCIPAL
// ======================================================

function renderDocumentacionView() {
  const container = getDocAppContent();
  if (!container) return;

  const idioma = appState.documentacion.idioma || "es";

  const mediaHtml = renderDocMediaLibraryHTML();
  const fichasHtml = renderDocFichasHTML();
  const sectionsHtml = renderDocSectionsHTML();

  container.innerHTML = `
    <div class="doc-layout">
      <div class="doc-sidebar">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Documentación gráfica</div>
          </div>
          <div class="card-body doc-media-body">
            <div class="form-group mb-2">
              <input
                type="text"
                id="docMediaSearchInput"
                class="form-control"
                placeholder="Buscar imágenes..."
                value="${docEscapeHtml(
                  appState.documentacion.mediaSearchTerm || ""
                )}"
              >
            </div>
            ${mediaHtml}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Fichas técnicas</div>
          </div>
          <div class="card-body">
            ${fichasHtml}
          </div>
        </div>
      </div>

      <div class="doc-main">
        <div class="doc-toolbar card mb-3">
          <div class="card-body doc-toolbar-body">
            <div class="doc-toolbar-left">
              <button id="docModoComercialBtn"
                class="btn btn-sm ${
                  appState.documentacion.modo === "comercial"
                    ? "btn-primary"
                    : "btn-ghost"
                }">
                Modo comercial
              </button>
              <button id="docModoTecnicoBtn"
                class="btn btn-sm ${
                  appState.documentacion.modo === "tecnica"
                    ? "btn-primary"
                    : "btn-ghost"
                }">
                Modo técnico
              </button>
            </div>

            <div class="doc-toolbar-center">
              ${Object.values(DOC_LANGS)
                .map(
                  (l) => `
                <button
                  class="btn btn-xs ${
                    appState.documentacion.idioma === l.code
                      ? "btn-primary"
                      : "btn-ghost"
                  }"
                  data-doc-lang="${l.code}"
                >
                  ${l.label}
                </button>`
                )
                .join("")}
            </div>

            <div class="doc-toolbar-right">
              <button id="docRegenerarBtn" class="btn btn-sm btn-outline">
                🔁 Regenerar texto base
              </button>
              <button id="docNuevoBloqueBtn" class="btn btn-sm">
                ➕ Añadir bloque personalizado
              </button>
              <button id="docExportarBtn" class="btn btn-sm btn-primary">
                📄 Exportar PDF
              </button>
            </div>
          </div>
        </div>

        <div class="doc-sections-wrapper">
          ${sectionsHtml}
        </div>
      </div>
    </div>
  `;

  attachDocSearchHandlers(container);
  attachDocSectionHandlers(container);
  attachDocMediaGridHandlers(container);

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

  const regenBtn = container.querySelector("#docRegenerarBtn");
  if (regenBtn) {
    regenBtn.addEventListener("click", () => {
      autoGenerateDocumentacion(appState.documentacion.idioma || "es");
      renderDocumentacionView();
    });
  }

  const nuevoBloqueBtn = container.querySelector("#docNuevoBloqueBtn");
  if (nuevoBloqueBtn) {
    nuevoBloqueBtn.addEventListener("click", openDocCustomModal);
  }

  const exportBtn = container.querySelector("#docExportarBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportarDocumentacionPDF().catch((err) =>
        console.error("Error exportando PDF:", err)
      );
    });
  }
}

window.renderDocumentacionView = renderDocumentacionView;
