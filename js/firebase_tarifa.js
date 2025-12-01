// ==========================================
// firebase_tarifa.js
// Gestión de tarifas 2N desde Firestore
// Estructura principal: /tarifas/v1/productos/{ref}
// ==========================================

window.appState = window.appState || {};
appState.tarifas = appState.tarifas || {
  data: null,
  lastLoaded: null,
};

// TARIFA_CACHE_KEY definido en state.js
// const TARIFA_CACHE_KEY = "presupuestos2n_tarifa";

// ==========================================
// OBTENER TARIFAS (1 lectura + caché)
// ==========================================
async function getTarifas() {
  // 1) Si ya está en memoria, usarlo
  if (appState.tarifas && appState.tarifas.data) {
    return appState.tarifas.data;
  }

  // 2) Intentar localStorage primero
  try {
    const cached = localStorage.getItem(TARIFA_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === "object") {
        appState.tarifas = {
          data: parsed,
          lastLoaded: Date.now(),
        };
        console.log(
          "%cTarifa cargada desde localStorage",
          "color:#22c55e; font-weight:600;"
        );
        return parsed;
      }
    }
  } catch (e) {
    console.warn("No se pudo leer la tarifa desde localStorage:", e);
  }

  // 3) Lectura única desde Firestore: /tarifas/v1
  try {
    const docSnap = await db.collection("tarifas").doc("v1").get();

    if (!docSnap.exists) {
      console.error("El documento tarifas/v1 no existe.");
      return {};
    }

    const data = docSnap.data() || {};
    const productos = data.productos || {};

    const tarifas = {};

    // productos = { "916020": { pvp, descripcion, campos_originales: {...} }, ... }
    Object.keys(productos).forEach((refRaw) => {
      const prod = productos[refRaw] || {};
      const campos = prod.campos_originales || {};

      const pvp =
        Number(prod.pvp) ||
        Number(campos["MSRP (EUR)"]) ||
        Number(campos["Distributor Price (EUR)"]) ||
        Number(campos["NFR Distributor (EUR)"]) ||
        0;

      if (pvp > 0) {
        const ref = String(refRaw).trim();
        tarifas[ref] = pvp;
      }
    });

    appState.tarifas = {
      data: tarifas,
      lastLoaded: Date.now(),
    };

    try {
      localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(tarifas));
    } catch (e) {
      console.warn("No se pudo guardar la tarifa en localStorage:", e);
    }

    console.log(
      `%cTarifa cargada desde Firestore: ${Object.keys(tarifas).length} referencias`,
      "color:#22c55e; font-weight:600;"
    );

    return tarifas;
  } catch (error) {
    console.error("Error obteniendo tarifas desde Firestore:", error);
    return {};
  }
}

// ==========================================
// SUBIR TARIFA A FIRESTORE DESDE LA PÁGINA TARIFA 2N
// productosMap: { ref: { pvp, descripcion, rawRow } }
// ==========================================
async function subirTarifaAFirestore(productosMap) {
  if (!productosMap || Object.keys(productosMap).length === 0) {
    throw new Error("No hay productos para subir.");
  }

  const docRef = db.collection("tarifas").doc("v1");
  const entries = Object.entries(productosMap);

  const CHUNK_SIZE = 150; // para no hacer payloads enormes
  let subidos = 0;

  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const slice = entries.slice(i, i + CHUNK_SIZE);
    const updateData = {};

    slice.forEach(([ref, info]) => {
      updateData[`productos.${ref}`] = {
        pvp: Number(info.pvp) || 0,
        descripcion: info.descripcion || "",
        campos_originales: info.rawRow || {},
      };
    });

    // Usamos set con merge para no machacar todo el doc
    await docRef.set(updateData, { merge: true });
    subidos += slice.length;
    console.log(
      `%cTarifa · Subidos ${subidos}/${entries.length} productos`,
      "color:#0ea5e9;"
    );
  }

  // Invalidar caché en memoria y localStorage
  appState.tarifas.data = null;
  appState.tarifas.lastLoaded = null;
  try {
    localStorage.removeItem(TARIFA_CACHE_KEY);
  } catch {}

  console.log(
    `%cTarifa actualizada en Firestore (${entries.length} referencias)`,
    "color:#16a34a; font-weight:600;"
  );

  return entries.length;
}

console.log(
  "%cMódulo de tarifas inicializado (firebase_tarifa.js)",
  "color:#0ea5e9; font-weight:600;"
);
