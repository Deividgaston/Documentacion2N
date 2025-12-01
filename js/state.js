// js/state.js
// Estado global + claves de localStorage

window.appState = window.appState || {};

// Claves de almacenamiento local
const PROYECTO_CACHE_KEY = "presupuestos2n_proyecto";
const PRESUPUESTO_CACHE_KEY = "presupuestos2n_presupuesto";
const TARIFA_CACHE_KEY = "presupuestos2n_tarifa";

// Estructuras por defecto
if (!appState.proyecto) {
  appState.proyecto = {
    filas: [],
    archivoNombre: null,
    fechaImportacion: null,
    seccion: null,
    titulo: null,
  };
}

if (!appState.presupuesto) {
  appState.presupuesto = {
    lineas: [],
    totales: {
      base: 0,
      dtoGlobal: 0,
      iva: 0,
      totalConIva: 0,
    },
    nombreProyecto: "",
    cliente: "",
    fechaPresupuesto: null,
  };
}

if (!appState.tarifas) {
  appState.tarifas = {
    data: null,
    lastLoaded: null,
  };
}

// Cargar proyecto desde cache (si existe)
(function loadProyectoFromCache() {
  try {
    const cached = localStorage.getItem(PROYECTO_CACHE_KEY);
    if (!cached) return;

    const parsed = JSON.parse(cached);
    if (!parsed || !Array.isArray(parsed.filas)) return;

    appState.proyecto = {
      filas: parsed.filas,
      archivoNombre: parsed.archivoNombre || null,
      fechaImportacion: parsed.fechaImportacion || null,
      seccion: parsed.seccion || null,
      titulo: parsed.titulo || null,
    };
  } catch (e) {
    console.warn("No se pudo cargar proyecto desde cache:", e);
  }
})();

// Cargar presupuesto desde cache (si existe)
(function loadPresupuestoFromCache() {
  try {
    const cached = localStorage.getItem(PRESUPUESTO_CACHE_KEY);
    if (!cached) return;

    const parsed = JSON.parse(cached);
    if (!parsed || !Array.isArray(parsed.lineas)) return;

    appState.presupuesto = parsed;
  } catch (e) {
    console.warn("No se pudo cargar presupuesto desde cache:", e);
  }
})();

console.log(
  "%cState inicializado (state.js)",
  "color:#0ea5e9; font-weight:600;"
);
