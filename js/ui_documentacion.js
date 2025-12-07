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
    return (
      '<div class="card doc-section-card" data-doc-section="' +
      key +
      '">' +
      '  <div class="card-header">' +
      '    <div class="card-title">' +
      labelForSection(key) +
      "</div>" +
      '    <div class="doc-section-header-actions">' +
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
    return (
      m &&
      m.id &&
      typeof m.id === "string" &&
      m.id.trim() !== "" &&
      m.url &&
      typeof m.url === "string" &&
      m.url.trim() !== ""
    );
  });
  if (cleaned.length !== list.length) {
    appState.documentacion.mediaLibrary = cleaned;
  }
}

function renderDocMediaLibraryHTML() {
  const allMedia = appState.documentacion.mediaLibrary || [];
  console.log(
    "[DOC] renderDocMediaLibraryHTML – total items:",
    allMedia.length
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

  // Nos quedamos solo con IMÁGENES
  const images = (appState.documentacion.mediaLibrary || []).filter(function (
    m
  ) {
    if (!m || !m.id || !m.url) return false;

    const cat = (m.docCategory || "").toLowerCase();
    const mime = (m.mimeType || "").toLowerCase();
    const type = (m.type || "").toLowerCase();
    const url = (m.url || "").toLowerCase();

    return (
      cat === "imagen" ||
      mime.indexOf("image/") === 0 ||
      type === "image" ||
      url.endsWith(".png") ||
      url.endsWith(".jpg") ||
      url.endsWith(".jpeg") ||
      url.endsWith(".webp") ||
      url.endsWith(".gif")
    );
  });

  console.log(
    "[DOC] renderDocMediaLibraryHTML – images:",
    images.length
  );

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
      const url = (item.url || "").toLowerCase();

      const isImageByMime = mime.indexOf("image/") === 0;
      const isImageByType = type === "image";
      const isImageByExt =
        url.endsWith(".png") ||
        url.endsWith(".jpg") ||
        url.endsWith(".jpeg") ||
        url.endsWith(".webp") ||
        url.endsWith(".gif");

      const isImage =
        cat === "imagen" || isImageByMime || isImageByType || isImageByExt;

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
      media.push({ id: doc.id, ...doc.data() });
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

  const mediaData = {
    id: null,
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
    mediaData.id = docRef.id;
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

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
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
  if (modo === "comercial") {
    await exportarPDFComercial();
  } else {
    await exportarPDFTecnico();
  }
}

// ===== Versión técnica =====

async function exportarPDFTecnico() {
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
  headerLines.push(nombreProyecto);
  if (promotora) headerLines.push(promotora);

  headerLines.forEach(function (line) {
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

  const sectionMediaMap = appState.documentacion.sectionMedia || {};
  const mediaLib = appState.documentacion.mediaLibrary || [];

  function getSectionImages(sectionKey) {
    const ids = sectionMediaMap[sectionKey] || [];
    return ids
      .map(function (id) {
        return mediaLib.find(function (m) {
          return m.id === id;
        });
      })
      .filter(function (m) {
        if (!m || !m.url) return false;
        const mime = (m.mimeType || "").toLowerCase();
        const type = m.type || "";
        return type === "image" || mime.indexOf("image/") === 0;
      });
  }

  async function insertImagesForSection(sectionKey) {
    const images = getSectionImages(sectionKey);
    if (!images.length) return;

    for (const m of images) {
      try {
        const obj = await loadImageAsDataUrl(m.url);
        const dataUrl = obj.dataUrl;
        const width = obj.width;
        const height = obj.height;
        const ratio = width && height ? width / height : 4 / 3;

        const maxWidthMm = 80;
        const maxHeightMm = 60;
        let imgW = maxWidthMm;
        let imgH = imgW / ratio;
        if (imgH > maxHeightMm) {
          imgH = maxHeightMm;
          imgW = imgH * ratio;
        }

        const neededHeight = imgH + 10;
        if (y + neededHeight > 280) {
          doc.addPage();
          y = 20;
        }

        const imgX = 20;
        const imgY = y;
        doc.addImage(dataUrl, "JPEG", imgX, imgY, imgW, imgH);
        y += imgH + 4;

        if (m.nombre) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          const capLines = doc.splitTextToSize(m.nombre, 170);
          doc.text(capLines, 20, y);
          y += capLines.length * 4 + 2;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
        }
      } catch (e) {
        console.warn("No se pudo insertar imagen de sección en PDF:", e);
      }
    }
  }

  for (const key of DOC_SECTION_ORDER) {
    const contenido = (secciones[key] || "").trim();
    if (!contenido && !getSectionImages(key).length) continue;

    const tituloSeccion = labelForSection(key);

    ensureSpace(3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(tituloSeccion, 20, y);
    y += 7;

    if (contenido) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const textLines = doc.splitTextToSize(contenido, 170);
      ensureSpace(textLines.length);
      doc.text(textLines, 20, y);
      y += textLines.length * 5 + 4;
    }

    await insertImagesForSection(key);
    y += 2;
  }

  const selIds = appState.documentacion.selectedFichasMediaIds || [];
  const fichasMediaSeleccionadas = mediaLib.filter(function (m) {
    return selIds.indexOf(m.id) !== -1;
  });

  if (fichasMediaSeleccionadas.length > 0) {
    doc.addPage();
    y = 20;

    let tituloDocs = "Anexo – Fichas técnicas adjuntas";
    if (idioma === "en") tituloDocs = "Appendix – Technical documentation";
    if (idioma === "pt") tituloDocs = "Anexo – Documentação técnica";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(tituloDocs, 20, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    fichasMediaSeleccionadas.forEach(function (m) {
      const extra = m.folderName ? " – " + m.folderName : "";
      const urlText = m.url ? " (" + m.url + ")" : "";
      const line = m.nombre + extra + urlText;
      const splitted = doc.splitTextToSize(line, 170);
      ensureSpace(splitted.length);
      doc.text(splitted, 20, y);
      y += splitted.length * 5 + 2;
    });
  }

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

// ===== Versión comercial =====

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

  let tituloDoc = "Solución de accesos y videoportero IP";
  if (idioma === "en") tituloDoc = "IP access and video intercom solution";
  if (idioma === "pt") tituloDoc = "Solução IP de acessos e videoporteiro";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(tituloDoc, 20, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  let y = 40;

  const headerLines = [];
  headerLines.push(nombreProyecto);
  if (promotora) headerLines.push(promotora);

  headerLines.forEach(function (line) {
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

  const fichas = [];
  if (presupuesto && Array.isArray(presupuesto.lineas)) {
    presupuesto.lineas.forEach(function (l, idx) {
      if (!appState.documentacion.fichasIncluidas[idx]) return;
      const ref = l.ref || l.codigo || l.code || "";
      const desc = l.descripcion || l.desc || "";
      const qty = l.cantidad || l.qty || 1;
      fichas.push({ ref: ref, desc: desc, qty: qty });
    });
  }

  for (const f of fichas) {
    doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(f.desc || f.ref, 20, 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Ref: " + f.ref + "  ·  x" + f.qty, 20, 32);

    const imgUrl = getImagenRef(f.ref);
    if (imgUrl) {
      try {
        const obj = await loadImageAsDataUrl(imgUrl);
        const dataUrl = obj.dataUrl;
        const width = obj.width;
        const height = obj.height;
        const ratio = width && height ? width / height : 4 / 3;

        const maxWidthMm = 120;
        const maxHeightMm = 75;
        let imgW = maxWidthMm;
        let imgH = imgW / ratio;
        if (imgH > maxHeightMm) {
          imgH = maxHeightMm;
          imgW = imgH * ratio;
        }

        const imgX = (210 - imgW) / 2;
        const imgY = 40;
        doc.addImage(dataUrl, "JPEG", imgX, imgY, imgW, imgH);
      } catch (e) {
        console.warn("No se pudo cargar imagen para", f.ref, imgUrl, e);
      }
    }

    let bullets;
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
    bullets.forEach(function (b) {
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

  const filename = filenameBase + "_" + (safeName || "2n") + ".pdf";
  doc.save(filename);
}

// ===========================
// Exponer render
// ===========================

window.renderDocumentacionView = renderDocumentacionView;
