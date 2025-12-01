// js/firebase_tarifa.js
// Funciones específicas para gestionar la TARIFA 2N en Firestore

import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// Ruta base de la tarifa en Firestore:
// /tarifas/v1/productos/{referencia}
const TARIFAS_COLLECTION = "tarifas";
const TARIFA_VERSION = "v1";
const PRODUCTOS_SUBCOL = "productos";

/**
 * Sube la tarifa a Firestore usando batches (máx. 450 docs por batch)
 * productosMap: {
 *   "916020": { pvp: 833.0, descripcion: "2N IP Style ..." },
 *   ...
 * }
 *
 * Devuelve el número total de referencias subidas.
 */
export async function subirTarifaAFirestore(productosMap) {
  const entries = Object.entries(productosMap || {});
  if (!entries.length) return 0;

  const CHUNK_SIZE = 450;
  let totalEscritos = 0;

  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(([ref, data]) => {
      const docRef = doc(
        db,
        TARIFAS_COLLECTION,
        TARIFA_VERSION,
        PRODUCTOS_SUBCOL,
        String(ref)
      );

      const payload = {
        referencia: String(ref),
        descripcion: data.descripcion || "",
        pvp: Number(data.pvp) || 0,
        updatedAt: serverTimestamp(),
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
 * Devuelve un objeto:
 * {
 *   "916020": { pvp: 833.0, descripcion: "2N IP Style ..." },
 *   ...
 * }
 */
export async function getTarifas() {
  const colRef = collection(
    db,
    TARIFAS_COLLECTION,
    TARIFA_VERSION,
    PRODUCTOS_SUBCOL
  );

  const snap = await getDocs(colRef);
  const result = {};

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (!d) return;
    const ref = docSnap.id;
    const pvp = Number(d.pvp) || 0;
    const descripcion = d.descripcion || "";
    if (!pvp) return;

    result[ref] = { pvp, descripcion };
  });

  console.log(
    `%cTarifa · getTarifas() -> ${Object.keys(result).length} referencias`,
    "color:#3b82f6;"
  );

  return result;
}
