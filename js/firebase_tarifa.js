// js/firebase_tarifa.js
// Gestión opcional de la tarifa 2N en Firebase (subidas / mantenimiento)

/* ============================================================
   SUBIR TARIFA A FIRESTORE (por ejemplo desde Excel)
   ============================================================ */

async function guardarTarifaEnFirebase(productos) {
  if (!productos || typeof productos !== "object") {
    console.error("Formato incorrecto para productos:", productos);
    return false;
  }

  try {
    await db.collection("tarifas").doc("v1").set(
      {
        productos: productos,
        fechaActualizacion: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(
      "%cTarifa actualizada correctamente en Firebase",
      "color:#1d4fd8; font-weight:600;"
    );

    // Actualizar cache local
    localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(productos));

    // Actualizar estado en memoria
    appState.tarifas = productos;

    return true;
  } catch (err) {
    console.error("Error guardando tarifa:", err);
    return false;
  }
}

/* ============================================================
   LEER TARIFA DIRECTAMENTE DE FIRESTORE (modo mantenimiento)
   ============================================================ */

async function leerTarifaDirectoFirebase() {
  try {
    const snap = await db.collection("tarifas").doc("v1").get();

    if (!snap.exists) {
      console.warn("No existe tarifas/v1");
      return null;
    }

    const data = snap.data()?.productos || {};

    console.log(
      "%cTarifa leída directamente desde Firestore",
      "color:#6b7280;"
    );

    return data;
  } catch (err) {
    console.error("Error leyendo ta
