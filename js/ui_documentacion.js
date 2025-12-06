// js/ui_documentacion.js
// Página de DOCUMENTACIÓN: memoria de calidades auto-generada + editor flotante

window.appState = window.appState || {};
appState.documentacion = appState.documentacion || {
  idioma: "es", // "es" | "en" | "pt"
  secciones: {}, // mapa: clave -> texto
  customBlocks: [], // bloques añadidos manualmente
  fichasIncluidas: {}, // mapa: idLinea -> true/false
  ultimaAutoGen: null,
};

// Helpers globales ya usados en otros módulos
const getAppContent =
  typeof window.getAppContent === "function"
    ? window.getAppContent
    : () => document.getElementById("appContent");

const getPresupuestoActual =
  typeof window.getPresupuestoActual === "function"
    ? window.getPresupuestoActual
    : null;

// ===========================
// CONFIGURACIÓN BASE
// ===========================

const DOC_LANGS = {
  es: { code: "es", label: "Castellano" },
  en: { code: "en", label: "English" },
  pt: { code: "pt", label: "Português (PT)" },
};

const DOC_SECTION_ORDER = [
  "resumen",
  "sistema",
  "equipos",
  "infraestructura",
  "servicios",
  "normativa",
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
      "La solución puede complementarse con servicios cloud para gestión remota, apertura desde app móvil, actualizaciones de firmware y monitorización del sistema. Estos servicios permiten mejorar la experiencia del usuario final y facilitar el mantenimiento preventivo.",
    normativa:
      "Todos los equipos seleccionados cumplen con la normativa europea vigente en materia de seguridad eléctrica, compatibilidad electromagnética y normativa de telecomunicaciones. Adicionalmente, se sigue la normativa local aplicable en materia de accesibilidad y seguridad de uso.",
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
    normativa:
      "All selected devices comply with the applicable European regulations regarding electrical safety, electromagnetic compatibility and telecom standards. Additionally, local accessibility and safety-of-use regulations are followed.",
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
    normativa:
      "Todos os equipamentos selecionados cumprem a regulamentação europeia aplicável em matéria de segurança elétrica, compatibilidade eletromagnética e normas de telecomunicações. Adicionalmente, é cumprida a regulamentação local em matéria de acessibilidade e segurança de utilização.",
    otros:
      "Se necessário, podem ser incorporadas soluções adicionais como controlo de acessos por zonas, integração com CCTV, gestão de visitantes ou sistemas de reserva de zonas comuns.",
  },
};

// ===========================
// HELPERS DE DATOS
// ===========================

function buildDocTokens() {
  const proyecto = appState.proyecto || {};
  const presupuesto = typeof getPresupuestoActual === "function" ? getPresupuestoActual() : null;

  const nombreProyecto =
    proyecto.nombre ||
    proyecto.nombreProyecto ||
    presupuesto?.nombreProyecto ||
    "el proyecto";

  const promotora =
    proyecto.promotora ||
    proyecto.cliente ||
    presupuesto?.cliente ||
    "la propiedad";

  let numViviendas =
    proyecto.numViviendas ||
    proyecto.viviendas ||
    presupuesto?.numViviendas ||
    null;

  if (!numViviendas && Array.isArray(proyecto.filas)) {
    // Heurística muy básica: contar filas de tipo "vivienda" si existiera
    numViviendas = proyecto.filas.length;
  }

  return {
    "{{NOMBRE_PROYECTO}}": nombreProyecto,
    "{{PROMOTORA}}": promotora,
    "{{NUM_VIVIENDAS}}": numViviendas ? String(numViviendas) : "las viviendas",
    "{{LISTADO_EQUIPOS}}": buildListadoEquiposTexto(appState.documentacion.idioma),
  };
}

function buildListadoEquiposTexto(idioma) {
  const presupuesto = typeof getPresupuestoActual === "function" ? getPresupuestoActual() : null;
  const lineas = Array.isArray(presupuesto?.lineas) ? presupuesto.lineas : [];

  if (!lineas.length) {
    if (idioma === "en") return "No devices have been loaded from the current bill of materials.";
    if (idioma === "pt") return "Ainda não foram carregados equipamentos a partir da lista de materiais.";
    return "Todavía no se han cargado equipos desde la lista de materiales.";
  }

  // Agrupar por posible familia/categoría
  const grupos = {};
  lineas.forEach((l, idx) => {
    const cat = l.familia || l.categoria || l.grupo || "General";
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push({
      idx,
      ref: l.ref || l.codigo || l.code || "",
      desc: l.descripcion || l.descripcionCorta || l.desc || "",
      qty: l.cantidad || l.qty || 1,
    });

    // Inicializar fichas incluidas por defecto
    if (!appState.documentacion.fichasIncluidas[idx]) {
      appState.documentacion.fichasIncluidas[idx] = true;
    }
  });

  const partes = [];
  Object.keys(grupos).forEach((cat) => {
    partes.push(`- ${cat}:`);
    grupos[cat].forEach((item) => {
      partes.push(
        `   • ${item.ref ? item.ref + " – " : ""}${item.desc} (x${item.qty})`
      );
    });
    partes.push("");
  });

  return partes.join("\n");
}

function applyTokensToTemplate(template, tokens) {
  let out = template || "";
  Object.keys(tokens).forEach((key) => {
    out = out.replaceAll(key, tokens[key]);
  });
  return out;
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
}

// ===========================
// RENDER PRINCIPAL
// ===========================

function renderDocumentacionView() {
  const container = getAppContent();
  if (!container) return;

  // Si no hay aún auto-gen, la generamos por primera vez
  if (!appState.documentacion.ultimaAutoGen) {
    autoGenerateDocumentacion(appState.documentacion.idioma || "es");
  }

  const idiomaActual = appState.documentacion.idioma || "es";

  container.innerHTML = `
    <div class="doc-layout">

      <div class="doc-header card">
        <div class="card-header">
          <div>
            <div class="card-title">Documentación</div>
            <div class="card-subtitle">
              Genera la memoria de calidades de forma automática a partir del proyecto y la lista de materiales. Añade textos personalizados cuando lo necesites.
            </div>
          </div>
        </div>

        <div class="doc-toolbar">
          <div class="doc-lang-switch">
            ${Object.values(DOC_LANGS)
              .map(
                (l) => `
              <button
                class="btn btn-sm ${l.code === idiomaActual ? "btn-primary" : "btn-outline"}"
                data-doc-lang="${l.code}"
              >
                ${l.label}
              </button>
            `
              )
              .join("")}
          </div>

          <div class="doc-actions">
            <button class="btn btn-sm" id="docRegenerarBtn">
              🔁 Regenerar contenido automático
            </button>
            <button class="btn btn-sm" id="docNuevoBloqueBtn">
              ✏️ Añadir texto personalizado
            </button>
            <button class="btn btn-sm btn-primary" id="docExportarBtn">
              📄 Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <div class="doc-main">
        <!-- COLUMNA IZQUIERDA: SECCIONES -->
        <div class="doc-sections">
          ${renderDocSectionsHTML()}
        </div>

        <!-- COLUMNA DERECHA: FICHAS TÉCNICAS / RESUMEN -->
        <aside class="doc-side card">
          <div class="card-header">
            <div class="card-title">Fichas técnicas</div>
            <div class="card-subtitle">Selecciona qué equipos incluir como anexo.</div>
          </div>
          <div class="doc-side-body">
            ${renderDocFichasHTML()}
          </div>
        </aside>
      </div>

      <!-- MODAL EDITOR FLOTANTE -->
      <div id="docCustomModal" class="doc-modal hidden">
        <div class="doc-modal-content card">
          <div class="card-header">
            <div class="card-title">Añadir texto a la memoria</div>
            <div class="card-subtitle">Elige sección e introduce el contenido personalizado.</div>
          </div>
          <div class="card-body">
            <div class="form-group mb-2">
              <label>Sección destino</label>
              <select id="docCustomSectionSelect" class="form-control">
                ${DOC_SECTION_ORDER.map(
                  (key) => `<option value="${key}">${labelForSection(key)}</option>`
                ).join("")}
              </select>
            </div>
            <div class="form-group mb-3">
              <label>Texto a añadir</label>
              <textarea id="docCustomText" class="form-control" rows="6"
                placeholder="Escribe aquí el párrafo o bloque que quieras añadir a la memoria..."></textarea>
            </div>
          </div>
          <div class="card-footer doc-modal-footer">
            <button class="btn btn-sm" id="docCustomCancelBtn">Cancelar</button>
            <button class="btn btn-sm btn-primary" id="docCustomSaveBtn">Añadir a la memoria</button>
          </div>
        </div>
      </div>

      <div id="docModalBackdrop" class="doc-backdrop hidden"></div>
    </div>
  `;

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
    case "normativa":
      return "Normativa y cumplimiento";
    case "otros":
      return "Otros aspectos / observaciones";
    default:
      return key;
  }
}

function renderDocSectionsHTML() {
  const secciones = appState.documentacion.secciones || {};
  return DOC_SECTION_ORDER.map((key) => {
    const contenido = secciones[key] || "";
    return `
      <div class="card doc-section-card" data-doc-section="${key}">
        <div class="card-header">
          <div class="card-title">${labelForSection(key)}</div>
        </div>
        <div class="card-body">
          <textarea
            class="form-control doc-section-textarea"
            data-doc-section-text="${key}"
            rows="8"
          >${contenido}</textarea>
        </div>
      </div>
    `;
  }).join("");
}

function renderDocFichasHTML() {
  const presupuesto = typeof getPresupuestoActual === "function" ? getPresupuestoActual() : null;
  const lineas = Array.isArray(presupuesto?.lineas) ? presupuesto.lineas : [];

  if (!lineas.length) {
    return `
      <p class="text-muted">
        No se ha encontrado lista de materiales en el presupuesto actual.
      </p>
    `;
  }

  return `
    <div class="doc-fichas-list">
      ${lineas
        .map((l, idx) => {
          const id = `docFichaChk_${idx}`;
          const ref = l.ref || l.codigo || l.code || "";
          const desc = l.descripcion || l.desc || "";
          const checked = appState.documentacion.fichasIncluidas[idx] ? "checked" : "";
          return `
            <label class="doc-ficha-item">
              <input type="checkbox" id="${id}" data-doc-ficha-index="${idx}" ${checked} />
              <span class="doc-ficha-main">
                <strong>${ref}</strong> – ${desc}
              </span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;
}

// ===========================
// HANDLERS
// ===========================

function attachDocumentacionHandlers() {
  const container = getAppContent();
  if (!container) return;

  // Cambio de idioma
  container.querySelectorAll("[data-doc-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-doc-lang") || "es";
      autoGenerateDocumentacion(lang);
      renderDocumentacionView(); // re-render completo para refrescar todo
    });
  });

  // Regenerar contenido automático (misma lengua)
  const regenBtn = container.querySelector("#docRegenerarBtn");
  if (regenBtn) {
    regenBtn.addEventListener("click", () => {
      autoGenerateDocumentacion(appState.documentacion.idioma || "es");
      renderDocumentacionView();
    });
  }

  // Guardar cambios manuales en textareas de secciones
  container.querySelectorAll(".doc-section-textarea").forEach((ta) => {
    ta.addEventListener("input", () => {
      const secKey = ta.getAttribute("data-doc-section-text");
      if (!secKey) return;
      appState.documentacion.secciones = appState.documentacion.secciones || {};
      appState.documentacion.secciones[secKey] = ta.value;
    });
  });

  // Fichas técnicas seleccionadas
  container.querySelectorAll("[data-doc-ficha-index]").forEach((chk) => {
    chk.addEventListener("change", () => {
      const idx = chk.getAttribute("data-doc-ficha-index");
      if (idx == null) return;
      appState.documentacion.fichasIncluidas[idx] = chk.checked;
    });
  });

  // Modal editor flotante
  const nuevoBloqueBtn = container.querySelector("#docNuevoBloqueBtn");
  if (nuevoBloqueBtn) {
    nuevoBloqueBtn.addEventListener("click", openDocCustomModal);
  }

  const exportBtn = container.querySelector("#docExportarBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportarDocumentacionPDFStub);
  }

  const modal = document.getElementById("docCustomModal");
  const backdrop = document.getElementById("docModalBackdrop");
  const cancelBtn = modal?.querySelector("#docCustomCancelBtn");
  const saveBtn = modal?.querySelector("#docCustomSaveBtn");

  if (cancelBtn) cancelBtn.addEventListener("click", closeDocCustomModal);
  if (backdrop) backdrop.addEventListener("click", closeDocCustomModal);
  if (saveBtn) saveBtn.addEventListener("click", saveDocCustomBlock);
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
  appState.documentacion.customBlocks = appState.documentacion.customBlocks || [];
  appState.documentacion.customBlocks.push({
    section: secKey,
    text,
    ts: new Date().toISOString(),
  });

  closeDocCustomModal();
  // Re-render solo las secciones (para refrescar textarea)
  const container = getAppContent();
  if (!container) return;
  const secContainer = container.querySelector(".doc-sections");
  if (secContainer) {
    secContainer.innerHTML = renderDocSectionsHTML();
    // Reasignar handlers de textareas
    container.querySelectorAll(".doc-section-textarea").forEach((ta) => {
      ta.addEventListener("input", () => {
        const key = ta.getAttribute("data-doc-section-text");
        if (!key) return;
        appState.documentacion.secciones[key] = ta.value;
      });
    });
  }
}

// ===========================
// EXPORTAR PDF (STUB)
// ===========================

function exportarDocumentacionPDFStub() {
  // Aquí luego podrás enganchar la generación real de PDF.
  // De momento dejamos un stub para no romper nada.
  console.log("[Documentación] Exportar PDF con idioma:", appState.documentacion.idioma);
  console.log("[Documentación] Secciones:", appState.documentacion.secciones);
  console.log("[Documentación] Fichas incluidas:", appState.documentacion.fichasIncluidas);
  alert(
    "Exportar PDF todavía no está implementado en esta versión.\n\n" +
      "Pero el contenido de la memoria ya está generado y listo para usar."
  );
}

// Exponer función principal al global para poder llamarla desde el router/menu
window.renderDocumentacionView = renderDocumentacionView;
