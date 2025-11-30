// js/firebase_tarifa.js
// Servicio de tarifas 2N para Firestore (Firebase v8 namespaced)

// Requiere que en firebase.js ya exista:
//   const db = firebase.firestore();
// y que ese archivo se haya cargado antes que este.

if (!window.appState) window.appState = {};
if (!appState.tarifas) appState.tarifas = {};

window.tarifasCache = window.tarifasCache || {};
const tarifasCache = window.tarifasCache;

// NOMBRE DE LA COLECCIÓN EN FIRESTORE
// ⚠️ AJUSTA ESTE VALOR AL NOMBRE REAL DE TU BD
const COLECCION_TARIFA = "tarifa2n";

// Carga solo las REF que no están en caché
async function loadTarifasForRefs(refs) {
  if (!refs || !refs.length) return;

  const limpias = [...new Set(refs.map(r => String(r || "").trim()).filter(Boolean))];
  const pendientes = limpias.filter(ref => !tarifasCache[ref]);

  if (!pendientes.length) {
    console.log("[Tarifa] Todas las refs ya están cacheadas.");
    return;
  }

  console.log("[Tarifa] Descargando desde Firestore:", pendientes);

  // Firestore limita where("in") a 10 elementos → troceamos
  const trocear = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const lotes = trocear(pendientes, 10);

  for (const lote of lotes) {
    try {
      const snap = await db
        .collection(COLECCION_TARIFA)
        .where("ref", "in", lote)
        .get();

      snap.forEach(doc => {
        const data = doc.data();
        const ref = String(data.ref || "").trim();
        if (!ref) return;

        const item = {
          ref,
          descripcion: data.descripcion || data.Desc || data.Descripcion || "",
          pvp: Number(data.pvp ?? data.PVP ?? data.precio ?? 0)
        };

        // Guardar en memoria
        tarifasCache[ref] = item;
        appState.tarifas[ref] = item;
      });
    } catch (error) {
      console.error("[Tarifa] ERROR consultando Firestore:", error);
    }
  }

  console.log("[Tarifa] Tarifas cacheadas:", Object.keys(tarifasCache).length);
}

// Para compatibilidad si algún archivo la llama
async function loadTarifasIfNeeded() {
  return;
}

// Hacer accesible globalmente
window.loadTarifasForRefs = loadTarifasForRefs;
window.loadTarifasIfNeeded = loadTarifasIfNeeded;
