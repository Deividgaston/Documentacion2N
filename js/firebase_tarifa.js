// js/firebase_tarifa.js
// Servicio de tarifas 2N para Firestore (Firebase v8)

// Requiere que en firebase.js ya exista:
//   const db = firebase.firestore();

if (!window.appState) window.appState = {};
if (!appState.tarifas) appState.tarifas = {};

// Cache en memoria compartida
window.tarifasCache = window.tarifasCache || {};
const tarifasCache = window.tarifasCache;

// Ruta en Firestore:
// tarifas / v1 / productos / {ref}
const TARIFAS_COLLECTION = "tarifas";
const TARIFAS_DOC_VERSION = "v1";
const TARIFAS_SUBCOL = "productos";

/**
 * Carga desde Firestore solo las refs que no estén en caché.
 * refs: array de referencias tipo ["916020", "915510E", ...]
 */
async function loadTarifasForRefs(refs) {
  if (!refs || !refs.length) return;

  // Normalizamos y quitamos duplicados
  const limpias = [...new Set(refs.map(r => String(r || "").trim()).filter(Boolean))];

  // Solo las que no están en caché
  const pendientes = limpias.filter(ref => !tarifasCache[ref]);
  if (!pendientes.length) {
    console.log("[Tarifa] Todas las refs ya estaban cacheadas.");
    return;
  }

  console.log("[Tarifa] Consultando Firestore para refs:", pendientes);

  // Leemos todos los docs en paralelo (1 lectura por ref, pero sin duplicados)
  const promises = pendientes.map(async (ref) => {
    try {
      const docRef = db
        .collection(TARIFAS_COLLECTION)
        .doc(TARIFAS_DOC_VERSION)
        .collection(TARIFAS_SUBCOL)
        .doc(ref);

      const snapshot = await docRef.get();
      if (!snapshot.exists) {
        console.warn("[Tarifa] No existe producto con ref", ref);
        return;
      }

      const data = snapshot.data() || {};
      const co = data.campos_originales || {};

      const descripcion =
        co["Product Name"] ||
        co["Description"] ||
        co["Product description"] ||
        co["2N SKU"] ||
        ref;

      const precio =
        co["List Price (EUR)"] ??
        co["Distributor Price (EUR)"] ??
        0;

      const item = {
        ref,
        descripcion: descripcion || "",
        pvp: Number(precio) || 0
      };

      tarifasCache[ref] = item;
      appState.tarifas[ref] = item;
    } catch (err) {
      console.error("[Tarifa] Error obteniendo ref", ref, err);
    }
  });

  await Promise.all(promises);

  console.log("[Tarifa] Total refs en caché ahora:", Object.keys(tarifasCache).length);
}

/**
 * Función opcional, por si en algún sitio quieres precargar todo.
 * Aquí no hacemos nada porque preferimos cargar solo lo necesario.
 */
async function loadTarifasIfNeeded() {
  return;
}

// Helpers globales para el resto de archivos
function findTarifaItem(ref) {
  if (!ref) return null;
  const key = String(ref).trim();
  return appState.tarifas[key] || tarifasCache[key] || null;
}

window.loadTarifasForRefs = loadTarifasForRefs;
window.loadTarifasIfNeeded = loadTarifasIfNeeded;
window.findTarifaItem = findTarifaItem;
