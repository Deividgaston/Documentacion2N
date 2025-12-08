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
// PLANTILLAS FIJAS MEMORIA (EMPRESA + PRODUCTOS)
// ===========================

const DOC_TEXT_TEMPLATES = {
  empresa: {
    empresa_default_es: {
      id: "empresa_default_es",
      idioma: "es",
      title: "Presentación de la empresa",
      bodyText:
        "2N es un fabricante especializado en soluciones de videoportero IP y control de accesos, con más de 30 años de experiencia en el sector.\n\n" +
        "Nuestra propuesta se basa en combinar tecnología IP, diseño cuidado y alta fiabilidad, ofreciendo una plataforma preparada para integrarse con otros sistemas del edificio (PMS, BMS, domótica, CCTV, etc.).\n\n" +
        "Formamos parte del grupo Axis Communications, lo que refuerza nuestro compromiso con la innovación, la ciberseguridad y el soporte a largo plazo.",
    },
  },
  productos: {
    ip_style_main_es: {
      id: "ip_style_main_es",
      idioma: "es",
      title: "2N® IP Style – Placa principal de acceso",
      bodyText:
        "El 2N® IP Style es un videoportero IP de gama alta con pantalla táctil de 10\", diseñado para proyectos residenciales y corporativos de alto nivel.\n\n" +
        "Integra cámara de alta resolución, audio full-duplex y múltiples credenciales de acceso (PIN, QR, RFID y móvil con Bluetooth), permitiendo un control de accesos flexible y preparado para futuro.\n\n" +
        "Su diseño y grado de protección lo hacen adecuado para zonas exteriores exigentes, manteniendo una estética alineada con proyectos de arquitectura contemporánea.",
    },
    indoor_clip_main_es: {
      id: "indoor_clip_main_es",
      idioma: "es",
      title: "2N® Indoor Clip / Indoor Compact – Unidades interiores",
      bodyText:
        "Los monitores 2N® Indoor Clip y 2N® Indoor Compact ofrecen al usuario final una experiencia sencilla para gestionar llamadas de la placa de calle y la apertura de puertas.\n\n" +
        "Se alimentan por PoE y se conectan mediante un único cable UTP a la red IP del edificio, simplificando la instalación y el mantenimiento.\n\n" +
        "Según la configuración de cada proyecto, pueden recibir llamadas de distintos accesos, comunicarse con conserjería y, en determinados casos, integrarse con otros sistemas IP del inmueble.",
    },
    d7a_main_es: {
      id: "d7a_main_es",
      idioma: "es",
      title: "2N® IP Phone D7A – Puesto de conserjería",
      bodyText:
        "El 2N® IP Phone D7A es un terminal IP pensado para funciones de conserjería o control centralizado, con pantalla táctil y gestión sencilla de llamadas.\n\n" +
        "Permite recibir y gestionar las llamadas procedentes de los distintos accesos del edificio, visualizar el origen, consultar llamadas perdidas y realizar llamadas internas.\n\n" +
        "Es especialmente útil en proyectos con conserjería física o con soluciones de conserjería virtual, centralizando la comunicación con los residentes.",
    },
  },
};

// Mapa de códigos internos de producto a IDs de plantilla
const DOC_PRODUCT_TEMPLATE_MAP = {
  IP_STYLE: "ip_style_main_es",
  INDOOR_CLIP: "indoor_clip_main_es",
  INDOOR_COMPACT: "indoor_clip_main_es",
  D7A: "d7a_main_es",
  // Aquí puedes ir añadiendo más productos: ACCESS_UNIT_M, IP_VERSO_2, etc.
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
// NUEVO: PAYLOAD PROYECTO PARA IA + PRODUCTOS
// ===========================

function buildProjectDocPayloadBase() {
  const modo = appState.documentacion.modo || "comercial";
  const idioma = appState.documentacion.idioma || "es";
  const proyecto = appState.proyecto || {};
  const presupuesto =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

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

  let numViviendas =
    proyecto.numViviendas ||
    proyecto.viviendas ||
    (presupuesto && presupuesto.numViviendas) ||
    null;

  if (!numViviendas && Array.isArray(proyecto.filas)) {
    numViviendas = proyecto.filas.length;
  }

  return {
    meta: {
      idioma,
      tono: modo, // "comercial" | "tecnica"
      fechaDocumento: new Date().toISOString().slice(0, 10),
    },
    proyecto: {
      id: proyecto.id || null,
      nombre: nombreProyecto,
      promotora: promotora,
      ubicacion: proyecto.ubicacion || (presupuesto && presupuesto.ubicacion) || "",
      tipoProyecto: proyecto.tipoProyecto || "",
      segmento: proyecto.segmento || "",
      numeroViviendas: numViviendas,
      observaciones: proyecto.observaciones || "",
    },
    edificio: {
      numeroBloques: proyecto.numeroBloques || null,
      numeroPortales: proyecto.numeroPortales || null,
      tieneGaraje: !!proyecto.tieneGaraje,
      tieneTrasteros: !!proyecto.tieneTrasteros,
      zonasComunes: proyecto.zonasComunes || [],
    },
    solucionesAcceso: {
      // Estructura opcional, por si en el futuro la rellenas desde el presupuesto
      entradas: proyecto.entradas || [],
    },
    integraciones: {
      pms: proyecto.integracionPMS || null,
      conserjeriaVirtual: !!proyecto.conserjeriaVirtual,
      bms: proyecto.bms || null,
      otrosSistemas: proyecto.otrosSistemas || [],
    },
    seguridadYNormativa: {
      prioridadSeguridad: proyecto.prioridadSeguridad || null,
      requisitosNormativos: proyecto.requisitosNormativos || [],
      notasCiber: proyecto.notasCiber || "",
    },
    productosPrincipales: proyecto.productosPrincipales || [],
    extra: {},
  };
}

// Construye texto de "equipos" a partir de plantillas de productos
function buildProductosMainSectionFromProject(projectDocPayload, idioma = "es") {
  const templatesPorProducto = (DOC_TEXT_TEMPLATES && DOC_TEXT_TEMPLATES.productos) || {};
  if (!projectDocPayload || !Array.isArray(projectDocPayload.productosPrincipales)) {
    return "";
  }

  const seccionesText = [];
  const usados = new Set();

  for (const productCode of projectDocPayload.productosPrincipales) {
    const templateId = DOC_PRODUCT_TEMPLATE_MAP[productCode];
    if (!templateId) continue;
    if (usados.has(templateId)) continue;

    const tpl = templatesPorProducto[templateId];
    if (!tpl || tpl.idioma !== idioma) continue;

    usados.add(templateId);

    seccionesText.push(tpl.title + "\n" + tpl.bodyText);
  }

  return seccionesText.join("\n\n");
}

function autoFillProductosMainSection(projectDocPayload) {
  const idioma = (appState.documentacion && appState.documentacion.idioma) || "es";
  const textoEquipos = buildProductosMainSectionFromProject(projectDocPayload, idioma);

  appState.documentacion.secciones = appState.documentacion.secciones || {};

  if (textoEquipos && textoEquipos.trim().length > 0) {
    appState.documentacion.secciones.equipos = textoEquipos;
  }
}

// ===========================
// NUEVO: PROMPTS BASE IA (RESUMEN + SISTEMA)
// ===========================

function getTonoLabel(meta) {
  if (!meta) return "comercial";
  return meta.tono === "tecnica" ? "técnico" : "comercial";
}

function buildIntroPromptEs(projectDocPayload) {
  const { meta, proyecto, edificio } = projectDocPayload;
  const tono = getTonoLabel(meta);

  return (
    "Actúa como consultor senior de soluciones de videoportero IP y control de accesos 2N.\n\n" +
    "Redacta un texto para la sección 'Resumen del proyecto' de una memoria de calidades.\n" +
    "Tono: " + tono + ", profesional y claro. Idioma: español.\n\n" +
    "Datos del proyecto:\n" +
    "- Nombre del proyecto: " + (proyecto?.nombre || "-") + "\n" +
    "- Promotora: " + (proyecto?.promotora || "-") + "\n" +
    "- Ubicación: " + (proyecto?.ubicacion || "-") + "\n" +
    "- Tipo de proyecto: " + (proyecto?.tipoProyecto || "-") + "\n" +
    "- Nº de viviendas: " + (proyecto?.numeroViviendas || "-") + "\n" +
    "- Nº de bloques / portales: " +
    (edificio?.numeroBloques || "-") +
    " / " +
    (edificio?.numeroPortales || "-") +
    "\n\n" +
    "Objetivo:\n" +
    "- Presentar el proyecto y el contexto de forma breve.\n" +
    "- Explicar que el documento describe la solución 2N de videoportero IP y control de accesos.\n" +
    "- No entres en detalles de productos concretos.\n\n" +
    "Devuelve solo el texto final, en uno o varios párrafos, sin etiquetas HTML."
  );
}

function buildSolucionesPromptEs(projectDocPayload) {
  const { meta, proyecto, seguridadYNormativa } = projectDocPayload;
  const tono = getTonoLabel(meta);

  return (
    "Actúa como consultor de 2N especializado en diseño de soluciones de acceso.\n\n" +
    "Redacta un texto para la sección 'Sistema de videoportero y accesos' de una memoria de calidades.\n" +
    "Tono: " + tono + ", orientado a aportar valor al promotor y al arquitecto. Idioma: español.\n\n" +
    "Datos relevantes:\n" +
    "- Proyecto: " + (proyecto?.nombre || "-") + " (" + (proyecto?.tipoProyecto || "-") + ")\n" +
    "- Prioridad de seguridad: " + (seguridadYNormativa?.prioridadSeguridad || "no especificada") + "\n\n" +
    "Objetivo:\n" +
    "- Explicar cómo se estructura la solución IP (placas, monitores, control de accesos, red IP).\n" +
    "- Mencionar de forma general el uso de credenciales móviles, códigos PIN, tarjetas, etc., si aplica.\n" +
    "- Destacar la escalabilidad y la integración futura con otros sistemas.\n\n" +
    "Devuelve solo el texto final, en uno o varios párrafos, sin etiquetas HTML."
  );
}

// Devuelve prompts por sección de documentación que queremos cubrir con IA
function buildAllDocPromptsEs(projectDocPayload) {
  return {
    resumen: buildIntroPromptEs(projectDocPayload),
    sistema: buildSolucionesPromptEs(projectDocPayload),
    // En el futuro podríamos añadir más claves (otros, servicios, etc.)
  };
}

// ===========================
// NUEVO: MOCK IA + AUTOGENERAR MEMORIA (IA)
// ===========================

async function fakeCallAIForSection(sectionKey, prompt) {
  console.log("[DOC AI MOCK] Sección:", sectionKey);
  console.log("[DOC AI MOCK] Prompt (inicio):", (prompt || "").slice(0, 400));

  // Simulamos pequeña latencia
  await new Promise((resolve) => setTimeout(resolve, 200));

  return (
    "[AUTO (" +
    sectionKey +
    ")] Contenido de ejemplo generado automáticamente para esta sección " +
    "en función de los datos del proyecto. " +
    "Una vez conectes tu backend de IA, aquí se insertará el texto real."
  );
}

/**
 * Autogenera la memoria de calidades con IA:
 * - resumen: IA
 * - sistema: IA
 * - equipos: plantillas de productos
 *
 * Resto de secciones (infraestructura, servicios, normativa, etc.) se mantienen
 * como estén (normalmente, según la plantilla base).
 */
async function autoGenerateMemoriaCalidadesFromAI() {
  try {
    appState.documentacion = appState.documentacion || {};
    appState.documentacion.secciones =
      appState.documentacion.secciones || {};

    // 1) Payload estándar del proyecto
    const projectDocPayload = buildProjectDocPayloadBase();

    // 2) Rellenar sección "equipos" con plantillas de productos
    autoFillProductosMainSection(projectDocPayload);

    // 3) Prompts para secciones IA (resumen + sistema)
    const prompts = buildAllDocPromptsEs(projectDocPayload);

    for (const [sectionKey, prompt] of Object.entries(prompts)) {
      if (!prompt) continue;
      const texto = await fakeCallAIForSection(sectionKey, prompt);
      if (texto && texto.trim()) {
        appState.documentacion.secciones[sectionKey] = texto.trim();
      }
    }

    // 4) Podemos opcionalmente insertar presentación de empresa en "otros" si no hay nada
    const tplEmpresa = DOC_TEXT_TEMPLATES?.empresa?.empresa_default_es;
    if (tplEmpresa) {
      const actuales = appState.documentacion.secciones.otros || "";
      const bloqueEmpresa =
        tplEmpresa.title + "\n" + tplEmpresa.bodyText + "\n\n";
      appState.documentacion.secciones.otros = actuales
        ? actuales.trim() + "\n\n" + bloqueEmpresa
        : bloqueEmpresa;
    }

    appState.documentacion.ultimaAutoGen = new Date().toISOString();
    saveDocStateToLocalStorage();

    if (typeof renderDocumentacionView === "function") {
      renderDocumentacionView();
    }
  } catch (err) {
    console.error("[DOC AI] Error al autogenerar memoria de calidades:", err);
    alert("Se ha producido un error al autogenerar la memoria de calidades.");
  }
}

// ===========================
// AUTO-GENERACIÓN DE SECCIONES (PLANTILLA BASE)
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
    '        <button class="btn btn-sm" id="docAutoMemoriaBtn">✨ Autogenerar memoria (IA)</button>' +
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
    const isMimeImage = mime.indexOf("
