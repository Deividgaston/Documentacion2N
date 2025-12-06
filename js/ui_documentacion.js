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
    console.error("Error cargando estado de documentación desde localStorage:", e);
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
    };
    localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error("Error guardando estado de documentación en localStorage:", e);
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
      "A solução inclui os seguintes equipamentos principais:\n\n{{LISTADO_EQUIPOS}}\n\nCada equipamento foi selecionado para cumprir os requisitos de desenho, funcionalidade e durabilidade do projeto.",
    infraestructura:
      "Toda a infraestrutura de comunicações assenta numa rede IP com cablagem estruturada, bastidores de comunicações e electrónica de rede gerida. O desenho contempla caminhos redundantes, alimentação adequada (PoE quando aplicável) e capacidade de reserva para futuras ampliações.",
    servicios:
      "A solução pode ser complementada com serviços cloud para gestão remota, abertura de portas através de aplicação móvel, atualizações de firmware e monitorização do sistema. Estes serviços melhoram a experiência do utilizador final e facilitam a manutenção preventiva.",
    normativa_red:
      "Norma RED (Radio Equipment Directive) – 1 de agosto de 2025\n\nTodos os equipamentos de comunicações incluídos na solução cumprem a Diretiva RED (2014/53/EU) e os requisitos de cibersegurança que se tornam obrigatórios a partir de 1 de agosto de 2025. Os dispositivos 2N incorporam as medidas necessárias em termos de cibersegurança, gestão do espectro radioelétrico e segurança do utilizador, incluindo:\n\n- Gestão segura de firmware e atualizações remotas.\n- Mecanismos de proteção contra acessos não autorizados.\n- Conformidade com os requisitos essenciais de segurança, compatibilidade eletromagnética e utilização eficiente do espectro.\n\nA solução foi desenhada tendo em conta estes requisitos para garantir segurança e conformidade normativa a longo prazo.",
    normativa_lpd:
      "Proteção de dados (RGPD)\n\nA solução proposta permite um tratamento responsável dos dados pessoais, em especial no que respeita a imagens de vídeo, registos de acesso e credenciais digitais.\n\nA arquitetura recomendada foi concebida para:\n\n- Minimizar a quantidade de dados pessoais armazenados.\n- Restringir o acesso aos dados a perfis autorizados (administradores, segurança, manutenção).\n- Facilitar o cumprimento do Regulamento Geral de Proteção de Dados (RGPD) e da legislação local em matéria de proteção de dados.\n\nRecomenda-se que a propriedade e/ou a entidade gestora do edifício definam políticas de conservação de dados, informação ao utilizador e exercício de direitos (acesso, retificação, apagamento, etc.), tirando partido das capacidades técnicas da solução.",
    normativa_ciber:
      "Cibersegurança e práticas de segurança 2N\n\nOs dispositivos 2N incluídos na solução são desenhados seguindo boas práticas de cibersegurança, incluindo:\n\n- Sistema operativo embebido reforçado, sem serviços desnecessários expostos.\n- Autenticação segura e gestão de credenciais para administradores e utilizadores.\n- Suporte de comunicações cifradas (HTTPS / TLS) para
