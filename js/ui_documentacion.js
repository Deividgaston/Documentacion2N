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
    otros: "Notas adicionais e integrações opcionais.",
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

  // 🔧 AHORA PRIORIDAD AL NOMBRE DEL PRESUPUESTO (campo `nombre`)
  const nombreProyecto =
    proyecto.nombre ||
    proyecto.nombreProyecto ||
    (presupuesto && (presupuesto.nombre || presupuesto.nombreProyecto)) ||
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
    "A 2N foi fundada em 1991 em Praga por três amigos com uma visão clara de inovar e ter sucesso. Praga continua a ser a sede mundial e, desde então, expandimos com equipas em muitos outros países (Estados Unidos, Reino Unido, Alemanha, Itália, França, Espanha, Bélgica, Países Baixos, Dinamarca, Emirados Árabes Unidos e Austrália) e uma ampla rede de distribuição no resto do mundo. Em 2016 tornámo-nos um orgulhoso membro do Grupo Axis, o que reforçou os nossos recursos e nos deu ainda mais estabilidade.",
};

function autoGenerateDocumentacion(idioma) {
  const lang = DOC_BASE_TEMPLATES[idioma] ? idioma : "es";
  const base = DOC_BASE_TEMPLATES[lang];
  const tokens = buildDocTokens();

  const nuevas = {};
  const d = appState.documentacion;

  DOC_SECTION_ORDER.forEach((key) => {
    if (key === "presentacion_empresa") {
      // Opción A: SIEMPRE regenerar la presentación según el idioma seleccionado
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


// ... ⚠️ A PARTIR DE AQUÍ EL RESTO DEL ARCHIVO SIGUE IGUAL QUE LO TENÍAS,
// SOLO VOY A PEGAR LAS PARTES DONDE TAMBIÉN SE USA EL NOMBRE DEL PROYECTO
// PARA QUE NO SE HAGA INFINITO EL MENSAJE.

// ======================================================
// (TODO el resto del código intermedio se mantiene idéntico)
// ======================================================

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

  // 🔧 PRIORIDAD AL NOMBRE DEL PRESUPUESTO (campo `nombre`)
  const nombreProyecto =
    proyecto.nombre ||
    proyecto.nombreProyecto ||
    presupuesto?.nombre ||
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

  // ... (resto de exportarPDFTecnico sin cambios)
}

// ======================================================
// PDF COMERCIAL (títulos 20 / texto 11 en secciones)
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

  // 🔧 PRIORIDAD AL NOMBRE DEL PRESUPUESTO (campo `nombre`)
  const nombreProyecto =
    proyecto.nombre ||
    proyecto.nombreProyecto ||
    presupuesto?.nombre ||
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

  // ... (resto de exportarPDFComercial sin cambios)
}

// ======================================================
// EXPORTAR PDF SEGÚN MODO
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
// (Resto de handlers y renderDocumentacionView igual que en tu archivo)
// ======================================================

window.renderDocumentacionView = renderDocumentacionView;
window.ensureDocMediaLoaded = ensureDocMediaLoaded;
window.saveMediaFileToStorageAndFirestore =
  saveMediaFileToStorageAndFirestore;
window.deleteMediaById = deleteMediaById;
