// js/utils.js
// Utilidades comunes

function clearApp() {
  appRoot.innerHTML = "";
}

function el(tag, className, html) {
  const x = document.createElement(tag);
  if (className) x.className = className;
  if (html) x.innerHTML = html;
  return x;
}

function toNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  return Number(String(v).replace(",", ".")) || 0;
}

function findHeaderKey(keys, regexList) {
  for (const k of keys) {
    const norm = k.toLowerCase().replace(/\s+/g, " ").trim();
    for (const r of regexList) {
      if (r.test(norm)) return k;
    }
  }
  return null;
}

async function loadTarifasOnce() {
  if (appState.tarifas) return appState.tarifas;

  const cached = localStorage.getItem(TARIFA_CACHE_KEY);
  if (cached) {
    appState.tarifas = JSON.parse(cached);
    return appState.tarifas;
  }

  const snap = await db.collection("tarifas").doc("v1").get();
  if (snap.exists) {
    appState.tarifas = snap.data().productos || {};
    localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(appState.tarifas));
  } else {
    appState.tarifas = {};
  }
  return appState.tarifas;
}

function generarCodigoPresupuesto() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
  return `2N-${y}${m}${d}-${rand}`;
}
