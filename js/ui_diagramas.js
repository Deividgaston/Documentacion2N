// js/ui_diagramas.js
// Nueva vista: DIAGRAMAS (IA)
// V1: genera un "preview" (JSON) usando Gemini y muestra el resultado.
// V1.2 (Hito 16): Import DXF (lite) -> extrae BLOCKS/LAYERS/INSERTS y pasa INSERTS a la IA
// para que diseñe red UTP Cat6 optimizando cableado.

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

  // DXF import state
  dxfFileName: "",
  dxfText: "",
  dxfBlocks: [],
  dxfLayers: [],
  dxfInserts: [], // [{block, layer, x, y, z, rot, sx, sy}]
  dxfSearch: "",
  dxfLayerFilter: "__ALL__",
  catalogFromDxf: false,

  // Catálogo (simulado por defecto; luego puede venir del DXF)
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

/* ======================================================
   DXF (lite) parsing helpers
   - ASCII DXF is "group code" lines alternating with value lines.
   - Parse:
     - BLOCK names from SECTION BLOCKS (group code 2 after "BLOCK")
     - LAYER names from TABLE LAYER (records start with "LAYER", group code 2 is name)
     - INSERT entities from SECTION ENTITIES:
       0 INSERT + 2 blockName + 10/20/30 coords + 8 layer + 50 rot + 41/42 scale
 ====================================================== */

function _dxfToPairs(dxfText) {
  const lines = String(dxfText || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  const pairs = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i] != null ? String(lines[i]).trim() : "";
    const value = lines[i + 1] != null ? String(lines[i + 1]).trimEnd() : "";
    if (code === "" && value === "" && i > 50) continue;
    pairs.push([code, value.trim()]);
  }
  return pairs;
}

function _dxfExtractBlocks(pairs) {
  const blocks = [];
  let inBlocksSection = false;
  let inBlockEntity = false;

  for (let i = 0; i < pairs.length; i++) {
    const [c, v] = pairs[i];

    if (c === "0" && v === "SECTION") {
      const next = pairs[i + 1];
      if (next && next[0] === "2") {
        inBlocksSection = next[1] === "BLOCKS";
        inBlockEntity = false;
      }
      continue;
    }

    if (!inBlocksSection) continue;

    if (c === "0" && v === "ENDSEC") {
      inBlocksSection = false;
      inBlockEntity = false;
      continue;
    }

    if (c === "0" && v === "BLOCK") {
      inBlockEntity = true;
      continue;
    }

    if (c === "0" && v === "ENDBLK") {
      inBlockEntity = false;
      continue;
    }

    if (inBlockEntity && c === "2") {
      const name = String(v || "").trim();
      if (name && !blocks.includes(name)) blocks.push(name);
      inBlockEntity = false;
    }
  }

  return blocks;
}

function _dxfExtractLayers(pairs) {
  const layers = [];
  let inTables = false;
  let inLayerTable = false;
  let inLayerRecord = false;

  for (let i = 0; i < pairs.length; i++) {
    const [c, v] = pairs[i];

    if (c === "0" && v === "SECTION") {
      const next = pairs[i + 1];
      if (next && next[0] === "2") {
        inTables = next[1] === "TABLES";
        inLayerTable = false;
        inLayerRecord = false;
      }
      continue;
    }

    if (!inTables) continue;

    if (c === "0" && v === "ENDSEC") {
      inTables = false;
      inLayerTable = false;
      inLayerRecord = false;
      continue;
    }

    if (c === "0" && v === "TABLE") {
      const next = pairs[i + 1];
      inLayerTable = !!(next && next[0] === "2" && next[1] === "LAYER");
      inLayerRecord = false;
      continue;
    }

    if (inLayerTable && c === "0" && v === "ENDTAB") {
      inLayerTable = false;
      inLayerRecord = false;
      continue;
    }

    if (!inLayerTable) continue;

    if (c === "0" && v === "LAYER") {
      inLayerRecord = true;
      continue;
    }

    if (inLayerRecord && c === "2") {
      const name = String(v || "").trim();
      if (name && !layers.includes(name)) layers.push(name);
      inLayerRecord = false;
    }
  }

  return layers;
}

function _dxfExtractInserts(pairs, maxItems = 5000) {
  const inserts = [];
  let inEntities = false;
  let cur = null;

  function flush() {
    if (cur && cur.block) inserts.push(cur);
    cur = null;
  }

  for (let i = 0; i < pairs.length; i++) {
    const [c, v] = pairs[i];

    if (c === "0" && v === "SECTION") {
      const next = pairs[i + 1];
      if (next && next[0] === "2") {
        inEntities = next[1] === "ENTITIES";
        cur = null;
      }
      continue;
    }

    if (!inEntities) continue;

    if (c === "0" && v === "ENDSEC") {
      flush();
      inEntities = false;
      continue;
    }

    if (c === "0" && v === "INSERT") {
      flush();
      cur = { block: null, layer: null, x: null, y: null, z: 0, rot: 0, sx: 1, sy: 1 };
      continue;
    }

    if (!cur) continue;

    if (c === "2") cur.block = String(v || "").trim();
    else if (c === "8") cur.layer = String(v || "").trim();
    else if (c === "10") cur.x = Number(v);
    else if (c === "20") cur.y = Number(v);
    else if (c === "30") cur.z = Number(v);
    else if (c === "50") cur.rot = Number(v);
    else if (c === "41") cur.sx = Number(v);
    else if (c === "42") cur.sy = Number(v);

    if (inserts.length >= maxItems) break;
  }

  flush();

  // normaliza números
  for (const it of inserts) {
    if (!Number.isFinite(it.x)) it.x = null;
    if (!Number.isFinite(it.y)) it.y = null;
    if (!Number.isFinite(it.z)) it.z = 0;
    if (!Number.isFinite(it.rot)) it.rot = 0;
    if (!Number.isFinite(it.sx)) it.sx = 1;
    if (!Number.isFinite(it.sy)) it.sy = 1;
    if (!it.layer) it.layer = "0";
  }

  return inserts;
}

function _buildCatalogFromBlocks(blockNames) {
  const blocks = Array.isArray(blockNames) ? blockNames : [];
  const catalog_blocks = blocks
    .map((name) => String(name || "").trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      device_type: "unknown",
      sku_set: [],
    }));

  return JSON.stringify({ catalog_blocks }, null, 2);
}

function _renderDxfInfo() {
  const host = _el("diagDxfInfo");
  if (!host) return;

  const s = appState.diagramas;
  const blocks = Array.isArray(s.dxfBlocks) ? s.dxfBlocks : [];
  const layers = Array.isArray(s.dxfLayers) ? s.dxfLayers : [];
  const inserts = Array.isArray(s.dxfInserts) ? s.dxfInserts : [];

  const q = String(s.dxfSearch || "").toLowerCase().trim();
  const filteredBlocks = q ? blocks.filter((b) => String(b).toLowerCase().includes(q)) : blocks;

  host.innerHTML = `
    <div class="mt-2">
      <div class="muted">DXF: <b>${_escapeHtml(s.dxfFileName || "—")}</b> · inserts: <b>${inserts.length}</b></div>

      <div class="grid mt-2" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <div class="card" style="padding:10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <h4 style="margin:0;">Blocks (${filteredBlocks.length}/${blocks.length})</h4>
          </div>
          <div class="form-group mt-2">
            <input id="diagDxfSearch" type="text" placeholder="Buscar block..." value="${_escapeHtml(s.dxfSearch || "")}" />
          </div>
          <div style="max-height:220px; overflow:auto; border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:8px;">
            ${
              filteredBlocks.length
                ? filteredBlocks
                    .slice(0, 400)
                    .map((b) => `<div class="muted" style="padding:2px 0;">• ${_escapeHtml(b)}</div>`)
                    .join("")
                : `<div class="muted">No hay blocks detectados.</div>`
            }
            ${filteredBlocks.length > 400 ? `<div class="muted mt-2">Mostrando 400. Refina la búsqueda.</div>` : ""}
          </div>
        </div>

        <div class="card" style="padding:10px;">
          <h4 style="margin:0;">Layers (${layers.length})</h4>
          <div class="form-group mt-2">
            <select id="diagDxfLayerFilter">
              <option value="__ALL__"${s.dxfLayerFilter === "__ALL__" ? " selected" : ""}>Todas</option>
              ${layers
                .slice(0, 500)
                .map(
                  (l) =>
                    `<option value="${_escapeHtml(l)}"${
                      s.dxfLayerFilter === l ? " selected" : ""
                    }>${_escapeHtml(l)}</option>`
                )
                .join("")}
            </select>
          </div>
          <div class="muted">Filtro (lo aplicaremos a inserts/placements en siguientes pasos).</div>
        </div>
      </div>

      <div class="card mt-2" style="padding:10px;">
        <h4 style="margin:0;">Inserts (dispositivos colocados) (${inserts.length})</h4>
        <div class="muted">Se envían a la IA para diseñar la red optimizando cableado (distancia XY).</div>
        <div style="max-height:170px; overflow:auto; border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:8px; margin-top:8px;">
          ${
            inserts.length
              ? inserts
                  .slice(0, 300)
                  .map((it, idx) => {
                    const xy =
                      Number.isFinite(it.x) && Number.isFinite(it.y)
                        ? `(${it.x.toFixed(1)}, ${it.y.toFixed(1)})`
                        : "(sin XY)";
                    return `<div class="muted" style="padding:2px 0;">• #${idx + 1} ${_escapeHtml(
                      it.block
                    )} <span class="muted">layer:${_escapeHtml(it.layer || "0")} ${_escapeHtml(xy)}</span></div>`;
                  })
                  .join("")
              : `<div class="muted">No hay INSERTS detectados.</div>`
          }
          ${inserts.length > 300 ? `<div class="muted mt-2">Mostrando 300.</div>` : ""}
        </div>
      </div>
    </div>
  `;

  const inp = _el("diagDxfSearch");
  if (inp) {
    inp.addEventListener("input", () => {
      appState.diagramas.dxfSearch = _strVal("diagDxfSearch", "");
      _renderDxfInfo();
    });
  }

  const sel = _el("diagDxfLayerFilter");
  if (sel) {
    sel.addEventListener("change", () => {
      appState.diagramas.dxfLayerFilter = _strVal("diagDxfLayerFilter", "__ALL__");
    });
  }
}

async function diagImportDxfFile(file) {
  if (!file) return;

  appState.diagramas.lastError = null;
  appState.diagramas.dxfFileName = file.name || "";
  appState.diagramas.dxfText = "";
  appState.diagramas.dxfBlocks = [];
  appState.diagramas.dxfLayers = [];
  appState.diagramas.dxfInserts = [];

  const okExt = /\.dxf$/i.test(file.name || "");
  if (!okExt) {
    appState.diagramas.lastError = "El archivo no parece DXF (.dxf).";
    _renderResult();
    return;
  }

  try {
    const text = await file.text();

    // Heurística de binario
    const sample = text.slice(0, 2000);
    const nonPrintable = (sample.match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length;
    if (nonPrintable > 50) {
      throw new Error("DXF parece binario o no-ASCII. Exporta como DXF ASCII y reintenta.");
    }

    appState.diagramas.dxfText = text;

    const pairs = _dxfToPairs(text);
    const blocks = _dxfExtractBlocks(pairs);
    const layers = _dxfExtractLayers(pairs);
    const inserts = _dxfExtractInserts(pairs, 5000);

    appState.diagramas.dxfBlocks = blocks;
    appState.diagramas.dxfLayers = layers;
    appState.diagramas.dxfInserts = inserts;

    // Auto-catálogo por blocks
    if (blocks.length) {
      appState.diagramas.catalogJsonText = _buildCatalogFromBlocks(blocks);
      appState.diagramas.catalogFromDxf = true;
      const ta = _el("diagCatalog");
      if (ta) ta.value = appState.diagramas.catalogJsonText;
    }

    _renderDxfInfo();
    _renderResult();
  } catch (e) {
    appState.diagramas.lastError = e.message || String(e);
    _renderResult();
  }
}

function diagUseCatalogFromDxf() {
  const blocks = Array.isArray(appState.diagramas.dxfBlocks) ? appState.diagramas.dxfBlocks : [];
  if (!blocks.length) {
    appState.diagramas.lastError = "No hay blocks DXF cargados para generar catálogo.";
    _renderResult();
    return;
  }
  appState.diagramas.catalogJsonText = _buildCatalogFromBlocks(blocks);
  appState.diagramas.catalogFromDxf = true;

  const ta = _el("diagCatalog");
  if (ta) ta.value = appState.diagramas.catalogJsonText;

  appState.diagramas.lastError = null;
  _renderResult();
}

/* ======================================================
   IA prompt payload
 ====================================================== */

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

  // Inserts (dispositivos en plano) -> para que la IA optimice cableado
  const layerFilter = appState.diagramas.dxfLayerFilter || "__ALL__";
  const rawInserts = Array.isArray(appState.diagramas.dxfInserts) ? appState.diagramas.dxfInserts : [];
  const inserts = rawInserts
    .filter((it) => !!it && !!it.block)
    .filter((it) => layerFilter === "__ALL__" || (it.layer || "0") === layerFilter)
    .slice(0, 1200)
    .map((it, idx) => ({
      id: `I${idx + 1}`,
      block: it.block,
      layer: it.layer || "0",
      x: Number.isFinite(it.x) ? it.x : null,
      y: Number.isFinite(it.y) ? it.y : null,
    }));

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

    // DXF context (real)
    dxf: {
      file: appState.diagramas.dxfFileName || "",
      layer_filter: layerFilter,
      blocks_count: Array.isArray(appState.diagramas.dxfBlocks) ? appState.diagramas.dxfBlocks.length : 0,
      inserts_count: inserts.length,
      inserts, // <-- lo más importante para diseñar red en plano
      cable: { type: "UTP_CAT6", max_segment_m: 90 }, // heurística típica Ethernet
    },
  };

  // 3) Network rules base
  const network_rules = {
    // Todo por Cat6
    default_cable: "UTP_CAT6",
    topologies: ["star", "hierarchical_star"],

    // Si detectas PoE (placas / videoportero), conectar a switch PoE
    videoportero: { connects_to: ["switch_poe"], connection: "UTP_CAT6_PoE" },
    access_unit: { connects_to: ["switch_poe"], connection: "UTP_CAT6_PoE" },

    // Monitores normalmente LAN (no PoE o PoE depende), dejamos LAN
    monitor: { connects_to: ["switch"], connection: "UTP_CAT6" },

    // Switches
    switch_poe: { connects_to: ["switch_core", "router"], connection: "UTP_CAT6" },
    switch: { connects_to: ["switch_core", "router"], connection: "UTP_CAT6" },
    switch_core: { connects_to: ["router"], connection: "UTP_CAT6" },

    router: { connects_to: ["internet"], connection: "WAN" },
  };

  // 4) Strict instruction: diseñador de redes, optimiza distancia XY (aprox cable)
  const instructions = `
Eres un diseñador de redes (Ethernet) para videoportero/control de accesos.

OBJETIVO: Diseñar la red MÁS EFICIENTE usando SOLO cable UTP Cat6.
- Minimiza longitud total de cable aproximando por distancia Euclídea con coordenadas (x,y) del DXF inserts[].
- Usa topología estrella o estrella jerárquica: dispositivos -> switches (PoE si aplica) -> core -> router.
- No inventes dispositivos que no existan. Trabaja con spec.dxf.inserts[] como “dispositivos en plano”.
- Si falta algún elemento imprescindible (ej. switch/router), puedes crear EXACTAMENTE 1 router y N switches necesarios,
  pero deben aparecer en placements con block="VIRTUAL_*" (p.ej. "VIRTUAL_SWITCH_POE") para que el usuario lo añada al plano luego.
- Conecta cada dispositivo al switch más cercano (o al mejor candidato) respetando capacidad lógica:
  - videoporteros/access units preferiblemente a switch PoE
  - monitores a switch normal o PoE si no hay otro
- Evita cadenas largas device->device. No hagas daisy-chain salvo switches.
- DEVUELVE SOLO JSON VÁLIDO. Nada de texto fuera del JSON.

Formato exacto:
{
  "placements":[
    { "id":"...", "block":"...", "device_type":"...", "meta":{ "source":"DXF"|"VIRTUAL", "x":0, "y":0 } }
  ],
  "connections":[
    { "from":"...", "to":"...", "type":"UTP_CAT6", "approx_len": 12.3 }
  ],
  "summary": { "total_devices":0, "total_switches":0, "approx_total_cable":0 },
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

  const handler = window.handleDocSectionAI || window.handleAI || window.callGemini || null;
  if (typeof handler !== "function") {
    appState.diagramas.lastError =
      "No encuentro el handler de IA (ej. window.handleDocSectionAI). Pásame el archivo donde lo defines y lo conectamos.";
    _renderResult();
    return;
  }

  _setBusy(true);
  try {
    const res = await handler({
      mode: "diagram_network_v2_cat6",
      instructions: payload.instructions,
      catalog_blocks: payload.catalog_blocks,
      spec: payload.spec,
      network_rules: payload.network_rules,
      user: { email: appState?.user?.email || "", role: appState?.user?.role || "" },
    });

    let obj = res;
    if (typeof res === "string") {
      try {
        obj = JSON.parse(res);
      } catch (e) {
        throw new Error("La IA no devolvió JSON válido.");
      }
    }

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

  const caps = appState?.user?.capabilities;
  const allowed = (caps?.pages && !!caps.pages.diagramas) || (caps?.views && !!caps.views.diagramas);

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
          <h2 style="margin-bottom:4px;">Diagrama (IA) · DXF + Red Cat6</h2>
          <div class="muted">Importa DXF (BLOCKS/INSERTS) y genera el diseño de red UTP Cat6 optimizado.</div>
        </div>
        <div>
          <button id="btnDiagGenerate" class="btn btn-primary">Generar preview</button>
          <span id="diagBusy" class="muted" style="display:none; margin-left:8px;">Generando…</span>
        </div>
      </div>

      <div class="card mt-3" style="padding:12px;">
        <h3>DXF (import)</h3>
        <div class="muted mb-2">Carga un DXF ASCII. Extraemos <b>BLOCKS</b> e <b>INSERTS</b> (posiciones) y se lo pasamos a la IA.</div>

        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <input id="diagDxfFile" type="file" accept=".dxf" />
          <button id="btnDiagUseDxfCatalog" class="btn">Usar catálogo DXF</button>
          <span class="muted">${
            s.dxfFileName
              ? `Cargado: <b>${_escapeHtml(s.dxfFileName)}</b> · blocks: ${(s.dxfBlocks || []).length} · inserts: ${(s.dxfInserts || []).length}`
              : "Sin DXF cargado"
          }</span>
        </div>

        <div id="diagDxfInfo"></div>
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
          <h3>Catálogo</h3>
          <div class="muted mb-2">${s.catalogFromDxf ? "Catálogo generado desde DXF (editable)." : "Catálogo manual (editable)."}</div>
          <div class="form-group">
            <textarea id="diagCatalog" rows="18">${_escapeHtml(s.catalogJsonText)}</textarea>
          </div>
          <div class="muted">
            Tip: para que la IA use un bloque, rellena <b>sku_set</b> con SKUs reales y pon un <b>device_type</b> coherente.
          </div>
        </div>
      </div>

      <div class="mt-3" id="diagOutput"></div>
    </div>
  `;

  const btn = _el("btnDiagGenerate");
  if (btn) btn.addEventListener("click", diagGeneratePreview);

  const inpFile = _el("diagDxfFile");
  if (inpFile) {
    inpFile.addEventListener("change", async () => {
      const f = inpFile.files && inpFile.files[0] ? inpFile.files[0] : null;
      await diagImportDxfFile(f);
    });
  }

  const btnUse = _el("btnDiagUseDxfCatalog");
  if (btnUse) btnUse.addEventListener("click", diagUseCatalogFromDxf);

  _renderDxfInfo();
  _renderResult();
}

// export public
window.renderDiagramasView = renderDiagramasView;
window.diagGeneratePreview = diagGeneratePreview;
window.diagImportDxfFile = diagImportDxfFile;
window.diagUseCatalogFromDxf = diagUseCatalogFromDxf;
