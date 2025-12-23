// js/ui_diagramas.js
// Vista: DIAGRAMAS (IA)
// V2.2 (Hito nuevo - opción 2):
// - Fix IA: envía sectionKey + aliases + sectionText para compatibilidad con handleDocSectionAI
// - Anclaje en plano por click (canvas con rejilla)
// - Export DXF: usa anchors si existen; si no, esquema por zonas

window.appState = window.appState || {};
appState.diagramas = appState.diagramas || {
  // Biblioteca DXF (iconos)
  dxfFileName: "",
  dxfText: "",
  dxfBlocks: [],

  // Paleta refs proyecto
  refs: [], // [{ref, descripcion, qty}]
  refsSearch: "",

  // Zonas y asignaciones
  zones: [
    { key: "entrada_principal", label: "Entrada principal" },
    { key: "portales_interiores", label: "Portales interiores" },
    { key: "zonas_comunes", label: "Zonas comunes" },
    { key: "zonas_refugio", label: "Zonas refugio" },
    { key: "armario_cpd", label: "Armario / CPD" },
  ],
  assignments: {
    // zoneKey: [{id, ref, descripcion, qty, iconBlock}]
  },

  // Plano (anclaje por click)
  plan: {
    // No parseamos DXF aún: esto es un canvas con rejilla para anclar
    w: 960,
    h: 520,
    grid: 40,
    anchors: {}, // id -> {x,y} en coords de canvas
    selectedPlacementId: null, // id seleccionado para anclar
    invertYForDxf: true, // DXF típico: Y hacia arriba. Canvas: Y hacia abajo.
    scale: 1, // factor simple (canvas -> dxf units)
    offsetX: 0,
    offsetY: 0,
    show: true,
  },

  // Prompt editor
  promptUiOpen: false,
  useCustomPrompt: false,
  customPromptText: "",

  // Resultado IA
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

function _escapeHtmlAttr(s) {
  return _escapeHtml(s).replaceAll('"', "&quot;");
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
    out.innerHTML = `<div class="muted">Asigna referencias a zonas, ancla posiciones en el plano (opcional) y pulsa <b>Generar diseño</b>.</div>`;
    return;
  }

  const pretty = _escapeHtml(JSON.stringify(appState.diagramas.lastResult, null, 2));
  out.innerHTML = `
    <div class="mb-2" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
      <span class="chip">Diseño IA (JSON)</span>
      <span class="muted">UTP Cat6 · topología eficiente</span>
    </div>
    <pre style="white-space:pre-wrap; background:#0b1020; color:#e5e7eb; padding:12px; border-radius:10px; overflow:auto;">${pretty}</pre>
  `;
}

/* ======================================================
   1) Cargar referencias del proyecto (presupuesto)
 ====================================================== */

function diagLoadProjectRefs() {
  const presu = appState?.presupuesto;
  const lineas = Array.isArray(presu?.lineas) ? presu.lineas : [];

  const map = new Map();
  for (const l of lineas) {
    const ref = String(l?.ref || "").trim();
    if (!ref) continue;
    const qty = Number(l?.cantidad || l?.qty || 0) || 0;
    const desc = String(l?.descripcion || "").trim();

    if (!map.has(ref)) {
      map.set(ref, { ref, descripcion: desc, qty: qty > 0 ? qty : 0 });
    } else {
      const it = map.get(ref);
      it.qty += qty > 0 ? qty : 0;
      if (!it.descripcion && desc) it.descripcion = desc;
    }
  }

  appState.diagramas.refs = Array.from(map.values()).sort((a, b) => a.ref.localeCompare(b.ref));

  appState.diagramas.assignments = appState.diagramas.assignments || {};
  for (const z of appState.diagramas.zones) {
    if (!Array.isArray(appState.diagramas.assignments[z.key])) {
      appState.diagramas.assignments[z.key] = [];
    }
  }
}

/* ======================================================
   2) DXF (lite): extrae BLOCKS (biblioteca de iconos)
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

async function diagImportDxfFile(file) {
  if (!file) return;

  appState.diagramas.lastError = null;
  appState.diagramas.dxfFileName = file.name || "";
  appState.diagramas.dxfText = "";
  appState.diagramas.dxfBlocks = [];

  if (!/\.dxf$/i.test(file.name || "")) {
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
    appState.diagramas.dxfBlocks = blocks.sort((a, b) => a.localeCompare(b));

    _renderDiagramasUI();
    _renderResult();
  } catch (e) {
    appState.diagramas.lastError = e.message || String(e);
    _renderResult();
  }
}

/* ======================================================
   3) Drag & Drop (paleta -> zonas)
 ====================================================== */

let _dragRefKey = null;

function _onRefDragStart(ev, ref) {
  _dragRefKey = String(ref || "");
  try {
    ev.dataTransfer.setData("text/plain", _dragRefKey);
    ev.dataTransfer.effectAllowed = "copy";
  } catch (_) {}
}

function _onZoneDragOver(ev) {
  ev.preventDefault();
  try {
    ev.dataTransfer.dropEffect = "copy";
  } catch (_) {}
  const zone = ev.currentTarget;
  if (zone) zone.classList.add("is-drag-over");
}

function _onZoneDragLeave(ev) {
  const zone = ev.currentTarget;
  if (zone) zone.classList.remove("is-drag-over");
}

function _onZoneDrop(ev, zoneKey) {
  ev.preventDefault();
  const zone = ev.currentTarget;
  if (zone) zone.classList.remove("is-drag-over");

  let ref = "";
  try {
    ref = ev.dataTransfer.getData("text/plain") || "";
  } catch (_) {
    ref = _dragRefKey || "";
  }
  ref = String(ref || "").trim();
  if (!ref) return;

  const source = (appState.diagramas.refs || []).find((r) => r.ref === ref);
  if (!source) return;

  const list = (appState.diagramas.assignments[zoneKey] = appState.diagramas.assignments[zoneKey] || []);
  const existing = list.find((x) => x.ref === ref);

  if (existing) {
    existing.qty = Number(existing.qty || 0) + 1;
  } else {
    list.push({
      id: `A_${zoneKey}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ref: source.ref,
      descripcion: source.descripcion || "",
      qty: Math.max(1, Number(source.qty || 1) || 1),
      iconBlock: "",
    });
  }

  _renderDiagramasUI();
}

function _removeAssignment(zoneKey, id) {
  const list = appState.diagramas.assignments[zoneKey] || [];
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) list.splice(idx, 1);

  // borra anclaje si existía
  if (appState.diagramas.plan?.anchors && appState.diagramas.plan.anchors[id]) {
    delete appState.diagramas.plan.anchors[id];
  }
  if (appState.diagramas.plan?.selectedPlacementId === id) {
    appState.diagramas.plan.selectedPlacementId = null;
  }

  _renderDiagramasUI();
  _drawPlan();
}

function _updateAssignment(zoneKey, id, patch) {
  const list = appState.diagramas.assignments[zoneKey] || [];
  const it = list.find((x) => x.id === id);
  if (!it) return;
  Object.assign(it, patch);
}

/* ======================================================
   4) AUTO icon suggestion (por heurística)
 ====================================================== */

function _norm(s) {
  return String(s || "").toLowerCase();
}

function _suggestIconBlockForItem(item, blocks) {
  const text = `${item.ref || ""} ${item.descripcion || ""}`.toLowerCase();
  const rules = [
    { patterns: ["ip style", "ipstyle"], blockHints: ["ip style", "ipstyle"] },
    { patterns: ["ip one", "ipone"], blockHints: ["ip one", "ipone"] },
    { patterns: ["indoor", "monitor", "pantalla"], blockHints: ["indoor", "monitor"] },
    { patterns: ["access", "unit", "ble", "rfid", "lector"], blockHints: ["access", "unit"] },
    { patterns: ["switch", "poe"], blockHints: ["switch", "poe"] },
    { patterns: ["router", "gateway"], blockHints: ["router", "gateway"] },
    { patterns: ["server", "nvr"], blockHints: ["server", "nvr"] },
  ];

  const bNorm = blocks.map((b) => ({ raw: b, n: _norm(b) }));

  for (const r of rules) {
    if (!r.patterns.some((p) => text.includes(p))) continue;
    for (const hint of r.blockHints) {
      const hit = bNorm.find((x) => x.n.includes(_norm(hint)));
      if (hit) return hit.raw;
    }
  }

  const refNorm = _norm(item.ref);
  if (refNorm) {
    const hit2 = bNorm.find((x) => x.n.includes(refNorm));
    if (hit2) return hit2.raw;
  }

  return "";
}

function diagAutoAssignIcons() {
  const blocks = Array.isArray(appState.diagramas.dxfBlocks) ? appState.diagramas.dxfBlocks : [];
  if (!blocks.length) {
    appState.diagramas.lastError = "Carga primero la plantilla DXF para poder sugerir iconos (BLOCKS).";
    _renderResult();
    return;
  }

  appState.diagramas.lastError = null;

  for (const z of appState.diagramas.zones) {
    const list = appState.diagramas.assignments[z.key] || [];
    for (const it of list) {
      if (it.iconBlock) continue;
      const sug = _suggestIconBlockForItem(it, blocks);
      if (sug) it.iconBlock = sug;
    }
  }

  _renderDiagramasUI();
  _renderResult();
}

/* ======================================================
   5) Prompt + payload IA
 ====================================================== */

function _defaultInstructions() {
  return `
Eres un diseñador de redes Ethernet.

Contexto:
- El usuario ha asignado referencias (ref) del presupuesto a zonas del edificio:
  entrada_principal, portales_interiores, zonas_comunes, zonas_refugio, armario_cpd.
- Solo se permite cableado UTP categoría 6 (Cat6).
- El usuario puede anclar posiciones (x,y) en el plano: si existen anchors, NO propongas posiciones.

Objetivo:
- Diseña la red más eficiente y mantenible.
- Topología preferida: estrella jerárquica (dispositivos -> switches de zona -> core -> router).
- Agrupa por zonas; si hay Armario/CPD úsalo como ubicación de core/router.
- No inventes dispositivos finales: SOLO usa los asignados por el usuario.
- Sí puedes proponer infraestructura si hace falta (switches/core/router) en infra[] como VIRTUAL_*.

DEVUELVE SOLO JSON válido con este formato exacto:
{
  "placements":[
    { "id":"...", "ref":"...", "zone":"...", "icon_block":"...", "qty":1, "meta":{ "source":"USER"|"VIRTUAL", "pos": {"x":0,"y":0} } }
  ],
  "infra":[
    { "id":"...", "type":"VIRTUAL_SWITCH_POE"|"VIRTUAL_SWITCH"|"VIRTUAL_CORE"|"VIRTUAL_ROUTER", "zone":"...", "meta":{...} }
  ],
  "connections":[
    { "from":"...", "to":"...", "type":"UTP_CAT6", "note":"..." }
  ],
  "summary": { "total_refs":0, "total_devices":0, "total_switches":0 },
  "errors":[ ... ]
}
`.trim();
}

function _getEffectiveInstructions() {
  const s = appState.diagramas;
  if (s.useCustomPrompt && String(s.customPromptText || "").trim()) return String(s.customPromptText).trim();
  return _defaultInstructions();
}

function _buildAiPayload() {
  const zones = appState.diagramas.zones || [];
  const assignments = appState.diagramas.assignments || {};
  const anchors = appState.diagramas.plan?.anchors || {};

  const placements = [];
  for (const z of zones) {
    const list = Array.isArray(assignments[z.key]) ? assignments[z.key] : [];
    for (const it of list) {
      placements.push({
        id: it.id,
        ref: it.ref,
        descripcion: it.descripcion || "",
        zone: z.key,
        icon_block: it.iconBlock || "",
        qty: Number(it.qty || 0) || 0,
        meta: {
          source: "USER",
          pos: anchors[it.id] ? { x: anchors[it.id].x, y: anchors[it.id].y } : null,
        },
      });
    }
  }

  if (!placements.length) throw new Error("No hay referencias asignadas. Arrastra refs a alguna zona.");

  const iconLibrary = Array.isArray(appState.diagramas.dxfBlocks) ? appState.diagramas.dxfBlocks : [];

  const spec = {
    cable: "UTP_CAT6",
    zones: zones.map((z) => ({ key: z.key, label: z.label })),
    placements,
    has_anchors: Object.keys(anchors).length > 0,
    icon_library_blocks: iconLibrary.slice(0, 2000),
  };

  const network_rules = {
    cable: "UTP_CAT6",
    topology: ["hierarchical_star", "star"],
    hints: {
      poe_keywords: ["IPSTYLE", "ACCESS", "UNIT", "CA", "READER", "IP ONE", "INTERCOM"],
      cpd_zone_key: "armario_cpd",
    },
  };

  return { instructions: _getEffectiveInstructions(), spec, network_rules };
}

// --- FIX compat handler: sectionKey + aliases + sectionText ---
function _buildHandlerEnvelope(payload) {
  const sectionKey = "diagramas_network";
  const docKey = "diagramas";

  // Algunos handlers de Documentación esperan un "texto de sección"
  const sectionText = [
    "DIAGRAMAS / NETWORK",
    payload.instructions,
    JSON.stringify({ spec: payload.spec, network_rules: payload.network_rules }).slice(0, 6000),
  ].join("\n\n");

  return {
    // claves "doc" / "section" en todas las variantes típicas
    docKey,
    doc_key: docKey,
    documentKey: docKey,

    sectionKey,
    section_key: sectionKey,
    sectionId: sectionKey,
    section_id: sectionKey,

    // contenido en variantes típicas
    sectionText,
    section_text: sectionText,
    content: sectionText,
    text: sectionText,

    // tu payload real
    mode: "diagram_network_v5_zones_cpd",
    instructions: payload.instructions,
    spec: payload.spec,
    network_rules: payload.network_rules,
    user: { email: appState?.user?.email || "", role: appState?.user?.role || "" },
  };
}

function _coerceTextFromHandlerResponse(res) {
  if (res == null) return "";
  if (typeof res === "string") return res;

  // Algunos handlers devuelven objetos con el texto en campos típicos
  const candidates = [
    res.text,
    res.output_text,
    res.outputText,
    res.content,
    res.result,
    res.data,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }

  // Si viene algo como { ok:true, response:"..." }
  if (typeof res.response === "string") return res.response;

  // Último recurso: stringify
  try {
    return JSON.stringify(res);
  } catch (_) {
    return String(res);
  }
}

function _extractJsonString(s) {
  const t = String(s || "").trim();
  if (!t) return "";

  // 1) Bloque ```json ... ```
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) return fence[1].trim();

  // 2) Primer { ... último }
  const i0 = t.indexOf("{");
  const i1 = t.lastIndexOf("}");
  if (i0 >= 0 && i1 > i0) return t.slice(i0, i1 + 1).trim();

  return "";
}

function _parseJsonRobust(res) {
  if (res == null) return { ok: false, error: "Respuesta vacía", raw: "" };

  // Si ya es objeto y parece JSON esperado
  if (typeof res === "object") {
    // Si ya tiene la forma final, úsalo
    if (("placements" in res) && ("connections" in res) && ("errors" in res)) {
      return { ok: true, obj: res, raw: "" };
    }
  }

  const rawText = _coerceTextFromHandlerResponse(res);
  const jsonText = _extractJsonString(rawText);

  if (!jsonText) {
    return {
      ok: false,
      error: "La IA devolvió texto sin JSON reconocible (no encuentro { ... }).",
      raw: rawText,
    };
  }

  try {
    const obj = JSON.parse(jsonText);
    return { ok: true, obj, raw: rawText };
  } catch (e) {
    return {
      ok: false,
      error: "El JSON extraído no se puede parsear (JSON.parse falla).",
      raw: rawText,
    };
  }
}

async function diagGenerateDesign() {
  appState.diagramas.lastError = null;
  appState.diagramas.lastResult = null;

  // (opcional) guarda el raw de la IA para debug si algo va mal
  appState.diagramas.lastRaw = null;

  _renderResult();

  // Sync prompt UI
  appState.diagramas.useCustomPrompt = !!(_el("diagUseCustomPrompt") && _el("diagUseCustomPrompt").checked);
  appState.diagramas.customPromptText = _el("diagPromptText")
    ? String(_el("diagPromptText").value || "")
    : appState.diagramas.customPromptText;

  let payload;
  try {
    payload = _buildAiPayload();
  } catch (e) {
    appState.diagramas.lastError = e.message || String(e);
    _renderResult();
    return;
  }

  const handler = window.handleDocSectionAI || window.handleAI || window.callGemini || null;
  if (typeof handler !== "function") {
    appState.diagramas.lastError = "No encuentro el handler de IA (ej. window.handleDocSectionAI).";
    _renderResult();
    return;
  }

  _setBusy(true);
  try {
    const env = _buildHandlerEnvelope(payload);

    const res = await handler(env);

    const parsed = _parseJsonRobust(res);
    if (!parsed.ok) {
      appState.diagramas.lastRaw = parsed.raw || null;
      throw new Error(parsed.error || "La IA no devolvió JSON válido.");
    }

    const obj = parsed.obj;

    // Validación mínima estructura
    if (!obj || typeof obj !== "object") throw new Error("Respuesta IA inválida.");
    if (!("placements" in obj) || !("connections" in obj) || !("errors" in obj)) {
      appState.diagramas.lastRaw = parsed.raw || null;
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


/* ======================================================
   6) Plano (canvas) - anclaje por click
 ====================================================== */

function _getAllAssignmentsFlat() {
  const out = [];
  for (const z of appState.diagramas.zones) {
    const list = appState.diagramas.assignments[z.key] || [];
    for (const it of list) out.push({ zoneKey: z.key, zoneLabel: z.label, it });
  }
  return out;
}

function _selectForAnchoring(id) {
  appState.diagramas.plan.selectedPlacementId = id || null;
  _renderDiagramasUI();
  _drawPlan();
}

function _drawPlan() {
  const cv = _el("diagPlanCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  if (!ctx) return;

  const plan = appState.diagramas.plan;
  const w = plan.w, h = plan.h;
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;

  // background
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // grid
  const g = Math.max(10, Number(plan.grid || 40));
  ctx.strokeStyle = "rgba(15,23,42,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += g) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += g) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // anchors
  const anchors = plan.anchors || {};
  const selected = plan.selectedPlacementId;

  const flat = _getAllAssignmentsFlat();
  const idToLabel = new Map(flat.map((x) => [x.it.id, `${x.it.ref}`]));

  for (const id of Object.keys(anchors)) {
    const p = anchors[id];
    if (!p) continue;

    const isSel = id === selected;
    ctx.beginPath();
    ctx.fillStyle = isSel ? "rgba(29,79,216,0.9)" : "rgba(17,24,39,0.75)";
    ctx.arc(p.x, p.y, isSel ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(17,24,39,0.85)";
    const label = idToLabel.get(id) || id;
    ctx.fillText(label, p.x + 10, p.y - 8);
  }

  // hint selected
  if (selected) {
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(29,79,216,0.95)";
    ctx.fillText("Click en el plano para anclar el elemento seleccionado", 12, h - 12);
  } else {
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(107,114,128,0.95)";
    ctx.fillText("Selecciona un elemento (en las zonas) para anclarlo aquí", 12, h - 12);
  }
}

function _planCanvasClick(ev) {
  const plan = appState.diagramas.plan;
  const id = plan.selectedPlacementId;
  if (!id) return;

  const cv = ev.currentTarget;
  const rect = cv.getBoundingClientRect();
  const x = Math.round((ev.clientX - rect.left) * (cv.width / rect.width));
  const y = Math.round((ev.clientY - rect.top) * (cv.height / rect.height));

  plan.anchors = plan.anchors || {};
  plan.anchors[id] = { x, y };

  _drawPlan();
}

/* ======================================================
   7) Export DXF
   - Si hay anchors: usa anchors (coords canvas -> dxf)
   - Si no: esquema por zonas (legacy)
 ====================================================== */

function _dxfLine(x1, y1, x2, y2, layer = "CABLE") {
  return ["0","LINE","8",layer,"10",String(x1),"20",String(y1),"30","0","11",String(x2),"21",String(y2),"31","0"].join("\n");
}
function _dxfCircle(x, y, r, layer = "NODES") {
  return ["0","CIRCLE","8",layer,"10",String(x),"20",String(y),"30","0","40",String(r)].join("\n");
}
function _dxfText(x, y, h, text, layer = "LABELS") {
  const t = String(text || "").replaceAll("\n", " ");
  return ["0","TEXT","8",layer,"10",String(x),"20",String(y),"30","0","40",String(h),"1",t].join("\n");
}

function _canvasToDxf(x, y) {
  const plan = appState.diagramas.plan;
  const sx = Number(plan.scale || 1);
  const ox = Number(plan.offsetX || 0);
  const oy = Number(plan.offsetY || 0);

  let dx = x * sx + ox;
  let dy = y * sx + oy;

  if (plan.invertYForDxf) {
    dy = (plan.h - y) * sx + oy;
  }
  return { x: dx, y: dy };
}

function _buildCoordsFromAnchorsOrSchematic(result) {
  const plan = appState.diagramas.plan;
  const anchors = plan.anchors || {};
  const hasAnchors = Object.keys(anchors).length > 0;

  if (hasAnchors) {
    const map = new Map();
    const placements = Array.isArray(result?.placements) ? result.placements : [];
    const infra = Array.isArray(result?.infra) ? result.infra : [];

    for (const p of placements) {
      const a = anchors[p.id];
      if (!a) continue; // solo exporta colocados
      const d = _canvasToDxf(a.x, a.y);
      const label = `${p.ref || p.id || ""}${p.qty ? ` x${p.qty}` : ""}`;
      map.set(p.id, { x: d.x, y: d.y, label });
    }

    // Infra: si no hay anclaje, lo colocamos por defecto en CPD (centro)
    const cpdCenterCanvas = { x: Math.round(plan.w * 0.82), y: Math.round(plan.h * 0.18) };
    const cpdCenterDxf = _canvasToDxf(cpdCenterCanvas.x, cpdCenterCanvas.y);

    for (const n of infra) {
      const a = anchors[n.id];
      const d = a ? _canvasToDxf(a.x, a.y) : cpdCenterDxf;
      const label = `${n.type || n.id || ""}`;
      map.set(n.id, { x: d.x, y: d.y, label });
    }

    return { map, mode: "anchors" };
  }

  // fallback a esquema por zonas
  return { map: _buildSchematicCoordsFromResult(result), mode: "schematic" };
}

function _buildSchematicCoordsFromResult(result) {
  const zones = appState.diagramas.zones || [];
  const zoneIndex = new Map(zones.map((z, i) => [z.key, i]));
  const colW = 280;
  const rowH = 80;
  const startX = 100;
  const startY = 100;

  const placements = Array.isArray(result?.placements) ? result.placements : [];
  const infra = Array.isArray(result?.infra) ? result.infra : [];

  const perZoneCount = {};
  for (const z of zones) perZoneCount[z.key] = 0;

  function nextPos(zoneKey) {
    const i = zoneIndex.has(zoneKey) ? zoneIndex.get(zoneKey) : 0;
    const x = startX + i * colW;
    const n = perZoneCount[zoneKey] || 0;
    perZoneCount[zoneKey] = n + 1;
    const y = startY + n * rowH;
    return { x, y };
  }

  const map = new Map();

  for (const p of placements) {
    const zone = String(p.zone || "entrada_principal");
    const pos = nextPos(zone);
    const label = `${p.ref || p.id || ""}${p.qty ? ` x${p.qty}` : ""}`;
    map.set(p.id, { x: pos.x, y: pos.y, label });
  }

  for (const n of infra) {
    const zone = String(n.zone || "armario_cpd");
    const pos = nextPos(zone);
    const label = `${n.type || n.id || ""}`;
    map.set(n.id, { x: pos.x, y: pos.y, label });
  }

  return map;
}

function diagExportDxf() {
  const r = appState.diagramas.lastResult;
  if (!r) {
    appState.diagramas.lastError = "No hay resultado IA para exportar. Genera el diseño primero.";
    _renderResult();
    return;
  }

  const { map: coords, mode } = _buildCoordsFromAnchorsOrSchematic(r);
  if (!coords.size) {
    appState.diagramas.lastError =
      "No hay nodos exportables. Si usas anclaje, coloca al menos un elemento en el plano.";
    _renderResult();
    return;
  }

  const connections = Array.isArray(r.connections) ? r.connections : [];
  const ents = [];

  for (const [, p] of coords.entries()) {
    ents.push(_dxfCircle(p.x, p.y, 10, "NODES"));
    ents.push(_dxfText(p.x + 16, p.y + 4, 10, p.label, "LABELS"));
  }

  for (const c of connections) {
    const a = coords.get(c.from);
    const b = coords.get(c.to);
    if (!a || !b) continue;
    ents.push(_dxfLine(a.x, a.y, b.x, b.y, "CABLE"));
  }

  const title = mode === "anchors" ? "DIAGRAMA RED UTP CAT6 (ANCLADO)" : "DIAGRAMA RED UTP CAT6 (ESQUEMA)";
  ents.push(_dxfText(100, 20, 14, title, "LABELS"));

  const dxf = [
    "0","SECTION","2","HEADER","0","ENDSEC",
    "0","SECTION","2","TABLES","0","ENDSEC",
    "0","SECTION","2","ENTITIES",
    ents.join("\n"),
    "0","ENDSEC","0","EOF",
  ].join("\n");

  const nameBase = (appState.diagramas.dxfFileName || "diagrama").replace(/\.dxf$/i, "");
  const fileName = `${nameBase}_red_cat6_${mode}.dxf`;

  try {
    const blob = new Blob([dxf], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (_) {
    appState.diagramas.lastError = "No se pudo descargar el DXF.";
    _renderResult();
  }
}

/* ======================================================
   8) Render UI
 ====================================================== */

function _renderDiagramasUI() {
  const host = _el("diagMain");
  if (!host) return;

  const s = appState.diagramas;
  const refs = Array.isArray(s.refs) ? s.refs : [];
  const q = String(s.refsSearch || "").toLowerCase().trim();
  const filtered = q
    ? refs.filter((r) => (r.ref || "").toLowerCase().includes(q) || (r.descripcion || "").toLowerCase().includes(q))
    : refs;

  const blocks = Array.isArray(s.dxfBlocks) ? s.dxfBlocks : [];

  function zoneHtml(z) {
    const list = Array.isArray(s.assignments[z.key]) ? s.assignments[z.key] : [];
    const items = list
      .map((it) => {
        const isSelected = s.plan.selectedPlacementId === it.id;
        const hasAnchor = !!(s.plan.anchors && s.plan.anchors[it.id]);

        const blockOptions =
          `<option value="">(sin icono)</option>` +
          blocks
            .slice(0, 800)
            .map(
              (b) =>
                `<option value="${_escapeHtmlAttr(b)}"${it.iconBlock === b ? " selected" : ""}>${_escapeHtml(b)}</option>`
            )
            .join("");

        return `
          <div class="card" style="padding:10px; margin-top:8px; border:${isSelected ? "1px solid rgba(29,79,216,.55)" : "none"};">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
              <div style="min-width:0; cursor:pointer;" data-act="selectAnchor" data-id="${_escapeHtmlAttr(it.id)}">
                <div style="font-weight:600; display:flex; gap:8px; align-items:center;">
                  ${_escapeHtml(it.ref)}
                  <span class="chip" style="font-size:11px; padding:.12rem .45rem;">${hasAnchor ? "Anclado" : "Sin anclar"}</span>
                </div>
                <div class="muted" style="font-size:12px;">${_escapeHtml(it.descripcion || "")}</div>
              </div>
              <button class="btn btn-sm" data-act="remove" data-zone="${_escapeHtmlAttr(z.key)}" data-id="${_escapeHtmlAttr(it.id)}">Quitar</button>
            </div>

            <div class="grid mt-2" style="display:grid; grid-template-columns: 120px 1fr; gap:10px; align-items:center;">
              <div class="form-group" style="margin:0;">
                <label style="font-size:12px;">Cantidad</label>
                <input type="number" min="1" value="${Number(it.qty || 1)}" data-act="qty" data-zone="${_escapeHtmlAttr(z.key)}" data-id="${_escapeHtmlAttr(it.id)}"/>
              </div>
              <div class="form-group" style="margin:0;">
                <label style="font-size:12px;">Icono DXF (BLOCK)</label>
                <select data-act="icon" data-zone="${_escapeHtmlAttr(z.key)}" data-id="${_escapeHtmlAttr(it.id)}">
                  ${blockOptions}
                </select>
              </div>
            </div>

            <div class="mt-2" style="display:flex; gap:8px; align-items:center;">
              <button class="btn btn-sm" data-act="selectAnchor" data-id="${_escapeHtmlAttr(it.id)}">${isSelected ? "Seleccionado" : "Anclar en plano"}</button>
              ${hasAnchor ? `<button class="btn btn-sm" data-act="clearAnchor" data-id="${_escapeHtmlAttr(it.id)}">Quitar anclaje</button>` : ""}
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="card diag-dropzone" data-zone="${_escapeHtmlAttr(z.key)}" style="padding:12px; min-height:180px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div>
            <div style="font-weight:700;">${_escapeHtml(z.label)}</div>
            <div class="muted" style="font-size:12px;">Suelta aquí referencias del presupuesto</div>
          </div>
          <span class="chip">${list.length}</span>
        </div>
        ${items || `<div class="muted mt-2" style="font-size:12px;">(vacío)</div>`}
      </div>
    `;
  }

  const plan = s.plan;

  host.innerHTML = `
    <div class="grid" style="display:grid; grid-template-columns: 360px 1fr; gap:14px;">
      <!-- LEFT -->
      <div class="card" style="padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <h3 style="margin:0;">Referencias del proyecto</h3>
          <button id="btnDiagReloadRefs" class="btn btn-sm">Recargar</button>
        </div>

        <div class="muted mt-1" style="font-size:12px;">Fuente: presupuesto (appState.presupuesto.lineas). Arrastra a zonas.</div>

        <div class="form-group mt-2">
          <input id="diagRefsSearch" type="text" placeholder="Buscar ref/descripcion..." value="${_escapeHtml(s.refsSearch || "")}"/>
        </div>

        <div style="max-height:520px; overflow:auto; border:1px solid rgba(15,23,42,.08); border-radius:10px; padding:8px;">
          ${
            filtered.length
              ? filtered
                  .slice(0, 300)
                  .map(
                    (r) => `
                      <div class="card diag-draggable" style="padding:10px; margin-bottom:8px;"
                           draggable="true" data-ref="${_escapeHtmlAttr(r.ref)}">
                        <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
                          <div style="min-width:0;">
                            <div style="font-weight:700;">${_escapeHtml(r.ref)}</div>
                            <div class="muted" style="font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                              ${_escapeHtml(r.descripcion || "")}
                            </div>
                          </div>
                          <span class="chip">${Number(r.qty || 0)}</span>
                        </div>
                      </div>
                    `
                  )
                  .join("")
              : `<div class="muted">No hay referencias. Genera un presupuesto primero.</div>`
          }
          ${filtered.length > 300 ? `<div class="muted mt-2">Mostrando 300.</div>` : ""}
        </div>

        <div class="card mt-3" style="padding:12px;">
          <h4 style="margin:0;">Biblioteca de iconos (DXF)</h4>
          <div class="muted" style="font-size:12px; margin-top:6px;">
            Carga tu “PLANTILLA DE ICONOS.dxf” para poder seleccionar el BLOCK en cada elemento.
          </div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:10px;">
            <input id="diagDxfFile" type="file" accept=".dxf"/>
            <span class="muted" style="font-size:12px;">
              ${s.dxfFileName ? `Cargado: <b>${_escapeHtml(s.dxfFileName)}</b> · blocks: ${blocks.length}` : "Sin DXF cargado"}
            </span>
          </div>
        </div>
      </div>

      <!-- RIGHT -->
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
          <div>
            <h3 style="margin:0;">Ubicación de dispositivos</h3>
            <div class="muted" style="font-size:12px;">Arrastra refs a zonas. Selecciona un elemento y haz click en el plano para anclarlo.</div>
          </div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <button id="btnDiagAuto" class="btn btn-secondary btn-sm">Auto</button>
            <button id="btnDiagTogglePrompt" class="btn btn-sm">Prompt</button>
            <button id="btnDiagGenerate" class="btn btn-primary btn-sm">Generar diseño</button>
            <button id="btnDiagExportDxf" class="btn btn-sm">Exportar DXF</button>
            <span id="diagBusy" class="muted" style="display:none;">Generando…</span>
          </div>
        </div>

        <!-- PLANO -->
        <div class="card mt-3" style="padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <div>
              <div style="font-weight:700;">Plano (anclaje por click)</div>
              <div class="muted" style="font-size:12px;">
                Selecciona un elemento (botón “Anclar en plano”) y haz click para fijar posición. (Aún sin render DXF real)
              </div>
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <label style="display:flex; gap:8px; align-items:center; font-size:12px;">
                <input id="diagInvertY" type="checkbox"${plan.invertYForDxf ? " checked" : ""}/>
                Invertir Y (DXF)
              </label>
              <button id="btnDiagClearSelected" class="btn btn-sm">Limpiar selección</button>
              <button id="btnDiagClearAllAnchors" class="btn btn-sm">Borrar anclajes</button>
            </div>
          </div>

          <div class="mt-2" style="overflow:auto; border-radius:12px; border:1px solid rgba(15,23,42,.10);">
            <canvas id="diagPlanCanvas" width="${plan.w}" height="${plan.h}" style="display:block; width:100%; height:auto; background:#fff;"></canvas>
          </div>
        </div>

        <!-- PROMPT -->
        <div id="diagPromptBox" class="card mt-3" style="padding:12px; display:${s.promptUiOpen ? "" : "none"};">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <h4 style="margin:0;">Prompt</h4>
            <span class="muted" style="font-size:12px;">Editable</span>
          </div>
          <label style="display:flex; gap:8px; align-items:center; margin-top:10px;">
            <input id="diagUseCustomPrompt" type="checkbox"${s.useCustomPrompt ? " checked" : ""}/> Usar prompt personalizado
          </label>
          <div class="form-group mt-2">
            <textarea id="diagPromptText" rows="10">${_escapeHtml(s.customPromptText || _defaultInstructions())}</textarea>
          </div>
        </div>

        <div class="grid mt-3" style="display:grid; grid-template-columns: 1fr 1fr; gap:14px;">
          ${s.zones.map(zoneHtml).join("")}
        </div>

        <div class="mt-3" id="diagOutput"></div>
      </div>
    </div>
  `;

  // Search
  const inp = _el("diagRefsSearch");
  if (inp) {
    inp.addEventListener("input", () => {
      appState.diagramas.refsSearch = String(inp.value || "");
      _renderDiagramasUI();
    });
  }

  // Reload refs
  const btnReload = _el("btnDiagReloadRefs");
  if (btnReload) btnReload.addEventListener("click", () => { diagLoadProjectRefs(); _renderDiagramasUI(); });

  // DXF icons import
  const inpDxf = _el("diagDxfFile");
  if (inpDxf) {
    inpDxf.addEventListener("change", async () => {
      const f = inpDxf.files && inpDxf.files[0] ? inpDxf.files[0] : null;
      await diagImportDxfFile(f);
    });
  }

  // Prompt toggle
  const btnPrompt = _el("btnDiagTogglePrompt");
  if (btnPrompt) btnPrompt.addEventListener("click", () => { appState.diagramas.promptUiOpen = !appState.diagramas.promptUiOpen; _renderDiagramasUI(); _renderResult(); });

  // Auto
  const btnAuto = _el("btnDiagAuto");
  if (btnAuto) btnAuto.addEventListener("click", diagAutoAssignIcons);

  // Generate
  const btnGen = _el("btnDiagGenerate");
  if (btnGen) btnGen.addEventListener("click", diagGenerateDesign);

  // Export DXF
  const btnExp = _el("btnDiagExportDxf");
  if (btnExp) btnExp.addEventListener("click", diagExportDxf);

  // Draggables
  host.querySelectorAll("[draggable='true'][data-ref]").forEach((node) => {
    node.addEventListener("dragstart", (ev) => _onRefDragStart(ev, node.dataset.ref));
    node.addEventListener("dragend", () => (_dragRefKey = null));
  });

  // Dropzones
  host.querySelectorAll(".diag-dropzone[data-zone]").forEach((zone) => {
    const zoneKey = zone.dataset.zone;
    zone.addEventListener("dragover", _onZoneDragOver);
    zone.addEventListener("dragleave", _onZoneDragLeave);
    zone.addEventListener("drop", (ev) => _onZoneDrop(ev, zoneKey));
  });

  // Actions inside assignments
  host.querySelectorAll("[data-act]").forEach((node) => {
    const act = node.dataset.act;
    const zoneKey = node.dataset.zone;
    const id = node.dataset.id;

    if (act === "remove") {
      node.addEventListener("click", () => _removeAssignment(zoneKey, id));
    } else if (act === "qty") {
      node.addEventListener("change", () => {
        const v = Number(node.value || 1);
        _updateAssignment(zoneKey, id, { qty: Math.max(1, Number.isFinite(v) ? v : 1) });
      });
    } else if (act === "icon") {
      node.addEventListener("change", () => _updateAssignment(zoneKey, id, { iconBlock: String(node.value || "") }));
    } else if (act === "selectAnchor") {
      node.addEventListener("click", () => _selectForAnchoring(id));
    } else if (act === "clearAnchor") {
      node.addEventListener("click", () => {
        if (appState.diagramas.plan.anchors && appState.diagramas.plan.anchors[id]) delete appState.diagramas.plan.anchors[id];
        if (appState.diagramas.plan.selectedPlacementId === id) appState.diagramas.plan.selectedPlacementId = null;
        _renderDiagramasUI();
        _drawPlan();
      });
    }
  });

  // Plan canvas
  const cv = _el("diagPlanCanvas");
  if (cv) {
    cv.addEventListener("click", _planCanvasClick);
  }
  const invY = _el("diagInvertY");
  if (invY) {
    invY.addEventListener("change", () => {
      appState.diagramas.plan.invertYForDxf = !!invY.checked;
      _drawPlan();
    });
  }
  const btnClearSel = _el("btnDiagClearSelected");
  if (btnClearSel) btnClearSel.addEventListener("click", () => { appState.diagramas.plan.selectedPlacementId = null; _renderDiagramasUI(); _drawPlan(); });

  const btnClearAll = _el("btnDiagClearAllAnchors");
  if (btnClearAll) btnClearAll.addEventListener("click", () => {
    appState.diagramas.plan.anchors = {};
    appState.diagramas.plan.selectedPlacementId = null;
    _renderDiagramasUI();
    _drawPlan();
  });

  // Paint plan
  _drawPlan();
}

/* ======================================================
   Public view entry
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

  diagLoadProjectRefs();

  root.innerHTML = `
    <div class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div>
          <h2 style="margin-bottom:4px;">Diagramas · Anclaje en plano</h2>
          <div class="muted">Arrastras refs a zonas y anclas posiciones con click. La IA diseña red UTP Cat6.</div>
        </div>
      </div>
      <div id="diagMain" class="mt-3"></div>
    </div>
  `;

  _renderDiagramasUI();
  _renderResult();
}

// exports
window.renderDiagramasView = renderDiagramasView;
window.diagImportDxfFile = diagImportDxfFile;
window.diagGenerateDesign = diagGenerateDesign;
window.diagAutoAssignIcons = diagAutoAssignIcons;
window.diagExportDxf = diagExportDxf;
