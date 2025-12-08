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
};

// ===========================
// PERSISTENCIA LOCAL
// ===========================

const DOC_STORAGE_KEY = "docState_v1";

// Cargar estado guardado al iniciar
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
    console.error(
      "Error cargando estado de documentación desde localStorage:",
      e
    );
  }
})();

// Guardar estado relevante de documentación
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
    };
    localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error(
      "Error guardando estado de documentación en localStorage:",
      e
    );
  }
}

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

// Añadimos secciones específicas de normativa
const DOC_SECTION_ORDER = [
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

// Logo por defecto (puedes sobrescribir con window.DOC_LOGO_URL)
const DOC_LOGO_DEFAULT_URL = "img/logo_2n.svg";

// Imagen de portada técnica
const DOC_TECH_COVER_URL = "img/PortadaTecnica.jpg";

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
      "La solución puede complementarse con servicios cloud para gestión remota, apertura desde app móvil, actualizaciones de firmware y monitorización del sistema. Estos servicios permiten mejorar la experiencia del usuario final y facilitar la mantenimiento preventivo.",
    normativa_red:
      "Normativa RED (Radio Equipment Directive) – 1 de agosto de 2025\n\nTodos los equipos de comunicaciones incluidos en la solución cumplen con la Directiva RED (2014/53/EU) y su actualización de aplicación obligatoria a partir del 1 de agosto de 2025. Los dispositivos 2N incorporan las medidas necesarias en materia de ciberseguridad, gestión del espectro radioeléctrico y seguridad del usuario, incluyendo:\n\n- Gestión segura de firmware y actualizaciones remotas.\n- Mecanismos de protección frente a accesos no autorizados.\n- Conformidad con los requisitos esenciales de seguridad, compatibilidad electromagnética y uso eficiente del espectro.\n\nLa solución se ha diseñado teniendo en cuenta estos requisitos para garantizar la máxima seguridad y cumplimiento normativo a largo plazo.",
    normativa_lpd:
      "Protección de datos (LPD / GDPR)\n\nLa solución propuesta permite un tratamiento responsable de los datos personales, especialmente en lo relativo a imágenes de vídeo, registros de acceso y credenciales digitales.\n\nLa arquitectura recomendada se ha planteado para:\n\n- Minimizar la cantidad de datos personales almacenados.\n- Limitar el acceso a los datos a perfiles autorizados (administradores, seguridad, mantenimiento).\n- Facilitar el cumplimiento del Reglamento General de Protección de Datos (RGPD / GDPR) y de la normativa local de protección de datos.\n\nSe recomienda que la propiedad y/o la empresa gestora del edificio definan sus políticas de conservación de datos, información al usuario y ejercicio de derechos (acceso, rectificación, supresión, etc.), apoyándose en las capacidades técnicas de la solución.",
    normativa_ciber:
      "Ciberseguridad y certificaciones 2N\n\nLos dispositivos 2N incorporados en la solución se han diseñado siguiendo buenas prácticas de ciberseguridad, incluyendo:\n\n- Sistema operativo embebido endurecido, sin servicios innecesarios expuestos.\n- Autenticación segura y gestión de credenciales para administradores y usuarios.\n- Soporte de comunicaciones cifradas (HTTPS / TLS) para la gestión y, cuando aplica, para la señalización.\n- Posibilidad de integración con infraestructuras de red seguras (VLAN, segmentación, firewalls, etc.).\n\nAdicionalmente, 2N forma parte del grupo Axis, que aplica políticas estrictas de seguridad de producto, gestión de vulnerabilidades y ciclo de vida de firmware. Esto contribuye a reducir la superficie de ataque de la instalación y a facilitar el cumplimiento de políticas internas de ciberseguridad del cliente.",
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
    normativa_red:
      "RED Directive – 1 August 2025\n\nAll communication devices included in the solution comply with the Radio Equipment Directive (2014/53/EU) and its updated cybersecurity requirements, which become mandatory on 1 August 2025. 2N devices implement the necessary measures regarding cybersecurity, radio spectrum management and user safety, including:\n\n- Secure firmware management and remote updates.\n- Protection mechanisms against unauthorised access.\n- Compliance with the essential requirements on safety, EMC and efficient use of the spectrum.\n\nThe solution has been designed with these requirements in mind to ensure long-term regulatory compliance and system security.",
    normativa_lpd:
      "Data protection (GDPR)\n\nThe proposed solution supports responsible processing of personal data, especially for video images, access logs and digital credentials.\n\nThe recommended architecture is designed to:\n\n- Minimise the amount of personal data stored.\n- Restrict access to data to authorised roles only (administrators, security, maintenance).\n- Facilitate compliance with the General Data Protection Regulation (GDPR) and local data protection laws.\n\nThe building owner and/or operator should define data retention policies, user information and procedures to exercise data subject rights (access, rectification, erasure, etc.), leveraging the technical capabilities of the solution.",
    normativa_ciber:
      "Cybersecurity and 2N security practices\n\n2N devices included in the solution are designed following industry best practices in cybersecurity, including:\n\n- Hardened embedded operating system, with no unnecessary services exposed.\n- Secure authentication and credentials management for administrators and users.\n- Support for encrypted communications (HTTPS / TLS) for management and, when applicable, for signalling.\n- Possibility to integrate into secure network infrastructures (VLANs, segmentation, firewalls, etc.).\n\nFurthermore, 2N is part of Axis group, which applies strict product security policies, vulnerability management and firmware lifecycle processes. This helps reduce the attack surface of the installation and supports the client’s internal cybersecurity policies.",
    otros:
      "If required, additional solutions can be added such as zoned access control, CCTV integration, visitor management or common area booking systems.",
  },
  pt: {
    resumen:
      "O presente documento descreve a solução proposta de videoporteiro IP e controlo de acessos para o projeto {{NOMBRE_PROYECTO}}, promovido por {{PROMOTORA}}. A solução foi concebida para oferecer uma experiência de acesso segura, cómoda e escalável para {{NUM_VIVIENDAS}} fracções e respetivas zonas comuns.",
    sistema:
      "A solução baseia-se num sistema de videoporteiro IP totalmente distribuído, com dispositivos 2N ligados através de rede Ethernet. O sistema permite a gestão de chamadas de acesso, controlo de portas, integração com aplicação móvel e, opcionalmente, com sistemas de domótica e PMS, garantindo elevada disponibilidade e flexibilidade.",
    equipos:
      "A solução inclui os seguintes equipamentos principais:\n\n{{LISTADO_EQUIPOS}}\n\nCada equipamento fue selecionado para cumprir os requisitos de desenho, funcionalidade e durabilidade do projeto.",
    infraestructura:
      "Toda a infraestrutura de comunicações assenta numa rede IP com cablagem estruturada, bastidores de comunicações e electrónica de rede gerida. O desenho contempla caminhos redundantes, alimentação adequada (PoE quando aplicável) e capacidade de reserva para futuras ampliações.",
    servicios:
      "A solução pode ser complementada com serviços cloud para gestão remota, abertura de portas através de aplicação móvel, atualizações de firmware e monitorização do sistema. Estes serviços melhoram a experiência do utilizador final e facilitam a manutenção preventiva.",
    normativa_red:
      "Norma RED (Radio Equipment Directive) – 1 de agosto de 2025\n\nTodos os equipamentos de comunicações incluídos na solução cumprem a Diretiva RED (2014/53/EU) e os requisitos de cibersegurança que se tornam obrigatórios a partir de 1 de agosto de 2025. Os dispositivos 2N incorporam as medidas necessárias em termos de cibersegurança, gestão do espectro radioeléctrico e segurança do utilizador, incluindo:\n\n- Gestão segura de firmware e atualizações remotas.\n- Mecanismos de proteção contra acessos não autorizados.\n- Conformidade com os requisitos essenciais de segurança, compatibilidade eletromagnética e utilização eficiente do espectro.\n\nA solução foi desenhada tendo em conta estes requisitos para garantir segurança e conformidade normativa a longo prazo.",
    normativa_lpd:
      "Proteção de dados (RGPD)\n\nA solução proposta permite um tratamento responsável dos dados pessoais, em especial no que respeita a imagens de vídeo, registos de acesso e credenciais digitais.\n\nA arquitetura recomendada foi concebida para:\n\n- Minimizar a quantidade de dados pessoais armazenados.\n- Restringir o acesso aos dados a perfis autorizados (administradores, segurança, manutenção).\n- Facilitar o cumprimento do Regulamento Geral de Proteção de Dados (RGPD) e da legislação local em matéria de proteção de dados.\n\nRecomenda-se que a propriedade e/ou a entidade gestora do edifício definam políticas de conservação de dados, informação ao utilizador e exercício de direitos (acesso, retificação, apagamento, etc.), tirando partido das capacidades técnicas da solução.",
    normativa_ciber:
      "Cibersegurança e práticas de segurança 2N\n\nOs dispositivos 2N incluídos na solução são desenhados seguindo boas práticas de cibersegurança, incluindo:\n\n- Sistema operativo embebido reforçado, sem serviços desnecessários expostos.\n- Autenticação segura e gestão de credenciais para administradores e utilizadores.\n- Suporte de comunicações cifradas (HTTPS / TLS) para gestão e, quando aplicável, para sinalização.\n- Possibilidade de integração em infraestruturas de rede seguras (VLAN, segmentação, firewalls, etc.).\n\nAdicionalmente, a 2N faz parte do grupo Axis, que aplica políticas rigorosas de segurança de produto, gestão de vulnerabilidades e ciclo de vida de firmware. Isto contribui para reduzir a superfície de ataque da instalação e para facilitar o cumprimento das políticas internas de cibersegurança do cliente.",
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
    (presupuesto && presupuesto.nombreProyecto) ||
    "el proyecto";

  const promotora =
    proyecto.promotora ||
    proyecto.cliente ||
    (presupuesto && presupuesto.cliente) ||
    "la propiedad";

  let numViviendas =
    proyecto.numViviendas ||
    proyecto.viviendas ||
    (presupuesto && presupuesto.numViviendas) ||
    null;

  if (!numViviendas && Array.isArray(proyecto.filas)) {
    numViviendas = proyecto.filas.length;
  }

  return {
    "{{NOMBRE_PROYECTO}}": nombreProyecto,
    "{{PROMOTORA}}": promotora,
    "{{NUM_VIVIENDAS}}": numViviendas ? String(numViviendas) : "las viviendas",
    "{{LISTADO_EQUIPOS}}": buildListadoEquiposTexto(
      appState.documentacion.idioma
    ),
  };
}

function buildListadoEquiposTexto(idioma) {
  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

  const lineas = Array.isArray(presupuesto && presupuesto.lineas)
    ? presupuesto.lineas
    : [];

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
      idx: idx,
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
    partes.push("- " + cat + ":");
    grupos[cat].forEach((item) => {
      partes.push(
        "   • " +
          (item.ref ? item.ref + " – " : "") +
          item.desc +
          " (x" +
          item.qty +
          ")"
      );
    });
    partes.push("");
  });

  return partes.join("\n");
}

function applyTokensToTemplate(template, tokens) {
  let out = template || "";
  Object.keys(tokens).forEach((key) => {
    out = out.split(key).join(tokens[key]); // replaceAll compatible
  });
  return out;
}

// Escapar HTML para títulos en el overlay de imagen
function docEscapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  saveDocStateToLocalStorage();
}

// ===========================
// RENDER PRINCIPAL
// ===========================

async function renderDocumentacionView() {
  const container = getDocAppContent();
  if (!container) return;

  if (!appState.documentacion.ultimaAutoGen) {
    autoGenerateDocumentacion(appState.documentacion.idioma || "es");
  }

  // Aseguramos la carga de media ANTES de pintar
  await ensureDocMediaLoaded();

  const idiomaActual = appState.documentacion.idioma || "es";
  const modoActual = appState.documentacion.modo || "comercial";

  container.innerHTML =
    '<div class="doc-layout">' +
    '  <div class="doc-header card">' +
    '    <div class="card-header">' +
    '      <div>' +
    '        <div class="card-title">Documentación</div>' +
    '        <div class="card-subtitle">' +
    '          Genera la memoria de calidades de forma automática a partir del proyecto y la lista de materiales. Añade textos personalizados y documentación gráfica cuando lo necesites.' +
    "        </div>" +
    "      </div>" +
    "    </div>" +
    '    <div class="doc-toolbar">' +
    '      <div class="doc-lang-switch">' +
    Object.values(DOC_LANGS)
      .map(function (l) {
        var active = l.code === idiomaActual ? "btn-primary" : "btn-outline";
        return (
          '<button class="btn btn-sm ' +
          active +
          '" data-doc-lang="' +
          l.code +
          '">' +
          l.label +
          "</button>"
        );
      })
      .join("") +
    "      </div>" +
    '      <div class="doc-actions">' +
    '        <div class="doc-mode-switch">' +
    '          <button class="btn btn-sm ' +
    (modoActual === "comercial" ? "btn-primary" : "btn-outline") +
    '" id="docModoComercialBtn">🧑‍💼 Comercial</button>' +
    '          <button class="btn btn-sm ' +
    (modoActual === "tecnica" ? "btn-primary" : "btn-outline") +
    '" id="docModoTecnicoBtn">🧑‍🔬 Técnica</button>' +
    "        </div>" +
    '        <button class="btn btn-sm" id="docRegenerarBtn">🔁 Regenerar contenido automático</button>' +
    '        <button class="btn btn-sm" id="docNuevoBloqueBtn">✏️ Añadir texto personalizado</button>' +
    '        <button class="btn btn-sm btn-primary" id="docExportarBtn">📄 Exportar PDF</button>' +
    "      </div>" +
    "    </div>" +
    "  </div>" +
    '  <div class="doc-main">' +
    '    <div class="doc-sections">' +
    renderDocSectionsHTML() +
    "    </div>" +
    '    <aside class="doc-side">' +
    '      <div class="card">' +
    '        <div class="card-header doc-media-header">' +
    "          <div>" +
    '            <div class="card-title">Fichas técnicas</div>' +
    '            <div class="card-subtitle">' +
    "              Selecciona las fichas técnicas y documentación gráfica desde la biblioteca." +
    "              La subida de archivos se realiza en <strong>Gestión de documentación</strong>." +
    "            </div>" +
    "          </div>" +
    "        </div>" +
    '        <div class="doc-side-body">' +
    renderDocFichasHTML() +
    '          <hr style="margin:0.75rem 0;" />' +
    '          <div class="card-subtitle" style="margin-bottom:0.35rem;">' +
    "            Documentación gráfica (imágenes)" +
    "          </div>" +
    '          <div class="form-group mb-2">' +
    '            <input type="text" id="docMediaSearchInput" class="form-control" placeholder="Buscar por nombre o carpeta..." value="' +
    (appState.documentacion.mediaSearchTerm || "") +
    '" />' +
    "          </div>" +
    '          <div class="doc-media-body">' +
    renderDocMediaLibraryHTML() +
    "          </div>" +
    "        </div>" +
    "      </div>" +
    "    </aside>" +
    "  </div>" +
    '  <div id="docCustomModal" class="doc-modal hidden">' +
    '    <div class="doc-modal-content card">' +
    '      <div class="card-header">' +
    '        <div class="card-title">Añadir texto a la memoria</div>' +
    '        <div class="card-subtitle">Elige sección e introduce el contenido personalizado.</div>' +
    "      </div>" +
    '      <div class="card-body">' +
    '        <div class="form-group mb-2">' +
    "          <label>Sección destino</label>" +
    '          <select id="docCustomSectionSelect" class="form-control">' +
    DOC_SECTION_ORDER.map(function (key) {
      return (
        '<option value="' + key + '">' + labelForSection(key) + "</option>"
      );
    }).join("") +
    "          </select>" +
    "        </div>" +
    '        <div class="form-group mb-3">' +
    "          <label>Texto a añadir</label>" +
    '          <textarea id="docCustomText" class="form-control" rows="6" placeholder="Escribe aquí el párrafo o bloque que quieras añadir a la memoria..."></textarea>' +
    "        </div>" +
    "      </div>" +
    '      <div class="card-footer doc-modal-footer">' +
    '        <button class="btn btn-sm" id="docCustomCancelBtn">Cancelar</button>' +
    '        <button class="btn btn-sm btn-primary" id="docCustomSaveBtn">Añadir a la memoria</button>' +
    "      </div>" +
    "    </div>" +
    "  </div>" +
    '  <div id="docModalBackdrop" class="doc-backdrop hidden"></div>' +
    "</div>";

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
  const map = appState.documentacion.includedSections || {};
  if (typeof map[key] === "boolean") return map[key];
  // Por defecto, todas incluidas
  return true;
}

function renderSectionMediaHTML(sectionKey) {
  const mediaMap = {};
  (appState.documentacion.mediaLibrary || []).forEach(function (m) {
    if (m && m.id) mediaMap[m.id] = m;
  });

  const ids =
    (appState.documentacion.sectionMedia &&
      appState.documentacion.sectionMedia[sectionKey]) ||
    [];

  if (!ids.length) return "";

  return ids
    .map(function (id) {
      const m = mediaMap[id];
      if (!m) return "";

      const cat = (m.docCategory || "").toLowerCase();
      const mime = (m.mimeType || "").toLowerCase();

      const isImage =
        cat === "imagen" ||
        m.type === "image" ||
        mime.indexOf("image/") === 0;

      const icon = isImage ? "" : "📄";
      const caption = m.nombre || "";
      const tag =
        cat === "ficha"
          ? "Ficha técnica"
          : cat === "imagen"
          ? "Imagen"
          : "";

      return (
        '<div class="doc-section-media-chip">' +
        '  <div class="doc-section-media-thumb">' +
        (isImage && m.url
          ? '<img src="' + m.url + '" alt="' + caption + '" />'
          : '<div class="doc-section-media-icon">' + icon + "</div>") +
        "  </div>" +
        '  <div class="doc-section-media-foot">' +
        '    <div class="doc-section-media-caption-wrap">' +
        '      <span class="doc-section-media-caption">' +
        caption +
        "</span>" +
        (tag
          ? '<span class="doc-section-media-tag">' + tag + "</span>"
          : "") +
        "    </div>" +
        '    <button type="button" class="doc-section-media-remove" data-remove-media-id="' +
        id +
        '" title="Quitar de la sección">✕</button>' +
        "  </div>" +
        "</div>"
      );
    })
    .join("");
}

function renderDocSectionsHTML() {
  const secciones = appState.documentacion.secciones || {};
  return DOC_SECTION_ORDER.map(function (key) {
    const contenido = secciones[key] || "";
    const included = getSectionIncluded(key);
    return (
      '<div class="card doc-section-card" data-doc-section="' +
      key +
      '">' +
      '  <div class="card-header">' +
      '    <div class="card-title">' +
      labelForSection(key) +
      "</div>" +
      '    <div class="doc-section-header-actions">' +
      '      <label class="doc-section-include-toggle" style="font-size:0.75rem;display:flex;align-items:center;gap:0.25rem;margin-right:0.5rem;">' +
      '        <input type="checkbox" data-doc-section-enable="' +
      key +
      '"' +
      (included ? " checked" : "") +
      ' />' +
      "        Incluir en PDF" +
      "      </label>" +
      '      <button type="button" class="btn btn-xs btn-outline" data-doc-ai-section="' +
      key +
      '" title="Preguntar a IA para mejorar o completar el texto">✨ Preguntar a IA</button>' +
      "    </div>" +
      "  </div>" +
      '  <div class="card-body">' +
      '    <textarea class="form-control doc-section-textarea" data-doc-section-text="' +
      key +
      '" rows="8">' +
      contenido +
      "</textarea>" +
      '    <div class="doc-section-media-drop" data-doc-section-drop="' +
      key +
      '">' +
      '      <div class="doc-section-media-items">' +
      renderSectionMediaHTML(key) +
      "      </div>" +
      '      <div class="doc-section-media-hint">' +
      "        Arrastra aquí imágenes o documentos desde la columna derecha para adjuntarlos a esta sección." +
      "      </div>" +
      "    </div>" +
      "  </div>" +
      "</div>"
    );
  }).join("");
}

// ===========================
// FICHAS TÉCNICAS (solo biblioteca)
// ===========================

function renderDocFichasHTML() {
  const media = appState.documentacion.mediaLibrary || [];

  const fichasMedia = media.filter(function (m) {
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

  const selIds = new Set(appState.documentacion.selectedFichasMediaIds || []);

  if (!fichasMedia.length) {
    return (
      '<div class="doc-fichas-section">' +
      '  <p class="text-muted" style="font-size:0.8rem;">' +
      "    Todavía no hay fichas técnicas en la biblioteca de documentación." +
      "    Súbelas desde <strong>Gestión de documentación</strong>." +
      "  </p>" +
      "</div>"
    );
  }

  const term = (appState.documentacion.fichasSearchTerm || "")
    .trim()
    .toLowerCase();

  const filtered = term
    ? fichasMedia.filter(function (m) {
        const txt =
          (m.nombre || "") +
          " " +
          (m.folderName || "") +
          " " +
          (m.docCategory || "");
        return txt.toLowerCase().indexOf(term) !== -1;
      })
    : fichasMedia;

  if (!filtered.length) {
    return (
      '<div class="doc-fichas-section">' +
      '  <div class="doc-fichas-block">' +
      '    <div class="doc-fichas-title">Fichas técnicas de biblioteca</div>' +
      '    <p class="doc-fichas-help">' +
      "      Selecciona las fichas técnicas y documentos que quieres anexar a la memoria." +
      "    </p>" +
      '    <div class="form-group mb-2">' +
      '      <input type="text" id="docFichasSearchInput" class="form-control" placeholder="Buscar por nombre o carpeta..." value="' +
      (appState.documentacion.fichasSearchTerm || "") +
      '" />' +
      "    </div>" +
      '    <p class="text-muted" style="font-size:0.8rem;">' +
      "      No se han encontrado fichas que coincidan con la búsqueda." +
      "    </p>" +
      "  </div>" +
      "</div>"
    );
  }

  const listHTML = filtered
    .map(function (m) {
      const checked = selIds.has(m.id) ? "checked" : "";
      const mainLabel = m.folderName
        ? "<strong>" + m.folderName + "</strong> – " + m.nombre
        : "<strong>" + m.nombre + "</strong>";
      return (
        '<label class="doc-ficha-item">' +
        '  <input type="checkbox" data-doc-ficha-media-id="' +
        m.id +
        '" ' +
        checked +
        " />" +
        '  <span class="doc-ficha-main">' +
        mainLabel +
        "</span>" +
        "</label>"
      );
    })
    .join("");

  return (
    '<div class="doc-fichas-section">' +
    '  <div class="doc-fichas-block">' +
    '    <div class="doc-fichas-title">Fichas técnicas de biblioteca</div>' +
    '    <p class="doc-fichas-help">' +
    "      Selecciona las fichas técnicas y documentos que quieres anexar a la memoria." +
    "    </p>" +
    '    <div class="form-group mb-2">' +
    '      <input type="text" id="docFichasSearchInput" class="form-control" placeholder="Buscar por nombre o carpeta..." value="' +
    (appState.documentacion.fichasSearchTerm || "") +
    '" />' +
    "    </div>" +
    '    <div class="doc-fichas-list doc-fichas-media-list">' +
    listHTML +
    "    </div>" +
    "  </div>" +
    "</div>"
  );
}

// ===========================
// LIMPIEZA Y DOCUMENTACIÓN GRÁFICA (solo imágenes)
// ===========================

function cleanInvalidMediaItems() {
  const list = appState.documentacion.mediaLibrary || [];
  const cleaned = list.filter(function (m) {
    return m && m.id && typeof m.id === "string" && m.id.trim() !== "";
  });
  if (cleaned.length !== list.length) {
    appState.documentacion.mediaLibrary = cleaned;
  }
}

function renderDocMediaLibraryHTML() {
  const allMedia = appState.documentacion.mediaLibrary || [];
  console.log(
    "[DOC] renderDocMediaLibraryHTML – total items:",
    allMedia.length,
    allMedia
  );

  if (!allMedia.length) {
    return `
      <p class="text-muted" style="font-size:0.85rem;">
        Todavía no has subido documentación gráfica.
        Sube los archivos desde <strong>Gestión de documentación</strong>.
      </p>
    `;
  }

  // saneamos por si hay registros antiguos rotos
  cleanInvalidMediaItems();

  // Nos quedamos solo con IMÁGENES (robusto para registros viejos de Storage)
  const images = (appState.documentacion.mediaLibrary || []).filter(function (
    m
  ) {
    if (!m || !m.id) return false;

    const cat = (m.docCategory || "").toLowerCase();
    const mime = (m.mimeType || "").toLowerCase();
    const type = (m.type || "").toLowerCase();
    const urlRaw = (m.url || "").split("?")[0]; // quitamos query de Storage
    const url = urlRaw.toLowerCase();
    const storagePath = (m.storagePath || "").toLowerCase();
    const name = (m.nombre || "").toLowerCase();

    const isCatImage =
      cat === "imagen" || cat === "image" || cat === "img" || cat === "foto";
    const isMimeImage = mime.indexOf("image/") === 0;
    const isTypeImage = type === "image";

    const hasImageExt = function (s) {
      return (
        s.endsWith(".png") ||
        s.endsWith(".jpg") ||
        s.endsWith(".jpeg") ||
        s.endsWith(".webp") ||
        s.endsWith(".gif")
      );
    };

    const isByPathOrName =
      hasImageExt(url) || hasImageExt(storagePath) || hasImageExt(name);

    return isCatImage || isMimeImage || isTypeImage || isByPathOrName;
  });

  console.log("[DOC] renderDocMediaLibraryHTML – images:", images.length);

  if (!images.length) {
    return `
      <p class="text-muted" style="font-size:0.85rem;">
        No se han encontrado imágenes en la biblioteca de documentación.
        Sube nuevas imágenes desde <strong>Gestión de documentación</strong>.
      </p>
    `;
  }

  const term = (appState.documentacion.mediaSearchTerm || "")
    .trim()
    .toLowerCase();

  const filtered = term
    ? images.filter(function (m) {
        const txt =
          (m.nombre || "") +
          " " +
          (m.folderName || "") +
          " " +
          (m.docCategory || "");
        return txt.toLowerCase().indexOf(term) !== -1;
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
        .map(function (m) {
          const captionText = m.folderName
            ? m.folderName + " – " + m.nombre
            : m.nombre;

          return `
            <div class="doc-media-item doc-media-row"
                 draggable="true"
                 data-media-id="${m.id}">
              <div class="doc-media-row-main">
                <span class="doc-media-row-icon">🖼️</span>
                <span class="doc-media-caption">
                  ${captionText}
                </span>
              </div>
              <div class="doc-media-row-actions">
                <button
                  type="button"
                  class="btn btn-xs"
                  data-media-view-id="${m.id}"
                  title="Ver imagen"
                >
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

// ===========================
// REFRESH PARCIAL DEL GRID MEDIA
// ===========================

function refreshDocMediaGridOnly() {
  const container = getDocAppContent();
  if (!container) return;
  const body = container.querySelector(".doc-media-body");
  if (!body) return;
  body.innerHTML = renderDocMediaLibraryHTML();
  attachDocMediaGridHandlers(container);
}

// ===========================
// OVERLAY FLOTANTE PARA IMÁGENES
// ===========================

function openDocImageFloatingPreview(item) {
  if (!item || !item.url) {
    console.warn("[DOC] openDocImageFloatingPreview sin url", item);
    alert("No se ha encontrado la URL de la imagen para previsualizarla.");
    return;
  }

  const existing = document.getElementById("docMediaFloatingPreview");
  if (existing) existing.remove();

  const title =
    item.folderName && item.nombre
      ? item.folderName + " – " + item.nombre
      : item.nombre || "Imagen";

  const overlay = document.createElement("div");
  overlay.id = "docMediaFloatingPreview";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.65)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "2147483647";

  overlay.innerHTML =
    '<div style="position:relative;max-width:90vw;max-height:90vh;background:#111827;padding:12px;border-radius:12px;box-shadow:0 15px 40px rgba(0,0,0,0.6);display:flex;flex-direction:column;">' +
    '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;">' +
    '    <div style="color:#e5e7eb;font-size:0.9rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70vw;">' +
    docEscapeHtml(title) +
    "</div>" +
    '    <button type="button" id="docMediaFloatingCloseBtn" style="border:none;background:#374151;color:#f9fafb;border-radius:999px;padding:4px 10px;font-size:0.8rem;cursor:pointer;">✕ Cerrar</button>' +
    "  </div>" +
    '  <div style="flex:1;display:flex;align-items:center;justify-content:center;">' +
    '    <img src="' +
    item.url +
    '" alt="' +
    docEscapeHtml(title) +
    '" style="max-width:86vw;max-height:80vh;object-fit:contain;border-radius:6px;background:#000;" />' +
    "  </div>" +
    "</div>";

  document.body.appendChild(overlay);

  const close = function () {
    overlay.remove();
  };

  const closeBtn = document.getElementById("docMediaFloatingCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", close);

  overlay.addEventListener("click", function (ev) {
    if (ev.target === overlay) close();
  });
}

// ===========================
// HANDLERS
// ===========================

function attachDocumentacionHandlers() {
  const container = getDocAppContent();
  if (!container) return;

  const backdrop = document.getElementById("docModalBackdrop");

  // Buscador de imágenes
  const searchInput = container.querySelector("#docMediaSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      appState.documentacion.mediaSearchTerm = searchInput.value || "";
      saveDocStateToLocalStorage();
      refreshDocMediaGridOnly();
    });
  }

  // Buscador de fichas técnicas
  const fichasSearchInput = container.querySelector("#docFichasSearchInput");
  if (fichasSearchInput) {
    fichasSearchInput.addEventListener("input", function () {
      appState.documentacion.fichasSearchTerm = fichasSearchInput.value || "";
      saveDocStateToLocalStorage();
      renderDocumentacionView();
    });
  }

  // Idiomas
  container.querySelectorAll("[data-doc-lang]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const lang = btn.getAttribute("data-doc-lang") || "es";
      autoGenerateDocumentacion(lang);
      renderDocumentacionView();
    });
  });

  // Modo comercial / técnico
  const modoComBtn = container.querySelector("#docModoComercialBtn");
  const modoTecBtn = container.querySelector("#docModoTecnicoBtn");
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

  // Regenerar automático
  const regenBtn = container.querySelector("#docRegenerarBtn");
  if (regenBtn) {
    regenBtn.addEventListener("click", function () {
      autoGenerateDocumentacion(appState.documentacion.idioma || "es");
      renderDocumentacionView();
    });
  }

  // Textareas de secciones
  container.querySelectorAll(".doc-section-textarea").forEach(function (ta) {
    ta.addEventListener("input", function () {
      const secKey = ta.getAttribute("data-doc-section-text");
      if (!secKey) return;
      appState.documentacion.secciones =
        appState.documentacion.secciones || {};
      appState.documentacion.secciones[secKey] = ta.value;
      saveDocStateToLocalStorage();
    });
  });

  // Checkbox incluir sección en PDF
  container
    .querySelectorAll("[data-doc-section-enable]")
    .forEach(function (chk) {
      chk.addEventListener("change", function () {
        const key = chk.getAttribute("data-doc-section-enable");
        if (!key) return;
        appState.documentacion.includedSections =
          appState.documentacion.includedSections || {};
        appState.documentacion.includedSections[key] = chk.checked;
        saveDocStateToLocalStorage();
      });
    });

  // Botón IA por sección
  container.querySelectorAll("[data-doc-ai-section]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const sectionKey = btn.getAttribute("data-doc-ai-section");
      if (!sectionKey) return;
      askAIForSection(sectionKey);
    });
  });

  // Checkboxes de fichas técnicas
  container
    .querySelectorAll("[data-doc-ficha-media-id]")
    .forEach(function (chk) {
      chk.addEventListener("change", function () {
        const id = chk.getAttribute("data-doc-ficha-media-id");
        if (!id) return;
        const list = appState.documentacion.selectedFichasMediaIds || [];
        const pos = list.indexOf(id);
        if (chk.checked) {
          if (pos === -1) list.push(id);
        } else {
          if (pos !== -1) list.splice(pos, 1);
        }
        appState.documentacion.selectedFichasMediaIds = list;
        saveDocStateToLocalStorage();
      });
    });

  // Drag & drop en secciones
  container.querySelectorAll("[data-doc-section-drop]").forEach(function (zone) {
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
      const mediaId = ev.dataTransfer && ev.dataTransfer.getData("text/plain");
      const sectionKey = zone.getAttribute("data-doc-section-drop");
      if (!mediaId || !sectionKey) return;
      attachMediaToSection(sectionKey, mediaId);
    });
  });

  // Quitar media de sección
  container
    .querySelectorAll(".doc-section-media-remove")
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        const mediaId = btn.getAttribute("data-remove-media-id");
        const zone = btn.closest("[data-doc-section-drop]");
        const sectionKey = zone
          ? zone.getAttribute("data-doc-section-drop")
          : null;
        if (!mediaId || !sectionKey) return;
        detachMediaFromSection(sectionKey, mediaId);
      });
    });

  // Grid de media (drag, ver)
  attachDocMediaGridHandlers(container);

  // Nuevo bloque custom
  const nuevoBloqueBtn = container.querySelector("#docNuevoBloqueBtn");
  if (nuevoBloqueBtn) {
    nuevoBloqueBtn.addEventListener("click", openDocCustomModal);
  }

  // Exportar PDF
  const exportBtn = container.querySelector("#docExportarBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", function () {
      exportarDocumentacionPDF().catch(function (err) {
        console.error("Error exportando PDF documentación:", err);
      });
    });
  }

  // Modal custom
  const customModal = document.getElementById("docCustomModal");
  const customCancelBtn =
    customModal && customModal.querySelector("#docCustomCancelBtn");
  const customSaveBtn =
    customModal && customModal.querySelector("#docCustomSaveBtn");

  if (customCancelBtn && customModal && backdrop) {
    customCancelBtn.addEventListener("click", function () {
      customModal.classList.add("hidden");
      backdrop.classList.add("hidden");
    });
  }

  if (customSaveBtn) {
    customSaveBtn.addEventListener("click", saveDocCustomBlock);
  }

  if (backdrop) {
    backdrop.addEventListener("click", function () {
      const customModal2 = document.getElementById("docCustomModal");
      if (customModal2) customModal2.classList.add("hidden");
      backdrop.classList.add("hidden");
    });
  }
}

// Handlers solo del grid de documentación gráfica
function attachDocMediaGridHandlers(root) {
  const container = root || getDocAppContent();
  if (!container) return;

  container.querySelectorAll(".doc-media-item").forEach(function (item) {
    item.addEventListener("dragstart", function (ev) {
      const id = item.getAttribute("data-media-id");
      if (!id || !ev.dataTransfer) return;
      ev.dataTransfer.setData("text/plain", id);
      ev.dataTransfer.effectAllowed = "copy";
    });
  });

  container.querySelectorAll("[data-media-view-id]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-media-view-id");
      if (!id) return;

      const item =
        (appState.documentacion.mediaLibrary || []).find(function (m) {
          return m.id === id;
        }) || null;

      if (!item || !item.url) {
        alert(
          "No se ha encontrado la imagen en la biblioteca o falta la URL.\nRevisa la consola para más detalles."
        );
        return;
      }

      const cat = (item.docCategory || "").toLowerCase();
      const mime = (item.mimeType || "").toLowerCase();
      const type = (item.type || "").toLowerCase();
      const urlRaw = (item.url || "").split("?")[0];
      const url = urlRaw.toLowerCase();

      const isImageByMime = mime.indexOf("image/") === 0;
      const isImageByType = type === "image";
      const isImageByExt =
        url.endsWith(".png") ||
        url.endsWith(".jpg") ||
        url.endsWith(".jpeg") ||
        url.endsWith(".webp") ||
        url.endsWith(".gif");

      const isImage =
        cat === "imagen" ||
        cat === "image" ||
        isImageByMime ||
        isImageByType ||
        isImageByExt;

      if (isImage) {
        openDocImageFloatingPreview(item);
      } else {
        window.open(item.url, "_blank");
      }
    });
  });
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
    text: text,
    ts: new Date().toISOString(),
  });

  saveDocStateToLocalStorage();
  closeDocCustomModal();
  renderDocumentacionView();
}

// ===========================
// IA POR SECCIÓN (HOOK)
// ===========================

async function askAIForSection(sectionKey) {
  const idioma = appState.documentacion.idioma || "es";
  const secciones = appState.documentacion.secciones || {};
  const textoActual = secciones[sectionKey] || "";
  const proyecto = appState.proyecto || {};
  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

  if (typeof window.handleDocSectionAI === "function") {
    try {
      const nuevoTexto = await window.handleDocSectionAI({
        sectionKey: sectionKey,
        idioma: idioma,
        texto: textoActual,
        proyecto: proyecto,
        presupuesto: presupuesto,
      });
      if (typeof nuevoTexto === "string" && nuevoTexto.trim()) {
        appState.documentacion.secciones[sectionKey] = nuevoTexto;
        saveDocStateToLocalStorage();
        renderDocumentacionView();
      }
      return;
    } catch (e) {
      console.error("Error en handleDocSectionAI:", e);
      alert(
        "Se ha producido un error al llamar a la IA. Revisa la consola para más detalles."
      );
      return;
    }
  }

  alert(
    "Función de IA no configurada.\n\n" +
      "Para activar 'Preguntar a IA', implementa en tu código:\n\n" +
      "window.handleDocSectionAI = async ({ sectionKey, idioma, texto, proyecto, presupuesto }) => {\n" +
      "  // Llama a tu backend / Cloud Function con OpenAI, etc.\n" +
      "  return textoMejorado;\n" +
      "};"
  );
}

// ===========================
// MEDIA: FIRESTORE + STORAGE
// ===========================

async function ensureDocMediaLoaded() {
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

    const snap = await query.limit(200).get();

    const media = [];
    snap.forEach((doc) => {
      // IMPORTANTE: primero data, luego id para NO machacar el id correcto
      media.push({ ...doc.data(), id: doc.id });
    });

    console.log("[DOC] Media cargada desde Firestore:", media.length, "items");

    appState.documentacion.mediaLibrary = media;
    appState.documentacion.mediaLoaded = true;
  } catch (e) {
    console.error("Error cargando documentación gráfica:", e);
    appState.documentacion.mediaLoaded = false;
  }
}

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

async function saveMediaFileToStorageAndFirestore(file, options) {
  options = options || {};
  const name = file.name || "archivo";
  const nowIso = new Date().toISOString();
  const isImage = file.type && file.type.indexOf("image/") === 0;
  const type = isImage ? "image" : "file";

  const folderName = options.folderName || "";
  const docCategory = options.docCategory || "imagen";
  const folderSlug = slugifyFolderName(folderName);

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
    storagePath =
      "documentacion_media/" +
      (uid || "anon") +
      "/" +
      folderSlug +
      "/" +
      (Date.now() + "_" + name);
    const ref = storage.ref().child(storagePath);
    await ref.put(file);
    url = await ref.getDownloadURL();
  } else {
    url = URL.createObjectURL(file);
  }

  // OJO: no incluimos id aquí; solo en cliente
  const mediaData = {
    nombre: name,
    type: type,
    mimeType: file.type,
    url: url,
    storagePath: storagePath,
    uploadedAt: nowIso,
    folderName: folderName || null,
    docCategory: docCategory,
  };

  if (db) {
    const docRef = await db.collection("documentacion_media").add({
      ...mediaData,
      uid: uid || null,
    });
    mediaData.id = docRef.id; // id solo en el objeto local
  } else {
    mediaData.id =
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 8);
  }

  return mediaData;
}

// Borrar documento de Storage + Firestore + estado local
async function deleteMediaById(mediaId) {
  const mediaLib = appState.documentacion.mediaLibrary || [];
  const item = mediaLib.find(function (m) {
    return m.id === mediaId;
  });
  if (!item) return;

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

  if (storage && item.storagePath) {
    try {
      await storage.ref().child(item.storagePath).delete();
    } catch (e) {
      console.warn("No se pudo borrar en Storage (se continúa):", e);
    }
  }

  if (db) {
    try {
      await db.collection("documentacion_media").doc(mediaId).delete();
    } catch (e) {
      console.warn("No se pudo borrar en Firestore (se continúa):", e);
    }
  }

  appState.documentacion.mediaLibrary = mediaLib.filter(function (m) {
    return m.id !== mediaId;
  });

  const map = appState.documentacion.sectionMedia || {};
  Object.keys(map).forEach(function (sec) {
    const arr = map[sec] || [];
    map[sec] = arr.filter(function (id) {
      return id !== mediaId;
    });
  });
  appState.documentacion.sectionMedia = map;

  const sel = appState.documentacion.selectedFichasMediaIds || [];
  appState.documentacion.selectedFichasMediaIds = sel.filter(function (id) {
    return id !== mediaId;
  });

  saveDocStateToLocalStorage();
  renderDocumentacionView();
}

// ===========================
// IMÁGENES DE DISPOSITIVOS
// ===========================

function getImagenRef(ref) {
  if (!ref) return null;
  const clean = String(ref).trim().toUpperCase();
  if (window.DOC_IMAGENES_POR_REF && window.DOC_IMAGENES_POR_REF[clean]) {
    return window.DOC_IMAGENES_POR_REF[clean];
  }
  return "img/devices/" + clean + ".png";
}

// Carga imagen, la limita a una resolución máxima y devuelve dataUrl + tamaño
function loadImageAsDataUrl(url) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = function () {
      try {
        const maxDim = 1200;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        const maxActual = Math.max(width, height);
        const scale = maxActual > maxDim ? maxDim / maxActual : 1;

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Usamos PNG para preservar transparencias (logo sin fondo negro)
        const dataUrl = canvas.toDataURL("image/png");
        resolve({
          dataUrl: dataUrl,
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

// ===========================
// LOGO PARA PDF
// ===========================

async function getDocLogoImage() {
  const state = appState.documentacion;
  if (state.logoData) return state.logoData;

  const url =
    (window.DOC_LOGO_URL && String(window.DOC_LOGO_URL)) ||
    DOC_LOGO_DEFAULT_URL;

  try {
    const obj = await loadImageAsDataUrl(url);
    state.logoData = obj;
    return obj;
  } catch (e) {
    console.warn("No se pudo cargar el logo para PDF:", e);
    state.logoData = null;
    return null;
  }
}

function getDocPageDimensions(pdf) {
  const size = pdf.internal.pageSize;
  const width =
    typeof size.getWidth === "function" ? size.getWidth() : size.width;
  const height =
    typeof size.getHeight === "function" ? size.getHeight() : size.height;
  return { width: width, height: height };
}

// ===== CABECERA / PIE PÁGINAS TÉCNICAS =====

function drawTechHeader(pdf, opts) {
  const dims = getDocPageDimensions(pdf);
  const w = dims.width;
  const nombreProyecto = opts.nombreProyecto || "Proyecto";
  const logo = opts.logo || null;

  const marginX = 20;
  const textY = 18; // altura del texto

  // Calculamos la parte baja del logo para poner la línea SIEMPRE por debajo
  let logoBottomY = textY;

  if (logo && logo.dataUrl) {
    const ratio =
      logo.width && logo.height ? logo.width / logo.height : 2.5;
    const logoW = 25; // mm
    const logoH = logoW / ratio;
    const logoX = w - marginX - logoW;
    const logoY = textY - 6; // ligeramente por encima del texto
    logoBottomY = logoY + logoH;

    try {
      pdf.addImage(logo.dataUrl, "PNG", logoX, logoY, logoW, logoH);
    } catch (e) {
      console.warn("No se pudo dibujar logo en cabecera:", e);
    }
  }

  // Texto de cabecera
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(55, 65, 81);
  pdf.text(nombreProyecto, marginX, textY);

  // Línea por debajo del logo y del texto
  const lineY = Math.max(textY + 2, logoBottomY + 2);

  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(marginX, lineY, w - marginX, lineY);

  // Y de inicio de contenido
  return lineY + 8;
}

function drawTechFooter(pdf, opts) {
  const dims = getDocPageDimensions(pdf);
  const w = dims.width;
  const h = dims.height;
  const idioma = opts.idioma || "es";

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);

  let txt =
    "Solución IP de videoportero y control de accesos – 2N®";
  if (idioma === "en")
    txt = "IP video intercom & access control solution – 2N®";
  else if (idioma === "pt")
    txt = "Solução IP de videoporteiro e controlo de acessos – 2N®";

  pdf.text(txt, 20, h - 10);
}

function setupTechContentPage(pdf, opts) {
  const startY = drawTechHeader(pdf, opts);
  drawTechFooter(pdf, opts);
  return startY;
}

// ===========================
// MEDIA ASIGNADA A SECCIONES
// ===========================

function attachMediaToSection(sectionKey, mediaId) {
  appState.documentacion.sectionMedia =
    appState.documentacion.sectionMedia || {};
  const arr = appState.documentacion.sectionMedia[sectionKey] || [];
  if (arr.indexOf(mediaId) === -1) {
    arr.push(mediaId);
    appState.documentacion.sectionMedia[sectionKey] = arr;
  }
  saveDocStateToLocalStorage();
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
  saveDocStateToLocalStorage();
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

  if (modo === "tecnica") {
    await exportarPDFTecnico();
  } else {
    await exportarPDFComercial();
  }
}

// ===== Helpers imágenes por sección (modo técnico) =====

function getSectionImages(sectionKey) {
  const sectionMediaMap = appState.documentacion.sectionMedia || {};
  const mediaLib = appState.documentacion.mediaLibrary || [];

  const ids = sectionMediaMap[sectionKey] || [];

  const list = ids
    .map(function (id) {
      return mediaLib.find(function (m) {
        return m.id === id;
      });
    })
    .filter(function (m) {
      if (!m || !m.url) return false;
      const mime = (m.mimeType || "").toLowerCase();
      const type = (m.type || "").toLowerCase();
      return type === "image" || mime.indexOf("image/") === 0;
    });

  // Máximo 4 imágenes por sección
  return list.slice(0, 4);
}

async function insertImagesForSection(doc, sectionKey, y, onNewPage) {
  const images = getSectionImages(sectionKey);
  if (!images.length) return y;

  const dims = getDocPageDimensions(doc);
  const pageWidth = dims.width;
  const maxContentY = dims.height - 25; // margen inferior

  for (const m of images) {
    try {
      const obj = await loadImageAsDataUrl(m.url);
      const dataUrl = obj.dataUrl;
      const width = obj.width;
      const height = obj.height;
      const ratio = width && height ? width / height : 4 / 3;

      // Tamaño más pequeño (mitad de lo anterior) y centrado
      const maxWidthMm = 60;
      const maxHeightMm = 37.5;

      let imgW = maxWidthMm;
      let imgH = imgW / ratio;
      if (imgH > maxHeightMm) {
        imgH = maxHeightMm;
        imgW = imgH * ratio;
      }

      const neededHeight = imgH + 8;
      if (y + neededHeight > maxContentY) {
        if (typeof onNewPage === "function") {
          y = onNewPage();
        } else {
          doc.addPage();
          y = 25;
        }
      }

      const imgX = (pageWidth - imgW) / 2; // CENTRADO
      const imgY = y;
      doc.addImage(dataUrl, "PNG", imgX, imgY, imgW, imgH);

      // Sin pie de imagen, sólo margen inferior
      y += imgH + 8;
    } catch (e) {
      console.warn("No se pudo insertar imagen de sección en PDF:", e);
    }
  }

  return y;
}

// ===== Versión técnica (memoria de calidades bonita) =====

async function exportarPDFTecnico() {
  const jsPDF = window.jspdf.jsPDF;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const idioma = appState.documentacion.idioma || "es";
  const secciones = appState.documentacion.secciones || {};
  const includedSections = appState.documentacion.includedSections || {};

  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;
  const proyecto = appState.proyecto || {};

  const nombreProyecto =
    proyecto.nombre ||
    proyecto.nombreProyecto ||
    (presupuesto && presupuesto.nombreProyecto) ||
    "Proyecto";

  const promotora =
    proyecto.promotora ||
    proyecto.cliente ||
    (presupuesto && presupuesto.cliente) ||
    "";

  const logo = await getDocLogoImage();
  const dims = getDocPageDimensions(doc);
  const pageWidth = dims.width;
  const pageHeight = dims.height;

    // ===== Portada con imagen de fondo (sin deformar) =====
  let tituloDoc = "Memoria de calidades";
  if (idioma === "en") tituloDoc = "Technical specification";
  if (idioma === "pt") tituloDoc = "Memória descritiva";

  try {
    const coverImg = await loadImageAsDataUrl(DOC_TECH_COVER_URL);
    if (coverImg && coverImg.dataUrl) {
      const imgWpx = coverImg.width || 1200;
      const imgHpx = coverImg.height || 800;
      const imgRatio = imgWpx / imgHpx;
      const pageRatio = pageWidth / pageHeight;

      let drawW, drawH, drawX, drawY;
      if (imgRatio > pageRatio) {
        // imagen más horizontal -> se ajusta a alto, se recorta por los lados
        drawH = pageHeight;
        drawW = drawH * imgRatio;
        drawX = (pageWidth - drawW) / 2;
        drawY = 0;
      } else {
        // imagen más vertical -> se ajusta a ancho, se recorta arriba/abajo
        drawW = pageWidth;
        drawH = drawW / imgRatio;
        drawX = 0;
        drawY = (pageHeight - drawH) / 2;
      }

      doc.addImage(coverImg.dataUrl, "PNG", drawX, drawY, drawW, drawH);
    }
  } catch (e) {
    console.warn("No se pudo cargar la imagen de portada técnica:", e);
  }

  // Gradiente inferior para mejorar legibilidad
  const gradHeight = 70;
  const gradStartY = pageHeight - gradHeight;
  for (let i = 0; i < 6; i++) {
    const stepY = gradStartY + (i * gradHeight) / 6;
    const stepH = gradHeight / 6 + 0.5;
    const shade = 255 - i * 8; // 255, 247, 239...
    doc.setFillColor(shade, shade, shade);
    doc.rect(0, stepY, pageWidth, stepH, "F");
  }

  // Banda blanca sólida inferior
  const panelHeight = 55;
  const panelY = pageHeight - panelHeight;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, panelY, pageWidth, panelHeight, "F");

  // Logo portada AHORA en la banda blanca, a la derecha
  if (logo && logo.dataUrl) {
    const ratio =
      logo.width && logo.height ? logo.width / logo.height : 2.5;
    const logoW = 40;
    const logoH = logoW / ratio;
    const logoX = pageWidth - 20 - logoW;
    const logoY = panelY + (panelHeight - logoH) / 2; // centrado vertical en la banda blanca
    try {
      doc.addImage(logo.dataUrl, "PNG", logoX, logoY, logoW, logoH);
    } catch (e) {
      console.warn("No se pudo dibujar logo en portada:", e);
    }
  }

  // Títulos y datos en negro, en la parte baja (subidos un poco)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  // SUBIMOS ligeramente el título para separarlo del pie
  doc.text(tituloDoc, 20, panelY + 14);

  const subTitulo = "Videoportero y control de accesos 2N";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(subTitulo, 20, panelY + 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  // Bloque de proyecto también un poco más arriba
  let y = panelY + 38;

  // Proyecto
  doc.setFont("helvetica", "bold");
  doc.text("Proyecto:", 20, y);
  doc.setFont("helvetica", "normal");
  let proyectoLines = doc.splitTextToSize(nombreProyecto, pageWidth - 60);
  doc.text(proyectoLines, 45, y);
  y += proyectoLines.length * 6 + 4;

  // Promotora / Propiedad (si existe)
  if (promotora) {
    doc.setFont("helvetica", "bold");
    doc.text("Promotor:", 20, y);
    doc.setFont("helvetica", "normal");
    const promLines = doc.splitTextToSize(promotora, pageWidth - 60);
    doc.text(promLines, 45, y);
    y += promLines.length * 6 + 4;
  }

  // Pie de portada
  drawTechFooter(doc, { idioma: idioma });

  // ===== Índice (página 2) =====
  doc.addPage();
  const tocPageNumber = doc.getNumberOfPages();
  doc.setPage(tocPageNumber);
  const tocStartY = setupTechContentPage(doc, {
    idioma: idioma,
    nombreProyecto: nombreProyecto,
    logo: logo,
  });

  const tocEntries = [];

  // ===== Cuerpo de memoria =====
  doc.addPage();
  let currentPage = doc.getNumberOfPages();
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

  function ensureSpace(linesCount) {
    const needed = linesCount * 5 + 12;
    if (y + needed > pageHeight - 25) {
      newPage();
    }
  }

  let firstSection = true;

  for (const key of DOC_SECTION_ORDER) {
    // Respetar el check "Incluir en PDF"
    if (includedSections.hasOwnProperty(key) && !includedSections[key]) {
      continue;
    }

    const contenido = (secciones[key] || "").trim();
    const hasImages = getSectionImages(key).length > 0;
    if (!contenido && !hasImages) continue;

    // Cada sección arranca en una página diferente
    if (!firstSection) {
      newPage();
    } else {
      firstSection = false;
    }

    const tituloSeccion = labelForSection(key);

    // Añadimos entrada al índice
    tocEntries.push({ title: tituloSeccion, page: currentPage });

    // Título sección
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175); // azul suave
    doc.text(tituloSeccion, 20, y);
    y += 4;

    // Línea fina bajo título
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(20, y, pageWidth - 20, y);
    y += 5;

    // Texto
    if (contenido) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      const textLines = doc.splitTextToSize(contenido, pageWidth - 40);

      // Gestión de saltos de página dentro de la sección
      let block = [];
      const maxLinesPerChunk = 35;
      for (let i = 0; i < textLines.length; i++) {
        block.push(textLines[i]);
        if (
          block.length === maxLinesPerChunk ||
          i === textLines.length - 1
        ) {
          ensureSpace(block.length);
          doc.text(block, 20, y);
          y += block.length * 5 + 4;
          block = [];
        }
      }
    }

    // Imágenes asociadas (centradas, sin pie)
    y = await insertImagesForSection(doc, key, y, newPage);
    y += 4;
  }

  // ===== Anexo de fichas técnicas (solo listado) =====
  const mediaLib = appState.documentacion.mediaLibrary || [];
  const selIds = appState.documentacion.selectedFichasMediaIds || [];
  const fichasMediaSeleccionadas = mediaLib.filter(function (m) {
    return selIds.indexOf(m.id) !== -1;
  });

  if (fichasMediaSeleccionadas.length > 0) {
    newPage();

    let tituloDocs = "Anexo – Fichas técnicas adjuntas";
    if (idioma === "en") tituloDocs = "Appendix – Technical documentation";
    if (idioma === "pt") tituloDocs = "Anexo – Documentação técnica";

    // Entrada en el índice
    tocEntries.push({ title: tituloDocs, page: currentPage });

    y = y || 25;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(tituloDocs, 20, y);
    y += 6;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(20, y, pageWidth - 20, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);

    fichasMediaSeleccionadas.forEach(function (m) {
      const extra = m.folderName ? " – " + m.folderName : "";
      const urlText = m.url ? " (" + m.url + ")" : "";
      const line = m.nombre + extra + urlText;
      const splitted = doc.splitTextToSize("• " + line, pageWidth - 40);
      ensureSpace(splitted.length);
      doc.text(splitted, 20, y);
      y += splitted.length * 4.8 + 2;
    });
  }

  // ===== Dibujar el índice en la página 2 =====
  doc.setPage(tocPageNumber);

  let yToc = tocStartY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Contenido", 20, yToc);
  yToc += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);

  tocEntries.forEach(function (entry, index) {
    if (yToc > pageHeight - 25) {
      // Si se llenara la página de índice, creamos otra
      doc.addPage();
      const newTocPage = doc.getNumberOfPages();
      doc.setPage(newTocPage);
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

    const label = entry.title;
    const pageStr = String(entry.page);
    const lineY = yToc;

    // Texto de sección
    doc.text(label, 25, lineY);

    // Número de página a la derecha
    const tw = doc.getTextWidth(pageStr);
    doc.text(pageStr, pageWidth - 25 - tw, lineY);

    // Línea suave
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    doc.line(25, lineY + 1.5, pageWidth - 25, lineY + 1.5);

    yToc += 7;
  });

  // ===== Nombre de fichero =====
  let filenameBase = "memoria_calidades";
  if (idioma === "en") filenameBase = "technical_specification";
  if (idioma === "pt") filenameBase = "memoria_descritiva";

  const safeName = String(nombreProyecto || "proyecto")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  const filename = filenameBase + "_" + (safeName || "2n") + ".pdf";
  doc.save(filename);
}

// ===== Versión comercial (simple, pero más profesional) =====

async function exportarPDFComercial() {
  const jsPDF = window.jspdf.jsPDF;
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
    (presupuesto && presupuesto.nombreProyecto) ||
    "Proyecto";

  const promotora =
    proyecto.promotora ||
    proyecto.cliente ||
    (presupuesto && presupuesto.cliente) ||
    "";

  const logo = await getDocLogoImage();
  const dims = getDocPageDimensions(doc);
  const pageWidth = dims.width;

  // Título portada
  let tituloDoc = "Solución de accesos y videoportero IP";
  if (idioma === "en") tituloDoc = "IP access & video intercom solution";
  if (idioma === "pt") tituloDoc = "Solução IP de acessos e videoporteiro";

  // Logo portada (derecha)
  if (logo && logo.dataUrl) {
    const ratio =
      logo.width && logo.height ? logo.width / logo.height : 2.5;
    const logoW = 40;
    const logoH = logoW / ratio;
    const logoX = pageWidth - 20 - logoW;
    const logoY = 18;
    try {
      doc.addImage(logo.dataUrl, "PNG", logoX, logoY, logoW, logoH);
    } catch (e) {
      console.warn("No se pudo dibujar logo en portada comercial:", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(tituloDoc, 20, 40);

  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.4);
  doc.line(20, 43, pageWidth - 20, 43);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  let y = 60;

  const headerLines = [];
  headerLines.push(nombreProyecto);
  if (promotora) headerLines.push(promotora);

  headerLines.forEach((line) => {
    const lines = doc.splitTextToSize(line, pageWidth - 40);
    doc.text(lines, 20, y);
    y += lines.length * 6;
  });

  y += 8;

  // Solo el resumen en modo comercial
  const resumen = (secciones.resumen || "").trim();
  if (resumen) {
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(resumen, pageWidth - 40);
    doc.text(lines, 20, y);
  }

  // Pie de página corporativo
  drawTechFooter(doc, { idioma: idioma });

  // Guardar PDF
  let filenameBase = "presentacion_accesos";
  if (idioma === "en") filenameBase = "access_solution_presentation";
  if (idioma === "pt") filenameBase = "apresentacao_acessos";

  const safe = String(nombreProyecto || "proyecto")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  doc.save(filenameBase + "_" + safe + ".pdf");
}

// ===========================
// Exponer render
// ===========================

window.renderDocumentacionView = renderDocumentacionView;
