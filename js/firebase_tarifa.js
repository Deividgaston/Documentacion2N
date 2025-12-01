// ==========================================
// firebase_tarifa.js
// Gestión de tarifas 2N desde Firestore
// Estructura: /tarifas/v1/productos/{ref}/campos_originales
// ==========================================

window.appState = window.appState || {};
appState.tarifas = appState.tarifas || {
  data: null,
  lastLoaded: null,
};

// TARIFA_CACHE_KEY está definido en state.js
// const TARIFA_CACHE_KEY = "presupuestos2n_tarifa";

// ==========================================
// OBTENER TARIFAS DESDE /tarifas/v1 (1 lectura + caché)
// ==========================================
async function getTarifas() {
  // 1) Si ya está en memoria, no volvemos a Firestore
  if (appState.tarifas && appState.tarifas.data) {
    return appState.tarifas.data;
  }

  // 2) Intentar cargar desde localStorage (offline / segunda visita)
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

  // 3) Lectura ÚNICA desde Firestore: /tarifas/v1
  try {
    const docSnap = await db.collection("tarifas").doc("v1").get();

    if (!docSnap.exists) {
      console.error("El documento tarifas/v1 no existe.");
      return {};
    }

    const data = docSnap.data() || {};
    const productos = data.productos || {};

    const tarifas = {};

    // productos = { "916020": { campos_originales: { "MSRP (EUR)": 11, ... } }, ... }
    Object.keys(productos).forEach((refRaw) => {
      const prod = productos[refRaw] || {};
      const campos = prod.campos_originales || prod;

      const pvp =
        Number(campos["MSRP (EUR)"]) ||
        Number(campos["Distributor Price (EUR)"]) ||
        Number(campos["NFR Distributor (EUR)"]) ||
        0;

      if (pvp > 0) {
        const ref = String(refRaw).trim(); // la referencia es la clave del mapa
        tarifas[ref] = pvp;
      }
    });

    // Guardar en memoria
    appState.tarifas = {
      data: tarifas,
      lastLoaded: Date.now(),
    };

    // Guardar en localStorage para siguientes visitas
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

console.log(
  "%cMódulo de tarifas inicializado (firebase_tarifa.js)",
  "color:#0ea5e9; font-weight:600;"
);
