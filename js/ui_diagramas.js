// js/ui_diagramas.js
// DIAGRAMAS (IA)
// V1.3: Import DXF (BLOCKS/LAYERS/INSERTS) + preview visual SVG + editor de prompt

window.appState = window.appState || {};
appState.diagramas = appState.diagramas || {
  projectType: "residencial",
  drawMode: "residencial",
  buildings: 1,
  placasPorEdificio: 2,
  placaExteriorPorEdificio: 1,
  viviendasPorEdificio: 15,
  monitoresPorVivienda: 2,
  zones: { comunes: true, refugio: false, domotica: false, controlAccesos: true },
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

  // Prompt editor
  useCustomPrompt: false,
  customPromptText: "", // si vacío, se usa default
  promptUiOpen: false,

  // Catálogo
  catalogJsonText: JSON.stringify(
    {
      catalog_blocks: [
        { name: "VP_STD", device_type: "videoportero", sku_set: ["IPSTYLE-B", "IPSTYLE-S"] },
        { name: "VP_CA", device_type: "videoportero", sku_set: ["IPSTYLE-CA"] },
        { name: "SWITCH_POE", device_type: "switch_poe", sku_set: ["SWITCH-POE-8", "SWITCH-POE-16"] },
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

/* ======================================================
   DXF (lite) parsing helpers
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
    .map((name) => ({ name, device_type: "unknown", sku_set: [] }));

  return JSON.stringify({ catalog_blocks }, null, 2);
}

/* ======================================================
   Preview SVG
 ====================================================== */

function _safeNum(x) {
  return Number.isFinite(x) ? x : null;
}

function _computeBounds(points) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return null;
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  return { minX, minY, maxX, maxY, w, h };
}

function _renderSvgPreview() {
  const host = _el("diagPreview");
  if (!host) return;

  const s = appState.diagramas;
  const layerFilter = s.dxfLayerFilter || "__ALL__";
  const raw = Array.isArray(s.dxfInserts) ? s.dxfInserts : [];
  const pts = raw
    .filter((it) => it && it.block)
    .filter((it) => layerFilter === "__ALL__" || (it.layer || "0") === layerFilter)
    .slice(0, 2000)
    .map((it, idx) => ({
      id: `I${idx + 1}`,
      block: it.block,
      x: _safeNum(it.x),
      y: _safeNum(it.y),
      layer: it.layer || "0",
    }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

  if (!pts.length) {
    host.innerHTML = `<div class="muted">Preview: carga un DXF con INSERTS para ver el plano.</div>`;
    return;
  }

  const bounds = _computeBounds(pts);
  if (!bounds) {
    host.innerHTML = `<div class="muted">Preview: no hay coordenadas válidas.</div>`;
    return;
  }

  // Map id -> point
  const pointMap = new Map();
  for (const p of pts) pointMap.set(p.id, p);

  // Connections: si la IA devuelve from/to como ids de inserts o placements,
  // intentamos pintar si existen coords en meta o si el id coincide con I*
  const connections = Array.isArray(s.lastResult?.connections) ? s.lastResult.connections : [];

  // Construimos un map de coords para placements si vienen en meta
  const placements = Array.isArray(s.lastResult?.placements) ? s.lastResult.placements : [];
  const placementMap = new Map();
  for (const pl of placements) {
    const x = _safeNum(pl?.meta?.x);
    const y = _safeNum(pl?.meta?.y);
    if (pl?.id && Number.isFinite(x) && Number.isFinite(y)) {
      placementMap.set(pl.id, { x, y });
    }
  }

  function getXY(id) {
    if (pointMap.has(id)) return pointMap.get(id);
    if (placementMap.has(id)) return placementMap.get(id);
    return null;
  }

  // SVG viewBox: invertimos Y para que se vea “como CAD” (opcional),
  // aquí lo dejamos sin invertir para no liar; si lo quieres invertimos luego.
  const pad = 20;
  const vbX = bounds.minX - pad;
  const vbY = bounds.minY - pad;
  const vbW = bounds.w + pad * 2;
  const vbH = bounds.h + pad * 2;

  let linesSvg = "";
  for (const c of connections) {
    const a = c?.from;
    const b = c?.to;
    if (!a || !b) continue;
    const pa = getXY(a);
    const pb = getXY(b);
    if (!pa || !pb) continue;
    linesSvg += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="rgba(99,102,241,.8)" stroke-width="2" />`;
  }

  let pointsSvg = "";
  for (const p of pts) {
    pointsSvg += `<circle cx="${p.x}" cy="${p.y}" r="6" fill="rgba(16,185,129,.85)">
      <title>${_escapeHtml(p.id)} · ${_escapeHtml(p.block)}</title>
    </circle>`;
  }

  host.innerHTML = `
    <div class="muted mb-2">Preview (SVG): puntos=INSERTS · líneas=conexiones IA (si hay)</div>
    <div style="border:1px solid rgba(255,255,255,.08); border-radius:12px; overflow:hidden;">
      <svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="100%" height="420" preserveAspectRatio="xMidYMid meet" style="background:rgba(255,255,255,.02)">
        ${linesSvg}
        ${pointsSvg}
      </svg>
    </div>
  `;
}

/* ======================================================
   DXF Info UI
 ====================================================== */

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
          <h4 style="margin:0;">Blocks (${filteredBlocks.length}/${blocks.length})</h4>
          <div class="form-group mt-2">
            <input id="diagDxfSearch" type="text" placeholder="Buscar block..." value="${_escapeHtml(s.dxfSearch || "")}" />
          </div>
          <div style="max-height:180px; overflow:auto; border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:8px;">
            ${
              filteredBlocks.length
                ? filteredBlocks
                    .slice(0, 250)
                    .map((b) => `<div class="muted" style="padding:2px 0;">• ${_escapeHtml(b)}</div>`)
                    .join("")
                : `<div class="muted">No hay blocks detectados.</div>`
            }
            ${filteredBlocks.length > 250 ? `<div class="muted mt-2">Mostrando 250.</div>` : ""}
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
          <div class="muted">Filtro aplicado al preview y a inserts que se envían a la IA.</div>
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
      _renderSvgPreview();
    });
  }
}

/* ======================================================
   DXF Import
 ====================================================== */

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
    const sample = text.slice(0, 2000);
    const nonPrintable = (sample.match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length;
    if (nonPrintable > 50) throw new Error("DXF parece binario/no-ASCII. Exporta como DXF ASCII.");

    appState.diagramas.dxfText = text;

    const pairs = _dxfToPairs(text);
    const blocks = _dxfExtractBlocks(pairs);
    const layers = _dxfExtractLayers(pairs);
    const inserts = _dxfExtractInserts(pairs, 5000);

    appState.diagramas.dxfBlocks = blocks;
    appState.diagramas.dxfLayers = layers;
    appState.diagramas.dxfInserts = inserts;

    if (blocks.length) {
      appState.diagramas.catalogJsonText = _buildCatalogFromBlocks(blocks);
      appState.diagramas.catalogFromDxf = true;
      const ta = _el("diagCatalog");
      if (ta) ta.value = appState.diagramas.catalogJsonText;
    }

    _renderDxfInfo();
    _renderSvgPreview();
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
   Prompt builder (default + override)
 ====================================================== */

function _defaultInstructions() {
  return `
Eres un diseñador de redes Ethernet para videoportero/control de accesos.

OBJETIVO: Diseñar la red MÁS EFICIENTE usando SOLO cable UTP Cat6.
- Minimiza longitud total de cable aproximando por distancia Euclídea con coordenadas (x,y) de spec.dxf.inserts[].
- Topología: estrella o estrella jerárquica (dispositivos -> switches -> core -> router).
- No inventes dispositivos finales. Trabaja con spec.dxf.inserts[] como dispositivos existentes.
- Si falta infraestructura (router/switches), puedes crearla como VIRTUAL_* en placements.
- Devuelve SOLO JSON VÁLIDO.

Formato exacto:
{
  "placements":[ { "id":"...", "block":"...", "device_type":"...", "meta":{ "source":"DXF"|"VIRTUAL", "x":0, "y":0 } } ],
  "connections":[ { "from":"...", "to":"...", "type":"UTP_CAT6", "approx_len": 12.3 } ],
  "summary": { "total_devices":0, "total_switches":0, "approx_total_cable":0 },
  "errors":[ ... ]
}
  `.trim();
}

function _getEffectiveInstructions() {
  const s = appState.diagramas;
  if (s.useCustomPrompt && String(s.customPromptText || "").trim()) return String(s.customPromptText).trim();
  return _defaultInstructions();
}

/* ======================================================
   IA payload
 ====================================================== */

function _buildDiagramPromptPayload() {
  let catalogObj = null;
  try {
    catalogObj = JSON.parse(appState.diagramas.catalogJsonText || "{}");
  } catch (e) {
    throw new Error("El JSON del catálogo no es válido.");
  }

  const catalogBlocks = Array.isArray(catalogObj?.catalog_blocks) ? catalogObj.catalog_blocks : [];
  if (!catalogBlocks.length) throw new Error("El catálogo está vacío (catalog_blocks).");

  const skus = _parseSkus(appState.diagramas.skusText);
  if (!skus.length) throw new Error("Añade al menos 1 SKU para la prueba.");

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
    project_type: appState.diagramas.projectType,
    draw_mode: appState.diagramas.drawMode,
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
    dxf: {
      file: appState.diagramas.dxfFileName || "",
      layer_filter: layerFilter,
      inserts_count: inserts.length,
      inserts,
      cable: { type: "UTP_CAT6", max_segment_m: 90 },
    },
  };

  const network_rules = {
    default_cable: "UTP_CAT6",
    videoportero: { connects_to: ["switch_poe"], connection: "UTP_CAT6_PoE" },
    access_unit: { connects_to: ["switch_poe"], connection: "UTP_CAT6_PoE" },
    monitor: { connects_to: ["switch"], connection: "UTP_CAT6" },
    switch_poe: { connects_to: ["switch_core", "router"], connection: "UTP_CAT6" },
    switch: { connects_to: ["switch_core", "router"], connection: "UTP_CAT6" },
    switch_core: { connects_to: ["router"], connection: "UTP_CAT6" },
  };

  const instructions = _getEffectiveInstructions();

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

  // sync prompt UI
  appState.diagramas.useCustomPrompt = _boolVal("diagUseCustomPrompt");
  appState.diagramas.customPromptText = _strVal("diagPromptText", appState.diagramas.customPromptText);

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
      mode: "diagram_network_v3_preview",
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
    _renderSvgPreview();
  } catch (e) {
    console.error(e);
    appState.diagramas.lastError = e.message || String(e);
    appState.diagramas.lastResult = null;
    _renderResult();
    _renderSvgPreview();
  } finally {
    _setBusy(false);
  }
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
   View
 ====================================================== */

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
          <h2 style="margin-bottom:4px;">Diagrama (IA) · Preview</h2>
          <div class="muted">DXF + red UTP Cat6. Preview visual + editor de prompt.</div>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <button id="btnDiagTogglePrompt" class="btn">Prompt</button>
          <button id="btnDiagGenerate" class="btn btn-primary">Generar preview</button>
          <span id="diagBusy" class="muted" style="display:none;">Generando…</span>
        </div>
      </div>

      <div class="card mt-3" style="padding:12px;">
        <h3>DXF (import)</h3>
        <div class="muted mb-2">Carga un DXF ASCII. Extraemos INSERTS (puntos) y la IA devuelve conexiones.</div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <input id="diagDxfFile" type="file" accept=".dxf" />
          <button id="btnDiagUseDxfCatalog" class="btn">Usar catálogo DXF</button>
          <span class="muted">${
            s.dxfFileName
              ? `Cargado: <b>${_escapeHtml(s.dxfFileName)}</b> · inserts: ${(s.dxfInserts || []).length}`
              : "Sin DXF cargado"
          }</span>
        </div>
        <div id="diagDxfInfo"></div>
      </div>

      <div id="diagPromptBox" class="card mt-3" style="padding:12px; display:${s.promptUiOpen ? "" : "none"};">
        <h3>Prompt</h3>
        <div class="muted mb-2">Activa “usar prompt personalizado” si quieres controlar exactamente el comportamiento.</div>
        <label style="display:flex; gap:8px; align-items:center;">
          <input id="diagUseCustomPrompt" type="checkbox"${s.useCustomPrompt ? " checked" : ""}/> Usar prompt personalizado
        </label>
        <div class="form-group mt-2">
          <textarea id="diagPromptText" rows="10" placeholder="Pega aquí tu prompt...">${_escapeHtml(
            s.customPromptText || _defaultInstructions()
          )}</textarea>
        </div>
        <div class="muted">Si está desactivado, se usa el prompt por defecto.</div>
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
            <textarea id="diagSkus" rows="6">${_escapeHtml(s.skusText)}</textarea>
          </div>
        </div>

        <div class="card" style="padding:12px;">
          <h3>Catálogo</h3>
          <div class="muted mb-2">${s.catalogFromDxf ? "Generado desde DXF (editable)." : "Manual (editable)."}</div>
          <div class="form-group">
            <textarea id="diagCatalog" rows="18">${_escapeHtml(s.catalogJsonText)}</textarea>
          </div>
        </div>
      </div>

      <div class="card mt-3" style="padding:12px;">
        <h3>Preview visual</h3>
        <div id="diagPreview"></div>
      </div>

      <div class="mt-3" id="diagOutput"></div>
    </div>
  `;

  // binds
  const btn = _el("btnDiagGenerate");
  if (btn) btn.addEventListener("click", diagGeneratePreview);

  const btnToggle = _el("btnDiagTogglePrompt");
  if (btnToggle) {
    btnToggle.addEventListener("click", () => {
      appState.diagramas.promptUiOpen = !appState.diagramas.promptUiOpen;
      renderDiagramasView(); // re-render simple
    });
  }

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
  _renderSvgPreview();
  _renderResult();
}

// export public
window.renderDiagramasView = renderDiagramasView;
window.diagGeneratePreview = diagGeneratePreview;
window.diagImportDxfFile = diagImportDxfFile;
window.diagUseCatalogFromDxf = diagUseCatalogFromDxf;
