// js/firebase_tarifa.js
// Funciones específicas para gestionar la TARIFA 2N en Firestore (modo compat)
//
// Usa la instancia global de Firestore ya creada en firebase.js
// y la API compat (db.collection(...), db.batch(), etc).

// Instancia de Firestore (compat)
const db = firebase.firestore();

// Ruta base de la tarifa en Firestore:
// /tarifas/v1/productos/{referencia}
const TARIFAS_COLLECTION = "tarifas";
const TARIFA_VERSION = "v1";
const PRODUCTOS_SUBCOL = "productos";

/**
 * Sube la tarifa a Firestore usando batches (máx. ~400 docs por batch)
 * productosMap: {
 *   "916020": { pvp: 833.0, descripcion: "2N IP Style ...", "Ancho (mm)": 110, ... },
 *   ...
 * }
 *
 * Devuelve el número total de referencias subidas.
 */
export async function subirTarifaAFirestore(productosMap) {
  const entries = Object.entries(productosMap || {});
  if (!entries.length) return 0;

  // ================================
  // 1) Asegurar documento padre /tarifas/v1
  // ================================
  try {
    const tarifaVersionRef = db
      .collection(TARIFAS_COLLECTION)
      .doc(TARIFA_VERSION);

    const batch0 = db.batch();

    batch0.set(
      tarifaVersionRef,
      {
        version: TARIFA_VERSION,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch0.commit();
    console.log("%cDocumento padre /tarifas/v1 creado OK", "color:#22c55e;");
  } catch (e) {
    console.error("Error creando documento padre tarifas/v1:", e);
    throw e;
  }

  // ================================
  // 2) Subir productos en batches
  // ================================
  const batchSize = 400;
  let totalEscritos = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const chunk = entries.slice(i, i + batchSize);
    const batch = db.batch();

    chunk.forEach(([ref, data]) => {
      // /tarifas/v1/productos/{ref}
      const docRef = db
        .collection(TARIFAS_COLLECTION)
        .doc(TARIFA_VERSION)
        .collection(PRODUCTOS_SUBCOL)
        .doc(String(ref));

      // ✅ CAMBIO MÍNIMO:
      // - guardamos TODOS los campos que vengan del import (incluidas keys con espacios: "Ancho (mm)", "EAN code"...)
      // - PERO NO guardamos rawRow (es enorme y no hace falta en Firestore)
      const safeData = { ...(data || {}) };
      if ("rawRow" in safeData) delete safeData.rawRow;

      const payload = {
        ...safeData, // <- aquí van Nota/Ancho/Alto/Profundidad/Peso/HS/EAN/Web/EOL/Motivo...
        referencia: String(ref),
        pvp: Number(safeData.pvp) || 0,
        descripcion: safeData.descripcion || "",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      batch.set(docRef, payload, { merge: true });
    });

    await batch.commit();
    totalEscritos += chunk.length;
    console.log(
      `%cTarifa · Batch subido (${i + chunk.length}/${entries.length})`,
      "color:#22c55e;"
    );
  }

  console.log(
    `%cTarifa · Subida completa: ${totalEscritos} referencias`,
    "color:#16a34a; font-weight:600;"
  );

  return totalEscritos;
}

/**
 * Lee la tarifa actual desde Firestore.
 *
 * Devuelve un objeto:
 * {
 *   "916020": 833.0,
 *   "9155101": 1299.0,
 *   ...
 * }
 *
 * (solo número, para encajar con ui_presupuesto.js)
 */
export async function getTarifas() {
  const colRef = db
    .collection(TARIFAS_COLLECTION)
    .doc(TARIFA_VERSION)
    .collection(PRODUCTOS_SUBCOL);

  const snap = await colRef.get();
  const result = {};

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (!d) return;

    const ref = docSnap.id;
    const pvp = Number(d.pvp) || 0;
    if (!pvp) return;

    // Mapa simple ref -> número
    result[ref] = pvp;
  });

  console.log(
    `%cTarifa · getTarifas() -> ${Object.keys(result).length} referencias`,
    "color:#3b82f6;"
  );

  return result;
}
