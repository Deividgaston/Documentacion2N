// js/firebase_tarifa.js
// Lectura optimizada de tarifas 2N desde Firestore
// Estructura esperada:
//  collection "tarifas" / doc "v1" / campo "productos" (MAP)
//  productos[ref].campos_originales["Distributor Price (EUR)"], ["Product Name"], etc.

if (!window.appState) window.appState = {};
if (!appState.tarifas) appState.tarifas = {};

window.tarifasCache = window.tarifasCache || {};
const tarifasCache = window.tarifasCache;

const TARIFAS_COLLECTION = "tarifas";
const TARIFAS_DOC_VERSION = "v1";

let tarifaProductosMap = null;
let tarifaDocLoaded = false;

async function ensureTarifaLoaded() {
  if (tarifaDocLoaded && tarifaProductosMap) return;

  try {
    const docRef = db.collection(TARIFAS_COLLECTION).doc(TARIFAS_DOC_VERSION);
    const snap = await docRef.get();

    if (!snap.exists) {
      console.error("[Tarifa] El documento tarifas/v1 no existe.");
      tarifaProductosMap = {};
      tarifaDocLoaded = true;
      return;
    }

    const data = snap.data() || {};
    tarifaProductosMap = data.productos || {};
    tarifaDocLoaded = true;

    console.log("[Tarifa] tarifas/v1 cargado. Nº refs:", Object.keys(tarifaProductosMap).length);
  } catch (err) {
    console.error("[Tarifa] Error cargando tarifas/v1:", err);
    tarifaProductosMap = {};
    tarifaDocLoaded = true;
  }
}

async function loadTarifasForRefs(refs) {
  if (!refs || !refs.length) return;

  const limpias = [...new Set(refs.map(r => String(r || "").trim()).filter(Boolean))];
  const pendientes = limpias.filter(ref => !tarifasCache[ref]);

  if (!pendientes.length) {
    console.log("[Tarifa] Todas las refs ya estaban en caché.");
    return;
  }

  await ensureTarifaLoaded();
  if (!tarifaProductosMap) {
    console.warn("[Tarifa] MAP de productos no disponible.");
    return;
  }

  pendientes.forEach(ref => {
    const prod = tarifaProductosMap[ref];
    if (!prod) {
      console.warn("[Tarifa] No existe producto con ref", ref);
      return;
    }

    const co = prod.campos_originales || prod;

    const descripcion =
      co["Product Name"] ||
      co["Descripción"] ||
      co["Description"] ||
      co["2N SKU"] ||
      ref;

    const precio =
      co["Distributor Price (EUR)"] ??
      co["List Price (EUR)"] ??
      co["Price (EUR)"] ??
      0;

    const item = {
      ref,
      descripcion: descripcion || "",
      pvp: Number(precio) || 0,
    };

    tarifasCache[ref] = item;
    appState.tarifas[ref] = item;
  });

  console.log("[Tarifa] Total refs en caché:", Object.keys(tarifasCache).length);
}

function findTarifaItem(ref) {
  if (!ref) return null;
  const key = String(ref).trim();
  return appState.tarifas[key] || tarifasCache[key] || null;
}

window.loadTarifasForRefs = loadTarifasForRefs;
window.findTarifaItem = findTarifaItem;
window.ensureTarifaLoaded = ensureTarifaLoaded;
