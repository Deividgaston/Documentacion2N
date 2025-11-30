// js/firebase_tarifa.js
// Servicio de tarifa 2N para el generador de presupuestos

// IMPORTANTE:
// - Asumo que ya tienes inicializado Firebase y una instancia "db" de Firestore.
//   Ejemplo típico en otro archivo:
//   import { getFirestore } from "firebase/firestore";
//   const db = getFirestore(app);
//
// - Ajusta el nombre de la colección y de los campos según tu base de datos:
//   const COLECCION_TARIFA = "tarifa2n";
//   Campo referencia: "ref"
//   Campo descripción: "descripcion"
//   Campo precio: "pvp"

import {
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";

const COLECCION_TARIFA = "tarifa2n";

if (!window.appState) window.appState = {};
if (!appState.tarifas) appState.tarifas = {};

let tarifasCache = window.tarifasCache || {};
window.tarifasCache = tarifasCache;

// Carga desde Firestore SOLO las refs que falten en caché
export async function loadTarifasForRefs(refs) {
  if (!refs || !refs.length) return;

  // Normalizamos refs y quitamos duplicados
  const normalizadas = [...new Set(refs.map(r => String(r).trim()).filter(Boolean))];

  // Filtramos las que ya están en cache
  const pendientes = normalizadas.filter(ref => !tarifasCache[ref]);
  if (!pendientes.length) {
    console.log("[Tarifa] Todas las refs ya están en caché:", normalizadas);
    return;
  }

  console.log("[Tarifa] Voy a Firestore por estas refs:", pendientes);

  // Firestore limita 'in' a 10 elementos -> troceamos
  const trocear = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const lotes = trocear(pendientes, 10);

  for (const lote of lotes) {
    const colRef = collection(db, COLECCION_TARIFA);
    // Ojo: ajusta "ref" al nombre REAL del campo de referencia en tu colección
    const q = query(colRef, where("ref", "in", lote));

    const snap = await getDocs(q);

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const ref = String(data.ref || "").trim();
      if (!ref) return;

      const item = {
        ref,
        // Ajusta nombres de campos si hace falta
        descripcion: data.descripcion || data.Descripcion || "",
        pvp: Number(data.pvp ?? data.PVP ?? data.precio ?? 0)
      };

      tarifasCache[ref] = item;
      appState.tarifas[ref] = item;
    });
  }

  console.log("[Tarifa] Tarifas cacheadas:", Object.keys(tarifasCache).length);
}

// Versión genérica por si en algún sitio llamas loadTarifasIfNeeded()
export async function loadTarifasIfNeeded() {
  // Aquí podrías cargar toda la tarifa si quieres.
  // Para este proyecto, realmente usamos loadTarifasForRefs(refs),
  // así que puede quedarse vacío o hacer un preload básico si lo deseas.
  return;
}
