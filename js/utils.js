// js/utils.js
// Utilidades comunes

function clearApp() {
  if (appRoot) appRoot.innerHTML = "";
}

function el(tag, className, html) {
  const x = document.createElement(tag);
  if (className) x.className = className;
  if (html !== undefined && html !== null) x.innerHTML = html;
  return x;
}

function toNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(
    String(v)
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  );
  return isNaN(n) ? 0 : n;
}

function formatCurrency(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2
  }).format(n);
}

function generarCodigoPresupuesto() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
  return `2N-${y}${m}${d}-${rand}`;
}

// ==============================
// LECTURA DE EXCEL (utilidad)
// ==============================

function leerExcelComoMatriz(file, cb) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      cb(null, rows);
    } catch (err) {
      cb(err);
    }
  };
  reader.onerror = (err) => cb(err);
  reader.readAsArrayBuffer(file);
}

// ==============================
// CARGA DE TARIFAS (mínimas lecturas)
// ==============================

async function loadTarifasOnce() {
  // 1) Memoria
  if (appState.tarifas) return appState.tarifas;

  // 2) localStorage
  try {
    const cached = localStorage.getItem(TARIFA_CACHE_KEY);
    if (cached) {
      appState.tarifas = JSON.parse(cached) || {};
      return appState.tarifas;
    }
  } catch (e) {
    console.warn("No se pudo leer la tarifa cacheada", e);
  }

  // 3) Firestore (1 sola lectura)
  if (!db) {
    appState.tarifas = {};
    return appState.tarifas;
  }

  try {
    const snap = await db.collection("tarifas").doc("v1").get();
    if (snap.exists) {
      const data = snap.data() || {};
      appState.tarifas = data.productos || {};
      try {
        localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(appState.tarifas));
      } catch (e) {
        console.warn("No se pudo cachear la tarifa", e);
      }
    } else {
      appState.tarifas = {};
    }
  } catch (err) {
    console.error("Error leyendo tarifas de Firestore", err);
    appState.tarifas = {};
  }

  return appState.tarifas;
}

// Devuelve las líneas incluidas en presupuesto
function getLineasSeleccionadas() {
  return (appState.lineasProyecto || []).filter((l) => l.incluir !== false);
}
