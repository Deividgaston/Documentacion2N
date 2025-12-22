// js/ui_diagramas.js
// Nueva vista: DIAGRAMAS (IA)
// V1: genera un "preview" (JSON) usando Gemini y muestra el resultado.
// NO exporta DXF todavía.

window.appState = window.appState || {};
appState.diagramas = appState.diagramas || {
  projectType: "residencial", // residencial | retail | hotel | villa
  drawMode: "residencial",
  buildings: 1,
  placasPorEdificio: 2,
  placaExteriorPorEdificio: 1,
  viviendasPorEdificio: 15,
  monitoresPorVivienda: 2,
  zones: {
    comunes: true,
    refugio: false,
    domotica: false,
    controlAccesos: true,
  },
  skusText: "IPSTYLE-CA\nSWITCH-POE-8\nMONITOR-7",
  // Catálogo simulado (luego lo leeremos del DXF real)
  catalogJsonText: JSON.stringify(
    {
      catalog_blocks: [
        { name: "VP_STD", device_type: "videoportero", sku_set: ["IPSTYLE-B", "IPSTYLE-S"] },
        { name: "VP_CA", device_type: "videoportero", sku_set: ["IPSTYLE-CA"] },
        { name: "SWITCH_POE", device_type: "switch", sku_set: ["SWITCH-POE-8", "SWITCH-POE-16"] },
        { name: "MONITOR", device_type: "monitor", sku_set: ["MONITOR-7"] },
      ],
    },
    null,
    2
  ),
  lastResult: null,
  lastError: null,
  busy: false,
};

function _el(id) {
  return document.getElementById(id);
}

function _escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function _parseSkus(text) {
  return String(text || "")
    .split(/\r?\n|,/g)
    .map((x) => String(x).trim())
    .filter(Boolean);
}

function _boolVal(id) {
  const el = _el(id);
  return !!(el && el.checked);
}

function _numVal(id, def = 0) {
  const el = _el(id);
  const n = Number(el ? el.value : def);
  return Number.isFinite(n) ? n : def;
}

function _strVal(id, def = "") {
  const el = _el(id);
  return el ? String(el.value || def) : def;
}

function _setBusy(b) {
  appState.diagramas.busy = !!b;
  const btn = _el("btnDiagGenerate");
  if (btn) btn.disabled = !!b;

  const sp = _el("diagBusy");
  if (sp) sp.style.display = b ? "" : "none";
}

function _renderResult() {
  const out = _el("diagOutput");
  if (!out) return;

  if (appState.diagramas.lastError) {
    out.innerHTML = `<div class="alert alert-error">${_escapeHtml(appState.diagramas.lastError)}</div>`;
    return;
  }

  if (!appState.diagramas.lastResult) {
    out.innerHTML = `<div class="muted">Pulsa <b>Generar preview</b> para ver el JSON.</div>`;
    return;
  }

  const pretty = _escapeHtml(JSON.stringify(appState.diagramas.lastResult, null, 2));
  out.innerHTML = `
    <div class="mb-2"><span class="badge">Preview JSON</span></div>
    <pre style="white-space:pre-wrap; background:#0b1020; color:#e5e7eb; padding:12px; border-radius:10px; overflow:auto;">${pretty}</pre>
  `;
}

function _buildDiagramPromptPayload() {
  // 1) Catalog
  let catalogObj = null;
  try {
    catalogObj = JSON.parse(appState.diagramas.catalogJsonText || "{}");
  } catch (e) {
    throw new Error("El JSON del catálogo no es válido.");
  }

  const catalogBlocks = Array.isArray(catalogObj?.catalog_blocks) ? catalogObj.catalog_blocks : [];
  if (!catalogBlocks.length) throw new Error("El catálogo está vacío (catalog_blocks).");

  // 2) Project spec
  const projectType = appState.diagramas.projectType;
  const drawMode = appState.diagramas.drawMode;

  const skus = _parseSkus(appState.diagramas.skusText);
  if (!skus.length) throw new Error("Añade al menos 1 SKU para la prueba.");

  const spec = {
    project_type: projectType,
    draw_mode: drawMode,
    buildings: appState.diagramas.buildings,
    per_building: {
      placas_totales: appState.diagramas.placasPorEdificio,
      placas_exterior: appState.diagramas.placaExteriorPorEdificio,
      viviendas: appState.diagramas.viviendasPorEdificio,
      monitores_por_vivienda: appState.diagramas.monitoresPorVivienda,
    },
    features: {
      zonas_comunes: !!appState.diagramas.zones.comunes,
      zonas_refugio: !!appState.diagramas.zones.refugio,
      domotica: !!appState.diagramas.zones.domotica,
      control_accesos: !!appState.diagramas.zones.controlAccesos,
    },
    skus,
  };

  // 3) Network rules (mínimas para la prueba)
  const network_rules = {
    videoportero: { connects_to: ["switch"], connection: "LAN_PoE" },
    monitor: { connects_to: ["switch"], connection: "LAN" },
    switch: { connects_to: ["router", "server"], connection: "LAN" },
  };

  // 4) Strict instruction (JSON-only)
  const instructions = `
Eres un generador de topologías de red para diagramas de videoportero/control de accesos.

DEVUELVE SOLO JSON VÁLIDO. No añadas texto fuera del JSON.
NO inventes bloques: usa únicamente catalog_blocks[].name.
Un bloque es válido si alguna SKU del proyecto está incluida en sku_set del bloque.
Aplica network_rules para generar conexiones (no inventes conexiones fuera de las reglas).
Escala la estructura por edificios y viviendas según el spec.
Si falta un bloque para una SKU necesaria, devuelve errors[] y placements/connections vacíos.

Formato exacto:
{
  "placements":[ { "id":"...", "block":"...", "device_type":"...", "building":"B1", "meta":{...} } ],
  "connections":[ { "from":"...", "to":"...", "type":"..." } ],
  "summary": { ... },
  "errors":[ ... ]
}
  `.trim();

  return { instructions, catalog_blocks: catalogBlocks, spec, network_rules };
}

async function diagGeneratePreview() {
  appState.diagramas.lastError = null;
  appState.diagramas.lastResult = null;
  _renderResult();

  // sync state from UI
  appState.diagramas.projectType = _strVal("diagProjectType", "residencial");
  appState.diagramas.drawMode = _strVal("diagDrawMode", appState.diagramas.projectType);
  appState.diagramas.buildings = _numVal("diagBuildings", 1);
  appState.diagramas.placasPorEdificio = _numVal("diagPlacas", 2);
  appState.diagramas.placaExteriorPorEdificio = _numVal("diagPlacaExt", 1);
  appState.diagramas.viviendasPorEdificio = _numVal("diagViviendas", 15);
  appState.diagramas.monitoresPorVivienda = _numVal("diagMonitores", 2);
  appState.diagramas.zones.comunes = _boolVal("diagZComunes");
  appState.diagramas.zones.refugio = _boolVal("diagZRefugio");
  appState.diagramas.zones.domotica = _boolVal("diagZDomotica");
  appState.diagramas.zones.controlAccesos = _boolVal("diagZCA");
  appState.diagramas.skusText = _strVal("diagSkus", appState.diagramas.skusText);
  appState.diagramas.catalogJsonText = _strVal("diagCatalog", appState.diagramas.catalogJsonText);

  let payload;
  try {
    payload = _buildDiagramPromptPayload();
  } catch (e) {
    appState.diagramas.lastError = e.message || String(e);
    _renderResult();
    return;
  }

  // Check Gemini handler
  const handler =
    window.handleDocSectionAI ||
    window.handleAI ||
    window.callGemini ||
    null;

  if (typeof handler !== "function") {
    appState.diagramas.lastError =
      "No encuentro el handler de IA (ej. window.handleDocSectionAI). Pásame el archivo donde lo defines y lo conectamos.";
    _renderResult();
    return;
  }

  _setBusy(true);
  try {
    // Intento de llamada genérica: mantenemos compatibilidad.
    // Si tu handler espera otro formato, me pasas el archivo y lo ajusto.
    const res = await handler({
      mode: "diagram_network_v1",
      instructions: payload.instructions,
      catalog_blocks: payload.catalog_blocks,
      spec: payload.spec,
      network_rules: payload.network_rules,
      // contexto adicional (por si lo usas)
      user: { email: appState?.user?.email || "", role: appState?.user?.role || "" },
    });

    // El handler puede devolver string o objeto
    let obj = res;
    if (typeof res === "string") {
      try {
        obj = JSON.parse(res);
      } catch (e) {
        throw new Error("La IA no devolvió JSON válido.");
      }
    }

    // Validación mínima
    if (!obj || typeof obj !== "object") throw new Error("Respuesta IA inválida.");
    if (!("placements" in obj) || !("connections" in obj) || !("errors" in obj)) {
      throw new Error("JSON sin campos requeridos (placements/connections/errors).");
    }

    appState.diagramas.lastResult = obj;
    appState.diagramas.lastError = null;
    _renderResult();
  } catch (e) {
    console.error(e);
    appState.diagramas.lastError = e.message || String(e);
    appState.diagramas.lastResult = null;
    _renderResult();
  } finally {
    _setBusy(false);
  }
}

function renderDiagramasView() {
  const root = document.getElementById("appContent");
  if (!root) return;

  // Guard-rail de permisos (por si el link se colase)
  const caps = appState?.user?.capabilities;
  const allowed =
    (caps?.pages && !!caps.pages.diagramas) ||
    (caps?.views && !!caps.views.diagramas);

  if (!allowed) {
    root.innerHTML = `
      <div class="card">
        <h2>Diagrama</h2>
        <div class="alert alert-error mt-2">No tienes permisos para acceder a esta vista.</div>
      </div>
    `;
    return;
  }

  const s = appState.diagramas;

  root.innerHTML = `
    <div class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div>
          <h2 style="margin-bottom:4px;">Diagrama (IA) · Preview</h2>
          <div class="muted">V1: genera JSON de nodos/conexiones. Export DXF vendrá después.</div>
        </div>
        <div>
          <button id="btnDiagGenerate" class="btn btn-primary">Generar preview</button>
          <span id="diagBusy" class="muted" style="display:none; margin-left:8px;">Generando…</span>
        </div>
      </div>

      <div class="grid mt-3" style="display:grid; grid-template-columns: 1fr 1fr; gap:14px;">
        <div class="card" style="padding:12px;">
          <h3>Proyecto</h3>

          <div class="form-group">
            <label>Tipo de proyecto</label>
            <select id="diagProjectType">
              <option value="residencial"${s.projectType==="residencial"?" selected":""}>Residencial</option>
              <option value="retail"${s.projectType==="retail"?" selected":""}>Retail</option>
              <option value="hotel"${s.projectType==="hotel"?" selected":""}>Hotel</option>
              <option value="villa"${s.projectType==="villa"?" selected":""}>Villa</option>
            </select>
          </div>

          <div class="form-group">
            <label>Modo de dibujo (draw_mode)</label>
            <select id="diagDrawMode">
              <option value="residencial"${s.drawMode==="residencial"?" selected":""}>Residencial</option>
              <option value="retail"${s.drawMode==="retail"?" selected":""}>Retail</option>
              <option value="hotel"${s.drawMode==="hotel"?" selected":""}>Hotel</option>
              <option value="villa"${s.drawMode==="villa"?" selected":""}>Villa</option>
            </select>
          </div>

          <div class="grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div class="form-group">
              <label>Edificios</label>
              <input id="diagBuildings" type="number" min="1" value="${Number(s.buildings)||1}" />
            </div>
            <div class="form-group">
              <label>Placas por edificio</label>
              <input id="diagPlacas" type="number" min="0" value="${Number(s.placasPorEdificio)||0}" />
            </div>
            <div class="form-group">
              <label>Placa exterior por edificio</label>
              <input id="diagPlacaExt" type="number" min="0" value="${Number(s.placaExteriorPorEdificio)||0}" />
            </div>
            <div class="form-group">
              <label>Viviendas por edificio</label>
              <input id="diagViviendas" type="number" min="0" value="${Number(s.viviendasPorEdificio)||0}" />
            </div>
            <div class="form-group">
              <label>Monitores por vivienda</label>
              <input id="diagMonitores" type="number" min="0" value="${Number(s.monitoresPorVivienda)||0}" />
            </div>
          </div>

          <div class="mt-2">
            <label style="display:flex; gap:8px; align-items:center;">
              <input id="diagZComunes" type="checkbox"${s.zones.comunes?" checked":""}/> Zonas comunes
            </label>
            <label style="display:flex; gap:8px; align-items:center;">
              <input id="diagZRefugio" type="checkbox"${s.zones.refugio?" checked":""}/> Zonas de refugio
            </label>
            <label style="display:flex; gap:8px; align-items:center;">
              <input id="diagZDomotica" type="checkbox"${s.zones.domotica?" checked":""}/> Domótica
            </label>
            <label style="display:flex; gap:8px; align-items:center;">
              <input id="diagZCA" type="checkbox"${s.zones.controlAccesos?" checked":""}/> Control de accesos
            </label>
          </div>

          <div class="form-group mt-3">
            <label>SKUs (una por línea)</label>
            <textarea id="diagSkus" rows="6" placeholder="IPSTYLE-CA&#10;SWITCH-POE-8&#10;MONITOR-7">${_escapeHtml(s.skusText)}</textarea>
          </div>
        </div>

        <div class="card" style="padding:12px;">
          <h3>Catálogo (simulado)</h3>
          <div class="muted mb-2">V1: pega aquí el JSON con los bloques (más adelante lo leeremos del DXF).</div>
          <div class="form-group">
            <textarea id="diagCatalog" rows="16">${_escapeHtml(s.catalogJsonText)}</textarea>
          </div>
        </div>
      </div>

      <div class="mt-3" id="diagOutput"></div>
    </div>
  `;

  // bind
  const btn = _el("btnDiagGenerate");
  if (btn) btn.addEventListener("click", diagGeneratePreview);

  // primer render de resultado
  _renderResult();
}

// export public
window.renderDiagramasView = renderDiagramasView;
window.diagGeneratePreview = diagGeneratePreview;
