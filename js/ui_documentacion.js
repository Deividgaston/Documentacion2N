// js/ui_documentacion.js
// Página de DOCUMENTACIÓN: memoria de calidades auto-generada + editor flotante

// ======================================================
// ESTADO GLOBAL
// ======================================================

window.appState = window.appState || {};
appState.documentacion = appState.documentacion || {
  idioma: "es", // "es" | "en" | "pt"
  secciones: {}, // clave -> texto
  customBlocks: [], // bloques añadidos manualmente
  fichasIncluidas: {}, // (legacy) idLinea -> true/false
  ultimaAutoGen: null,
  modo: "comercial", // "comercial" | "tecnica"
  mediaLibrary: [], // [{id, nombre, type, mimeType, url, storagePath, folderName, docCategory,...}]
  mediaLoaded: false,
  sectionMedia: {}, // clave sección -> [mediaId]
  selectedFichasMediaIds: [], // fichas técnicas seleccionadas
  mediaSearchTerm: "",
  fichasSearchTerm: "",
  includedSections: {}, // clave sección -> true/false (incluir en PDF técnico)
  logoData: null, // cache logo para PDF
  sectionTitles: {}, // títulos personalizados por sección
};

// ======================================================
// PERSISTENCIA LOCAL
// ======================================================

const DOC_STORAGE_KEY = "docState_v1";

(function loadDocStateFromLocalStorage() {
  try {
    const raw =
      typeof window !== "undefined" &&
      window.localStorage &&
      localStorage.getItem(DOC_STORAGE_KEY);

    if (!raw) return;

    const saved = JSON.parse(raw);
    appState.documentacion = {
      ...appState.documentacion,
      ...saved,
    };
  } catch (e) {
    console.error("[DOC] Error cargando estado de documentación:", e);
  }
})();

function saveDocStateToLocalStorage() {
  try {
    if (!window.localStorage) return;

    const d = appState.documentacion;
    const toSave = {
      idioma: d.idioma,
      secciones: d.secciones,
      customBlocks: d.customBlocks,
      fichasIncluidas: d.fichasIncluidas,
      modo: d.modo,
      sectionMedia: d.sectionMedia,
      selectedFichasMediaIds: d.selectedFichasMediaIds,
      mediaSearchTerm: d.mediaSearchTerm || "",
      fichasSearchTerm: d.fichasSearchTerm || "",
      includedSections: d.includedSections || {},
      sectionTitles: d.sectionTitles || {},
    };

    localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error("[DOC] Error guardando estado documentación:", e);
  }
}

// ======================================================
// HELPERS DE CONTENEDOR
// ======================================================

function getDocAppContent() {
  if (typeof window.getAppContent === "function") {
    return window.getAppContent();
  }
  return document.getElementById("appContent");
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
    resumen:
      "This document describes the proposed IP video intercom and access control solution for the project {{NOMBRE_PROYECTO}}, promoted by {{PROMOTORA}}.",
    sistema:
      "The solution is based on a fully distributed IP video door entry system...",
    equipos:
      "The solution includes the following main devices:\n\n{{LISTADO_EQUIPOS}}",
    infraestructura:
      "All communication infrastructure is based on a structured cabling IP network...",
    servicios:
      "Cloud services can be added to enhance remote management and maintenance...",
    normativa_red: "RED Directive compliance...",
    normativa_lpd: "GDPR compliance information...",
    normativa_ciber: "Cybersecurity and Axis Group practices...",
    otros: "Additional notes and optional integrations.",
  },
  pt: {
    resumen:
      "O presente documento descreve a solução de videoporteiro IP e controlo de acessos proposta para o projeto {{NOMBRE_PROYECTO}}, promovido por {{PROMOTORA}}.",
    sistema:
      "A solução baseia-se num sistema de videoporteiro IP totalmente distribuído...",
    equipos:
      "A solução inclui os seguintes equipamentos principais:\n\n{{LISTADO_EQUIPOS}}",
    infraestrutura:
      "Toda a infraestrutura de comunicações assenta numa rede IP com cablagem estruturada...",
    servicios:
      "A solução pode ser complementada com serviços cloud para gestão remota...",
    normativa_red:
      "Norma RED (Radio Equipment Directive) – 1 de agosto de 2025...",
    normativa_lpd: "Informações sobre RGPD...",
    normativa_ciber: "Práticas de cibersegurança e Axis...",
    outros: "Notas adicionais e integrações opcionais.",
  },
};

// ======================================================
// TOKENS Y AUTO-GENERACIÓN
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
        return `• ${ref} – ${desc} (x${qty})`;
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
  Object.keys(tokens).forEach((k) => {
    out = out.replace(new RegExp(k, "g"), tokens[k]);
  });
  return out;
}
const DOC_PRESENTACION_TEMPLATES = {
  es:
    "2N lidera el camino en tecnología de control de acceso: ofrecemos las mejores características modernas sin comprometer la confiabilidad y la facilidad de uso.\n\n" +
    "2N tiene más de 30 años de experiencia en el desarrollo de productos innovadores y de alta calidad: después de inventar el primer intercomunicador IP del mundo en 2008 y el primer intercomunicador LTE / 4G diez años después, continuamos empujando los límites y reaccionando a las cambiantes demandas del mercado.\n\n" +
    "Nuestra cartera incluye intercomunicadores, unidades contestadoras, lectores de control de acceso y sistemas de elevación, y nos aseguramos de que pueda ofrecer a sus clientes una tecnología fiable y preparada para el futuro, incluido el acceso móvil a través de Bluetooth y códigos QR.\n" +
    "Juntos, estos productos innovadores crean una solución de control de acceso IP altamente avanzada, adecuada para cualquier proyecto residencial. También ofrecemos una gama de herramientas y software en línea diseñados para ayudar a los integradores y administradores de edificios en cada paso de su viaje, además de un soporte técnico integral disponible siempre que lo necesite.\n\n" +
    "La flexibilidad y la facilidad de integración son importantes para usted, ¡así que también lo es para nosotros! Es por eso que los productos 2N se basan en protocolos abiertos (SIP, RTSP, ONVIF, HTTPS, open API) y tienen más de 200 socios de integración oficiales, que ofrecen una integración perfecta con una amplia gama de sistemas de terceros.\n\n" +
    "En 2N nos tomamos el diseño tan en serio como la innovación, y los Red Dot e iF Design Awards lo demuestran. Invertimos mucho en desarrollo y pruebas, e incluso nuestros dispositivos de más alta tecnología pueden soportar condiciones climáticas exigentes y una gran afluencia.\n\n" +
    "Historia de la empresa\n\n" +
    "2N fue fundada en 1991 en Praga por tres amigos con una visión clara para innovar y tener éxito. Praga sigue siendo la sede mundial, y desde entonces nos hemos expandido, con equipos ahora en muchos otros países (Estados Unidos, Reino Unido, Alemania, Italia, Francia, España, Bélgica, Países Bajos, Dinamarca, Emiratos Árabes Unidos y Australia) y una extensa red de distribución en el resto del mundo. En 2016 nos convertimos en un orgulloso miembro del Grupo Axis, lo que ha mejorado nuestros recursos y nos ha dado aún más estabilidad.",

  en:
    "2N leads the way in access control technology: we offer the most advanced modern features without compromising reliability and ease of use.\n\n" +
    "2N has more than 30 years of experience in developing innovative, high-quality products: after inventing the world’s first IP intercom in 2008 and the first LTE / 4G intercom ten years later, we continue to push the boundaries and respond to changing market demands.\n\n" +
    "Our portfolio includes intercoms, answering units, access control readers and lift systems, ensuring you can offer your customers reliable, future-proof technology, including mobile access via Bluetooth and QR codes.\n" +
    "Together, these innovative products create a highly advanced IP access control solution suitable for any residential project. We also offer a range of online tools and software designed to support integrators and building managers at every step of their journey, plus comprehensive technical support whenever it is needed.\n\n" +
    "Flexibility and ease of integration are important to you – so they are also important to us! That’s why 2N products are based on open protocols (SIP, RTSP, ONVIF, HTTPS, open API) and integrate with more than 200 official technology partners, enabling seamless integration with a wide range of third-party systems.\n\n" +
    "At 2N we take design as seriously as innovation – and our Red Dot and iF Design Awards prove it. We invest heavily in development and testing so that even our most advanced devices can withstand demanding weather conditions and high traffic.\n\n" +
    "Company history\n\n" +
    "2N was founded in 1991 in Prague by three friends with a clear vision to innovate and succeed. Prague remains our global headquarters and, since then, we have expanded with teams in many other countries (United States, United Kingdom, Germany, Italy, France, Spain, Belgium, the Netherlands, Denmark, United Arab Emirates and Australia) and an extensive distribution network worldwide. In 2016, we proudly became part of the Axis Group, which has strengthened our resources and given us even greater stability.",

  pt:
    "A 2N lidera o caminho na tecnologia de controlo de acessos: oferecemos as funcionalidades modernas mais avançadas sem comprometer a fiabilidade e a facilidade de utilização.\n\n" +
    "A 2N tem mais de 30 anos de experiência no desenvolvimento de produtos inovadores e de alta qualidade: depois de lançar o primeiro intercomunicador IP do mundo em 2008 e o primeiro intercomunicador LTE / 4G dez anos mais tarde, continuamos a ultrapassar limites e a responder às exigências em constante mudança do mercado.\n\n" +
    "O nosso portefólio inclui intercomunicadores, unidades interiores, leitores de controlo de acessos e sistemas de elevador, garantindo que pode oferecer aos seus clientes uma tecnologia fiável e preparada para o futuro, incluindo acesso móvel através de Bluetooth e códigos QR.\n" +
    "Em conjunto, estes produtos inovadores criam uma solução de controlo de acessos IP altamente avançada, adequada para qualquer projeto residencial. Também oferecemos uma gama de ferramentas e software online pensados para apoiar integradores e administradores de edifícios em todas as fases do projeto, bem como um suporte técnico completo sempre que necessário.\n\n" +
    "A flexibilidade e a facilidade de integração são importantes para si – e, por isso, também são para nós! É por isso que os produtos 2N se baseiam em protocolos abertos (SIP, RTSP, ONVIF, HTTPS, open API) e contam com mais de 200 parceiros oficiais de integração, permitindo uma integração perfeita com uma vasta gama de sistemas de terceiros.\n\n" +
    "Na 2N levamos o design tão a sério quanto a inovação – e os prémios Red Dot e iF Design o demonstram. Investimos intensamente em desenvolvimento e testes para que mesmo os nossos dispositivos mais avançados possam suportar condições climatéricas exigentes e um grande fluxo de utilizadores.\n\n" +
    "História da empresa\n\n" +
    "A 2N foi fundada em 1991 em Praga por três amigos com uma visão clara de inovar e ter sucesso. Praga continua a ser a sede mundial e, desde então, expandimos com equipas em muitos outros países (Estados Unidos, Reino Unido, Alemanha, Itália, França, Espanha, Bélgica, Países Baixos, Dinamarca, Emirados Árabes Unidos e Austrália) e uma ampla rede de distribuição no resto do mundo. Em 2016 tornámo-nos um orgulhoso membro do Grupo Axis, o que reforçou nossos recursos e nos deu ainda mais estabilidade.",
};

function autoGenerateDocumentacion(idioma) {
  const lang = DOC_BASE_TEMPLATES[idioma] ? idioma : "es";
  const base = DOC_BASE_TEMPLATES[lang];
  const tokens = buildDocTokens();

  const nuevas = {};
  const d = appState.documentacion;

  DOC_SECTION_ORDER.forEach((key) => {
    if (key === "presentacion_empresa") {
      const tpl =
        DOC_PRESENTACION_TEMPLATES[lang] ||
        DOC_PRESENTACION_TEMPLATES.es;
      nuevas[key] = tpl;
    } else {
      const tpl = base[key] || "";
      nuevas[key] = applyTokensToTemplate(tpl, tokens);
    }
  });

  d.secciones = nuevas;
  d.ultimaAutoGen = new Date().toISOString();
  d.idioma = lang;

  saveDocStateToLocalStorage();
}

// ======================================================
// HELPERS GENERALES
// ======================================================

function docEscapeHtml(str) {
  if (str === null || str === undefined) return "";
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
  return true;
}

// ======================================================
// MEDIA POR SECCIÓN (chips dentro de cada bloque)
// ======================================================

function renderSectionMediaHTML(sectionKey) {
  const mediaLib = appState.documentacion.mediaLibrary || [];
  const map = {};
  mediaLib.forEach((m) => {
    if (m && m.id) map[m.id] = m;
  });

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
        url.endsWith(".png") ||
        url.endsWith(".jpg") ||
        url.endsWith(".jpeg") ||
        url.endsWith(".webp") ||
        url.endsWith(".gif");

      const caption = m.nombre || "";

      return `
        <div class="doc-section-media-chip">
          <div class="doc-section-media-thumb">
            ${
              isImg
                ? `<img src="${m.url}" alt="${docEscapeHtml(caption)}">`
                : `<div class="doc-section-media-icon">📄</div>`
            }
          </div>
          <div class="doc-section-media-foot">
            <span class="doc-section-media-caption">${docEscapeHtml(
              caption
            )}</span>
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
// RENDER DE SECCIONES (columna izquierda)
// ======================================================

function renderDocSectionsHTML() {
  const secciones = appState.documentacion.secciones || {};

  return DOC_SECTION_ORDER.map((key) => {
    const contenido = secciones[key] || "";
    const included = getSectionIncluded(key);
    const title = getSectionTitle(key);

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
            <label class="doc-section-include-toggle" style="font-size:0.75rem;display:flex;align-items:center;gap:0.25rem;margin-right:0.5rem;">
              <input type="checkbox"
                data-doc-section-enable="${key}"
                ${included ? "checked" : ""}>
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
            rows="10"
          >${docEscapeHtml(contenido)}</textarea>

          <div class="doc-section-media-drop"
            data-doc-section-drop="${key}">
            <div class="doc-section-media-items">
              ${renderSectionMediaHTML(key)}
            </div>
            <div class="doc-section-media-hint">
              Arrastra aquí imágenes para adjuntar a esta sección (máx. 10).
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ======================================================
// RENDER FICHAS TÉCNICAS (barra derecha)
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

  const searchInputHtml = `
    <div class="form-group mb-2">
      <input
        type="text"
        id="docFichasSearchInput"
        class="form-control"
        placeholder="Buscar por nombre..."
        value="${docEscapeHtml(
          appState.documentacion.fichasSearchTerm || ""
        )}"
      >
    </div>
  `;

  if (!filtered.length) {
    return `
      <div class="doc-fichas-section">
        <div class="doc-fichas-block">
          <div class="doc-fichas-title">Fichas técnicas</div>
          <p class="doc-fichas-help">
            No se han encontrado fichas técnicas. Puedes subirlas desde
            <strong>Gestión de documentación</strong>.
          </p>
          ${searchInputHtml}
        </div>
      </div>
    `;
  }

  const list = filtered
    .map((m) => {
      const checked = selected.has(m.id) ? "checked" : "";
      const main = m.folderName
        ? `<strong>${docEscapeHtml(
            m.folderName
          )}</strong> – ${docEscapeHtml(m.nombre || "")}`
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
        <div class="doc-fichas-title">Fichas técnicas</div>
        <p class="doc-fichas-help">
          Selecciona las fichas que quieras incluir en el PDF técnico.
        </p>
        ${searchInputHtml}
        <div class="doc-fichas-list doc-fichas-media-list">
          ${list}
        </div>
      </div>
    </div>
  `;
}

// ======================================================
// DOCUMENTACIÓN GRÁFICA – SOLO IMÁGENES
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
// MEDIA GRID HANDLERS
// ======================================================

function attachDocMediaGridHandlers(root) {
  const container = root || getDocAppContent();
  if (!container) return;

  // Drag
  container.querySelectorAll(".doc-media-item").forEach((item) => {
    item.addEventListener("dragstart", (ev) => {
      const id = item.getAttribute("data-media-id");
      if (!id || !ev.dataTransfer) return;
      ev.dataTransfer.setData("text/plain", id);
      ev.dataTransfer.effectAllowed = "copy";
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
        ) || null;

      if (!item?.url) {
        alert("No se ha encontrado la imagen. Revisa la consola.");
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

      if (isImg) openDocImageFloatingPreview(item);
      else window.open(item.url, "_blank");
    });
  });

  // Botón quitar imagen de sección
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
// AÑADIR / QUITAR MEDIA A SECCIÓN
// ======================================================

function attachMediaToSection(sectionKey, mediaId) {
  const map = appState.documentacion.sectionMedia || {};
  const arr = map[sectionKey] || [];

  if (!arr.includes(mediaId) && arr.length >= 10) {
    alert("Solo puedes adjuntar hasta 10 imágenes por sección.");
    return;
  }

  if (!arr.includes(mediaId)) arr.push(mediaId);
  map[sectionKey] = arr;
  appState.documentacion.sectionMedia = map;

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
// MODAL PARA BLOQUES CUSTOM
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
// IA POR SECCIÓN
// ======================================================

function sanitizeAIText(raw) {
  if (typeof raw !== "string") return "";
  let txt = raw.replace(/\r\n/g, "\n");
  const lines = txt.split("\n").map((line) => {
    let l = line;
    // Quitar viñetas tipo -, *, • al inicio
    l = l.replace(/^\s*[-*•]+(\s+)/, "");
    // Quitar cabeceras Markdown con #
    l = l.replace(/^\s*#+\s+/, "");
    // Quitar listas numeradas "1. "
    l = l.replace(/^\s*\d+\.\s+/, "");
    return l;
  });

  // Eliminar líneas vacías al principio y al final
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();

  txt = lines.join("\n");

  // Quitar negritas/cursivas Markdown para evitar asteriscos y guiones bajos
  txt = txt.replace(/\*\*([^*]+)\*\*/g, "$1");
  txt = txt.replace(/\*([^*]+)\*/g, "$1");
  txt = txt.replace(/_([^_]+)_/g, "$1");

  return txt;
}

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
      let nuevo = await window.handleDocSectionAI({
        sectionKey,
        idioma,
        titulo,
        texto: textoActual,
        proyecto,
        presupuesto,
        modo,
      });

      if (typeof nuevo === "string" && nuevo.trim()) {
        return sanitizeAIText(nuevo);
      }
      return textoActual;
    } catch (e) {
      console.error("[DOC] Error IA:", e);
      alert("Ha ocurrido un error al consultar la IA.");
      return textoActual;
    }
  }

  alert(
    "Función IA no implementada. Debes añadir window.handleDocSectionAI."
  );
  return textoActual;
}

// Implementación por defecto si no existe
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

    return sanitizeAIText(data.text);
  };
}
// ======================================================
// CARGA MEDIA (Firestore + Storage)
// ======================================================

async function ensureDocMediaLoaded() {
  const db =
    window.db ||
    (window.firebase?.firestore ? window.firebase.firestore() : null);
  if (!db) {
    console.warn("[DOC] Firestore no disponible para media.");
    return;
  }

  if (appState.documentacion.mediaLoaded) {
    return;
  }

  try {
    const snap = await db.collection("documentacion_media").get();
    const media = [];

    snap.forEach((d) => media.push({ ...d.data(), id: d.id }));

    appState.documentacion.mediaLibrary = media;
    appState.documentacion.mediaLoaded = true;

    console.log("[DOC] Media cargada:", media.length);
  } catch (e) {
    console.error("[DOC] Error cargando documentación media:", e);
    appState.documentacion.mediaLoaded = false;
  }
}

async function saveMediaFileToStorageAndFirestore(file, options = {}) {
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
  if (!storage || !db) throw new Error("Firebase Storage/Firestore no disponible");

  const basePath = `documentacion/${folderSlug || "general"}/`;
  const fileName = `${Date.now()}_${file.name}`;
  const storagePath = basePath + fileName;

  const ref = storage.ref().child(storagePath);
  await ref.put(file);

  const url = await ref.getDownloadURL();

  const data = {
    nombre: file.name,
    type,
    mimeType: file.type || "",
    url,
    storagePath,
    folderName,
    docCategory,
    createdAt: new Date(),
  };

  const docRef = await db.collection("documentacion_media").add(data);
  const saved = { ...data, id: docRef.id };

  appState.documentacion.mediaLibrary =
    appState.documentacion.mediaLibrary || [];
  appState.documentacion.mediaLibrary.push(saved);
  appState.documentacion.mediaLoaded = true;

  return saved;
}

// ======================================================
// RENDER PRINCIPAL DE VISTA DOCUMENTACIÓN
// ======================================================

function renderDocumentacionView() {
  const container = getDocAppContent();
  if (!container) return;

  const d = appState.documentacion;

  const langOptions = Object.values(DOC_LANGS)
    .map((l) => {
      const selected = d.idioma === l.code ? "selected" : "";
      return `<option value="${l.code}" ${selected}>${l.label}</option>`;
    })
    .join("");

  const mediaSearchValue = d.mediaSearchTerm || "";

  container.innerHTML = `
    <div class="doc-root">
      <div class="doc-header-bar">
        <div class="doc-header-left">
          <h2 class="page-title">Documentación – Memoria de calidades</h2>
          <p class="page-subtitle">
            Genera una memoria comercial o técnica a partir del presupuesto
            y personalízala sección por sección. Asocia imágenes y fichas técnicas.
          </p>
        </div>
        <div class="doc-header-right">
          <div class="doc-mode-toggle" role="radiogroup">
            <button
              type="button"
              class="btn btn-sm ${
                d.modo === "comercial" ? "btn-primary" : "btn-light"
              }"
              data-doc-modo="comercial"
            >
              Modo comercial
            </button>
            <button
              type="button"
              class="btn btn-sm ${
                d.modo === "tecnica" ? "btn-primary" : "btn-light"
              }"
              data-doc-modo="tecnica"
            >
              Modo técnico
            </button>
          </div>

          <div class="doc-lang-select">
            <label for="docIdiomaSelect">Idioma</label>
            <select id="docIdiomaSelect" class="form-control form-control-sm">
              ${langOptions}
            </select>
          </div>

          <button
            type="button"
            class="btn btn-sm btn-outline"
            id="docAutoGenBtn"
          >
            🔁 Auto-generar texto base
          </button>
        </div>
      </div>

      <div class="doc-main-layout">
        <div class="doc-left-column">
          ${renderDocSectionsHTML()}

          <div class="doc-toolbar">
            <button
              type="button"
              class="btn btn-sm btn-secondary"
              id="docAddCustomBlockBtn"
            >
              ➕ Añadir bloque manual
            </button>

            <button
              type="button"
              class="btn btn-sm btn-light"
              id="docExportComercialPdfBtn"
            >
              📄 Exportar PDF comercial
            </button>

            <button
              type="button"
              class="btn btn-sm btn-light"
              id="docExportTechPdfBtn"
            >
              🧩 Exportar PDF técnico
            </button>
          </div>
        </div>

        <div class="doc-right-column">
          <div class="doc-panel">
            <div class="doc-panel-header">
              <h3>Documentación gráfica</h3>
              <p>
                Arrastra imágenes desde aquí a cada sección para incorporarlas
                en el PDF. Solo se muestran archivos de tipo imagen.
              </p>
              <div class="form-group mb-2">
                <input
                  type="text"
                  id="docMediaSearchInput"
                  class="form-control"
                  placeholder="Buscar imágenes por nombre..."
                  value="${docEscapeHtml(mediaSearchValue)}"
                >
              </div>
            </div>
            <div class="doc-panel-body doc-media-body">
              ${renderDocMediaLibraryHTML()}
            </div>
          </div>

          ${renderDocFichasHTML()}
        </div>
      </div>
    </div>

    <div id="docModalBackdrop" class="doc-modal-backdrop hidden"></div>

    <div id="docCustomModal" class="doc-modal hidden">
      <div class="doc-modal-content">
        <div class="doc-modal-header">
          <h3>Añadir bloque manual</h3>
          <button
            type="button"
            class="doc-modal-close"
            id="docCustomModalCloseBtn"
          >✕</button>
        </div>
        <div class="doc-modal-body">
          <div class="form-group">
            <label for="docCustomSectionSelect">Sección destino</label>
            <select id="docCustomSectionSelect" class="form-control">
              ${DOC_SECTION_ORDER.map(
                (key) =>
                  `<option value="${key}">${docEscapeHtml(
                    labelForSection(key)
                  )}</option>`
              ).join("")}
            </select>
          </div>
          <div class="form-group">
            <label for="docCustomText">Texto del bloque</label>
            <textarea
              id="docCustomText"
              class="form-control"
              rows="6"
              placeholder="Escribe aquí el texto a insertar en la sección seleccionada..."
            ></textarea>
          </div>
        </div>
        <div class="doc-modal-footer">
          <button
            type="button"
            class="btn btn-light"
            id="docCustomModalCancelBtn"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            id="docCustomModalSaveBtn"
          >
            Guardar bloque
          </button>
        </div>
      </div>
    </div>
  `;

  attachDocumentacionHandlers(container);
}

// ======================================================
// HANDLERS DE LA VISTA
// ======================================================

function attachDocumentacionHandlers(container) {
  const d = appState.documentacion;

  const autoGenBtn = container.querySelector("#docAutoGenBtn");
  if (autoGenBtn) {
    autoGenBtn.addEventListener("click", () => {
      const idiomaSelect = container.querySelector("#docIdiomaSelect");
      const lang = idiomaSelect ? idiomaSelect.value : d.idioma || "es";
      if (
        !confirm(
          "Esto sobrescribirá el contenido base de las secciones (no los bloques manuales). ¿Continuar?"
        )
      ) {
        return;
      }
      autoGenerateDocumentacion(lang);
      renderDocumentacionView();
    });
  }

  const idiomaSelect = container.querySelector("#docIdiomaSelect");
  if (idiomaSelect) {
    idiomaSelect.addEventListener("change", () => {
      const lang = idiomaSelect.value || "es";
      appState.documentacion.idioma = lang;
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  }

  container.querySelectorAll("[data-doc-modo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modo = btn.getAttribute("data-doc-modo") || "comercial";
      appState.documentacion.modo = modo;
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  });

  container
    .querySelectorAll(".doc-section-textarea")
    .forEach((textarea) => {
      textarea.addEventListener("input", () => {
        const key = textarea.getAttribute("data-doc-section-text");
        if (!key) return;
        const secs = (appState.documentacion.secciones ||= {});
        secs[key] = textarea.value;
        saveDocStateToLocalStorage();
      });
    });

  container
    .querySelectorAll(".doc-section-title-input")
    .forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.getAttribute("data-doc-section-title");
        if (!key) return;
        const titles = (appState.documentacion.sectionTitles ||= {});
        titles[key] = input.value;
        saveDocStateToLocalStorage();
      });
    });

  container
    .querySelectorAll("[data-doc-section-enable]")
    .forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const key = checkbox.getAttribute("data-doc-section-enable");
        if (!key) return;
        const included = (appState.documentacion.includedSections ||= {});
        included[key] = checkbox.checked;
        saveDocStateToLocalStorage();
      });
    });

  container
    .querySelectorAll("[data-doc-ai-section]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const key = btn.getAttribute("data-doc-ai-section");
        if (!key) return;

        if (
          !confirm(
            "¿Quieres que la IA proponga un texto para esta sección? El contenido actual será reemplazado."
          )
        ) {
          return;
        }

        btn.disabled = true;
        btn.textContent = "Consultando IA...";

        try {
          const nuevo = await askAIForSection(key);
          const secs = (appState.documentacion.secciones ||= {});
          secs[key] = nuevo;
          saveDocStateToLocalStorage();
          renderDocumentacionView();
        } catch (e) {
          console.error("[DOC] Error al usar IA:", e);
        } finally {
          btn.disabled = false;
          btn.textContent = "✨ Preguntar a IA";
        }
      });
    });

  const addCustomBtn = container.querySelector("#docAddCustomBlockBtn");
  if (addCustomBtn) {
    addCustomBtn.addEventListener("click", () => {
      openDocCustomModal();
    });
  }

  ["docCustomModalCloseBtn", "docCustomModalCancelBtn"].forEach((id) => {
    const btn = container.querySelector("#" + id) || document.getElementById(id);
    if (btn) {
      btn.addEventListener("click", () => {
        closeDocCustomModal();
      });
    }
  });

  const saveCustomBtn =
    container.querySelector("#docCustomModalSaveBtn") ||
    document.getElementById("docCustomModalSaveBtn");
  if (saveCustomBtn) {
    saveCustomBtn.addEventListener("click", () => {
      saveDocCustomBlock();
    });
  }

  const mediaSearchInput = container.querySelector("#docMediaSearchInput");
  if (mediaSearchInput) {
    mediaSearchInput.addEventListener("input", () => {
      appState.documentacion.mediaSearchTerm = mediaSearchInput.value;
      saveDocStateToLocalStorage();
      refreshDocMediaGridOnly();
    });
  }

  const fichasSearchInput = container.querySelector("#docFichasSearchInput");
  if (fichasSearchInput) {
    fichasSearchInput.addEventListener("input", () => {
      appState.documentacion.fichasSearchTerm = fichasSearchInput.value;
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  }

  container
    .querySelectorAll("[data-doc-ficha-media-id]")
    .forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const id = checkbox.getAttribute("data-doc-ficha-media-id");
        if (!id) return;

        const list =
          appState.documentacion.selectedFichasMediaIds || [];
        const set = new Set(list);

        if (checkbox.checked) set.add(id);
        else set.delete(id);

        appState.documentacion.selectedFichasMediaIds = Array.from(set);
        saveDocStateToLocalStorage();
      });
    });

  container
    .querySelectorAll("[data-doc-section-drop]")
    .forEach((zone) => {
      zone.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        zone.classList.add("doc-drop-over");
      });
      zone.addEventListener("dragleave", () => {
        zone.classList.remove("doc-drop-over");
      });
      zone.addEventListener("drop", (ev) => {
        ev.preventDefault();
        zone.classList.remove("doc-drop-over");

        const id = ev.dataTransfer?.getData("text/plain");
        const key = zone.getAttribute("data-doc-section-drop");
        if (!id || !key) return;

        attachMediaToSection(key, id);
      });
    });

  attachDocMediaGridHandlers(container);

  const exportComercialBtn = container.querySelector(
    "#docExportComercialPdfBtn"
  );
  if (exportComercialBtn) {
    exportComercialBtn.addEventListener("click", () => {
      exportarPDFComercial();
    });
  }

  const exportTechBtn = container.querySelector("#docExportTechPdfBtn");
  if (exportTechBtn) {
    exportTechBtn.addEventListener("click", () => {
      exportarPDFTecnico();
    });
  }
}

// ======================================================
// UTILIDADES GENERALES PDF
// ======================================================

function getDocPageDimensions(pdf) {
  const size = pdf.internal.pageSize;
  if (Array.isArray(size)) {
    return { width: size[0], height: size[1] };
  }
  return { width: size.getWidth(), height: size.getHeight() };
}

async function loadImageAsDataUrl(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Error fetch imagen: " + resp.status);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          const maxDim = 2000;
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
        };
        img.onerror = (err) => reject(err);
        img.src = reader.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("[DOC] Error loadImageAsDataUrl:", e);
    return null;
  }
}

// ======================================================
// HEADER / FOOTER PARA PDF TÉCNICO
// ======================================================

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
      console.warn("[DOC] No se pudo dibujar logo en header:", e);
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

  return lineY + 10;
}

function drawTechFooter(pdf, opts = {}) {
  const dims = getDocPageDimensions(pdf);
  const h = dims.height;

  const idioma = opts.idioma || "es";
  let txt =
    idioma === "en"
      ? "2N TELEKOMUNIKACE a.s. – www.2n.com"
      : idioma === "pt"
      ? "2N TELEKOMUNIKACE a.s. – www.2n.com"
      : "2N TELEKOMUNIKACE a.s. – www.2n.com";

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(148, 163, 184);

  const marginX = 20;
  const footerY = h - 12;

  const page = pdf.getNumberOfPages();

  pdf.text(txt, marginX, footerY);
  pdf.text(String(page), h - 10, footerY);
}

function setupTechContentPage(pdf, opts = {}) {
  const startY = drawTechHeader(pdf, opts);
  drawTechFooter(pdf, opts);
  return startY;
}

// ---------------- PDF técnico completo ----------------

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
    (presupuesto && presupuesto.nombreProyecto) ||
    "Proyecto residencial";

  const dims = getDocPageDimensions(doc);
  const pageW = dims.width;
  const pageH = dims.height;

  const tocEntries = [];
  const pageHLimit = pageH - 25;

  // Portada técnica
  let titulo =
    idioma === "en"
      ? "Technical specification"
      : idioma === "pt"
      ? "Memória descritiva"
      : "Memoria de calidades";

  if (idioma === "pt") titulo = "Memória descritiva";

  // Portada
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
    console.warn("[DOC] No se pudo cargar portada técnica:", e);
  }

  const gradHeight = 70;
  const gradStart = pageH - gradHeight;
  for (let i = 0; i < 6; i++) {
    const y = gradStart + (i * gradHeight) / 6;
    const h = gradHeight / 6;
    const alpha = 1 - i / 6;
    doc.setFillColor(15, 23, 42, alpha * 255);
    doc.rect(0, y, pageW, h, "F");
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(248, 250, 252);
  doc.text(titulo, pageW / 2, gradStart + 20, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(nombreProyecto, pageW / 2, gradStart + 30, { align: "center" });

  doc.addPage();

  // Índice
  let y = setupTechContentPage(doc, { idioma, nombreProyecto });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175);
  doc.text(
    idioma === "en"
      ? "Contents"
      : idioma === "pt"
      ? "Índice"
      : "Contenido",
    20,
    y
  );
  y += 8;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(20, y, pageW - 20, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);

  const tocYStart = y;
  let yToc = tocYStart;

  const fillTocEntries = (entries) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 81);

    yToc = tocYStart;

    entries.forEach((entry, index) => {
      const text = `${index + 1}. ${entry.title}`;
      const page = String(entry.page);

      const textWidth = doc.getTextWidth(text);
      const maxTextWidth = pageW - 40 - 15;

      let displayText = text;
      if (textWidth > maxTextWidth) {
        while (
          displayText.length > 3 &&
          doc.getTextWidth(displayText + "…") > maxTextWidth
        ) {
          displayText = displayText.slice(0, -1);
        }
        displayText += "…";
      }

      if (yToc > pageH - 25) {
        // Si el índice se queda sin espacio, añadimos otra página solo para índice
        doc.addPage();
        yToc = setupTechContentPage(doc, { idioma, nombreProyecto });
      }

      doc.text(displayText, 25, yToc);
      const pageWidth = doc.getTextWidth(page);
      doc.text(page, pageW - 25 - pageWidth, yToc);

      doc.setDrawColor(230, 230, 230);
      doc.line(25, yToc + 1.5, pageW - 25, yToc + 1.5);

      yToc += 7;
    });
  };

  // Placeholder de índice (lo rellenaremos al final con las páginas correctas)
  fillTocEntries([]);

  // Presentación de empresa (si incluida)
  const includePresentacion =
    included["presentacion_empresa"] === false ? false : true;

  let nombreProyectoForHeader = nombreProyecto;
  let logo = null;

  try {
    if (!appState.documentacion.logoData) {
      const logoLoaded = await loadImageAsDataUrl(DOC_LOGO_DEFAULT_URL);
      appState.documentacion.logoData = logoLoaded;
    }
    logo = appState.documentacion.logoData;
  } catch (e) {
    console.warn("[DOC] No se pudo precargar logo:", e);
  }

  if (includePresentacion) {
    doc.addPage();
    let current = doc.getNumberOfPages();
    let y = setupTechContentPage(doc, {
      idioma,
      nombreProyecto: nombreProyectoForHeader,
      logo,
    });

    const baseTitle =
      idioma === "en"
        ? "Company introduction"
        : idioma === "pt"
        ? "Apresentação de empresa"
        : "Presentación de empresa";

    // TÍTULO SECCIÓN: 20
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 64, 175);
    doc.text(baseTitle, 20, y);
    y += 6;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(20, y, pageW - 20, y);
    y += 8;

    const texto = secciones["presentacion_empresa"] || "";
    if (texto) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(55, 65, 81);

      const lines = doc.splitTextToSize(texto, pageW - 40);
      const lineH = 5.5;
      const limitY = pageH - 25;

      tocEntries.push({ title: baseTitle, page: current });

      function newPagePresentacion() {
        doc.addPage();
        current = doc.getNumberOfPages();
        y = setupTechContentPage(doc, {
          idioma,
          nombreProyecto: nombreProyectoForHeader,
          logo,
        });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(30, 64, 175);
        doc.text(baseTitle + " (cont.)", 20, y);
        y += 6;

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(20, y, pageW - 20, y);
        y += 8;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(55, 65, 81);
      }

      for (let i = 0; i < lines.length; i++) {
        if (y + lineH > limitY) {
          newPagePresentacion();
        }
        doc.text(lines[i], 20, y);
        y += lineH;
      }
    }
  }

  // Resto secciones
  doc.addPage();
  let currentPage = doc.getNumberOfPages();
  y = setupTechContentPage(doc, {
    idioma,
    nombreProyecto: nombreProyectoForHeader,
    logo,
  });

  function newPage() {
    doc.addPage();
    currentPage = doc.getNumberOfPages();
    y = setupTechContentPage(doc, {
      idioma,
      nombreProyecto: nombreProyectoForHeader,
      logo,
    });
    return y;
  }

  function ensureSpace(linesCount) {
    const need = linesCount * 5.5 + 14;
    if (y + need > pageHLimit) {
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
    const imgsIds = appState.documentacion.sectionMedia?.[key] || [];
    if (!contenido && imgsIds.length === 0) continue;

    // Si no cabe ni el título ni unas pocas líneas, pasamos sección a la siguiente página
    const minSpaceForSection = 25; // espacio mínimo después del título
    if (y + minSpaceForSection > pageHLimit) {
      newPage();
    }

    const sectionTitle = getSectionTitle(key);
    const sectionStartPage = currentPage;
    tocEntries.push({ title: sectionTitle, page: sectionStartPage });

    // TÍTULO SECCIÓN: 20
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 64, 175);
    doc.text(sectionTitle, 20, y);
    y += 6;

    // Línea bajo título
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(20, y, pageW - 20, y);
    y += 8;

    // CUERPO: 11, LÍNEA A LÍNEA
    if (contenido) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(55, 65, 81);

      const lines = doc.splitTextToSize(contenido, pageW - 40);
      const lineH = 5.5;

      for (let i = 0; i < lines.length; i++) {
        if (y + lineH > pageHLimit) {
          // Nueva página, preservando encabezado/footers
          newPage();
        }
        doc.text(lines[i], 20, y);
        y += lineH;
      }

      y += 4; // pequeño espacio después del texto
    }

    // Imágenes asociadas a la sección (con control de saltos de página)
    y = await insertImagesForSection(doc, key, y, newPage);
    y += 4;
  }

  // Anexo fichas técnicas
  const allMedia = appState.documentacion.mediaLibrary || [];
  const fichas = allMedia.filter((m) => {
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

  if (fichas.length > 0) {
    doc.addPage();
    let y = setupTechContentPage(doc, {
      idioma,
      nombreProyecto: nombreProyectoForHeader,
      logo,
    });

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
      const lineH = 4.5;

      for (let i = 0; i < lines.length; i++) {
        if (y + lineH > pageH - 25) {
          doc.addPage();
          y = setupTechContentPage(doc, {
            idioma,
            nombreProyecto: nombreProyectoForHeader,
            logo,
          });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
        }
        doc.text(lines[i], 20, y);
        y += lineH;
      }

      y += 3;
    }
  }

  // Volver al índice y rellenar entradas con las páginas correctas
  doc.setPage(2);
  fillTocEntries(tocEntries);

  // Guardar
  let base =
    idioma === "en"
      ? "technical_specification"
      : idioma === "pt"
      ? "memoria_descritiva"
      : "memoria_calidades";

  if (proyecto.codigo) {
    base += "_" + proyecto.codigo;
  }

  const fileName = base + ".pdf";
  doc.save(fileName);
}

// ======================================================
// INSERCIÓN DE IMÁGENES EN SECCIÓN
// ======================================================

async function insertImagesForSection(doc, sectionKey, y, onNewPage) {
  const ids = appState.documentacion.sectionMedia?.[sectionKey] || [];
  const media = appState.documentacion.mediaLibrary || [];

  const images = ids
    .map((id) => media.find((m) => m.id === id))
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

  if (!images.length) return y;

  const dims = getDocPageDimensions(doc);
  const pageW = dims.width;
  const pageH = dims.height;
  const marginX = 20;
  const marginY = 25;

  const maxImgWidth = pageW - marginX * 2;
  const maxImgHeight = pageH / 3;

  for (const imgMeta of images) {
    if (y + maxImgHeight + 10 > pageH - marginY) {
      if (typeof onNewPage === "function") {
        y = onNewPage();
      } else {
        doc.addPage();
        y = marginY;
      }
    }

    try {
      const data = await loadImageAsDataUrl(imgMeta.url);
      if (!data?.dataUrl) continue;

      const ratio = data.width / data.height;
      let imgW = maxImgWidth;
      let imgH = imgW / ratio;

      if (imgH > maxImgHeight) {
        imgH = maxImgHeight;
        imgW = imgH * ratio;
      }

      const x = (pageW - imgW) / 2;

      doc.addImage(data.dataUrl, "PNG", x, y, imgW, imgH);
      y += imgH + 6;
    } catch (e) {
      console.warn("[DOC] Error insertando imagen sección:", e);
    }
  }

  return y;
}
