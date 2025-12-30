// js/ui_diagramas.js
// Vista: DIAGRAMAS (IA)
// V2.15 (Hito 20b) + fixes V2.15c/V2.15d

/* ======================================================
   ESTADO + HELPERS BÁSICOS
 ====================================================== */

function _defaultDiagramasState() {
  return {
    dxfFileName: "",
    dxfText: "",
    dxfBlocks: [],
    dxfBlockAttrs: {},
    dxfHeaderSection: "",
    dxfClassesSection: "",
    dxfTablesSection: "",
    dxfBlocksSection: "",
    dxfObjectsSection: "",

    refs: [],
    refsSearch: "",
    dxfBlocksSearch: "",

    zones: [
      { key: "entrada_principal", label: "Entrada principal" },
      { key: "portales_interiores", label: "Portales interiores" },
      { key: "zonas_comunes", label: "Zonas comunes" },
      { key: "zonas_refugio", label: "Zonas refugio" },
      { key: "armario_cpd", label: "Armario / CPD" },
    ],
    zonesDynamic: false,
    zonesConfig: {},
    zonesOrder: [],

    assignments: {},
    includeLocks: true,

    promptUiOpen: false,
    useCustomPrompt: false,
    customPromptText: "",

    previewEditMode: false,
    manualCoords: {},

    _previewResult: null,
    lastResult: null,
    lastError: null,
    lastRaw: null,
    usedLocalFallback: false,
    busy: false,

    _previewListenersBound: false,
    _previewMouseMoveHandler: null,
    _previewMouseUpHandler: null,

    _previewRaf: 0,
    _previewPendingMove: null,
  };
}

// ======================================================
// ESTADO GLOBAL
// ======================================================

window.appState = window.appState || {};
appState.diagramas = _defaultDiagramasState();

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

function _clearDiagError() {
  appState.diagramas.lastError = null;
  appState.diagramas.lastRaw = null;
}

/* ======================================================
   ZONES (SECCIONES)
 ====================================================== */

function _strip(s) {
  return String(s ?? "").trim();
}

function _normKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function _loadZonesConfig() {
  try {
    const t = localStorage.getItem("diag_zones_config");
    if (t) return JSON.parse(t) || {};
  } catch (_) {}
  return {};
}

function _saveZonesConfig(cfg) {
  try {
    localStorage.setItem("diag_zones_config", JSON.stringify(cfg || {}));
  } catch (_) {}
}

function _loadZonesOrder() {
  try {
    const t = localStorage.getItem("diag_zones_order");
    if (t) {
      const arr = JSON.parse(t);
      return Array.isArray(arr) ? arr.map(String) : [];
    }
  } catch (_) {}
  return [];
}

function _saveZonesOrder(order) {
  try {
    localStorage.setItem(
      "diag_zones_order",
      JSON.stringify(Array.isArray(order) ? order : [])
    );
  } catch (_) {}
}

function _getZoneConfig(key) {
  const s = appState.diagramas;
  s.zonesConfig = s.zonesConfig || _loadZonesConfig();
  return s.zonesConfig[key] || {};
}

function _setZoneConfig(key, patch) {
  const s = appState.diagramas;
  s.zonesConfig = s.zonesConfig || _loadZonesConfig();
  const cur = s.zonesConfig[key] || {};
  s.zonesConfig[key] = Object.assign({}, cur, patch);
  _saveZonesConfig(s.zonesConfig);
}

/* ======================================================
   PERSISTENCIA ASSIGNMENTS
 ====================================================== */

function _loadAssignments() {
  try {
    const t = localStorage.getItem("diag_assignments");
    const obj = t ? JSON.parse(t) : null;
    return obj && typeof obj === "object" ? obj : {};
  } catch (_) {
    return {};
  }
}

function _saveAssignments() {
  try {
    localStorage.setItem(
      "diag_assignments",
      JSON.stringify(appState.diagramas.assignments || {})
    );
  } catch (_) {}
}

/* ======================================================
   PERSISTENCIA LAYOUT (manualCoords)
 ====================================================== */

function _loadManualCoords() {
  try {
    const t = localStorage.getItem("diag_manual_coords");
    const obj = t ? JSON.parse(t) : null;
    return obj && typeof obj === "object" ? obj : {};
  } catch (_) {
    return {};
  }
}

function _saveManualCoords() {
  try {
    localStorage.setItem(
      "diag_manual_coords",
      JSON.stringify(appState.diagramas.manualCoords || {})
    );
  } catch (_) {}
}

/* ======================================================
   MOVER / REORDENAR ASSIGNMENTS
 ====================================================== */

function _moveAssignmentWithinZone(zoneKey, srcId, beforeId) {
  const list = appState.diagramas.assignments?.[zoneKey];
  if (!Array.isArray(list)) return;

  srcId = String(srcId || "");
  beforeId = beforeId != null ? String(beforeId) : "";

  if (!srcId) return;
  if (beforeId && beforeId === srcId) return;

  const from = list.findIndex((x) => String(x.id) === srcId);
  if (from < 0) return;

  const item = list.splice(from, 1)[0];

  if (!beforeId) {
    list.push(item);
    _saveAssignments();
    return;
  }

  let to = list.findIndex((x) => String(x.id) === beforeId);
  if (to < 0) {
    list.push(item);
    _saveAssignments();
    return;
  }

  list.splice(to, 0, item);
  _saveAssignments();
}

function _moveAssignmentToZone(srcZone, srcId, dstZone, beforeId) {
  const a =
    appState.diagramas.assignments || (appState.diagramas.assignments = {});
  const src = a[srcZone];
  const dst = (a[dstZone] = a[dstZone] || []);
  if (!Array.isArray(src) || !Array.isArray(dst)) return;

  srcId = String(srcId || "");
  beforeId = beforeId != null ? String(beforeId) : "";

  if (!srcId) return;
  if (beforeId && beforeId === srcId) beforeId = "";

  const from = src.findIndex((x) => String(x.id) === srcId);
  if (from < 0) return;

  const item = src.splice(from, 1)[0];

  if (!beforeId) {
    dst.push(item);
    _saveAssignments();
    return;
  }

  const to = dst.findIndex((x) => String(x.id) === beforeId);
  if (to < 0) dst.push(item);
  else dst.splice(to, 0, item);

  _saveAssignments();
}
/* ======================================================
   ✅ CRUD ASSIGNMENTS (FALTAVAM)
   - Corrige: botão "Quitar" e mudanças de qty/icono
 ====================================================== */

function _removeAssignment(zoneKey, id) {
  zoneKey = String(zoneKey || "");
  id = String(id || "");
  if (!zoneKey || !id) return;

  const s = appState.diagramas;
  s.assignments = s.assignments || {};
  const list = s.assignments[zoneKey];
  if (!Array.isArray(list)) return;

  const idx = list.findIndex((x) => String(x.id) === id);
  if (idx < 0) return;

  list.splice(idx, 1);
  _saveAssignments(); // ✅ persist
  _clearDiagError();
  _renderDiagramasUI();
  _renderResult();
}

function _updateAssignment(zoneKey, id, patch) {
  zoneKey = String(zoneKey || "");
  id = String(id || "");
  if (!zoneKey || !id) return;

  const s = appState.diagramas;
  s.assignments = s.assignments || {};
  const list = s.assignments[zoneKey];
  if (!Array.isArray(list)) return;

  const it = list.find((x) => String(x.id) === id);
  if (!it) return;

  patch = patch && typeof patch === "object" ? patch : {};

  if ("qty" in patch) {
    const q = Math.max(1, Number(patch.qty || 1) || 1);
    it.qty = q;
  }
  if ("iconBlock" in patch) {
    it.iconBlock = String(patch.iconBlock || "");
  }
  if ("descripcion" in patch) {
    it.descripcion = String(patch.descripcion || "");
  }
  if ("ref" in patch) {
    it.ref = String(patch.ref || "");
  }

  _saveAssignments(); // ✅ persist
}

/* ======================================================
   ZONAS DINÁMICAS DESDE PRESUPUESTO + ORDEN
 ====================================================== */

function _budgetLineSectionLabel(l) {
  const cand = [
    l?.seccion,
    l?.seccionNombre,
    l?.seccion_nombre,
    l?.section,
    l?.sectionName,
    l?.chapter,
    l?.capitulo,
    l?.capituloNombre,
    l?.capitulo_nombre,
    l?.capitulo_name,
    l?.zona,
    l?.ubicacion,
  ];
  for (const c of cand) {
    const t = _strip(c);
    if (t) return t;
  }
  return "";
}

function _getUserAddedZonesFromConfig() {
  const cfg =
    (appState.diagramas.zonesConfig =
      appState.diagramas.zonesConfig || _loadZonesConfig());
  const out = [];
  for (const [key, zc] of Object.entries(cfg || {})) {
    if (!zc || !zc.userAdded) continue;
    if (zc.deleted) continue;
    if (key === "armario_cpd") continue;
    const label = _strip(zc.label) || key;
    out.push({ key, label });
  }
  out.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return out;
}

function _getBudgetSecKeyMap() {
  const cfg =
    (appState.diagramas.zonesConfig =
      appState.diagramas.zonesConfig || _loadZonesConfig());
  if (!cfg.__budgetSecKeyMap || typeof cfg.__budgetSecKeyMap !== "object") {
    cfg.__budgetSecKeyMap = {};
    _saveZonesConfig(cfg);
  }
  return cfg.__budgetSecKeyMap;
}

function _getOrCreateBudgetZoneKey(label) {
  const map = _getBudgetSecKeyMap();
  const norm = _normKey(label);
  if (!norm) return `sec_${Date.now()}`;
  if (map[norm]) return String(map[norm]);

  let key = `sec_${norm}`;
  const cfg = appState.diagramas.zonesConfig || {};
  let i = 2;
  while (cfg[key] && cfg[key].__taken && map[norm] !== key)
    key = `sec_${norm}_${i++}`;
  map[norm] = key;

  cfg[key] = Object.assign({}, cfg[key] || {}, { __taken: true });
  appState.diagramas.zonesConfig = cfg;
  _saveZonesConfig(cfg);
  return key;
}

function _applyZonesOrder(zonesNoArmario) {
  const order =
    (appState.diagramas.zonesOrder =
      appState.diagramas.zonesOrder || _loadZonesOrder());
  if (!Array.isArray(order) || !order.length) return zonesNoArmario;

  const idx = new Map(order.map((k, i) => [String(k), i]));
  return zonesNoArmario
    .slice()
    .sort(
      (a, b) =>
        (idx.has(a.key) ? idx.get(a.key) : 99999) -
        (idx.has(b.key) ? idx.get(b.key) : 99999)
    );
}

function _buildZonesFromBudgetSections() {
  const presu = appState?.presupuesto;
  const lineas = Array.isArray(presu?.lineas) ? presu.lineas : [];

  const cfg =
    (appState.diagramas.zonesConfig =
      appState.diagramas.zonesConfig || _loadZonesConfig());

  const labels = [];
  const seen = new Set();

  for (const l of lineas) {
    const lab = _budgetLineSectionLabel(l);
    if (!lab) continue;
    const n = lab.toLowerCase();
    if (seen.has(n)) continue;
    seen.add(n);
    labels.push(lab);
  }

  const out = [];
  const usedKeys = new Set();

  if (labels.length) {
    for (const lab of labels) {
      const key = _getOrCreateBudgetZoneKey(lab);

      const zc = cfg[key] || {};
      if (zc.deleted) continue;

      out.push({
        key,
        label: _strip(zc.label) || lab,
      });
      usedKeys.add(key);
    }
  }

  const manual = _getUserAddedZonesFromConfig();
  for (const z of manual) {
    if (!z || !z.key) continue;
    if (usedKeys.has(z.key)) continue;
    usedKeys.add(z.key);
    out.push({ key: z.key, label: z.label });
  }

  if (!out.length) return null;

  const ordered = _applyZonesOrder(out);

  ordered.push({ key: "armario_cpd", label: "Armario / CPD" });

  return ordered;
}

function _syncZonesOrderFromCurrentZones() {
  const zones = appState.diagramas.zones || [];
  const order = zones
    .filter((z) => z.key !== "armario_cpd")
    .map((z) => String(z.key));
  appState.diagramas.zonesOrder = order;
  _saveZonesOrder(order);
}

function _ensureZonesOrderForZones(zones) {
  const keys = (Array.isArray(zones) ? zones : [])
    .filter((z) => z && z.key !== "armario_cpd")
    .map((z) => String(z.key));

  let order = appState.diagramas.zonesOrder || _loadZonesOrder();
  order = Array.isArray(order) ? order.map(String) : [];

  const valid = new Set(keys);

  const merged = order.filter((k) => valid.has(k));
  for (const k of keys) {
    if (!merged.includes(k)) merged.push(k);
  }

  appState.diagramas.zonesOrder = merged;
  _saveZonesOrder(merged);
}

/* ======================================================
   ZONAS: añadir / renombrar / borrar
 ====================================================== */

function _addZoneManual() {
  const name = _strip(prompt("Nombre de la nueva ubicación:", ""));
  if (!name) return;

  const key = `custom_${Date.now()}`;
  _setZoneConfig(key, { label: name, userAdded: true, deleted: false });

  const zones = appState.diagramas.zones || [];
  const idxArm = zones.findIndex((z) => z.key === "armario_cpd");
  const zObj = { key, label: name };

  if (idxArm >= 0) zones.splice(idxArm, 0, zObj);
  else zones.push(zObj);

  appState.diagramas.zones = zones;
  _syncZonesOrderFromCurrentZones();

  appState.diagramas.assignments = appState.diagramas.assignments || {};
  if (!Array.isArray(appState.diagramas.assignments[key]))
    appState.diagramas.assignments[key] = [];

  _saveAssignments(); // ✅ persist

  _clearDiagError();
  _renderDiagramasUI();
  _renderResult();
}

function _renameZone(zoneKey) {
  if (!zoneKey || zoneKey === "armario_cpd") return;
  const z = (appState.diagramas.zones || []).find((x) => x.key === zoneKey);
  const cur = z ? z.label : zoneKey;

  const next = prompt("Nuevo nombre para la sección:", cur || "");
  const name = _strip(next);
  if (!name) return;

  _setZoneConfig(zoneKey, { label: name });
  if (z) z.label = name;

  _renderDiagramasUI();
  _renderResult();
}

function _deleteZone(zoneKey) {
  if (!zoneKey || zoneKey === "armario_cpd") return;
  const z = (appState.diagramas.zones || []).find((x) => x.key === zoneKey);
  const label = z ? z.label : zoneKey;

  if (
    !confirm(
      `¿Eliminar la sección "${label}"? (Se ocultará y se borrarán sus asignaciones)`
    )
  )
    return;

  _setZoneConfig(zoneKey, { deleted: true });

  try {
    if (
      appState.diagramas.assignments &&
      appState.diagramas.assignments[zoneKey]
    ) {
      delete appState.diagramas.assignments[zoneKey];
      _saveAssignments(); // ✅ persist
    }
  } catch (_) {}

  appState.diagramas.zones = (appState.diagramas.zones || []).filter(
    (x) => x.key !== zoneKey
  );
  _syncZonesOrderFromCurrentZones();

  _clearDiagError();
  _renderDiagramasUI();
  _renderResult();
}

// ✅ cerradura como BLOCK DXF (no refs)
function _setZoneLockBlock(zoneKey, blockName) {
  if (!zoneKey || zoneKey === "armario_cpd") return;
  const b = _strip(blockName);
  _setZoneConfig(zoneKey, { lockBlock: b || "" });
  _clearDiagError();
}

function _setCpdSwitchBlock(blockName) {
  const b = _strip(blockName);
  _setZoneConfig("armario_cpd", { cpdSwitchBlock: b || "" });
  _clearDiagError();
}

/* ======================================================
   Helpers: detección + enriquecimiento SVG
 ====================================================== */

function _isDoorWireDevice(p) {
  const t = `${p?.ref || ""} ${p?.descripcion || ""} ${p?.icon_block || ""} ${
    p?.iconBlock || ""
  }`.toUpperCase();
  const hints = [
    "IPSTYLE",
    "IP STYLE",
    "VERSO",
    "IPONE",
    "IP ONE",
    "INTERCOM",
    "VIDEO",
    "PORTERO",
    "ACCESS",
    "ACCESS UNIT",
    "READER",
    "LECTOR",
    "CONTROL ACCES",
    "CONTROL DE ACCES",
    "RFID",
    "BLE",
    "INDOOR",
    "MONITOR",
  ];
  if (hints.some((k) => t.includes(k))) return true;
  if (
    t.includes("CERRADURA") ||
    t.includes("GARAJE") ||
    t.includes("PUERTA") ||
    t.includes("BARRERA")
  )
    return true;
  return false;
}

function _isSwitchLikePlacement(p) {
  const t = `${p?.ref || ""} ${p?.descripcion || ""} ${p?.icon_block || ""} ${
    p?.iconBlock || ""
  }`.toUpperCase();
  return t.includes("SWITCH") || t.includes("POE");
}

function _cloneDeepJson(x) {
  try {
    return JSON.parse(JSON.stringify(x));
  } catch (_) {
    return x;
  }
}
// ✅ FIX: si una zona NO tiene lockBlock, NO se crea cerradura genérica por dispositivo.
function _augmentResultForSvg(baseResult) {
  const r0 = baseResult;
  if (!r0 || typeof r0 !== "object") return r0;

  const r = _cloneDeepJson(r0);

  const placements = Array.isArray(r.placements) ? r.placements : [];
  const infra = Array.isArray(r.infra) ? r.infra : [];
  const connections = Array.isArray(r.connections) ? r.connections : [];

  for (const p of placements) {
    const q = Math.max(1, Number(p?.qty || 1) || 1);
    p.qty = q;
  }

  const existingNodeIds = new Set([
    ...placements.map((p) => String(p.id)),
    ...infra.map((n) => String(n.id)),
  ]);

  const existing2w = new Set(
    connections
      .filter((c) => String(c?.type || "").toUpperCase() === "2_WIRE")
      .map((c) => `${String(c.from)}__${String(c.to)}`)
  );

  // ✅ Siempre: asegurar SW POE en armario
  const cpdCfg = _getZoneConfig("armario_cpd");
  const cpdSwId = "V_CPD_SW_POE";
  if (!existingNodeIds.has(cpdSwId)) {
    infra.push({
      id: cpdSwId,
      type: "VIRTUAL_SWITCH_POE",
      zone: "armario_cpd",
      meta: {
        role: "CPD_SWITCH_POE",
        icon_block: _strip(cpdCfg.cpdSwitchBlock || ""),
      },
    });
    existingNodeIds.add(cpdSwId);
  } else {
    const it = infra.find((n) => String(n.id) === cpdSwId);
    if (it) {
      it.type = it.type || "VIRTUAL_SWITCH_POE";
      it.zone = it.zone || "armario_cpd";
      it.meta = Object.assign({}, it.meta || {}, {
        icon_block: _strip(
          cpdCfg.cpdSwitchBlock || it?.meta?.icon_block || ""
        ),
      });
    }
  }

  if (appState.diagramas.includeLocks) {
    const zones = appState.diagramas.zones || [];
    const zoneLock = new Map();
    for (const z of zones) {
      if (!z || z.key === "armario_cpd") continue;
      const cfg = _getZoneConfig(z.key);
      const lockBlock = _strip(cfg.lockBlock);
      if (!lockBlock) continue;
      const nodeId = `V_LOCK_ZONE_${String(z.key)}`;
      zoneLock.set(String(z.key), { block: lockBlock, nodeId });
    }

    for (const [zoneKey, info] of zoneLock.entries()) {
      if (!existingNodeIds.has(info.nodeId)) {
        infra.push({
          id: info.nodeId,
          type: "VIRTUAL_LOCK_GARAGE",
          zone: zoneKey,
          meta: {
            role: "LOCK_GARAGE",
            scope: "ZONE",
            icon_block: info.block,
          },
        });
        existingNodeIds.add(info.nodeId);
      } else {
        const it = infra.find((n) => String(n.id) === String(info.nodeId));
        if (it) {
          it.type = it.type || "VIRTUAL_LOCK_GARAGE";
          it.zone = it.zone || zoneKey;
          it.meta = Object.assign({}, it.meta || {}, {
            scope: "ZONE",
            icon_block: info.block,
          });
        }
      }
    }

    for (const p of placements) {
      if (!_isDoorWireDevice(p)) continue;

      const zoneKey = String(p.zone || "entrada_principal");
      const zLock = zoneLock.get(zoneKey);
      if (!zLock) continue;

      const lockId = zLock.nodeId;
      const key = `${String(p.id)}__${lockId}`;
      if (!existing2w.has(key)) {
        connections.push({
          from: String(p.id),
          to: lockId,
          type: "2_WIRE",
          note: "2 hilos a cerradura (zona)",
        });
        existing2w.add(key);
      }
    }
  }

  r.infra = infra;
  r.connections = connections;
  r.placements = placements;

  return r;
}

function _strokeForConnectionType(t) {
  const tt = String(t || "").toUpperCase();
  if (tt === "2_WIRE" || tt === "2H" || tt === "2_HILOS") {
    return { stroke: "rgba(245,158,11,.75)", width: 2, dash: "6 4" };
  }
  return { stroke: "rgba(29,79,216,.55)", width: 2, dash: "" };
}

/* ======================================================
   Preview SVG (coords)
 ====================================================== */

function _buildSchematicCoordsFromResult(result) {
  const zones = appState.diagramas.zones || [];
  const zoneIndex = new Map(zones.map((z, i) => [z.key, i]));

  const colW = 280;
  const rowH = 90;
  const startX = 80;
  const startY = 90;

  const placements = Array.isArray(result?.placements) ? result.placements : [];
  const infra = Array.isArray(result?.infra) ? result.infra : [];
  const connections = Array.isArray(result?.connections) ? result.connections : [];

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
  const manual = appState.diagramas.manualCoords || {};

  for (const p of placements) {
    const zone = String(p.zone || "entrada_principal");
    const qty = Math.max(1, Number(p.qty || 1) || 1);
    const label = `${p.ref || p.id || ""}${qty > 1 ? ` x${qty}` : ""}`;

    const m = manual[p.id];
    const pos =
      m && Number.isFinite(m.x) && Number.isFinite(m.y)
        ? { x: m.x, y: m.y }
        : nextPos(zone);

    map.set(p.id, {
      x: pos.x,
      y: pos.y,
      label,
      kind: "placement",
      zone,
      qty,
    });
  }

  for (const n of infra) {
    const zone = String(n.zone || "armario_cpd");

    const t = String(n.type || n.id || "");
    const isLock =
      t.toUpperCase().includes("LOCK") || t.toUpperCase().includes("GARAGE");
    const isCpdSw =
      t.toUpperCase().includes("SWITCH") &&
      String(n?.meta?.role || "").toUpperCase().includes("CPD");
    const label = isCpdSw
      ? "SWITCH POE (CPD)"
      : isLock
      ? "CERRADURA / GARAJE"
      : `${n.type || n.id || ""}`;

    const m = manual[n.id];
    const pos =
      m && Number.isFinite(m.x) && Number.isFinite(m.y)
        ? { x: m.x, y: m.y }
        : nextPos(zone);

    map.set(n.id, { x: pos.x, y: pos.y, label, kind: "infra", zone });
  }

  // nodos virtuales para 2H si existen
  for (const c of connections) {
    if (String(c?.type || "").toUpperCase() !== "2_WIRE") continue;
    const a = map.get(c.from);
    const b = map.get(c.to);
    if (b) continue;
    if (!a) continue;

    const mid = String(c.to || "");
    if (!mid) continue;

    const existsInInfra = infra.some((x) => String(x.id) === mid);
    const existsInPlac = placements.some((x) => String(x.id) === mid);
    if (!existsInInfra && !existsInPlac) continue;

    const m = manual[mid];
    if (m && Number.isFinite(m.x) && Number.isFinite(m.y)) {
      map.set(mid, { x: m.x, y: m.y, label: mid, kind: "infra", zone: a.zone });
      continue;
    }

    map.set(mid, {
      x: a.x + 90,
      y: a.y + 28,
      label: "CERRADURA / GARAJE",
      kind: "infra",
      zone: a.zone,
      _virtualNear: a,
    });
  }

  return map;
}

function _renderPreviewSvg(result) {
  const r = _augmentResultForSvg(result);

  const coords = _buildSchematicCoordsFromResult(r);
  if (!coords.size) return `<div class="muted">Sin nodos para preview.</div>`;

  const zones = appState.diagramas.zones || [];
  const colW = 280;
  const startX = 80;

  function _iconForNode(id, p) {
    if (p.kind === "infra") {
      const rr = r || appState.diagramas.lastResult || {};
      const infra = Array.isArray(rr.infra) ? rr.infra : [];
      const it = infra.find((x) => String(x.id) === String(id));
      const t = String(it?.type || "").toUpperCase();
      const role = String(it?.meta?.role || "").toUpperCase();

      if (t.includes("LOCK") || t.includes("GARAGE")) return "🔒";
      if (role.includes("CPD") && t.includes("SWITCH")) return "🔀";
      if (t.includes("ROUTER")) return "🌐";
      if (t.includes("CORE")) return "🧠";
      if (t.includes("SWITCH")) return "🔀";
      return "⬛";
    }

    const rr = r || appState.diagramas.lastResult || {};
    const placements = Array.isArray(rr.placements) ? rr.placements : [];
    const it = placements.find((x) => String(x.id) === String(id));
    const blk = String(it?.icon_block || it?.iconBlock || "").toLowerCase();
    const ref = String(it?.ref || "").toLowerCase();

    const s = `${blk} ${ref} ${String(p.label || "").toLowerCase()}`;

    if (
      s.includes("ip style") ||
      s.includes("ipstyle") ||
      s.includes("ai_ip style") ||
      s.includes("ai_ip_style")
    )
      return "📟";
    if (s.includes("verso")) return "📞";
    if (s.includes("ip one") || s.includes("ipone")) return "📞";
    if (
      s.includes("indoor") ||
      s.includes("monitor") ||
      s.includes("touch") ||
      s.includes("clip")
    )
      return "🖥️";
    if (
      s.includes("access") ||
      s.includes("unit") ||
      s.includes("reader") ||
      s.includes("rfid") ||
      s.includes("ble")
    )
      return "🔑";
    if (s.includes("switch") || s.includes("poe")) return "🔀";
    if (s.includes("router") || s.includes("gateway")) return "🌐";
    if (s.includes("server") || s.includes("nvr")) return "🗄️";

    return "●";
  }

  function _nodePriority(id, p) {
    const rr = r || {};
    const infra = Array.isArray(rr.infra) ? rr.infra : [];
    const placements = Array.isArray(rr.placements) ? rr.placements : [];

    if (p.kind === "infra") {
      const it = infra.find((x) => String(x.id) === String(id));
      const t = String(it?.type || "").toUpperCase();
      const role = String(it?.meta?.role || "").toUpperCase();
      const isLock = t.includes("LOCK") || t.includes("GARAGE");
      if (isLock) return 10;
      const isSwitch = t.includes("SWITCH") || role.includes("SWITCH");
      if (isSwitch) return 90;
      return 70;
    }

    const it = placements.find((x) => String(x.id) === String(id));
    if (_isSwitchLikePlacement(it)) return 95;
    if (_isDoorWireDevice(it)) return 50;
    return 60;
  }

  let maxX = 0,
    maxY = 0;
  for (const [, p] of coords.entries()) {
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const vbW = Math.max(900, maxX + 320);
  const vbH = Math.max(420, maxY + 180);

  const connections = Array.isArray(r?.connections) ? r.connections : [];

  function _orthPath(a, b, idx, type) {
    const st = _strokeForConnectionType(type);
    const dash = st.dash ? ` stroke-dasharray="${st.dash}"` : "";
    const pad = 10;
    const channel = (idx % 6) * 6;

    const x1 = a.x,
      y1 = a.y;
    const x2 = b.x,
      y2 = b.y;

    if (Math.abs(x1 - x2) < 25 || Math.abs(y1 - y2) < 25) {
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${st.stroke}" stroke-width="${st.width}"${dash}/>`;
    }

    const midX = (x1 + x2) / 2 + channel;
    const d = `M ${x1} ${y1} L ${midX - pad} ${y1} L ${midX - pad} ${y2} L ${x2} ${y2}`;
    return `<path d="${d}" fill="none" stroke="${st.stroke}" stroke-width="${st.width}"${dash}/>`;
  }

  const lines = connections
    .map((c, i) => {
      const a = coords.get(c.from);
      const b = coords.get(c.to);
      if (!a || !b) return "";
      const path = _orthPath(a, b, i, c.type);
      const label2h =
        String(c.type || "").toUpperCase() === "2_WIRE"
          ? `<text x="${(a.x + b.x) / 2 + 6}" y="${(a.y + b.y) / 2 - 6}" font-size="11" fill="rgba(245,158,11,.95)">2H</text>`
          : "";
      return `${path}${label2h}`;
    })
    .join("");

  const nodes = Array.from(coords.entries())
    .sort((a, b) => _nodePriority(a[0], a[1]) - _nodePriority(b[0], b[1]))
    .map(([id, p]) => {
      const isInfra = p.kind === "infra";
      const fill = isInfra ? "rgba(17,24,39,.95)" : "rgba(29,79,216,.95)";
      const stroke = isInfra ? "rgba(17,24,39,.25)" : "rgba(29,79,216,.25)";
      const label = _escapeHtml(p.label);
      const icon = _escapeHtml(_iconForNode(id, p));
      const qty = Math.max(1, Number(p.qty || 1) || 1);

      const qtyBadge =
        !isInfra && qty > 1
          ? `
            <g>
              <rect x="${p.x - 6}" y="${p.y - 34}" width="28" height="16" rx="6" ry="6" fill="rgba(17,24,39,.90)"></rect>
              <text x="${p.x - 2}" y="${p.y - 22}" font-size="11" fill="white">x${qty}</text>
            </g>
          `
          : "";

      // ✅ FIX Chrome: evita selección/drag nativo del navegador sobre SVG/text
      const nodeStyle = `cursor:${
        appState.diagramas.previewEditMode ? "grab" : "default"
      }; user-select:none; -webkit-user-select:none; -ms-user-select:none; -webkit-user-drag:none;`;

      return `
        <g class="diag-node" data-node-id="${_escapeHtmlAttr(
          id
        )}" style="${nodeStyle}">
          <circle class="diag-node-hit" cx="${p.x}" cy="${p.y}" r="18" fill="rgba(0,0,0,0)"></circle>
          <circle cx="${p.x}" cy="${p.y}" r="14" fill="${fill}" stroke="${stroke}" stroke-width="10"></circle>
          <text x="${p.x - 8}" y="${p.y + 7}" font-size="18" fill="white">${icon}</text>
          ${qtyBadge}
          <text x="${p.x + 18}" y="${p.y + 5}" font-size="12" fill="rgba(17,24,39,.95)">${label}</text>
        </g>
      `;
    })
    .join("");

  const headers = zones
    .map((z, i) => {
      const x = startX + i * colW;
      return `<text x="${x}" y="36" font-size="13" fill="rgba(107,114,128,.95)">${_escapeHtml(
        z.label
      )}</text>`;
    })
    .join("");

  return `
    <div class="card" style="padding:12px; overflow:hidden; max-width:100%; min-width:0;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
        <div>
          <div style="font-weight:700;">Preview</div>
          <div class="muted" style="font-size:12px;">
            Esquema por zonas (coords). Cat6 en azul · 2 hilos (si activo) en discontinuo.
            ${
              appState.diagramas.previewEditMode
                ? "Arrastra los nodos para fijar posición."
                : ""
            }
          </div>
        </div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button id="btnDiagToggleEdit" class="btn btn-sm">${
            appState.diagramas.previewEditMode ? "Salir edición" : "Editar posiciones"
          }</button>
          <button id="btnDiagResetLayout" class="btn btn-sm">Reset layout</button>
          <span class="chip">SVG</span>
        </div>
      </div>

      <div style="border:1px solid rgba(15,23,42,.10); border-radius:12px; overflow:auto; background:#fff; max-width:100%; min-width:0;">
        <svg id="diagPreviewSvg"
             width="100%" height="${vbH}"
             viewBox="0 0 ${vbW} ${vbH}"
             preserveAspectRatio="xMinYMin meet"
             style="display:block; max-width:100%; height:auto;">
          <rect x="0" y="0" width="${vbW}" height="${vbH}" fill="white"></rect>
          ${headers}
          ${lines}
          ${nodes}
        </svg>
      </div>

      <div class="muted mt-2" style="font-size:12px;">
        Tip: mueve dispositivos y exporta <b>SVG</b> (formato maestro).
      </div>
    </div>
  `;
}

/* ======================================================
   Drag controller para SVG (con rAF) + persist manualCoords
 ====================================================== */

var _diagDrag = (window._diagDrag =
  window._diagDrag || { active: false, nodeId: null, offsetX: 0, offsetY: 0 });

function _svgPoint(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const inv = ctm.inverse();
  const p = pt.matrixTransform(inv);
  return { x: p.x, y: p.y };
}

function _unbindPreviewWindowListeners() {
  const s = appState.diagramas;

  if (s._previewRaf) {
    try {
      cancelAnimationFrame(s._previewRaf);
    } catch (_) {}
    s._previewRaf = 0;
  }
  s._previewPendingMove = null;

  if (s._previewMouseMoveHandler) {
    window.removeEventListener("mousemove", s._previewMouseMoveHandler, true);
    s._previewMouseMoveHandler = null;
  }
  if (s._previewMouseUpHandler) {
    window.removeEventListener("mouseup", s._previewMouseUpHandler, true);
    s._previewMouseUpHandler = null;
  }
  s._previewListenersBound = false;
}

function _bindPreviewWindowListeners(svg) {
  const s = appState.diagramas;

  _unbindPreviewWindowListeners();

  // ✅ throttle con rAF: evita re-render por cada mousemove
  function _scheduleRender() {
    if (s._previewRaf) return;
    s._previewRaf = requestAnimationFrame(() => {
      s._previewRaf = 0;
      if (!s._previewPendingMove) return;
      const { nodeId, nx, ny } = s._previewPendingMove;
      s._previewPendingMove = null;

      s.manualCoords = s.manualCoords || {};
      s.manualCoords[nodeId] = { x: nx, y: ny };

      _renderResult();
    });
  }

  s._previewMouseMoveHandler = (ev) => {
    if (!_diagDrag.active || !_diagDrag.nodeId) return;
    const p = _svgPoint(svg, ev.clientX, ev.clientY);
    const nx = p.x + _diagDrag.offsetX;
    const ny = p.y + _diagDrag.offsetY;

    s._previewPendingMove = { nodeId: _diagDrag.nodeId, nx, ny };
    _scheduleRender();
  };

  s._previewMouseUpHandler = () => {
    // ✅ commit del último move pendiente ANTES de guardar
    if (s._previewPendingMove && s._previewPendingMove.nodeId) {
      const { nodeId, nx, ny } = s._previewPendingMove;
      s._previewPendingMove = null;

      s.manualCoords = s.manualCoords || {};
      s.manualCoords[nodeId] = { x: nx, y: ny };
    }

    // ✅ corta cualquier rAF pendiente
    if (s._previewRaf) {
      try {
        cancelAnimationFrame(s._previewRaf);
      } catch (_) {}
      s._previewRaf = 0;
    }

    _diagDrag.active = false;
    _diagDrag.nodeId = null;

    _saveManualCoords(); // ✅ ahora sí, guarda el último punto real
    _renderResult(); // ✅ refresca para que se vea fijo
  };

  window.addEventListener("mousemove", s._previewMouseMoveHandler, true);
  window.addEventListener("mouseup", s._previewMouseUpHandler, true);
  s._previewListenersBound = true;
}

function _bindPreviewInteractions() {
  const svg = _el("diagPreviewSvg");
  if (!svg) {
    _unbindPreviewWindowListeners();
    return;
  }

  const btnEdit = _el("btnDiagToggleEdit");
  if (btnEdit) {
    btnEdit.onclick = () => {
      appState.diagramas.previewEditMode = !appState.diagramas.previewEditMode;
      _renderResult();
    };
  }

  const btnReset = _el("btnDiagResetLayout");
  if (btnReset) {
    btnReset.onclick = () => {
      appState.diagramas.manualCoords = {};
      _saveManualCoords(); // ✅ persist reset
      _renderResult();
    };
  }

  if (!appState.diagramas.previewEditMode) {
    _unbindPreviewWindowListeners();
    svg.onmousedown = null;
    return;
  }

  const baseResult =
    appState.diagramas._previewResult || appState.diagramas.lastResult;
  const r = _augmentResultForSvg(baseResult);

  _bindPreviewWindowListeners(svg);

  // ✅ FIX Chrome: evita drag nativo del navegador sobre SVG/text
  try {
    svg.setAttribute("draggable", "false");

    // IMPORTANTE: en Chrome a veces se inicia un drag HTML5 sobre <text> del SVG
    // y eso rompe nuestros mousemove/mouseup.
    svg.addEventListener(
      "dragstart",
      (e) => {
        try {
          e.preventDefault();
        } catch (_) {}
        try {
          e.stopPropagation();
        } catch (_) {}
      },
      true
    );
  } catch (_) {}

  svg.onmousedown = (ev) => {
    const t = ev.target;
    const g = t && t.closest ? t.closest(".diag-node") : null;
    if (!g) return;

    const nodeId = g.getAttribute("data-node-id");
    if (!nodeId) return;

    const p = _svgPoint(svg, ev.clientX, ev.clientY);

    const coords = _buildSchematicCoordsFromResult(r);
    const cur = coords.get(nodeId);
    if (!cur) return;

    _diagDrag.active = true;
    _diagDrag.nodeId = nodeId;
    _diagDrag.offsetX = cur.x - p.x;
    _diagDrag.offsetY = cur.y - p.y;

    // ✅ CLAVE: Chrome — evita que el navegador “capture” el gesto como drag/selección
    try {
      ev.preventDefault();
    } catch (_) {}
    try {
      ev.stopPropagation();
    } catch (_) {}
  };
}


/* ======================================================
   Preview-only result desde assignments (sin IA)
 ====================================================== */

function _buildPreviewOnlyResultFromAssignments() {
  const zones = appState.diagramas.zones || [];
  const assignments = appState.diagramas.assignments || {};

  const placements = [];
  for (const z of zones) {
    const list = assignments[z.key] || [];
    for (const it of list) {
      placements.push({
        id: it.id,
        ref: it.ref,
        zone: z.key,
        icon_block: it.iconBlock || "",
        qty: it.qty || 1,
        descripcion: it.descripcion || "",
        meta: { source: "USER" },
      });
    }
  }

  return { placements, infra: [], connections: [], summary: {}, errors: [] };
}

/* ======================================================
   Render Result
 ====================================================== */

function _renderResult() {
  const out = _el("diagOutput");
  if (!out) return;

  const previewOnly = _buildPreviewOnlyResultFromAssignments();
  const hasPreviewPlacements =
    previewOnly.placements && previewOnly.placements.length > 0;

  if (appState.diagramas.lastError) {
    const raw = appState.diagramas.lastRaw
      ? `
        <details class="mt-2">
          <summary class="muted" style="cursor:pointer;">Ver respuesta IA (raw)</summary>
          <pre style="white-space:pre-wrap; background:#0b1020; color:#e5e7eb; padding:12px; border-radius:10px; overflow:auto; margin-top:8px;">${_escapeHtml(
            appState.diagramas.lastRaw
          )}</pre>
        </details>
      `
      : "";

    if (hasPreviewPlacements) {
      appState.diagramas._previewResult = previewOnly;
      out.innerHTML = `
        <div class="alert alert-error">${_escapeHtml(
          appState.diagramas.lastError
        )}</div>
        ${_renderPreviewSvg(previewOnly)}
        ${raw}
      `;
      _bindPreviewInteractions();
      return;
    }

    out.innerHTML = `<div class="alert alert-error">${_escapeHtml(
      appState.diagramas.lastError
    )}</div>${raw}`;
    _bindPreviewInteractions();
    return;
  }

  if (!appState.diagramas.lastResult) {
    if (!hasPreviewPlacements) {
      out.innerHTML = `<div class="muted">Arrastra referencias del proyecto a las zonas.</div>`;
      _bindPreviewInteractions();
      return;
    }

    appState.diagramas._previewResult = previewOnly;
    out.innerHTML = `
      <div class="alert alert-info mb-2">Preview manual (sin IA). Puedes posicionar dispositivos.</div>
      ${_renderPreviewSvg(previewOnly)}
    `;
    _bindPreviewInteractions();
    return;
  }

  const banner = appState.diagramas.usedLocalFallback
    ? `<div class="alert alert-info mb-2">Se generó el diseño en <b>modo local</b> (la IA devolvió texto, no JSON).</div>`
    : "";

  const raw = appState.diagramas.lastRaw
    ? `
      <details class="mt-2">
        <summary class="muted" style="cursor:pointer;">Ver respuesta IA (raw)</summary>
        <pre style="white-space:pre-wrap; background:#0b1020; color:#e5e7eb; padding:12px; border-radius:10px; overflow:auto; margin-top:8px;">${_escapeHtml(
          appState.diagramas.lastRaw
        )}</pre>
      </details>
    `
    : "";

  appState.diagramas._previewResult = appState.diagramas.lastResult;

  const preview = _renderPreviewSvg(appState.diagramas.lastResult);

  const enriched = _augmentResultForSvg(appState.diagramas.lastResult);
  const pretty = _escapeHtml(JSON.stringify(enriched, null, 2));

  out.innerHTML = `
    ${banner}
    <div class="mb-2" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
      <span class="chip">Diseño</span>
      <span class="muted">UTP Cat6 · 2 hilos (si activo)</span>
    </div>

    ${preview}

    <div class="card mt-3" style="padding:12px; min-width:0;">
      <div class="mb-2" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <span class="chip">JSON</span>
        <span class="muted" style="font-size:12px;">Salida completa (enriquecida para SVG)</span>
      </div>
      <pre style="white-space:pre-wrap; background:#0b1020; color:#e5e7eb; padding:12px; border-radius:10px; overflow:auto;">${pretty}</pre>
      ${raw}
    </div>
  `;

  _bindPreviewInteractions();
}
/* ======================================================
   1) Refs + ZONAS desde presupuesto
 ====================================================== */
function diagLoadProjectRefs() {
  const presu = appState?.presupuesto;
  const lineas = Array.isArray(presu?.lineas) ? presu.lineas : [];

  // 1) refs
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

  appState.diagramas.refs = Array.from(map.values()).sort((a, b) =>
    a.ref.localeCompare(b.ref)
  );

  // 2) zones desde secciones del presupuesto + manuales
  appState.diagramas.zonesConfig =
    appState.diagramas.zonesConfig || _loadZonesConfig();
  appState.diagramas.zonesOrder =
    appState.diagramas.zonesOrder || _loadZonesOrder();

  const dyn = _buildZonesFromBudgetSections();
  if (dyn) {
    appState.diagramas.zones = dyn;
    appState.diagramas.zonesDynamic = true;

    // ✅ CLAVE: NO sobrescribir el orden del usuario al recargar.
    // En su lugar, mantener el orden persistido y añadir nuevas zonas al final.
    _ensureZonesOrderForZones(appState.diagramas.zones);
  } else {
    appState.diagramas.zonesDynamic = false;

    // opcional: también asegurar orden para zonas “estáticas”
    _ensureZonesOrderForZones(appState.diagramas.zones || []);
  }

  // 3) assignments (NO pisar lo cargado si ya existe)
  appState.diagramas.assignments = appState.diagramas.assignments || {};
  for (const z of appState.diagramas.zones) {
    if (!Array.isArray(appState.diagramas.assignments[z.key])) {
      appState.diagramas.assignments[z.key] = [];
    }
  }

  // 4) limpia assignments de zonas ya no existentes
  try {
    const valid = new Set((appState.diagramas.zones || []).map((z) => z.key));
    for (const k of Object.keys(appState.diagramas.assignments || {})) {
      if (!valid.has(k)) delete appState.diagramas.assignments[k];
    }
  } catch (_) {}

  _saveAssignments(); // ✅ persist coherencia
}

/* ======================================================
   2) DXF (solo carga para selects/autosugerencias)
 ====================================================== */
function _stripBom(s) {
  return String(s || "").replace(/^\uFEFF/, "");
}

function _dxfToPairs(dxfText) {
  const lines = _stripBom(String(dxfText || ""))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  const pairs = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i] != null ? String(lines[i]).trim() : "";
    const value =
      lines[i + 1] != null ? String(lines[i + 1]).trimEnd() : "";
    if (code === "" && value === "" && i > 50) continue;
    pairs.push([code, value.trim()]);
  }
  return pairs;
}

function _dxfExtractBlocks(pairs) {
  const blocks = [];
  const attrsByBlock = {};

  let inBlocksSection = false;
  let inBlockEntity = false;

  let curName = null;
  let curTags = [];

  for (let i = 0; i < pairs.length; i++) {
    const [c, v] = pairs[i];

    if (c === "0" && v === "SECTION") {
      const next = pairs[i + 1];
      if (next && next[0] === "2") {
        inBlocksSection =
          String(next[1] || "").toUpperCase() === "BLOCKS";
        inBlockEntity = false;
        curName = null;
        curTags = [];
      }
      continue;
    }

    if (!inBlocksSection) continue;

    if (c === "0" && v === "ENDSEC") {
      inBlocksSection = false;
      inBlockEntity = false;
      curName = null;
      curTags = [];
      continue;
    }

    if (c === "0" && v === "BLOCK") {
      inBlockEntity = true;
      curName = null;
      curTags = [];
      continue;
    }

    if (c === "0" && v === "ENDBLK") {
      if (curName) {
        if (!blocks.includes(curName)) blocks.push(curName);
        attrsByBlock[curName] = {
          count: curTags.length,
          tags: curTags.slice(),
        };
      }
      inBlockEntity = false;
      curName = null;
      curTags = [];
      continue;
    }

    if (!inBlockEntity) continue;

    if (!curName && c === "2") {
      curName = String(v || "").trim();
      continue;
    }

    if (c === "0" && v === "ATTDEF") {
      let tag = "";
      for (let j = i + 1; j < pairs.length; j++) {
        const [c2, v2] = pairs[j];
        if (c2 === "0") break;
        if (c2 === "2") {
          tag = String(v2 || "").trim();
          break;
        }
      }
      if (tag) curTags.push(tag);
    }
  }

  return { blocks, attrsByBlock };
}

function _extractDxfSection(dxfText, sectionName) {
  let text = _stripBom(String(dxfText || ""));
  if (!text) return "";

  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const name = String(sectionName || "").trim().toUpperCase();
  if (!name) return "";

  const reStart = new RegExp(
    String.raw`(?:^|\n)\s*0\s*\n\s*SECTION\s*\n\s*2\s*\n\s*${name}\b`,
    "i"
  );
  const m0 = reStart.exec(text);
  if (!m0) return "";

  const startIdx = m0.index;

  const reEnd = /(?:^|\n)\s*0\s*\n\s*ENDSEC\b/gi;
  reEnd.lastIndex = startIdx;
  const m1 = reEnd.exec(text);
  if (!m1) return "";

  const endIdx = m1.index + m1[0].length;
  return text.slice(startIdx, endIdx);
}

async function diagImportDxfFile(file) {
  if (!file) return;

  appState.diagramas.lastError = null;
  appState.diagramas.lastRaw = null;

  appState.diagramas.dxfFileName = file.name || "";
  appState.diagramas.dxfText = "";
  appState.diagramas.dxfBlocks = [];
  appState.diagramas.dxfBlockAttrs = {};
  appState.diagramas.dxfHeaderSection = "";
  appState.diagramas.dxfClassesSection = "";
  appState.diagramas.dxfTablesSection = "";
  appState.diagramas.dxfBlocksSection = "";
  appState.diagramas.dxfObjectsSection = "";

  if (!/\.dxf$/i.test(file.name || "")) {
    appState.diagramas.lastError = "El archivo no parece DXF (.dxf).";
    _renderResult();
    return;
  }

  try {
    const text0 = await file.text();
    if (/\x00/.test(text0))
      throw new Error("DXF parece binario. Exporta como DXF ASCII.");

    const text = _stripBom(text0);
    appState.diagramas.dxfText = text;

    const pairs = _dxfToPairs(text);
    const ex = _dxfExtractBlocks(pairs);
    appState.diagramas.dxfBlocks = (ex.blocks || []).sort((a, b) =>
      a.localeCompare(b)
    );
    appState.diagramas.dxfBlockAttrs = ex.attrsByBlock || {};

    appState.diagramas.dxfHeaderSection =
      _extractDxfSection(text, "HEADER") || "";
    appState.diagramas.dxfClassesSection =
      _extractDxfSection(text, "CLASSES") || "";
    appState.diagramas.dxfTablesSection =
      _extractDxfSection(text, "TABLES") || "";
    appState.diagramas.dxfBlocksSection =
      _extractDxfSection(text, "BLOCKS") || "";
    appState.diagramas.dxfObjectsSection =
      _extractDxfSection(text, "OBJECTS") || "";

    if (!appState.diagramas.dxfBlocksSection) {
      throw new Error(
        "El DXF no contiene SECTION/BLOCKS (o no está en formato ASCII esperado)."
      );
    }

    try {
      localStorage.setItem(
        "diag_dxf_fileName",
        appState.diagramas.dxfFileName || ""
      );
      localStorage.setItem(
        "diag_dxf_blocks",
        JSON.stringify(appState.diagramas.dxfBlocks || [])
      );
      localStorage.setItem(
        "diag_dxf_blockAttrs",
        JSON.stringify(appState.diagramas.dxfBlockAttrs || {})
      );
      localStorage.setItem(
        "diag_dxf_headerSection",
        appState.diagramas.dxfHeaderSection || ""
      );
      localStorage.setItem(
        "diag_dxf_classesSection",
        appState.diagramas.dxfClassesSection || ""
      );
      localStorage.setItem(
        "diag_dxf_tablesSection",
        appState.diagramas.dxfTablesSection || ""
      );
      localStorage.setItem(
        "diag_dxf_blocksSection",
        appState.diagramas.dxfBlocksSection || ""
      );
      localStorage.setItem(
        "diag_dxf_objectsSection",
        appState.diagramas.dxfObjectsSection || ""
      );
    } catch (_) {}

    _renderDiagramasUI();
    _renderResult();
  } catch (e) {
    appState.diagramas.lastError = e.message || String(e);
    _renderResult();
  }
}
/* ======================================================
   3) Drag & drop (refs a zonas + mover/reorder assignments + reorder zonas)
 ====================================================== */
var _dragRefKey = (window._dragRefKey = window._dragRefKey || null);

// assignment drag state
var _dragAssign = (window._dragAssign =
  window._dragAssign || { zone: null, id: null });

// zone drag state
var _dragZoneKey = (window._dragZoneKey = window._dragZoneKey || null);

function _onRefDragStart(ev, ref) {
  _dragRefKey = (window._dragRefKey = String(ref || ""));
  try {
    ev.dataTransfer.setData("text/plain", `REF:${_dragRefKey}`);
    ev.dataTransfer.effectAllowed = "copy";
  } catch (_) {}
  // ✅ FIX: evita que otros dragstart (zona) “pisen” este drag
  try {
    ev.stopPropagation();
  } catch (_) {}
}

function _onAssignmentDragStart(ev, zoneKey, id) {
  _dragAssign.zone = String(zoneKey || "");
  _dragAssign.id = String(id || "");
  try {
    ev.dataTransfer.setData(
      "text/plain",
      `ASSIGN:${_dragAssign.zone}:${_dragAssign.id}`
    );
    ev.dataTransfer.effectAllowed = "move";
  } catch (_) {}
  // ✅ FIX: si no paras bubbling, el dragstart de la ZONA también se dispara y lo pisa
  try {
    ev.stopPropagation();
  } catch (_) {}
}

function _onAssignmentDragEnd() {
  _dragAssign.zone = null;
  _dragAssign.id = null;
}

function _onZoneCardDragStart(ev, zoneKey) {
  // ✅ FIX: NO iniciar drag de ZONA si realmente estás arrastrando una tarjeta assignment
  const t = ev.target;
  try {
    if (t && t.closest && t.closest(".diag-assignment")) return;
    // ✅ FIX: evita drags accidentales al tocar inputs/selects/botones dentro de la zona
    if (t && t.closest && t.closest("input,select,textarea,button,label"))
      return;
  } catch (_) {}

  _dragZoneKey = (window._dragZoneKey = String(zoneKey || ""));
  try {
    ev.dataTransfer.setData("text/plain", `ZONE:${_dragZoneKey}`);
    ev.dataTransfer.effectAllowed = "move";
  } catch (_) {}
}

function _onZoneDragOver(ev) {
  ev.preventDefault();
  ev.stopPropagation(); // ✅ CLAVE

  let payload = "";
  try {
    payload = ev.dataTransfer.getData("text/plain") || "";
  } catch (_) {}
  payload = String(payload || "").trim();

  try {
    ev.dataTransfer.dropEffect =
      payload.startsWith("ASSIGN:") || payload.startsWith("ZONE:")
        ? "move"
        : "copy";
  } catch (_) {}

  const zone = ev.currentTarget;
  if (zone) zone.classList.add("is-drag-over");
}

function _onZoneCardDragEnd() {
  _dragZoneKey = (window._dragZoneKey = null);

  // limpia estados visuales
  try {
    document
      .querySelectorAll(".diag-dropzone.is-drag-over")
      .forEach((el) => el.classList.remove("is-drag-over"));
  } catch (_) {}
}

function _onZoneDragLeave(ev) {
  const zone = ev.currentTarget;
  if (zone) zone.classList.remove("is-drag-over");
}

// ✅ helper: devuelve el ID de la tarjeta ANTES de la que hay que insertar (según Y del cursor)
// Si no hay, devuelve null => append al final.
function _findBeforeAssignmentIdInZone(zoneEl, clientY) {
  if (!zoneEl) return null;

  const cards = Array.from(zoneEl.querySelectorAll(".diag-assignment[data-id]"));
  if (!cards.length) return null;

  const draggingId =
    _dragAssign && _dragAssign.id ? String(_dragAssign.id) : null;

  for (const c of cards) {
    const cid = c.dataset.id || null;
    if (!cid) continue;
    if (draggingId && cid === draggingId) continue;

    const r = c.getBoundingClientRect();
    const midY = r.top + r.height / 2;

    // si el cursor está por encima del centro de esta tarjeta, insertamos ANTES de ella
    if (clientY < midY) return cid;
  }

  return null; // => al final
}

// ✅ Reordenar ZONAS (tarjetas de ubicación). Armario/CPD siempre fijo al final.
function _reorderZones(srcKey, dstKey) {
  srcKey = String(srcKey || "");
  dstKey = String(dstKey || "");
  if (!srcKey || !dstKey) return;

  // no permitir mover/insertar respecto a armario (fijo)
  if (srcKey === "armario_cpd") return;
  if (dstKey === "armario_cpd") return;

  const zones = Array.isArray(appState.diagramas.zones)
    ? appState.diagramas.zones
    : [];
  const idxSrc = zones.findIndex((z) => String(z.key) === srcKey);
  const idxDst = zones.findIndex((z) => String(z.key) === dstKey);
  if (idxSrc < 0 || idxDst < 0) return;

  const src = zones[idxSrc];
  zones.splice(idxSrc, 1);

  // tras extraer, recalcula destino
  const idxDst2 = zones.findIndex((z) => String(z.key) === dstKey);
  if (idxDst2 < 0) {
    zones.push(src);
  } else {
    zones.splice(idxDst2, 0, src); // insertar "antes" del destino
  }

  // asegurar armario al final siempre
  const idxArm = zones.findIndex((z) => String(z.key) === "armario_cpd");
  if (idxArm >= 0 && idxArm !== zones.length - 1) {
    const arm = zones[idxArm];
    zones.splice(idxArm, 1);
    zones.push(arm);
  } else if (idxArm < 0) {
    zones.push({ key: "armario_cpd", label: "Armario / CPD" });
  }

  appState.diagramas.zones = zones;

  // ✅ persistir orden
  _syncZonesOrderFromCurrentZones();
}

// ✅ Drop handler único por ZONA: soporta
// - REF:*  -> añadir a zona
// - ASSIGN:srcZone:srcId -> mover / reordenar (inserta cerca por drop Y)
// - ZONE:srcZoneKey -> reordenar ubicaciones
function _onZoneDrop(ev, zoneKey) {
  ev.preventDefault();
  ev.stopPropagation();

  // limpia visual
  try {
    const zoneEl = ev.currentTarget;
    if (zoneEl) zoneEl.classList.remove("is-drag-over");
  } catch (_) {}

  let payload = "";
  try {
    payload = ev.dataTransfer.getData("text/plain") || "";
  } catch (_) {}
  payload = String(payload || "").trim();

  // --------------------------------------------------
  // 1) Reordenar ZONAS
  // --------------------------------------------------
  if (payload.startsWith("ZONE:")) {
    const srcKey = payload.slice("ZONE:".length);
    const dstKey = String(zoneKey || "");
    if (srcKey && dstKey && srcKey !== dstKey) {
      _reorderZones(srcKey, dstKey);
      _clearDiagError();
      _renderDiagramasUI();
      _renderResult();
    }
    return;
  }

  // --------------------------------------------------
  // 2) Mover / reordenar ASSIGNMENTS
  // --------------------------------------------------
  if (payload.startsWith("ASSIGN:")) {
    const parts = payload.split(":");
    const srcZone = parts[1] || "";
    const srcId = parts[2] || "";
    const dstZone = String(zoneKey || "");
    if (!srcZone || !srcId || !dstZone) return;

    // ✅ insertar cerca por posición Y (en destino), si hay tarjetas
    let beforeId = "";
    try {
      const zoneEl = ev.currentTarget;
      const before = _findBeforeAssignmentIdInZone(zoneEl, ev.clientY);
      beforeId = before ? String(before) : "";
    } catch (_) {}

    if (String(srcZone) === String(dstZone)) {
      _moveAssignmentWithinZone(dstZone, srcId, beforeId);
    } else {
      _moveAssignmentToZone(srcZone, srcId, dstZone, beforeId);
    }

    _clearDiagError();
    _renderDiagramasUI();
    _renderResult();
    return;
  }

  // --------------------------------------------------
  // 3) Añadir REF a zona
  // --------------------------------------------------
  const refFromPayload = payload.startsWith("REF:")
    ? payload.slice("REF:".length)
    : _dragRefKey;
  const ref = String(refFromPayload || "").trim();
  if (!ref) return;

  const s = appState.diagramas;
  s.assignments = s.assignments || {};
  const list = (s.assignments[zoneKey] = s.assignments[zoneKey] || []);

  // busca info en refs
  const hit = (Array.isArray(s.refs) ? s.refs : []).find(
    (r) => String(r.ref) === ref
  );
  const desc = hit ? String(hit.descripcion || "") : "";
  const qty = hit && Number(hit.qty || 0) > 0 ? Number(hit.qty || 1) : 1;

  // id estable por ref+timestamp (evita colisiones al añadir la misma ref varias veces)
  const id = `P_${ref}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  list.push({
    id,
    ref,
    descripcion: desc,
    qty: Math.max(1, Number(qty || 1) || 1),
    iconBlock: "",
  });

  _saveAssignments(); // ✅ persist

  _clearDiagError();
  _renderDiagramasUI();
  _renderResult();
}
/* ======================================================
   4) AUTO icon suggestion
 ====================================================== */
function _norm(s) {
  return String(s || "").toLowerCase();
}

function _suggestIconBlockForItem(item, blocks) {
  const text = `${item.ref || ""} ${item.descripcion || ""}`.toLowerCase();
  const rules = [
    { patterns: ["ip style", "ipstyle"], blockHints: ["ip style", "ipstyle"] },
    { patterns: ["ip one", "ipone"], blockHints: ["ip one", "ipone"] },
    {
      patterns: ["indoor", "monitor", "pantalla"],
      blockHints: ["indoor", "monitor"],
    },
    {
      patterns: ["access", "unit", "ble", "rfid", "lector"],
      blockHints: ["access", "unit"],
    },
    { patterns: ["switch", "poe"], blockHints: ["switch", "poe"] },
    { patterns: ["router", "gateway"], blockHints: ["router", "gateway"] },
    { patterns: ["server", "nvr"], blockHints: ["server", "nvr"] },
    {
      patterns: ["cerradura", "lock", "garage"],
      blockHints: ["lock", "cerradura", "garage"],
    },
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
  const blocks = Array.isArray(appState.diagramas.dxfBlocks)
    ? appState.diagramas.dxfBlocks
    : [];
  if (!blocks.length) {
    appState.diagramas.lastError =
      "Carga primero la plantilla DXF para poder sugerir iconos (BLOCKS).";
    appState.diagramas.lastRaw = null;
    _renderResult();
    return;
  }

  _clearDiagError();

  for (const z of appState.diagramas.zones) {
    const list = appState.diagramas.assignments[z.key] || [];
    for (const it of list) {
      if (it.iconBlock) continue;
      const sug = _suggestIconBlockForItem(it, blocks);
      if (sug) it.iconBlock = sug;
    }
  }

  const cpdCfg = _getZoneConfig("armario_cpd");
  if (!cpdCfg.cpdSwitchBlock) {
    const sugSw =
      blocks.find(
        (b) => _norm(b).includes("switch") && _norm(b).includes("poe")
      ) || "";
    if (sugSw) _setCpdSwitchBlock(sugSw);
  }

  _saveAssignments(); // ✅ persist

  _renderDiagramasUI();
  _renderResult();
}

/* ======================================================
   5) Payload base (para IA y fallback local)
 ====================================================== */
function _defaultInstructions() {
  return `
RESPONDE ÚNICAMENTE CON JSON (sin markdown, sin \`\`\`, sin texto).
Tu respuesta DEBE empezar por "{" y terminar por "}".

Objetivo: Diseñar una red eficiente UTP_CAT6 minimizando saltos (latencia):
- Topología: devices -> switch de zona -> CORE (CPD) -> ROUTER
- PROHIBIDO: switches en cascada (NO switch->switch->switch). Cada switch de zona debe ir DIRECTO al CORE.
- Minimiza hops: máximo 2 saltos desde device hasta core (device->switch->core).

UNIDADES:
- Respeta qty de cada placement (xN). Eso implica ports estimados.

CABLES:
- Entre dispositivos de red usa UTP_CAT6.
- Para videoportero/control accesos: añade conexión "2_WIRE" SOLO si include_locks=true Y existe lock por zona (zone_locks).
  Si no hay lock por zona, NO inventes cerraduras.

NO inventes dispositivos finales: SOLO placements con source USER.
Puedes proponer infraestructura VIRTUAL_* en infra.

Devuelve EXACTAMENTE:
{
  "placements":[{"id":"...","ref":"...","zone":"...","icon_block":"...","qty":1,"meta":{"source":"USER"}}],
  "infra":[{"id":"...","type":"VIRTUAL_SWITCH_POE"|"VIRTUAL_SWITCH"|"VIRTUAL_CORE"|"VIRTUAL_ROUTER"|"VIRTUAL_LOCK_GARAGE","zone":"...","meta":{}}],
  "connections":[{"from":"...","to":"...","type":"UTP_CAT6"|"2_WIRE","note":"..."}],
  "summary":{"total_refs":0,"total_devices":0,"total_switches":0},
  "errors":[]
}
`.trim();
}

function _getEffectiveInstructions() {
  const s = appState.diagramas;
  if (s.useCustomPrompt && String(s.customPromptText || "").trim())
    return String(s.customPromptText).trim();
  return _defaultInstructions();
}

function _buildZoneLocksPayload() {
  const zones = appState.diagramas.zones || [];
  const out = [];
  for (const z of zones) {
    if (!z || z.key === "armario_cpd") continue;
    const cfg = _getZoneConfig(z.key);
    const lockBlock = _strip(cfg.lockBlock);
    if (!lockBlock) continue;
    out.push({ zone: z.key, lock_block: lockBlock });
  }
  return out;
}

function _buildSpecFromAssignments() {
  const zones = appState.diagramas.zones || [];
  const assignments = appState.diagramas.assignments || {};

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
        qty: Math.max(1, Number(it.qty || 1) || 1),
        meta: { source: "USER" },
      });
    }
  }

  if (!placements.length)
    throw new Error(
      "No hay referencias asignadas. Arrastra refs a alguna zona."
    );

  return {
    cable: "UTP_CAT6",
    zones: zones.map((z) => ({ key: z.key, label: z.label })),
    include_locks: !!appState.diagramas.includeLocks,
    zone_locks: _buildZoneLocksPayload(),
    cpd: {
      zone_key: "armario_cpd",
      switch_poe_block: _strip(
        _getZoneConfig("armario_cpd")?.cpdSwitchBlock || ""
      ),
    },
    placements,
    icon_library_blocks: (appState.diagramas.dxfBlocks || []).slice(0, 2000),
  };
}

/* ======================================================
   Fallback LOCAL (determinista)
 ====================================================== */
function _isPoeDevice(p) {
  const t = `${p.ref || ""} ${p.descripcion || ""}`.toUpperCase();
  const poeHints = [
    "IPSTYLE",
    "IP STYLE",
    "ACCESS",
    "UNIT",
    "READER",
    "INTERCOM",
    "IP ONE",
    "VERSO",
  ];
  return poeHints.some((k) => t.includes(k));
}

function _pickCoreZoneKey(spec) {
  const zones = Array.isArray(spec?.zones) ? spec.zones : [];
  const hasCpd = zones.some((z) => z.key === "armario_cpd");
  if (hasCpd) return "armario_cpd";
  return zones.length ? zones[0].key : "entrada_principal";
}

function _localDesignFromSpec(spec) {
  const placements = Array.isArray(spec?.placements) ? spec.placements : [];
  const zones = Array.isArray(spec?.zones) ? spec.zones : [];

  const byZone = {};
  for (const z of zones) byZone[z.key] = [];
  for (const p of placements) {
    const zk = String(p.zone || zones[0]?.key || "entrada_principal");
    if (!byZone[zk]) byZone[zk] = [];
    byZone[zk].push(p);
  }

  const coreZone = _pickCoreZoneKey(spec);

  const infra = [];
  const connections = [];

  const routerId = `V_ROUTER_${coreZone}`;
  const coreId = `V_CORE_${coreZone}`;
  infra.push({
    id: routerId,
    type: "VIRTUAL_ROUTER",
    zone: coreZone,
    meta: { role: "EDGE" },
  });
  infra.push({
    id: coreId,
    type: "VIRTUAL_CORE",
    zone: coreZone,
    meta: { role: "CORE" },
  });
  connections.push({
    from: coreId,
    to: routerId,
    type: "UTP_CAT6",
    note: "Uplink core -> router",
  });

  const cpdSwId = "V_CPD_SW_POE";
  infra.push({
    id: cpdSwId,
    type: "VIRTUAL_SWITCH_POE",
    zone: "armario_cpd",
    meta: {
      role: "CPD_SWITCH_POE",
      icon_block: _strip(spec?.cpd?.switch_poe_block || ""),
    },
  });
  connections.push({
    from: cpdSwId,
    to: coreId,
    type: "UTP_CAT6",
    note: "CPD switch -> core",
  });

  let totalSwitches = 1;

  // helper: asigna cada placement a 1 switch (distribución por qty)
  function _assignPlacementsToSwitches(list, switchesNeeded) {
    const items = (Array.isArray(list) ? list : []).slice();
    // opcional: ordena por qty desc para repartir mejor
    items.sort(
      (a, b) =>
        (Math.max(1, Number(b?.qty || 1) || 1) || 1) -
        (Math.max(1, Number(a?.qty || 1) || 1) || 1)
    );

    const buckets = Array.from({ length: switchesNeeded }, () => ({
      load: 0,
      items: [],
    }));

    for (const p of items) {
      const w = Math.max(1, Number(p?.qty || 1) || 1);
      // greedy: mete en el bucket con menos carga
      let best = 0;
      for (let i = 1; i < buckets.length; i++) {
        if (buckets[i].load < buckets[best].load) best = i;
      }
      buckets[best].items.push(p);
      buckets[best].load += w;
    }

    return buckets.map((b) => b.items);
  }

  for (const z of zones) {
    const list = byZone[z.key] || [];
    if (!list.length) continue;

    if (z.key === "armario_cpd") {
      for (const p of list) {
        connections.push({
          from: p.id,
          to: cpdSwId,
          type: "UTP_CAT6",
          note: "Device -> CPD switch",
        });
      }
      continue;
    }

    let ports = 0;
    let needsPoe = false;
    for (const p of list) {
      ports += Math.max(1, Number(p.qty || 1) || 1);
      if (_isPoeDevice(p)) needsPoe = true;
    }

    const switchesNeeded = ports > 24 ? 2 : 1;

    // ✅ NUEVO: repartir placements entre switches (cada placement a 1 switch)
    const perSwitchLists = _assignPlacementsToSwitches(list, switchesNeeded);

    for (let i = 1; i <= switchesNeeded; i++) {
      totalSwitches += 1;

      const swId = `V_SW_${z.key}_${i}`;
      infra.push({
        id: swId,
        type: needsPoe ? "VIRTUAL_SWITCH_POE" : "VIRTUAL_SWITCH",
        zone: z.key,
        meta: { ports_estimated: ports, index: i },
      });

      connections.push({
        from: swId,
        to: coreId,
        type: "UTP_CAT6",
        note: "Uplink zona -> core (sin cascada)",
      });

      // ✅ SOLO conecta a este switch los placements asignados a este switch
      const assigned = perSwitchLists[i - 1] || [];
      for (const p of assigned) {
        connections.push({
          from: p.id,
          to: swId,
          type: "UTP_CAT6",
          note: "Device -> switch zona",
        });
      }
    }
  }

  const summary = {
    total_refs: placements.length,
    total_devices: placements.reduce(
      (a, p) => a + Math.max(1, Number(p.qty || 1) || 1),
      0
    ),
    total_switches: totalSwitches,
  };

  const base = {
    placements: placements.map((p) => ({
      id: p.id,
      ref: p.ref,
      zone: p.zone,
      icon_block: p.icon_block || "",
      qty: Math.max(1, Number(p.qty || 1) || 1),
      descripcion: p.descripcion || "",
      meta: { source: "USER" },
    })),
    infra,
    connections,
    summary,
    errors: [],
  };

  return _augmentResultForSvg(base);
}
/* ======================================================
   IA (opcional) + parse robusto
 ====================================================== */
function _buildHandlerEnvelope(payload) {
  const sectionKey = "diagramas_network";
  const docKey = "diagramas";
  const sectionText = [
    payload.instructions,
    "",
    "INPUT_JSON:",
    JSON.stringify({ spec: payload.spec, network_rules: payload.network_rules }),
  ].join("\n");

  return {
    docKey,
    doc_key: docKey,
    documentKey: docKey,

    sectionKey,
    section_key: sectionKey,
    sectionId: sectionKey,
    section_id: sectionKey,

    sectionText,
    section_text: sectionText,
    content: sectionText,
    text: sectionText,

    mode: "diagram_network_v6_blocks_cpd_nocascade",
    instructions: payload.instructions,
    spec: payload.spec,
    network_rules: payload.network_rules,
    user: {
      email: appState?.user?.email || "",
      role: appState?.user?.role || "",
    },

    jsonOnly: true,
    response_format: "json",
  };
}

function _coerceTextFromHandlerResponse(res) {
  if (res == null) return "";
  if (typeof res === "string") return res;

  const candidates = [
    res.text,
    res.output_text,
    res.outputText,
    res.content,
    res.result,
    res.data,
    res.response,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }

  try {
    return JSON.stringify(res);
  } catch (_) {
    return String(res);
  }
}

function _extractJsonString(s) {
  const t = String(s || "").trim();
  if (!t) return "";

  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) return fence[1].trim();

  const i0 = t.indexOf("{");
  const i1 = t.lastIndexOf("}");
  if (i0 >= 0 && i1 > i0) return t.slice(i0, i1 + 1).trim();

  return "";
}

function _parseJsonRobust(res) {
  if (res == null) return { ok: false, error: "Respuesta vacía", raw: "" };

  if (typeof res === "object" && res) {
    if ("placements" in res && "connections" in res && "errors" in res) {
      return { ok: true, obj: res, raw: "" };
    }
  }

  const rawText = _coerceTextFromHandlerResponse(res);
  const jsonText = _extractJsonString(rawText);

  if (!jsonText) {
    return {
      ok: false,
      error:
        'La IA devolvió texto sin JSON reconocible (no encuentro "{ ... }").',
      raw: rawText,
    };
  }

  try {
    const obj = JSON.parse(jsonText);
    return { ok: true, obj, raw: rawText };
  } catch (_) {
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
  appState.diagramas.lastRaw = null;
  appState.diagramas.usedLocalFallback = false;
  _renderResult();

  appState.diagramas.useCustomPrompt = !!(
    _el("diagUseCustomPrompt") && _el("diagUseCustomPrompt").checked
  );
  appState.diagramas.customPromptText = _el("diagPromptText")
    ? String(_el("diagPromptText").value || "")
    : appState.diagramas.customPromptText;

  const chkLocks = _el("diagIncludeLocks");
  if (chkLocks) appState.diagramas.includeLocks = !!chkLocks.checked;

  let spec;
  try {
    spec = _buildSpecFromAssignments();
  } catch (e) {
    appState.diagramas.lastError = e.message || String(e);
    _renderResult();
    return;
  }

  const payload = {
    instructions: _getEffectiveInstructions(),
    spec,
    network_rules: {
      cable: "UTP_CAT6",
      topology: ["hierarchical_star", "star"],
      hints: {
        cpd_zone_key: "armario_cpd",
        avoid_cascaded_switches: true,
        minimize_hops: true,
      },
    },
  };

  const handler =
    window.handleDocSectionAI || window.handleAI || window.callGemini || null;

  if (typeof handler !== "function") {
    appState.diagramas.lastResult = _localDesignFromSpec(spec);
    appState.diagramas.usedLocalFallback = true;
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
      appState.diagramas.lastResult = _localDesignFromSpec(spec);
      appState.diagramas.usedLocalFallback = true;
      appState.diagramas.lastError = null;
      _renderResult();
      return;
    }

    const obj = parsed.obj;

    if (!obj || typeof obj !== "object")
      throw new Error("Respuesta IA inválida.");
    if (
      !("placements" in obj) ||
      !("connections" in obj) ||
      !("errors" in obj)
    ) {
      appState.diagramas.lastRaw = parsed.raw || null;
      appState.diagramas.lastResult = _localDesignFromSpec(spec);
      appState.diagramas.usedLocalFallback = true;
      appState.diagramas.lastError = null;
      _renderResult();
      return;
    }

    appState.diagramas.lastResult = _augmentResultForSvg(obj);

    appState.diagramas.lastError = null;
    appState.diagramas.usedLocalFallback = false;
    _renderResult();
  } catch (e) {
    console.error(e);
    appState.diagramas.lastResult = _localDesignFromSpec(spec);
    appState.diagramas.usedLocalFallback = true;
    appState.diagramas.lastError = null;
    _renderResult();
  } finally {
    _setBusy(false);
  }
}
/* ======================================================
   6A) Export SVG (MAESTRO)
 ====================================================== */
function diagExportSvg() {
  const base = appState.diagramas.lastResult || appState.diagramas._previewResult;
  if (!base) {
    appState.diagramas.lastError =
      "No hay resultado para exportar. Genera el diseño o crea un preview manual.";
    appState.diagramas.lastRaw = null;
    _renderResult();
    return;
  }

  const r = _augmentResultForSvg(base);

  const coords = _buildSchematicCoordsFromResult(r);
  if (!coords.size) {
    appState.diagramas.lastError = "No hay nodos para exportar.";
    appState.diagramas.lastRaw = null;
    _renderResult();
    return;
  }

  let maxX = 0,
    maxY = 0;
  for (const [, p] of coords.entries()) {
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const vbW = Math.max(900, maxX + 320);
  const vbH = Math.max(420, maxY + 180);

  const zones = appState.diagramas.zones || [];
  const colW = 280;
  const startX = 80;

  const connections = Array.isArray(r?.connections) ? r.connections : [];
  const placements = Array.isArray(r?.placements) ? r.placements : [];
  const infra = Array.isArray(r?.infra) ? r.infra : [];

  const headers = zones
    .map((z, i) => {
      const x = startX + i * colW;
      return `<text x="${x}" y="36" font-size="13" fill="#6b7280" font-family="Arial, sans-serif">${_escapeHtml(
        z.label
      )}</text>`;
    })
    .join("");

  const lines = connections
    .map((c) => {
      const a = coords.get(c.from);
      const b = coords.get(c.to);
      if (!a || !b) return "";
      const st = _strokeForConnectionType(c.type);
      const dash = st.dash ? ` stroke-dasharray="${st.dash}"` : "";
      const label2h =
        String(c.type || "").toUpperCase() === "2_WIRE"
          ? `<text x="${(a.x + b.x) / 2 + 6}" y="${(a.y + b.y) / 2 - 6}" font-size="11" fill="rgba(245,158,11,.95)" font-family="Arial, sans-serif">2H</text>`
          : "";
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${st.stroke}" stroke-width="${st.width}"${dash}/>${label2h}`;
    })
    .join("");

  const placementNodes = placements
    .map((p) => {
      const pos = coords.get(p.id);
      if (!pos) return "";
      const qty = Math.max(1, Number(p.qty || 1) || 1);
      const label = _escapeHtml(String(p.ref || p.id || ""));
      const badge =
        qty > 1
          ? `<g>
               <rect x="${pos.x - 6}" y="${pos.y - 34}" width="28" height="16" rx="6" ry="6" fill="rgba(17,24,39,.90)"></rect>
               <text x="${pos.x - 2}" y="${pos.y - 22}" font-size="11" fill="#ffffff" font-family="Arial, sans-serif">x${qty}</text>
             </g>`
          : "";
      return `
      <g>
        <circle cx="${pos.x}" cy="${pos.y}" r="14" fill="#1d4fd8" opacity="0.95"></circle>
        ${badge}
        <text x="${pos.x + 18}" y="${pos.y + 5}" font-size="12" fill="#111827" font-family="Arial, sans-serif">${label}</text>
      </g>
    `;
    })
    .join("");

  const infraNodes = infra
    .map((n) => {
      const pos = coords.get(n.id);
      if (!pos) return "";
      const t = String(n.type || n.id || "");
      const role = String(n?.meta?.role || "");
      const isLock =
        t.toUpperCase().includes("LOCK") || t.toUpperCase().includes("GARAGE");
      const isCpdSw =
        t.toUpperCase().includes("SWITCH") && role.toUpperCase().includes("CPD");
      const label = _escapeHtml(
        isCpdSw ? "SWITCH POE (CPD)" : isLock ? "CERRADURA / GARAJE" : t
      );
      return `
      <g>
        <circle cx="${pos.x}" cy="${pos.y}" r="14" fill="#111827" opacity="0.95"></circle>
        <text x="${pos.x + 18}" y="${pos.y + 5}" font-size="12" fill="#111827" font-family="Arial, sans-serif">${label}</text>
      </g>
    `;
    })
    .join("");

  const title = `<text x="80" y="20" font-size="14" fill="#111827" font-family="Arial, sans-serif" font-weight="700">DIAGRAMA RED (UTP CAT6${
    appState.diagramas.includeLocks ? " + 2H" : ""
  })</text>`;

  const svgText =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${vbW}" height="${vbH}" viewBox="0 0 ${vbW} ${vbH}">\n` +
    `<rect x="0" y="0" width="${vbW}" height="${vbH}" fill="#ffffff"/>\n` +
    `${title}\n${headers}\n${lines}\n${placementNodes}\n${infraNodes}\n` +
    `</svg>\n`;

  const nameBase = (appState.diagramas.dxfFileName || "diagrama").replace(
    /\.dxf$/i,
    ""
  );
  const fileName = `${nameBase}_red_cat6${
    appState.diagramas.includeLocks ? "_2h" : ""
  }.svg`;

  try {
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.style.display = "none";
    a.rel = "noopener";

    document.body.appendChild(a);
    requestAnimationFrame(() => {
      a.click();
      setTimeout(() => {
        try {
          a.remove();
        } catch (_) {}
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      }, 2000);
    });
  } catch (e) {
    console.error(e);
    appState.diagramas.lastError =
      "No se pudo descargar el SVG (bloqueado por el navegador).";
    _renderResult();
  }
}

/* ======================================================
   6B) Export DXF
   ⚠️ lo dejamos tal cual en tu proyecto (no incluido aquí a propósito)
 ====================================================== */
function diagExportDxf() {
  // IMPORTANTE: lo saltamos ahora como pediste. Mantén tu implementación existente.
  appState.diagramas.lastError =
    "Export DXF: pendiente (no tocado en esta versión).";
  appState.diagramas.lastRaw = null;
  _renderResult();
}
/* ======================================================
   7) Render UI
 ====================================================== */
function _renderRefsList() {
  const host = _el("diagRefsList");
  if (!host) return;

  const s = appState.diagramas;
  const refs = Array.isArray(s.refs) ? s.refs : [];
  const q = String(s.refsSearch || "").toLowerCase().trim();
  const filtered = q
    ? refs.filter(
        (r) =>
          (r.ref || "").toLowerCase().includes(q) ||
          (r.descripcion || "").toLowerCase().includes(q)
      )
    : refs;

  host.innerHTML = `
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
    ${
      filtered.length > 300
        ? `<div class="muted mt-2">Mostrando 300.</div>`
        : ""
    }
  `;

  host.querySelectorAll("[draggable='true'][data-ref]").forEach((node) => {
    node.addEventListener("dragstart", (ev) =>
      _onRefDragStart(ev, node.dataset.ref)
    );
    node.addEventListener(
      "dragend",
      () => (_dragRefKey = (window._dragRefKey = null))
    );
  });
}

function _renderDiagramasUI() {
  const host = _el("diagMain");
  if (!host) return;

  const s = appState.diagramas;
  const blocks = Array.isArray(s.dxfBlocks) ? s.dxfBlocks : [];

  function _blocksOptionsHtml(cur, { allowEmptyLabel = "(sin bloque)" } = {}) {
    if (!blocks.length) {
      return `<option value="">(sin DXF cargado)</option>`;
    }
    return (
      `<option value="">${_escapeHtml(allowEmptyLabel)}</option>` +
      blocks
        .slice(0, 1200)
        .map(
          (b) =>
            `<option value="${_escapeHtmlAttr(b)}"${
              cur === b ? " selected" : ""
            }>${_escapeHtml(b)}</option>`
        )
        .join("")
    );
  }

  function _lockSelectHtml(zoneKey) {
    if (zoneKey === "armario_cpd") return "";

    const cfg = _getZoneConfig(zoneKey);
    const cur = _strip(cfg.lockBlock);

    return `
      <div class="form-group mt-2" style="margin-bottom:0;">
        <label style="font-size:12px;">Cerradura (2 hilos, opcional) · BLOCK DXF</label>
        <select style="max-width:100%;" data-act="zoneLockBlock" data-zone="${_escapeHtmlAttr(
          zoneKey
        )}">
          ${_blocksOptionsHtml(cur, {
            allowEmptyLabel: "(sin cerradura en esta sección)",
          })}
        </select>
      </div>
    `;
  }

  function _cpdSwitchHtml() {
    const cfg = _getZoneConfig("armario_cpd");
    const cur = _strip(cfg.cpdSwitchBlock);
    return `
      <div class="form-group mt-2" style="margin-bottom:0;">
        <label style="font-size:12px;">Switch POE (Armario/CPD) · BLOCK DXF</label>
        <select style="max-width:100%;" data-act="cpdSwitchBlock">
          ${_blocksOptionsHtml(cur, {
            allowEmptyLabel: "(sin bloque, usar círculo)",
          })}
        </select>
      </div>
    `;
  }

  function zoneHtml(z) {
    const list = Array.isArray(s.assignments[z.key])
      ? s.assignments[z.key]
      : [];
    const isArmario = z.key === "armario_cpd";

    const items = list
      .map((it) => {
        const blockOptions = _blocksOptionsHtml(it.iconBlock, {
          allowEmptyLabel: "(sin icono)",
        });

        return `
          <div class="card diag-assignment" style="padding:10px; margin-top:8px; min-width:0;"
               draggable="true"
               data-zone="${_escapeHtmlAttr(z.key)}"
               data-id="${_escapeHtmlAttr(it.id)}">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
              <div style="min-width:0;">
                <div style="font-weight:600;">${_escapeHtml(it.ref)}</div>
                <div class="muted" style="font-size:12px;">${_escapeHtml(
                  it.descripcion || ""
                )}</div>
              </div>
              <div style="display:flex; gap:8px; align-items:center;">
                <span class="chip" title="Arrastra para mover/reordenar">↕︎</span>
                <button class="btn btn-sm" data-act="remove" data-zone="${_escapeHtmlAttr(
                  z.key
                )}" data-id="${_escapeHtmlAttr(it.id)}">Quitar</button>
              </div>
            </div>

            <div class="grid mt-2" style="display:grid; grid-template-columns: 120px 1fr; gap:10px; align-items:center; min-width:0;">
              <div class="form-group" style="margin:0;">
                <label style="font-size:12px;">Cantidad</label>
                <input type="number" min="1" value="${Number(
                  it.qty || 1
                )}" data-act="qty" data-zone="${_escapeHtmlAttr(
          z.key
        )}" data-id="${_escapeHtmlAttr(it.id)}"/>
              </div>
              <div class="form-group" style="margin:0; min-width:0;">
                <label style="font-size:12px;">Icono (BLOCK)</label>
                <select style="max-width:100%;" data-act="icon" data-zone="${_escapeHtmlAttr(
                  z.key
                )}" data-id="${_escapeHtmlAttr(it.id)}">
                  ${blockOptions}
                </select>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    const zoneActions = isArmario
      ? ""
      : `
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn btn-sm" title="Renombrar sección" data-act="zoneRename" data-zone="${_escapeHtmlAttr(
            z.key
          )}">✏️</button>
          <button class="btn btn-sm" title="Borrar sección" data-act="zoneDelete" data-zone="${_escapeHtmlAttr(
            z.key
          )}">🗑️</button>
        </div>
      `;

    // ✅ ZONA draggable (reordenar ubicaciones) excepto armario
    const zoneDragAttrs = !isArmario
      ? `draggable="true" data-zone-card="1"`
      : `data-zone-card="0"`;

    return `
      <div class="card diag-dropzone" ${zoneDragAttrs} data-zone="${_escapeHtmlAttr(
      z.key
    )}" style="padding:12px; min-height:180px; min-width:0;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div style="min-width:0;">
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <div style="font-weight:700;">${_escapeHtml(z.label)}</div>
              ${
                isArmario
                  ? `<span class="chip">Fijo</span>`
                  : `<span class="chip" title="Arrastra para mover esta ubicación">↔︎</span>`
              }
            </div>
            <div class="muted" style="font-size:12px;">Suelta aquí referencias · o arrastra tarjetas entre ubicaciones</div>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <span class="chip">${list.length}</span>
            ${zoneActions}
          </div>
        </div>

        ${isArmario ? _cpdSwitchHtml() : _lockSelectHtml(z.key)}
        ${items || `<div class="muted mt-2" style="font-size:12px;">(vacío)</div>`}
      </div>
    `;
  }

  host.innerHTML = `
    <div class="grid" style="display:grid; grid-template-columns: 360px 1fr; gap:14px; min-width:0; max-width:100%;">
      <div class="card" style="padding:12px; min-width:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <h3 style="margin:0;">Referencias del proyecto</h3>
          <div style="display:flex; gap:8px; align-items:center;">
            <button id="btnDiagReloadRefs" class="btn btn-sm">Recargar</button>
          </div>
        </div>

        <div class="muted mt-1" style="font-size:12px;">
          Fuente: presupuesto. Arrastra a secciones.
        </div>

        <div class="form-group mt-2">
          <input id="diagRefsSearch" type="text" placeholder="Buscar ref/descripcion..." value="${_escapeHtml(
            s.refsSearch || ""
          )}"/>
        </div>

        <div id="diagRefsList" style="max-height:520px; overflow:auto; border:1px solid rgba(15,23,42,.08); border-radius:10px; padding:8px;"></div>

        <div class="card mt-3" style="padding:12px;">
          <h4 style="margin:0;">Plantilla DXF (solo para iconos)</h4>
          <div class="muted" style="font-size:12px; margin-top:6px;">
            Cárgala para poder elegir BLOCKs en los selects y usar <b>Auto</b>.
          </div>

          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:10px;">
            <input id="diagDxfFile" type="file" accept=".dxf"/>
            <span class="muted" style="font-size:12px;">
              ${
                s.dxfFileName
                  ? `Cargado: <b>${_escapeHtml(s.dxfFileName)}</b> · blocks: ${
                      blocks.length
                    }`
                  : "Sin DXF cargado"
              }
            </span>
          </div>
        </div>
      </div>

      <div style="min-width:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
          <div style="min-width:0;">
            <h3 style="margin:0;">Ubicación de dispositivos</h3>
            <div class="muted" style="font-size:12px;">
              Puedes <b>reordenar ubicaciones</b> (arrastrando la tarjeta) y <b>mover dispositivos</b> entre ubicaciones arrastrando sus tarjetas.
            </div>
          </div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <label class="chip" style="display:flex; gap:8px; align-items:center; cursor:pointer;">
              <input id="diagIncludeLocks" type="checkbox"${
                s.includeLocks ? " checked" : ""
              } style="transform:translateY(1px);"/>
              Incluir cerraduras (2H)
            </label>
            <button id="btnDiagAddZone" class="btn btn-sm">Añadir ubicación</button>
            <button id="btnDiagAuto" class="btn btn-secondary btn-sm">Auto</button>
            <button id="btnDiagTogglePrompt" class="btn btn-sm">Prompt</button>
            <button id="btnDiagGenerate" class="btn btn-primary btn-sm">Generar diseño</button>
            <button id="btnDiagExportSvg" class="btn btn-sm">Exportar SVG</button>
            <button id="btnDiagExportDxf" class="btn btn-sm">Exportar DXF</button>
            <span id="diagBusy" class="muted" style="display:none;">Generando…</span>
          </div>
        </div>

        <div id="diagPromptBox" class="card mt-3" style="padding:12px; display:${
          s.promptUiOpen ? "" : "none"
        };">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <h4 style="margin:0;">Prompt</h4>
            <span class="muted" style="font-size:12px;">Editable</span>
          </div>
          <label style="display:flex; gap:8px; align-items:center; margin-top:10px;">
            <input id="diagUseCustomPrompt" type="checkbox"${
              s.useCustomPrompt ? " checked" : ""
            }/> Usar prompt personalizado
          </label>
          <div class="form-group mt-2">
            <textarea id="diagPromptText" rows="12">${_escapeHtml(
              s.customPromptText || _defaultInstructions()
            )}</textarea>
          </div>
        </div>

        <div class="grid mt-3" style="display:grid; grid-template-columns: 1fr 1fr; gap:14px; min-width:0;">
          ${s.zones.map(zoneHtml).join("")}
        </div>

        <div class="mt-3" id="diagOutput" style="min-width:0;"></div>
      </div>
    </div>
  `;

  _renderRefsList();

  const inp = _el("diagRefsSearch");
  if (inp) {
    inp.addEventListener("input", () => {
      appState.diagramas.refsSearch = String(inp.value || "");
      _renderRefsList();
    });
  }

  const btnReload = _el("btnDiagReloadRefs");
  if (btnReload) {
    btnReload.addEventListener("click", () => {
      diagLoadProjectRefs();
      _renderDiagramasUI();
      _renderResult();
    });
  }

  const btnAddZone = _el("btnDiagAddZone");
  if (btnAddZone) btnAddZone.addEventListener("click", _addZoneManual);

  const chkLocks = _el("diagIncludeLocks");
  if (chkLocks) {
    chkLocks.addEventListener("change", () => {
      appState.diagramas.includeLocks = !!chkLocks.checked;
      _clearDiagError();
      _renderResult();
    });
  }

  const inpDxf = _el("diagDxfFile");
  if (inpDxf) {
    inpDxf.addEventListener("change", async () => {
      const f = inpDxf.files && inpDxf.files[0] ? inpDxf.files[0] : null;
      await diagImportDxfFile(f);
    });
  }

  const btnPrompt = _el("btnDiagTogglePrompt");
  if (btnPrompt) {
    btnPrompt.addEventListener("click", () => {
      appState.diagramas.promptUiOpen = !appState.diagramas.promptUiOpen;
      _renderDiagramasUI();
      _renderResult();
    });
  }

  const btnAuto = _el("btnDiagAuto");
  if (btnAuto) btnAuto.addEventListener("click", diagAutoAssignIcons);

  const btnGen = _el("btnDiagGenerate");
  if (btnGen) btnGen.addEventListener("click", diagGenerateDesign);

  const btnSvg = _el("btnDiagExportSvg");
  if (btnSvg) btnSvg.addEventListener("click", diagExportSvg);

  const btnDxf = _el("btnDiagExportDxf");
  if (btnDxf) btnDxf.addEventListener("click", diagExportDxf);

  // ✅ Dropzones (refs + assignments + zone reorder)
  host.querySelectorAll(".diag-dropzone[data-zone]").forEach((zone) => {
    const zoneKey = zone.dataset.zone;

    zone.addEventListener("dragover", _onZoneDragOver);
    zone.addEventListener("dragleave", _onZoneDragLeave);
    zone.addEventListener("drop", (ev) => _onZoneDrop(ev, zoneKey));

    // zone card dragstart (reorder ubicaciones)
    if (
      zone.getAttribute("draggable") === "true" &&
      zone.dataset.zoneCard === "1"
    ) {
      zone.addEventListener("dragstart", (ev) =>
        _onZoneCardDragStart(ev, zoneKey)
      );
      zone.addEventListener("dragend", _onZoneCardDragEnd);
    }
  });

  // ✅ Cards: mover/reordenar assignments
  host.querySelectorAll(".diag-assignment[data-zone][data-id]").forEach(
    (card) => {
      const zoneKey = card.dataset.zone;
      const id = card.dataset.id;

      card.addEventListener("dragstart", (ev) =>
        _onAssignmentDragStart(ev, zoneKey, id)
      );
      card.addEventListener("dragend", _onAssignmentDragEnd);

      card.addEventListener("dragover", (ev) => {
        let payload = "";
        try {
          payload = ev.dataTransfer.getData("text/plain") || "";
        } catch (_) {}
        payload = String(payload || "").trim();

        // ✅ si arrastras una ZONA encima de una tarjeta
        if (payload.startsWith("ZONE:")) {
          ev.preventDefault();
          try {
            ev.dataTransfer.dropEffect = "move";
          } catch (_) {}
          return;
        }

        ev.preventDefault();
        try {
          ev.dataTransfer.dropEffect = "move";
        } catch (_) {}
      });

      card.addEventListener("drop", (ev) => {
        // NO gestionar aquí el drop
        // El orden lo decide _onZoneDrop() usando clientY
        ev.preventDefault();
      });
    }
  );

  host.querySelectorAll("[data-act]").forEach((node) => {
    const act = node.dataset.act;
    const zoneKey = node.dataset.zone;
    const id = node.dataset.id;

    if (act === "remove") {
      node.addEventListener("click", () => _removeAssignment(zoneKey, id));
    } else if (act === "qty") {
      node.addEventListener("change", () => {
        const v = Number(node.value || 1);
        _updateAssignment(zoneKey, id, {
          qty: Math.max(1, Number.isFinite(v) ? v : 1),
        });
        _renderResult();
      });
    } else if (act === "icon") {
      node.addEventListener("change", () => {
        _updateAssignment(zoneKey, id, {
          iconBlock: String(node.value || ""),
        });
        _renderResult();
      });
    } else if (act === "zoneRename") {
      node.addEventListener("click", () => _renameZone(zoneKey));
    } else if (act === "zoneDelete") {
      node.addEventListener("click", () => _deleteZone(zoneKey));
    } else if (act === "zoneLockBlock") {
      node.addEventListener("change", () => {
        _setZoneLockBlock(zoneKey, String(node.value || ""));
        _renderResult();
      });
    } else if (act === "cpdSwitchBlock") {
      node.addEventListener("change", () => {
        _setCpdSwitchBlock(String(node.value || ""));
        _renderResult();
      });
    }
  });
}

/* ======================================================
   Public view
 ====================================================== */
function renderDiagramasView() {
  appState.diagramas = _defaultDiagramasState();

  const root = document.getElementById("appContent");
  if (!root) return;

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

  try {
    if (!appState.diagramas.dxfBlocksSection) {
      appState.diagramas.dxfFileName =
        localStorage.getItem("diag_dxf_fileName") || "";
      const b = localStorage.getItem("diag_dxf_blocks");
      if (b) appState.diagramas.dxfBlocks = JSON.parse(b) || [];

      const ba = localStorage.getItem("diag_dxf_blockAttrs");
      if (ba) appState.diagramas.dxfBlockAttrs = JSON.parse(ba) || {};

      appState.diagramas.dxfHeaderSection =
        localStorage.getItem("diag_dxf_headerSection") || "";
      appState.diagramas.dxfClassesSection =
        localStorage.getItem("diag_dxf_classesSection") || "";
      appState.diagramas.dxfTablesSection =
        localStorage.getItem("diag_dxf_tablesSection") || "";
      appState.diagramas.dxfBlocksSection =
        localStorage.getItem("diag_dxf_blocksSection") || "";
      appState.diagramas.dxfObjectsSection =
        localStorage.getItem("diag_dxf_objectsSection") || "";
    }

    appState.diagramas.zonesConfig = _loadZonesConfig();
    appState.diagramas.zonesOrder = _loadZonesOrder();

    // ✅ cargar assignments persistidos
    appState.diagramas.assignments = _loadAssignments();

    // ✅ cargar layout persistido
    appState.diagramas.manualCoords = _loadManualCoords();
  } catch (_) {}

  diagLoadProjectRefs();

  root.innerHTML = `
    <div class="card">
      <div>
        <h2 style="margin-bottom:4px;">Diagramas · Drag & Drop</h2>
        <div class="muted">
          Exporta <b>SVG</b> (maestro).
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
window.diagExportSvg = diagExportSvg;
window.diagExportDxf = diagExportDxf;
window.diagLoadProjectRefs = diagLoadProjectRefs;
