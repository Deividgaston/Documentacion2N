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
// PLANTILLAS BASE
// ======================================================

const DOC_BASE_TEMPLATES = {
  es: {
    presentacion_empresa:
      "2N es líder en tecnología de videoportero IP y control de accesos, combinando diseño arquitectónico, seguridad y experiencia de usuario.\n\n" +
      "Con más de 30 años de experiencia en el desarrollo de soluciones IP, 2N forma parte del grupo Axis y dispone de un porfolio completo de intercomunicadores, unidades interiores, lectores de acceso y soluciones para ascensores.\n\n" +
      "Las soluciones propuestas para {{NOMBRE_PROYECTO}} se han diseñado para ofrecer una experiencia premium a residentes, visitantes y operadores del edificio.",
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
    normativa_lpd: "Protección de datos (LPD / GDPR)...",
    normativa_ciber: "Ciberseguridad y certificaciones 2N...",
    otros:
      "En caso de requerirlo, se podrán añadir servicios adicionales o integraciones.",
  },
  en: {
    presentacion_empresa:
      "2N is a leading provider of IP video intercom and access control technology, combining architectural design, security and user experience.\n\n" +
      "With more than 30 years of experience and as part of Axis group, 2N delivers a complete portfolio of IP intercoms, indoor stations, access readers and lift solutions.\n\n" +
      "The solution proposed for {{NOMBRE_PROYECTO}} has been designed to provide a premium experience for residents, visitors and building operators.",
    resumen:
      "This document describes the proposed IP video intercom and access control solution for the project {{NOMBRE_PROYECTO}}, developed by {{PROMOTORA}}.",
    sistema: "The solution is based on a fully distributed IP video door system...",
    equipos:
      "The solution includes the following main devices:\n\n{{LISTADO_EQUIPOS}}",
    infraestructura: "All communication infrastructure is based on an IP network...",
    servicios: "Cloud services can be added to enhance...",
    normativa_red: "RED Directive compliance...",
    normativa_lpd: "GDPR compliance information...",
    normativa_ciber: "Cybersecurity and Axis Group practices...",
    otros: "Additional notes and optional integrations.",
  },
  pt: {
    presentacion_empresa:
      "A 2N é líder em tecnologia de videoporteiro IP e controlo de acessos, aliando design arquitectónico, segurança e experiência de utilizador.\n\n" +
      "Com mais de 30 anos de experiência e integrada no grupo Axis, a 2N oferece um portefólio completo de intercomunicadores, unidades interiores, leitores de acesso e soluções para elevadores.\n\n" +
      "A solução proposta para {{NOMBRE_PROYECTO}} foi desenhada para proporcionar uma experiência premium a residentes, visitantes e operadores do edifício.",
    resumen:
      "O presente documento descreve a solução proposta de videoporteiro IP e controlo de acessos para o projeto {{NOMBRE_PROYECTO}}, promovido por {{PROMOTORA}}.",
    sistema:
      "A solução baseia-se num sistema de videoporteiro IP totalmente distribuído...",
    equipos:
      "A solução inclui os seguintes equipamentos principais:\n\n{{LISTADO_EQUIPOS}}",
    infraestructura:
      "A infraestrutura de comunicações assenta numa rede IP com cablagem estruturada...",
    servicios:
      "A solução pode ser complementada com serviços cloud para gestão remota...",
    normativa_red: "Norma RED e requisitos de cibersegurança...",
    normativa_lpd: "Informações sobre RGPD...",
    normativa_ciber: "Práticas de cibersegurança e Axis...",
    otros: "Notas adicionais.",
  },
};

// ======================================================
// HELPERS TOKENS / TEXTO
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
    listado = presupuesto.lineas
      .map((l) => {
        const ref = l.ref || l.referencia || "";
        const desc = l.descripcion || "";
        const qty = l.cantidad || 1;
        return "• " + ref + " – " + desc + " (x" + qty + ")";
      })
      .join("\n");
  }

  return {
    "{{NOMBRE_PROYECTO}}": nombreProyecto,
    "{{PROMOTORA}}": promotora,
    "{{LISTADO_EQUIPOS}}": listado,
  };
}

function applyTokensToTemplate(txt, tokens) {
  if (!txt) return "";
  let out = txt;
  Object.keys(tokens).forEach(function (k) {
    out = out.replace(new RegExp(k, "g"), tokens[k]);
  });
  return out;
}

function docEscapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ======================================================
// AUTO-GENERACIÓN
// ======================================================

function autoGenerateDocumentacion(idioma) {
  const lang = DOC_BASE_TEMPLATES[idioma] ? idioma : "es";
  const base = DOC_BASE_TEMPLATES[lang];
  const tokens = buildDocTokens();
  const nuevas = {};

  DOC_SECTION_ORDER.forEach(function (key) {
    const tpl = base[key] || "";
    nuevas[key] = applyTokensToTemplate(tpl, tokens);
  });

  appState.documentacion.secciones = nuevas;
  appState.documentacion.ultimaAutoGen = new Date().toISOString();
  appState.documentacion.idioma = lang;

  saveDocStateToLocalStorage();
}

// ======================================================
// HELPERS DE SECCIONES
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

function getSectionIncluded(key) {
  const m = appState.documentacion.includedSections || {};
  if (typeof m[key] === "boolean") return m[key];
  return true;
}

// ======================================================
// HELPERS BÁSICOS DE CONTENEDOR
// ======================================================

function getDocAppContent() {
  if (typeof window.getAppContent === "function") {
    return window.getAppContent();
  }
  return document.getElementById("appContent");
}

// ======================================================
// RENDER SECCIONES HTML (cuerpo central)
// ======================================================

function renderSectionMediaHTML(sectionKey) {
  const mediaLib = appState.documentacion.mediaLibrary || [];
  const map = {};
  mediaLib.forEach(function (m) {
    map[m.id] = m;
  });

  const ids =
    appState.documentacion.sectionMedia &&
    appState.documentacion.sectionMedia[sectionKey]
      ? appState.documentacion.sectionMedia[sectionKey]
      : [];

  if (!ids.length) return "";

  return ids
    .map(function (id) {
      const m = map[id];
      if (!m) return "";

      const mime = (m.mimeType || "").toLowerCase();
      const isImg =
        mime.startsWith("image/") ||
        (m.url || "").match(/\.(png|jpg|jpeg|webp|gif)$/i);

      const caption = m.nombre || "";

      return (
        '<div class="doc-section-media-chip">' +
        '<div class="doc-section-media-thumb">' +
        (isImg
          ? '<img src="' +
            m.url +
            '" alt="' +
            docEscapeHtml(caption) +
            '">' 
          : '<div class="doc-section-media-icon">📄</div>') +
        "</div>" +
        '<div class="doc-section-media-foot">' +
        '<div class="doc-section-media-caption-wrap">' +
        '<span class="doc-section-media-caption">' +
        docEscapeHtml(caption) +
        "</span>" +
        "</div>" +
        '<button type="button" class="doc-section-media-remove" data-remove-media-id="' +
        id +
        '">✕</button>' +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

function renderDocSectionsHTML() {
  const secciones = appState.documentacion.secciones || {};
  const included = appState.documentacion.includedSections || {};

  return DOC_SECTION_ORDER.map(function (key) {
    const contenido = secciones[key] || "";
    const title = getSectionTitle(key);
    const checked = included[key] !== false ? "checked" : "";
    const isReadonly = false; // ahora todas las secciones, incluida presentación, pueden usar IA

    return (
      '<div class="card doc-section-card" data-doc-section="' +
      key +
      '">' +
      '<div class="card-header">' +
      '<div class="doc-section-title-wrap" style="flex:1;max-width:60%;">' +
      '<input type="text" class="form-control doc-section-title-input" ' +
      'data-doc-section-title="' +
      key +
      '" value="' +
      docEscapeHtml(title) +
      '" placeholder="' +
      docEscapeHtml(labelForSection(key)) +
      '">' +
      "</div>" +
      '<div class="doc-section-header-actions">' +
      '<label class="doc-section-include-toggle">' +
      '<input type="checkbox" data-doc-section-enable="' +
      key +
      '" ' +
      checked +
      "> Incluir en PDF</label>" +
      '<button class="btn btn-xs btn-outline" data-doc-ai-section="' +
      key +
      '">✨ Preguntar a IA</button>' +
      "</div>" +
      "</div>" +
      '<div class="card-body">' +
      '<textarea class="form-control doc-section-textarea" data-doc-section-text="' +
      key +
      '" rows="8"' +
      (isReadonly ? " readonly" : "") +
      ">" +
      contenido +
      "</textarea>" +
      (isReadonly
        ? ""
        : '<div class="doc-section-media-drop" data-doc-section-drop="' +
          key +
          '">' +
          '<div class="doc-section-media-items">' +
          renderSectionMediaHTML(key) +
          "</div>" +
          '<div class="doc-section-media-hint">' +
          "Arrastra aquí imágenes para adjuntar a esta sección." +
          "</div>" +
          "</div>") +
      "</div>" +
      "</div>"
    );
  }).join("");
}

// ======================================================
// FICHAS TÉCNICAS (sidebar)
// ======================================================

function renderDocFichasHTML() {
  const media = appState.documentacion.mediaLibrary || [];

  const fichas = media.filter(function (m) {
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
    ? fichas.filter(function (m) {
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
    return (
      '<p class="text-muted" style="font-size:0.85rem;">' +
      "No se han encontrado fichas técnicas. Puedes subirlas desde " +
      "<strong>Gestión de documentación</strong>." +
      "</p>" +
      '<div class="form-group mb-2">' +
      '<input type="text" id="docFichasSearchInput" class="form-control" ' +
      'placeholder="Buscar por nombre..." value="' +
      docEscapeHtml(
        appState.documentacion.fichasSearchTerm || ""
      ) +
      '">' +
      "</div>"
    );
  }

  const list = filtered
    .map(function (m) {
      const checked = selected.has(m.id) ? "checked" : "";
      const main = m.folderName
        ? "<strong>" + m.folderName + "</strong> – " + m.nombre
        : "<strong>" + m.nombre + "</strong>";
      return (
        '<label class="doc-ficha-item">' +
        '<input type="checkbox" data-doc-ficha-media-id="' +
        m.id +
        '" ' +
        checked +
        ">" +
        '<span class="doc-ficha-main">' +
        main +
        "</span>" +
        "</label>"
      );
    })
    .join("");

  return (
    '<div class="doc-fichas-section">' +
    '<div class="doc-fichas-block">' +
    '<div class="doc-fichas-title">Fichas técnicas de biblioteca</div>' +
    '<p class="doc-fichas-help">' +
    "Selecciona las fichas que quieras incluir en el PDF técnico." +
    "</p>" +
    '<div class="form-group mb-2">' +
    '<input type="text" id="docFichasSearchInput" class="form-control" ' +
    'placeholder="Buscar por nombre..." value="' +
    docEscapeHtml(
      appState.documentacion.fichasSearchTerm || ""
    ) +
    '">' +
    "</div>" +
    '<div class="doc-fichas-list doc-fichas-media-list">' +
    list +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

// ======================================================
// DOCUMENTACIÓN GRÁFICA (solo IMÁGENES)
// ======================================================

function cleanInvalidMediaItems() {
  const list = appState.documentacion.mediaLibrary || [];
  appState.documentacion.mediaLibrary = list.filter(function (m) {
    return m && m.id && typeof m.id === "string" && m.id.trim();
  });
}

function renderDocMediaLibraryHTML() {
  cleanInvalidMediaItems();

  const all = appState.documentacion.mediaLibrary || [];

  const images = all.filter(function (m) {
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
    return (
      '<p class="text-muted" style="font-size:0.85rem;">' +
      "Todavía no has subido documentación gráfica." +
      "</p>"
    );
  }

  const term = (appState.documentacion.mediaSearchTerm || "")
    .trim()
    .toLowerCase();

  const filtered = term
    ? images.filter(function (m) {
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
    return (
      '<p class="text-muted" style="font-size:0.85rem;">' +
      "No se han encontrado imágenes que coincidan con la búsqueda." +
      "</p>"
    );
  }

  return (
    '<div class="doc-media-list doc-fichas-list">' +
    filtered
      .map(function (m) {
        const caption =
          m.folderName && m.nombre
            ? m.folderName + " – " + m.nombre
            : m.nombre;
        return (
          '<div class="doc-media-item doc-media-row" draggable="true" data-media-id="' +
          m.id +
          '">' +
          '<div class="doc-media-row-main">' +
          '<span class="doc-media-row-icon">🖼️</span>' +
          '<span class="doc-media-caption">' +
          docEscapeHtml(caption) +
          "</span>" +
          "</div>" +
          '<div class="doc-media-row-actions">' +
          '<button class="btn btn-xs" data-media-view-id="' +
          m.id +
          '">👁 Ver</button>' +
          "</div>" +
          "</div>"
        );
      })
      .join("") +
    "</div>"
  );
}

function refreshDocMediaGridOnly() {
  const container = getDocAppContent();
  if (!container) return;

  const body = container.querySelector(".doc-media-body");
  if (!body) return;

  body.innerHTML = renderDocMediaLibraryHTML();
  attachDocMediaGridHandlers(container);
}
  const images = (appState.documentacion.mediaLibrary || []).filter(function (
    m
  ) {
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
    return;
  }

  for (var i = 0; i < images.length; i++) {
    var m = images[i];
    try {
      URL.revokeObjectURL(m.url);
    } catch (e) {}
  }
}

// ======================================================
// PREVISUALIZADOR FLOTANTE
// ======================================================

function openDocImageFloatingPreview(item) {
  if (!item || !item.url) return;

  var prev = document.getElementById("docMediaFloatingPreview");
  if (prev) prev.remove();

  var title =
    item.folderName && item.nombre
      ? item.folderName + " – " + item.nombre
      : item.nombre || "Imagen";

  var overlay = document.createElement("div");
  overlay.id = "docMediaFloatingPreview";
  overlay.style =
    "position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;" +
    "align-items:center;justify-content:center;z-index:999999;";

  overlay.innerHTML =
    '<div style="position:relative;max-width:90vw;max-height:90vh;' +
    "background:#111827;padding:12px;border-radius:12px;" +
    'box-shadow:0 15px 40px rgba(0,0,0,0.6);display:flex;flex-direction:column;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
    '<div style="color:#e5e7eb;font-size:0.9rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70vw;">' +
    docEscapeHtml(title) +
    "</div>" +
    '<button id="docMediaFloatingCloseBtn" style="border:none;background:#374151;color:#f9fafb;border-radius:999px;padding:4px 10px;font-size:0.8rem;cursor:pointer;">✕ Cerrar</button>' +
    "</div>" +
    '<div style="flex:1;display:flex;align-items:center;justify-content:center;">' +
    '<img src="' +
    item.url +
    '" style="max-width:86vw;max-height:80vh;object-fit:contain;border-radius:6px;background:#000;">' +
    "</div>" +
    "</div>";

  document.body.appendChild(overlay);

  overlay.addEventListener("click", function (ev) {
    if (ev.target === overlay) overlay.remove();
  });

  var closeBtn = document.getElementById("docMediaFloatingCloseBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      overlay.remove();
    });
  }
}

// ======================================================
// MEDIA: ESTADO Y FIREBASE
// ======================================================

async function ensureDocMediaLoaded() {
  if (appState.documentacion.mediaLoaded) return;

  var db =
    window.db ||
    (window.firebase && window.firebase.firestore
      ? window.firebase.firestore()
      : null);

  if (!db) return;

  try {
    var auth =
      window.auth ||
      (window.firebase && window.firebase.auth
        ? window.firebase.auth()
        : null);

    var user = auth && auth.currentUser ? auth.currentUser : null;
    var uid = user ? user.uid : null;

    var query = db.collection("documentacion_media");
    if (uid) query = query.where("uid", "==", uid);

    var snap = await query.limit(200).get();
    var media = [];

    snap.forEach(function (d) {
      media.push(
        Object.assign(
          {
            id: d.id,
          },
          d.data()
        )
      );
    });

    appState.documentacion.mediaLibrary = media;
    appState.documentacion.mediaLoaded = true;
    console.log("[DOC] Media cargada:", media.length);
  } catch (e) {
    console.error("Error cargando documentación media:", e);
    appState.documentacion.mediaLoaded = false;
  }
}

async function saveMediaFileToStorageAndFirestore(file, options) {
  options = options || {};
  var name = file.name || "archivo";
  var now = new Date().toISOString();
  var isImg = file.type && file.type.startsWith("image/");
  var type = isImg ? "image" : "file";

  var folderName = options.folderName || "";
  var docCategory = options.docCategory || "imagen";

  var folderSlug = slugifyFolderName(folderName);

  var storage =
    window.storage ||
    (window.firebase && window.firebase.storage
      ? window.firebase.storage()
      : null);
  var db =
    window.db ||
    (window.firebase && window.firebase.firestore
      ? window.firebase.firestore()
      : null);
  var auth =
    window.auth ||
    (window.firebase && window.firebase.auth
      ? window.firebase.auth()
      : null);

  var url = null;
  var storagePath = null;
  var uid = auth && auth.currentUser ? auth.currentUser.uid : null;

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

    var ref = storage.ref().child(storagePath);
    await ref.put(file);
    url = await ref.getDownloadURL();
  } else {
    url = URL.createObjectURL(file);
  }

  var mediaData = {
    nombre: name,
    type: type,
    mimeType: file.type,
    url: url,
    storagePath: storagePath,
    uploadedAt: now,
    folderName: folderName || null,
    docCategory: docCategory,
  };

  if (db) {
    var refDoc = await db.collection("documentacion_media").add(
      Object.assign({}, mediaData, {
        uid: uid,
      })
    );
    mediaData.id = refDoc.id;
  } else {
    mediaData.id =
      "local_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2, 8);
  }

  return mediaData;
}

async function deleteMediaById(mediaId) {
  var media = appState.documentacion.mediaLibrary || [];
  var item = media.find(function (m) {
    return m.id === mediaId;
  });
  if (!item) return;

  var storage =
    window.storage ||
    (window.firebase && window.firebase.storage
      ? window.firebase.storage()
      : null);
  var db =
    window.db ||
    (window.firebase && window.firebase.firestore
      ? window.firebase.firestore()
      : null);

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

  appState.documentacion.mediaLibrary = media.filter(function (m) {
    return m.id !== mediaId;
  });

  var map = appState.documentacion.sectionMedia || {};
  Object.keys(map).forEach(function (sec) {
    map[sec] = map[sec].filter(function (id) {
      return id !== mediaId;
    });
  });

  appState.documentacion.selectedFichasMediaIds =
    (appState.documentacion.selectedFichasMediaIds || []).filter(function (
      id
    ) {
      return id !== mediaId;
    });

  saveDocStateToLocalStorage();
  renderDocumentacionView();
}

// ======================================================
// SLUGIFY
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

// ======================================================
// IA POR SECCIÓN
// ======================================================

async function askAIForSection(sectionKey) {
  var idioma = appState.documentacion.idioma || "es";
  var secciones = appState.documentacion.secciones || {};
  var textoActual = secciones[sectionKey] || "";
  var titulo = getSectionTitle(sectionKey);
  var proyecto = appState.proyecto || {};
  var presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

  var modo = appState.documentacion.modo || "comercial";

  if (typeof window.handleDocSectionAI === "function") {
    try {
      var nuevo = await window.handleDocSectionAI({
        sectionKey: sectionKey,
        idioma: idioma,
        titulo: titulo,
        texto: textoActual,
        proyecto: proyecto,
        presupuesto: presupuesto,
        modo: modo,
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

// Implementación por defecto usando tu endpoint Cloud Run
if (typeof window.handleDocSectionAI !== "function") {
  window.handleDocSectionAI = async function (payload) {
    var url = "https://docsectionai-is2pkrfj5a-uc.a.run.app";
    var resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      var extra = "";
      try {
        extra = await resp.text();
      } catch (e) {}
      throw new Error("IA error " + resp.status + ": " + extra);
    }

    var data = null;
    try {
      data = await resp.json();
    } catch (e) {}
    if (!data || typeof data.text !== "string") {
      throw new Error("Respuesta IA inválida: falta 'text'");
    }
    return data.text;
  };
}

// ======================================================
// UTILIDADES PDF (IMÁGENES)
// ======================================================

function loadImageAsDataUrl(url) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = function () {
      try {
        var maxDim = 1200;
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var max = Math.max(w, h);
        var scale = max > maxDim ? maxDim / max : 1;

        var canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        var ctx = canvas.getContext("2d");
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

  var url =
    window.DOC_LOGO_URL || DOC_LOGO_DEFAULT_URL || "img/logo_2n.svg";

  try {
    var obj = await loadImageAsDataUrl(url);
    appState.documentacion.logoData = obj;
    return obj;
  } catch (e) {
    console.warn("No se pudo cargar el logo:", e);
    return null;
  }
}

function getDocPageDimensions(pdf) {
  var size = pdf.internal.pageSize;
  return {
    width: size.getWidth ? size.getWidth() : size.width,
    height: size.getHeight ? size.getHeight() : size.height,
  };
}

// ======================================================
// CABECERA / PIE PDF TÉCNICO
// ======================================================

function drawTechHeader(pdf, opts) {
  opts = opts || {};
  var dims = getDocPageDimensions(pdf);
  var w = dims.width;

  var nombreProyecto = opts.nombreProyecto || "Proyecto";
  var logo = opts.logo || null;

  var marginX = 20;
  var textY = 18;
  var logoBottomY = textY;

  if (logo && logo.dataUrl) {
    var ratio = logo.width / logo.height || 2.5;
    var logoW = 25;
    var logoH = logoW / ratio;
    var logoX = w - marginX - logoW;
    var logoY = textY - 6;

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

  var lineY = Math.max(textY + 2, logoBottomY + 2);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(marginX, lineY, w - marginX, lineY);

  return lineY + 8;
}

function drawTechFooter(pdf, opts) {
  opts = opts || {};
  var dims = getDocPageDimensions(pdf);
  var h = dims.height;

  var idioma = opts.idioma || "es";
  var txt =
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

function setupTechContentPage(pdf, opts) {
  var startY = drawTechHeader(pdf, opts);
  drawTechFooter(pdf, opts);
  return startY;
}

// ======================================================
// IMÁGENES EN PDF TÉCNICO
// ======================================================

function getSectionImages(sectionKey) {
  var map = appState.documentacion.sectionMedia || {};
  var ids = map[sectionKey] || [];

  return ids
    .map(function (id) {
      return (appState.documentacion.mediaLibrary || []).find(function (m) {
        return m.id === id;
      });
    })
    .filter(function (m) {
      if (!m || !m.url) return false;
      var mime = (m.mimeType || "").toLowerCase();
      var url = (m.url || "").toLowerCase();
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
  var images = getSectionImages(sectionKey);
  if (!images.length) return y;

  var dims = getDocPageDimensions(doc);
  var maxY = dims.height - 25;
  var pageWidth = dims.width;

  for (var i = 0; i < images.length; i++) {
    var m = images[i];
    try {
      var obj = await loadImageAsDataUrl(m.url);
      var ratio = obj.width / obj.height;

      var imgW = 60;
      var imgH = imgW / ratio;

      if (imgH > 38) {
        imgH = 38;
        imgW = imgH * ratio;
      }

      var needed = imgH + 10;
      if (y + needed > maxY) {
        y = onNewPage();
      }

      var x = (pageWidth - imgW) / 2;
      doc.addImage(obj.dataUrl, "PNG", x, y, imgW, imgH);
      y += imgH + 4;

      var caption = removeExtension(m.nombre || "");
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
// EXPORTACIÓN PDF (selector modo)
// ======================================================

async function exportarDocumentacionPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("jsPDF no está cargado.");
    return;
  }
  var modo = appState.documentacion.modo || "comercial";
  if (modo === "tecnica") {
    await exportarPDFTecnico();
  } else {
    await exportarPDFComercial();
  }
}
async function exportarPDFTecnico() {
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  var idioma = appState.documentacion.idioma || "es";
  var secciones = appState.documentacion.secciones || {};
  var included = appState.documentacion.includedSections || {};

  var proyecto = appState.proyecto || {};
  var presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

  var nombreProyecto =
    proyecto.nombre ||
    proyecto.nombreProyecto ||
    (presupuesto && presupuesto.nombreProyecto) ||
    "Proyecto";

  var promotora =
    proyecto.promotora ||
    proyecto.cliente ||
    (presupuesto && presupuesto.cliente) ||
    "";

  var logo = await getDocLogoImage();
  var dims = getDocPageDimensions(doc);
  var pageW = dims.width;
  var pageH = dims.height;

  var titulo = "Memoria de calidades";
  if (idioma === "en") titulo = "Technical specification";
  if (idioma === "pt") titulo = "Memória descritiva";

  try {
    var cover = await loadImageAsDataUrl(DOC_TECH_COVER_URL);
    if (cover && cover.dataUrl) {
      var ratio = cover.width / cover.height;
      var pageRatio = pageW / pageH;
      var w, h, x, y;

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

  var gradHeight = 70;
  var gradStart = pageH - gradHeight;
  for (var i = 0; i < 6; i++) {
    var gy = gradStart + (i * gradHeight) / 6;
    var gh = gradHeight / 6 + 0.5;
    var shade = 255 - i * 8;
    doc.setFillColor(shade, shade, shade);
    doc.rect(0, gy, pageW, gh, "F");
  }

  var panelH = 55;
  var panelY = pageH - panelH;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, panelY, pageW, panelH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text(titulo, 20, panelY - 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Videoportero y control de accesos 2N", 20, panelY + 7);

  var y = panelY + 18;
  doc.setFont("helvetica", "bold");
  doc.text("Proyecto:", 20, y);
  doc.setFont("helvetica", "normal");

  var linesProyecto = doc.splitTextToSize(nombreProyecto, pageW - 60);
  doc.text(linesProyecto, 45, y);
  y += linesProyecto.length * 6 + 4;

  if (promotora) {
    doc.setFont("helvetica", "bold");
    doc.text("Promotor:", 20, y);
    doc.setFont("helvetica", "normal");
    var linesProm = doc.splitTextToSize(promotora, pageW - 60);
    doc.text(linesProm, 45, y);
    y += linesProm.length * 6 + 4;
  }

  drawTechFooter(doc, { idioma: idioma });

  doc.addPage();
  var tocPage = doc.getNumberOfPages();
  var tocStartY = setupTechContentPage(doc, {
    idioma: idioma,
    nombreProyecto: nombreProyecto,
    logo: logo,
  });

  var tocEntries = [];

  var includePresentacion = included["presentacion_empresa"] !== false;
  if (includePresentacion) {
    doc.addPage();
    var current = doc.getNumberOfPages();
    y = setupTechContentPage(doc, {
      idioma: idioma,
      nombreProyecto: nombreProyecto,
      logo: logo,
    });

    var titPres =
      idioma === "en"
        ? "Company introduction"
        : idioma === "pt"
        ? "Apresentação da empresa"
        : "Presentación de empresa";

    tocEntries.push({
      title: titPres,
      page: current,
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(titPres, 20, y);
    y += 4;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(20, y, pageW - 20, y);
    y += 6;

    var textoPres = secciones["presentacion_empresa"] || "";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);

    var linesPres = doc.splitTextToSize(textoPres, pageW - 40);
    doc.text(linesPres, 20, y);
    y += linesPres.length * 5 + 6;
  }

  doc.addPage();
  var currentPage = doc.getNumberOfPages();
  y = setupTechContentPage(doc, {
    idioma: idioma,
    nombreProyecto: nombreProyecto,
    logo: logo,
  });

  function newPage() {
    doc.addPage();
    currentPage = doc.getNumberOfPages();
    y = setupTechContentPage(doc, {
      idioma: idioma,
      nombreProyecto: nombreProyecto,
      logo: logo,
    });
    return y;
  }

  function ensureSpace(lines) {
    var need = lines * 5 + 12;
    if (y + need > pageH - 25) {
      newPage();
    }
  }

  var sectionKeys = [
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

  for (var s = 0; s < sectionKeys.length; s++) {
    var key = sectionKeys[s];
    if (included[key] === false) continue;

    var contenido = (secciones[key] || "").trim();
    var imgs = getSectionImages(key);
    if (!contenido && imgs.length === 0) continue;

    tocEntries.push({
      title: getSectionTitle(key),
      page: currentPage,
    });

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

      var lines = doc.splitTextToSize(contenido, pageW - 40);
      var block = [];
      var maxBlock = 35;

      for (var li = 0; li < lines.length; li++) {
        block.push(lines[li]);
        if (block.length === maxBlock || li === lines.length - 1) {
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

  var allMedia = appState.documentacion.mediaLibrary || [];
  var selected = appState.documentacion.selectedFichasMediaIds || [];
  var fichas = allMedia.filter(function (m) {
    return selected.indexOf(m.id) !== -1;
  });

  if (fichas.length > 0) {
    doc.addPage();
    currentPage = doc.getNumberOfPages();
    y = setupTechContentPage(doc, {
      idioma: idioma,
      nombreProyecto: nombreProyecto,
      logo: logo,
    });

    var titAnexo =
      idioma === "en"
        ? "Appendix – Technical documentation"
        : idioma === "pt"
        ? "Anexo – Documentação técnica"
        : "Anexo – Fichas técnicas adjuntas";

    tocEntries.push({
      title: titAnexo,
      page: currentPage,
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(titAnexo, 20, y);
    y += 6;

    doc.setDrawColor(226, 232, 240);
    doc.line(20, y, pageW - 20, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    for (var f = 0; f < fichas.length; f++) {
      var m = fichas[f];
      var extra = m.folderName ? " – " + m.folderName : "";
      var text =
        "• " + m.nombre + extra + (m.url ? " (" + m.url + ")" : "");
      var linesFicha = doc.splitTextToSize(text, pageW - 40);
      ensureSpace(linesFicha.length);
      doc.text(linesFicha, 20, y);
      y += linesFicha.length * 4.8 + 2;
    }
  }

  doc.setPage(tocPage);
  var yToc = tocStartY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Contenido", 20, yToc);
  yToc += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);

  for (var t = 0; t < tocEntries.length; t++) {
    var entry = tocEntries[t];
    if (yToc > pageH - 25) {
      doc.addPage();
      yToc = setupTechContentPage(doc, {
        idioma: idioma,
        nombreProyecto: nombreProyecto,
        logo: logo,
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Contenido (cont.)", 20, yToc);
      yToc += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(55, 65, 81);
    }

    var label = entry.title;
    var pageStr = String(entry.page);
    var textWidth = doc.getTextWidth(pageStr);

    doc.text(label, 25, yToc);
    doc.text(pageStr, pageW - 25 - textWidth, yToc);

    doc.setDrawColor(230, 230, 230);
    doc.line(25, yToc + 1.5, pageW - 25, yToc + 1.5);

    yToc += 7;
  }

  var base =
    idioma === "en"
      ? "technical_specification"
      : idioma === "pt"
      ? "memoria_descritiva"
      : "memoria_calidades";

  var safe = nombreProyecto
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  doc.save(base + "_" + safe + ".pdf");
}

// ======================================================
// PDF COMERCIAL (diseño multipágina)
// ======================================================

async function exportarPDFComercial() {
  var jsPDF = window.jspdf.jsPDF;

  var doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  var idioma = appState.documentacion.idioma || "es";
  var secciones = appState.documentacion.secciones || {};

  var proyecto = appState.proyecto || {};
  var presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

  var nombreProyecto =
    proyecto.nombre ||
    proyecto.nombreProyecto ||
    (presupuesto && presupuesto.nombreProyecto) ||
    "Proyecto";

  var promotora =
    proyecto.promotora ||
    proyecto.cliente ||
    (presupuesto && presupuesto.cliente) ||
    "";

  var logo = await getDocLogoImage();
  var dims = getDocPageDimensions(doc);
  var pageW = dims.width;
  var pageH = dims.height;

  var marginX = 20;
  var marginTop = 20;
  var marginBottom = 20;

  function drawSalesforceCard(cfg) {
    var x = cfg.x;
    var y = cfg.y;
    var width = cfg.width;
    var title = cfg.title;
    var body = cfg.body;
    var pdf = cfg.doc;
    var maxBodyWidth = cfg.maxBodyWidth || width - 16;
    var minHeight = cfg.minHeight || 45;

    var paddingX = 8;
    var paddingTop = 8;
    var paddingBottom = 8;
    var headerHeight = 8;

    var bodyW = maxBodyWidth;
    var lines = body ? pdf.splitTextToSize(body, bodyW) : [];
    var bodyH = lines.length * 4.4;

    var cardH =
      paddingTop + headerHeight + 4 + bodyH + paddingBottom;
    if (cardH < minHeight) cardH = minHeight;

    pdf.setFillColor(229, 231, 235);
    pdf.roundedRect(x + 1.2, y + 1.8, width, cardH, 3, 3, "F");

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(209, 213, 219);
    pdf.roundedRect(x, y, width, cardH, 3, 3, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(31, 41, 55);

    var titleLines = pdf.splitTextToSize(title, width - paddingX * 2);
    var titleY = y + paddingTop + 5;
    pdf.text(titleLines, x + paddingX, titleY);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(75, 85, 99);
    var yBody =
      titleY + titleLines.length * 4.2 + 3;

    if (lines.length) {
      pdf.text(lines, x + paddingX, yBody);
    }

    return {
      bottomY: y + cardH,
      height: cardH,
    };
  }

  function cleanCaption(name) {
    return name ? name.replace(/\.[^/.]+$/, "") : "";
  }

  function collectSectionImagesWithCaptions() {
    var map = appState.documentacion.sectionMedia || {};
    var media = appState.documentacion.mediaLibrary || [];
    var byId = {};
    media.forEach(function (m) {
      byId[m.id] = m;
    });

    var used = {};
    var out = [];

    Object.keys(map).forEach(function (key) {
      var ids = map[key] || [];
      ids.forEach(function (id) {
        if (used[id]) return;
        var m = byId[id];
        if (!m || !m.url) return;

        var mime = (m.mimeType || "").toLowerCase();
        var type = (m.type || "").toLowerCase();
        var url = (m.url || "").toLowerCase();

        var isImg =
          mime.startsWith("image/") ||
          type === "image" ||
          url.endsWith(".png") ||
          url.endsWith(".jpg") ||
          url.endsWith(".jpeg") ||
          url.endsWith(".webp") ||
          url.endsWith(".gif");

        if (!isImg) return;
        used[id] = true;
        out.push({
          media: m,
          caption: cleanCaption(m.nombre || ""),
        });
      });
    });

    return out.slice(0, 8);
  }

  try {
    var cover = await loadImageAsDataUrl(DOC_TECH_COVER_URL);
    if (cover && cover.dataUrl) {
      var ratio = cover.width / cover.height;
      var pageRatio = pageW / pageH;
      var w, h, x, y;

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

  var gradH = 70;
  var gradStart = pageH - gradH;
  for (var gi = 0; gi < 6; gi++) {
    var yG = gradStart + (gi * gradH) / 6;
    var hG = gradH / 6 + 0.5;
    var shadeG = 255 - gi * 8;
    doc.setFillColor(shadeG, shadeG, shadeG);
    doc.rect(0, yG, pageW, hG, "F");
  }

  var panelH = 55;
  var panelY = pageH - panelH;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, panelY, pageW, panelH, "F");

  var tituloCom =
    idioma === "en"
      ? "Highlights – IP access & video intercom solution"
      : idioma === "pt"
      ? "Highlights – solução IP de acessos e videoporteiro"
      : "Highlights – solución de accesos y videoportero IP";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);

  var linesTitulo = doc.splitTextToSize(
    tituloCom,
    pageW - marginX * 2 - 40
  );
  var yCom = panelY + 11;
  doc.text(linesTitulo, marginX, yCom);
  yCom += linesTitulo.length * 5 + 1;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  var subtitulo = nombreProyecto;
  if (promotora) subtitulo += " · " + promotora;
  var stLines = doc.splitTextToSize(
    subtitulo,
    pageW - marginX * 2 - 40
  );
  doc.text(stLines, marginX, yCom);
  yCom += stLines.length * 4.8 + 2;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);

  var claim =
    idioma === "en"
      ? "Architecture, design and IP technology for a truly premium access experience."
      : idioma === "pt"
      ? "Arquitetura, design e tecnologia IP para uma experiência de acesso verdadeiramente premium."
      : "Arquitectura, diseño y tecnología IP para una experiencia de acceso verdaderamente premium.";

  var claimLines = doc.splitTextToSize(
    claim,
    pageW - marginX * 2 - 40
  );
  doc.text(claimLines, marginX, yCom);

  if (logo && logo.dataUrl) {
    var ratioL = logo.width / logo.height || 2.5;
    var lw = 32;
    var lh = lw / ratioL;
    var lx = pageW - marginX - lw;
    var ly = panelY + panelH - lh - 6;
    try {
      doc.addImage(logo.dataUrl, "PNG", lx, ly, lw, lh);
    } catch (e) {
      console.warn("Logo portada comercial:", e);
    }
  }

  var includePresentacion =
    (appState.documentacion.includedSections || {})
      .presentacion_empresa !== false;

  if (includePresentacion) {
    doc.addPage();
    var dims2 = getDocPageDimensions(doc);
    var pw2 = dims2.width;

    var y2 = marginTop;

    var tit =
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
    doc.line(marginX, y2 + 2.5, pw2 - marginX, y2 + 2.5);
    y2 += 12;

    var texto = secciones["presentacion_empresa"] || "";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);

    var lines = doc.splitTextToSize(texto, pw2 - marginX * 2);
    doc.text(lines, marginX, y2);
  }

  doc.addPage();
  var dims3 = getDocPageDimensions(doc);
  var pw3 = dims3.width;
  var yCards = marginTop;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(31, 41, 55);

  var tit2 =
    idioma === "en"
      ? "Project overview"
      : idioma === "pt"
      ? "Visão geral do projeto"
      : "Visión general del proyecto";

  doc.text(tit2, marginX, yCards);
  doc.setDrawColor(209, 213, 219);
  doc.line(marginX, yCards + 2.5, pw3 - marginX, yCards + 2.5);
  yCards += 10;

  var cardWidth = pw3 - marginX * 2;

  var bloques2 = [];

  if (secciones.resumen && secciones.resumen.trim()) {
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

  if (secciones.sistema && secciones.sistema.trim()) {
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

  for (var b = 0; b < bloques2.length; b++) {
    var r = drawSalesforceCard({
      x: marginX,
      y: yCards,
      width: cardWidth,
      title: bloques2[b].title,
      body: bloques2[b].body,
      doc: doc,
      maxBodyWidth: cardWidth - 16,
      minHeight: 45,
    });
    yCards = r.bottomY + 8;
  }

  var tieneServicios =
    secciones.servicios && secciones.servicios.trim().length > 0;
  var tieneInfra =
    secciones.infraestructura &&
    secciones.infraestructura.trim().length > 0;
  var tieneOtros =
    secciones.otros && secciones.otros.trim().length > 0;

  if (tieneServicios || tieneInfra || tieneOtros) {
    doc.addPage();
    var dims4 = getDocPageDimensions(doc);
    var pw4 = dims4.width;

    var y4 = marginTop;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);

    var tit3 =
      idioma === "en"
        ? "Services, operation & infrastructure"
        : idioma === "pt"
        ? "Serviços, operação e infraestrutura"
        : "Servicios, operación e infraestructura";

    doc.text(tit3, marginX, y4);
    doc.setDrawColor(209, 213, 219);
    doc.line(marginX, y4 + 2.5, pw4 - marginX, y4 + 2.5);
    y4 += 10;

    var bloques3 = [];

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

    for (var j = 0; j < bloques3.length; j++) {
      var r2 = drawSalesforceCard({
        x: marginX,
        y: y4,
        width: pw4 - marginX * 2,
        title: bloques3[j].title,
        body: bloques3[j].body,
        doc: doc,
        maxBodyWidth: pw4 - marginX * 2 - 16,
        minHeight: 45,
      });
      y4 = r2.bottomY + 8;
    }
  }

  var galeria = collectSectionImagesWithCaptions();

  if (galeria.length) {
    doc.addPage();

    var dimsG = getDocPageDimensions(doc);
    var pwG = dimsG.width;
    var phG = dimsG.height;

    var yGal = marginTop;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);

    var tituloGaleria =
      idioma === "en"
        ? "Visual gallery of the solution"
        : idioma === "pt"
        ? "Galeria visual da solução"
        : "Galería visual de la solución";

    doc.text(tituloGaleria, marginX, yGal);
    doc.setDrawColor(209, 213, 219);
    doc.line(marginX, yGal + 2.5, pwG - marginX, yGal + 2.5);
    yGal += 12;

    var maxW = (pwG - marginX * 2 - 10) / 2;
    var maxH = 38;
    var rowH = maxH + 20;

    for (var k = 0; k < galeria.length; k++) {
      var item = galeria[k];
      var m = item.media;
      var caption = item.caption || "";
      var col = k % 2;

      if (k % 2 === 0 && k !== 0) yGal += rowH;

      if (yGal + rowH > phG - marginBottom) {
        doc.addPage();
        yGal = marginTop;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(31, 41, 55);
        doc.text(tituloGaleria, marginX, yGal);
        doc.setDrawColor(209, 213, 219);
        doc.line(marginX, yGal + 2.5, pwG - marginX, yGal + 2.5);
        yGal += 12;
      }

      try {
        var imgObj = await loadImageAsDataUrl(m.url);

        var ratio = imgObj.width / imgObj.height || 1.5;
        var wImg = maxW;
        var hImg = wImg / ratio;

        if (hImg > maxH) {
          hImg = maxH;
          wImg = hImg * ratio;
        }

        var xImg =
          marginX + col * (maxW + 10) + (maxW - wImg) / 2;

        doc.addImage(imgObj.dataUrl, "PNG", xImg, yGal, wImg, hImg);

        var captionLines = doc.splitTextToSize(caption, maxW);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(75, 85, 99);

        doc.text(
          captionLines,
          xImg + wImg / 2,
          yGal + hImg + 5,
          { align: "center" }
        );
      } catch (e) {
        console.warn("Error imagen galería:", e);
      }
    }

    if (logo && logo.dataUrl) {
      var rLogo = logo.width / logo.height || 2.5;
      var lw2 = 24;
      var lh2 = lw2 / rLogo;

      var lx2 = pwG - marginX - lw2;
      var ly2 = phG - marginBottom - lh2 + 4;

      try {
        doc.addImage(logo.dataUrl, "PNG", lx2, ly2, lw2, lh2);
      } catch (e) {
        console.warn("Logo galería:", e);
      }
    }
  }

  var baseCom =
    idioma === "en"
      ? "highlights_access_solution"
      : idioma === "pt"
      ? "highlights_acessos"
      : "highlights_accesos";

  var safeCom = nombreProyecto
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  doc.save(baseCom + "_" + safeCom + ".pdf");
}
// ======================================================
// HANDLERS: SECCIONES, GRID MEDIA, MODAL, ETC.
// ======================================================

function attachDocMediaGridHandlers(container) {
  container.querySelectorAll(".doc-media-item").forEach(function (item) {
    item.addEventListener("dragstart", function (ev) {
      var id = item.getAttribute("data-media-id");
      if (id && ev.dataTransfer) {
        ev.dataTransfer.setData("text/plain", id);
        ev.dataTransfer.effectAllowed = "copy";
      }
    });
  });

  container.querySelectorAll("[data-media-view-id]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-media-view-id");
      if (!id) return;

      var item = (appState.documentacion.mediaLibrary || []).find(
        function (m) {
          return m.id === id;
        }
      );

      if (!item || !item.url) {
        alert("Imagen no encontrada.");
        return;
      }

      var mime = (item.mimeType || "").toLowerCase();
      var url = (item.url || "").toLowerCase();

      var isImg =
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
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-remove-media-id");
        var zone = btn.closest("[data-doc-section-drop]");
        var sec = zone ? zone.getAttribute("data-doc-section-drop") : null;
        if (!id || !sec) return;
        detachMediaFromSection(sec, id);
      });
    });
}

function attachDocSearchHandlers(container) {
  var inputImg = container.querySelector("#docMediaSearchInput");
  if (inputImg) {
    inputImg.addEventListener("input", function () {
      appState.documentacion.mediaSearchTerm = inputImg.value || "";
      saveDocStateToLocalStorage();
      refreshDocMediaGridOnly();
    });
  }

  var inputFich = container.querySelector("#docFichasSearchInput");
  if (inputFich) {
    inputFich.addEventListener("input", function () {
      appState.documentacion.fichasSearchTerm =
        inputFich.value || "";
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  }
}

function attachDocSectionHandlers(container) {
  container
    .querySelectorAll(".doc-section-title-input")
    .forEach(function (inp) {
      inp.addEventListener("input", function () {
        var key = inp.getAttribute("data-doc-section-title");
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
    .forEach(function (txt) {
      txt.addEventListener("input", function () {
        var key = txt.getAttribute("data-doc-section-text");
        if (!key) return;

        appState.documentacion.secciones =
          appState.documentacion.secciones || {};
        appState.documentacion.secciones[key] = txt.value;

        saveDocStateToLocalStorage();
      });
    });

  container
    .querySelectorAll("[data-doc-section-enable]")
    .forEach(function (chk) {
      chk.addEventListener("change", function () {
        var key = chk.getAttribute("data-doc-section-enable");
        if (!key) return;

        appState.documentacion.includedSections =
          appState.documentacion.includedSections || {};
        appState.documentacion.includedSections[key] =
          chk.checked;

        saveDocStateToLocalStorage();
      });
    });

  container
    .querySelectorAll("[data-doc-ai-section]")
    .forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var key = btn.getAttribute("data-doc-ai-section");
        if (!key) return;

        var nuevo = await askAIForSection(key);
        appState.documentacion.secciones[key] = nuevo;
        saveDocStateToLocalStorage();
        renderDocumentacionView();
      });
    });

  container
    .querySelectorAll("[data-doc-section-drop]")
    .forEach(function (zone) {
      zone.addEventListener("dragover", function (ev) {
        ev.preventDefault();
        zone.classList.add("is-drag-over");
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
      });

      zone.addEventListener("dragleave", function () {
        zone.classList.remove("is-drag-over");
      });

      zone.addEventListener("drop", function (ev) {
        ev.preventDefault();
        zone.classList.remove("is-drag-over");

        var mediaId = ev.dataTransfer
          ? ev.dataTransfer.getData("text/plain")
          : null;
        var sectionKey = zone.getAttribute("data-doc-section-drop");

        if (!mediaId || !sectionKey) return;

        attachMediaToSection(sectionKey, mediaId);
      });
    });
}

// ======================================================
// MODAL BLOQUES CUSTOM
// ======================================================

function openDocCustomModal() {
  var modal = document.getElementById("docCustomModal");
  var back = document.getElementById("docModalBackdrop");

  if (modal) modal.classList.remove("hidden");
  if (back) back.classList.remove("hidden");

  var txt = document.getElementById("docCustomText");
  if (txt) txt.value = "";
}

function closeDocCustomModal() {
  var modal = document.getElementById("docCustomModal");
  var back = document.getElementById("docModalBackdrop");

  if (modal) modal.classList.add("hidden");
  if (back) back.classList.add("hidden");
}

function saveDocCustomBlock() {
  var select = document.getElementById("docCustomSectionSelect");
  var textarea = document.getElementById("docCustomText");

  if (!select || !textarea) return;

  var sec = select.value;
  var text = textarea.value.trim();

  if (!text) {
    closeDocCustomModal();
    return;
  }

  var secs = (appState.documentacion.secciones ||= {});
  var actual = secs[sec] || "";
  var nuevo =
    actual.trim().length > 0
      ? actual.trim() + "\n\n" + text
      : text;

  secs[sec] = nuevo;

  (appState.documentacion.customBlocks ||= []).push({
    section: sec,
    text: text,
    ts: new Date().toISOString(),
  });

  saveDocStateToLocalStorage();
  closeDocCustomModal();
  renderDocumentacionView();
}

// ======================================================
// AÑADIR / QUITAR MEDIA A SECCIÓN (LÍMITE 10 IMÁGENES)
// ======================================================

function attachMediaToSection(sectionKey, mediaId) {
  appState.documentacion.sectionMedia =
    appState.documentacion.sectionMedia || {};
  const arr = appState.documentacion.sectionMedia[sectionKey] || [];

  // Límite máximo de 10 imágenes por sección
  if (arr.indexOf(mediaId) === -1) {
    if (arr.length >= 10) {
      alert("Solo puedes adjuntar hasta 10 imágenes en esta sección.");
      return;
    }
    arr.push(mediaId);
    appState.documentacion.sectionMedia[sectionKey] = arr;
  }

  saveDocStateToLocalStorage();
  renderDocumentacionView();
}

function detachMediaFromSection(sectionKey, mediaId) {
  var map = appState.documentacion.sectionMedia || {};
  var arr = map[sectionKey] || [];
  map[sectionKey] = arr.filter(function (id) {
    return id !== mediaId;
  });
  appState.documentacion.sectionMedia = map;
  saveDocStateToLocalStorage();
  renderDocumentacionView();
}

// ======================================================
// RENDER PRINCIPAL
// ======================================================

async function renderDocumentacionView() {
  var container = getDocAppContent();
  if (!container) return;

  await ensureDocMediaLoaded();

  var idioma = appState.documentacion.idioma || "es";
  var modo = appState.documentacion.modo || "comercial";

  var langButtons = Object.keys(DOC_LANGS)
    .map(function (code) {
      var cfg = DOC_LANGS[code];
      var active = code === idioma ? "btn-primary" : "btn-soft";
      return (
        '<button type="button" class="btn btn-xs ' +
        active +
        '" data-doc-lang="' +
        cfg.code +
        '">' +
        cfg.label +
        "</button>"
      );
    })
    .join("");

  var modoComActive = modo === "comercial" ? "btn-primary" : "btn-soft";
  var modoTecActive = modo === "tecnica" ? "btn-primary" : "btn-soft";

  container.innerHTML =
    '<div class="doc-layout">' +
    '<div class="doc-main-column">' +
    '<div class="card mb-3">' +
    '<div class="card-header doc-header-flex">' +
    '<div>' +
    '<div class="card-title">Documentación del proyecto</div>' +
    '<div class="card-subtitle">' +
    "Genera y edita la memoria de calidades y la presentación comercial." +
    "</div>" +
    "</div>" +
    '<div class="doc-header-controls">' +
    '<div class="btn-group btn-group-xs" role="group">' +
    langButtons +
    "</div>" +
    '<div class="btn-group btn-group-xs" role="group" style="margin-left:8px;">' +
    '<button id="docModoComercialBtn" type="button" class="btn ' +
    modoComActive +
    '">Comercial</button>' +
    '<button id="docModoTecnicoBtn" type="button" class="btn ' +
    modoTecActive +
    '">Técnica</button>' +
    "</div>" +
    "</div>" +
    "</div>" +
    '<div class="card-body">' +
    '<p class="text-muted" style="font-size:0.85rem;">' +
    "Puedes regenerar los textos base según el idioma y luego ajustar cada sección manualmente o con ayuda de la IA." +
    "</p>" +
    '<button id="docRegenerarBtn" type="button" class="btn btn-sm btn-outline-primary">' +
    "🔁 Regenerar texto base por idioma" +
    "</button>" +
    "</div>" +
    "</div>" +
    '<div id="docSectionsContainer">' +
    renderDocSectionsHTML() +
    "</div>" +
    "</div>" +
    '<div class="doc-sidebar">' +
    '<div class="card mb-3">' +
    '<div class="card-header">' +
    '<div class="card-title">Documentación gráfica</div>' +
    '<div class="card-subtitle">Arrastra las imágenes a las secciones</div>' +
    "</div>" +
    '<div class="card-body">' +
    '<input type="text" id="docMediaSearchInput" class="form-control mb-2" placeholder="Buscar imagen..." value="' +
    docEscapeHtml(appState.documentacion.mediaSearchTerm || "") +
    '">' +
    '<div class="doc-media-body">' +
    renderDocMediaLibraryHTML() +
    "</div>" +
    "</div>" +
    "</div>" +
    '<div class="card mb-3">' +
    '<div class="card-header">' +
    '<div class="card-title">Fichas técnicas</div>' +
    "</div>" +
    '<div class="card-body">' +
    renderDocFichasHTML() +
    "</div>" +
    "</div>" +
    '<div class="card">' +
    '<div class="card-header">' +
    '<div class="card-title">Exportar / bloques extra</div>' +
    "</div>" +
    '<div class="card-body">' +
    '<button id="docExportarBtn" type="button" class="btn btn-sm btn-primary mb-2" style="width:100%;">' +
    "📄 Exportar PDF (" +
    (modo === "tecnica" ? "técnico" : "comercial") +
    ")" +
    "</button>" +
    '<button id="docNuevoBloqueBtn" type="button" class="btn btn-sm btn-soft w-100">' +
    "➕ Añadir bloque personalizado" +
    "</button>" +
    "</div>" +
    "</div>" +
    "</div>" +
    "</div>" +
    '<div id="docModalBackdrop" class="doc-modal-backdrop hidden"></div>' +
    '<div id="docCustomModal" class="doc-modal hidden">' +
    '<div class="doc-modal-content">' +
    '<div class="doc-modal-header">' +
    "<h3>Añadir bloque personalizado</h3>" +
    "</div>" +
    '<div class="doc-modal-body">' +
    '<label class="form-label">Sección destino</label>' +
    '<select id="docCustomSectionSelect" class="form-control mb-2">' +
    DOC_SECTION_ORDER.map(function (k) {
      return (
        '<option value="' +
        k +
        '">' +
        docEscapeHtml(labelForSection(k)) +
        "</option>"
      );
    }).join("") +
    "</select>" +
    '<label class="form-label">Texto a añadir</label>' +
    '<textarea id="docCustomText" class="form-control" rows="6"></textarea>' +
    "</div>" +
    '<div class="doc-modal-footer">' +
    '<button id="docCustomCancelBtn" type="button" class="btn btn-soft">Cancelar</button>' +
    '<button id="docCustomSaveBtn" type="button" class="btn btn-primary">Guardar bloque</button>' +
    "</div>" +
    "</div>" +
    "</div>";

  attachDocSearchHandlers(container);
  attachDocSectionHandlers(container);

  var regenBtn = container.querySelector("#docRegenerarBtn");
  if (regenBtn) {
    regenBtn.addEventListener("click", function () {
      autoGenerateDocumentacion(appState.documentacion.idioma || "es");
      renderDocumentacionView();
    });
  }

  var modoComBtn = container.querySelector("#docModoComercialBtn");
  var modoTecBtn = container.querySelector("#docModoTecnicoBtn");

  if (modoComBtn) {
    modoComBtn.addEventListener("click", function () {
      appState.documentacion.modo = "comercial";
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  }

  if (modoTecBtn) {
    modoTecBtn.addEventListener("click", function () {
      appState.documentacion.modo = "tecnica";
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  }

  container
    .querySelectorAll("[data-doc-lang]")
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        var lang = btn.getAttribute("data-doc-lang");
        autoGenerateDocumentacion(lang);
        renderDocumentacionView();
      });
    });

  var nuevoBloqueBtn = container.querySelector("#docNuevoBloqueBtn");
  if (nuevoBloqueBtn) {
    nuevoBloqueBtn.addEventListener("click", openDocCustomModal);
  }

  var exportBtn = container.querySelector("#docExportarBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", function () {
      exportarDocumentacionPDF().catch(function (err) {
        console.error("Error exportando PDF:", err);
      });
    });
  }

  var modal = document.getElementById("docCustomModal");
  var cancelBtn = modal && modal.querySelector("#docCustomCancelBtn");
  var saveBtn = modal && modal.querySelector("#docCustomSaveBtn");
  var backdrop = document.getElementById("docModalBackdrop");

  if (cancelBtn) cancelBtn.addEventListener("click", closeDocCustomModal);
  if (saveBtn) saveBtn.addEventListener("click", saveDocCustomBlock);
  if (backdrop)
    backdrop.addEventListener("click", function () {
      closeDocCustomModal();
    });

  attachDocMediaGridHandlers(container);
}

// ======================================================
// EXPONER RENDER
// ======================================================

window.renderDocumentacionView = renderDocumentacionView;
