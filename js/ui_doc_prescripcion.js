// js/ui_doc_prescripcion.js
// Página de PRESCRIPCIÓN:
// Vista intermedia entre "Documentación" y "Gestión de documentación".
// Resumen de la documentación disponible enfocada a prescripción comercial/técnica,
// sin añadir llamadas extra a Firebase: solo usa el estado ya cargado.

window.appState = window.appState || {};
appState.documentacion = appState.documentacion || {
  mediaLibrary: [],
  mediaLoaded: false,
};

// Helper común del proyecto: usamos el mismo contenedor que el resto de vistas
function getDocPrescripcionAppContent() {
  if (typeof window.getDocAppContent === "function") {
    return window.getDocAppContent();
  }
  if (typeof window.getAppContent === "function") {
    return window.getAppContent();
  }
  return document.getElementById("appContent");
}

// ==============================
// Carga mínima (reutiliza ensureDocMediaLoaded)
// ==============================

async function loadDocMediaForPrescripcion() {
  appState.documentacion = appState.documentacion || {};
  appState.documentacion.mediaLibrary =
    appState.documentacion.mediaLibrary || [];

  if (typeof window.ensureDocMediaLoaded === "function") {
    try {
      const maybePromise = window.ensureDocMediaLoaded();
      if (maybePromise && typeof maybePromise.then === "function") {
        await maybePromise;
      }
    } catch (e) {
      console.error(
        "[DOC-PRESCRIPCION] Error al asegurar carga de media de documentación:",
        e
      );
    }
  }
}

// ==============================
// Render principal
// ==============================

async function renderDocPrescripcionView() {
  const container = getDocPrescripcionAppContent();
  if (!container) return;

  await loadDocMediaForPrescripcion();

  const media = appState.documentacion.mediaLibrary || [];

  const counts = {
    total: media.length,
    ficha: 0,
    declaracion: 0,
    imagen: 0,
    certificado: 0,
    otros: 0,
  };

  media.forEach((m) => {
    const cat = (m.docCategory || "").toLowerCase();
    if (cat === "ficha") counts.ficha += 1;
    else if (cat === "declaracion") counts.declaracion += 1;
    else if (cat === "imagen") counts.imagen += 1;
    else if (cat === "certificado") counts.certificado += 1;
    else counts.otros += 1;
  });

  // Lista corta de últimos documentos (máx. 8) pensada para prescripción rápida
  const latest = [...media]
    .sort((a, b) => {
      const ta = a.createdAt || a.timestamp || 0;
      const tb = b.createdAt || b.timestamp || 0;
      return tb - ta;
    })
    .slice(0, 8);

  const latestHTML = latest.length
    ? latest
        .map((m) => {
          const nombre = m.nombre || "(sin nombre)";
          const carpeta = m.folderName || "";
          const tipo = (m.docCategory || "").toLowerCase();
          const isImage =
            m.type === "image" || (m.mimeType || "").startsWith("image/");
          const icon = isImage ? "🖼️" : "📄";

          let tipoLabel = "Otros";
          if (tipo === "ficha") tipoLabel = "Ficha técnica";
          else if (tipo === "declaracion") tipoLabel = "Declaración";
          else if (tipo === "imagen") tipoLabel = "Imagen";
          else if (tipo === "certificado") tipoLabel = "Certificado";

          return `
            <div class="doc-prescripcion-row">
              <div class="doc-prescripcion-main">
                <div class="doc-prescripcion-name">
                  ${icon} ${nombre}
                </div>
                <div class="doc-prescripcion-meta">
                  <span class="doc-gestion-pill">${tipoLabel}</span>
                  ${
                    carpeta
                      ? `<span class="doc-gestion-pill">${carpeta}</span>`
                      : ""
                  }
                </div>
              </div>
            </div>
          `;
        })
        .join("")
    : `
      <p class="text-muted" style="font-size:0.85rem;">
        Todavía no hay documentación cargada. Cuando subas fichas, imágenes o certificados
        desde <strong>Gestión de documentación</strong>, aquí verás un resumen
        listo para usar en tus memorias y presentaciones de prescripción.
      </p>
    `;

  container.innerHTML = `
    <div class="proyecto-layout" style="display:flex; flex-direction:column; gap:1rem;">
      <!-- Card 1: Resumen de documentación para prescripción -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Prescripción – resumen de documentación</div>
            <div class="card-subtitle">
              Vista rápida de la documentación disponible para preparar memorias comerciales,
              técnicas y argumentarios de prescripción.
            </div>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <span class="chip">Prescripción</span>
          </div>
        </div>
        <div class="card-body">
          <div
            class="stats-grid"
            style="
              display:grid;
              grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
              gap:0.75rem;
            "
          >
            <div class="stat-card">
              <div class="stat-label">Documentos totales</div>
              <div class="stat-value">${counts.total}</div>
              <div class="stat-hint">Todo lo cargado en documentación</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Fichas técnicas</div>
              <div class="stat-value">${counts.ficha}</div>
              <div class="stat-hint">Para memorias técnicas</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Declaraciones</div>
              <div class="stat-value">${counts.declaracion}</div>
              <div class="stat-hint">CE / conformidad / normativa</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Imágenes</div>
              <div class="stat-value">${counts.imagen}</div>
              <div class="stat-hint">Renders, fotos, esquemas</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Certificados</div>
              <div class="stat-value">${counts.certificado}</div>
              <div class="stat-hint">Calidad, fuego, accesibilidad...</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Otros documentos</div>
              <div class="stat-value">${counts.otros}</div>
              <div class="stat-hint">PDFs genéricos, otros formatos</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 2: Documentación clave reciente -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Documentación reciente para prescripción</div>
            <div class="card-subtitle">
              Últimos documentos añadidos para tener a mano lo más actual en fichas,
              imágenes y certificados.
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="doc-prescripcion-list">
            ${latestHTML}
          </div>
        </div>
      </div>

      <!-- Card 3: Apoyo a memorias de calidades -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Apoyo a memorias de calidades</div>
            <div class="card-subtitle">
              Usa esta documentación como base para las memorias comerciales y técnicas
              que generas en la pantalla de Documentación.
            </div>
          </div>
        </div>
        <div class="card-body">
          <ul style="padding-left:1.1rem; margin:0; font-size:0.9rem;">
            <li>
              Verifica que tienes al menos una <strong>ficha técnica</strong> y
              una <strong>imagen</strong> de cada familia de producto clave
              (IP Style, IP Verso, Access Unit, lectores, etc.).
            </li>
            <li>
              Revisa que las <strong>declaraciones de conformidad</strong> y
              <strong>certificados</strong> están actualizados para proyectos
              donde el ingeniero lo pueda exigir.
            </li>
            <li>
              Si falta documentación de algún producto, súbela desde
              <strong>Gestión de documentación</strong> y luego vuelve a esta
              vista de Prescripción.
            </li>
          </ul>
        </div>
      </div>
    </div>
  `;

  console.log(
    "%cUI Prescripción de documentación renderizada (ui_doc_prescripcion.js)",
    "color:#22c55e; font-weight:600;"
  );
}
