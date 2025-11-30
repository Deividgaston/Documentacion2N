// js/firebase_tarifa.js
// Servicio de tarifas 2N para Firestore (Firebase v8, productos como MAP en tarifas/v1)

if (!window.appState) window.appState = {};
if (!appState.tarifas) appState.tarifas = {};

window.tarifasCache = window.tarifasCache || {};
const tarifasCache = window.tarifasCache;

// Ruta en Firestore:
// tarifas / v1   --> campo "productos" (MAP) con claves = ref (9157101, 9160347, etc.)
const TARIFAS_COLLECTION = "tarifas";
const TARIFAS_DOC_VERSION = "v1";

// cache del documento completo tarifas/v1
let tarifaProductosMap = null;
let tarifaDocLoaded = false;

// Cargar doc tarifas/v1 una sola vez
async function ensureTarifaLoaded() {
  if (tarifaDocLoaded && tarifaProductosMap) return;

  try {
    const docRef = db.collection(TARIFAS_COLLECTION).doc(TARIFAS_DOC_VERSION);
    const snap = await docRef.get();

    if (!snap.exists) {
      console.error("[Tarifa] El documento tarifas/" + TARIFAS_DOC_VERSION + " no existe.");
      tarifaProductosMap = {};
      tarifaDocLoaded = true;
      return;
    }

    const data = snap.data() || {};
    // 👇 aquí está el MAP con todos los productos
    tarifaProductosMap = data.productos || {};
    tarifaDocLoaded = true;

    console.log(
      "[Tarifa] Documento tarifas/" + TARIFAS_DOC_VERSION + " cargado. Nº refs en MAP:",
      Object.keys(tarifaProductosMap).length
    );
  } catch (err) {
    console.error("[Tarifa] Error cargando tarifas/" + TARIFAS_DOC_VERSION + ":", err);
    tarifaProductosMap = {};
    tarifaDocLoaded = true;
  }
}

// Cargar en caché solo las refs que falten
async function loadTarifasForRefs(refs) {
  if (!refs || !refs.length) return;

  const limpias = [...new Set(refs.map(r => String(r || "").trim()).filter(Boolean))];
  const pendientes = limpias.filter(ref => !tarifasCache[ref]);

  if (!pendientes.length) {
    console.log("[Tarifa] Todas las refs ya estaban cacheadas.");
    return;
  }

  await ensureTarifaLoaded();

  if (!tarifaProductosMap) {
    console.warn("[Tarifa] No se ha podido cargar el MAP de productos.");
    return;
  }

  pendientes.forEach(ref => {
    const prod = tarifaProductosMap[ref];

    if (!prod) {
      console.warn("[Tarifa] No existe producto con ref", ref);
      return;
    }

    // En tu estructura, los datos están en prod.campos_originales
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
      pvp: Number(precio) || 0
    };

    tarifasCache[ref] = item;
    appState.tarifas[ref] = item;
  });

  console.log(
    "[Tarifa] Total refs en caché ahora:",
    Object.keys(tarifasCache).length
  );
}

async function loadTarifasIfNeeded() {
  await ensureTarifaLoaded();
}

function findTarifaItem(ref) {
  if (!ref) return null;
  const key = String(ref).trim();
  return appState.tarifas[key] || tarifasCache[key] || null;
}

// Exponer en global
window.loadTarifasForRefs = loadTarifasForRefs;
window.loadTarifasIfNeeded = loadTarifasIfNeeded;
window.findTarifaItem = findTarifaItem;
