// js/state.js
// Estado global de la app de presupuestos 2N

// Claves de caché en localStorage
const TARIFA_CACHE_KEY = "tarifa_2n_cache_v1";
const PROYECTO_CACHE_KEY = "proyecto_actual_v1";
const PRESUPUESTO_CACHE_KEY = "presupuesto_actual_v1";

// Estado principal
window.appState = window.appState || {};

Object.assign(appState, {
  currentView: appState.currentView || "proyecto",

  user: appState.user || null,

  // Tarifa 2N completa (productos, precios, etc.)
  tarifas: appState.tarifas || {},

  // Datos del proyecto importado desde Excel
  proyecto: appState.proyecto || {
    filas: [],           // [{ referencia, cantidad, descripcion }]
    archivoNombre: null,
    fechaImportacion: null,
  },

  // Datos del presupuesto generado a partir del proyecto + tarifa
  presupuesto: appState.presupuesto || {
    lineas: [],          // [{ referencia, descripcion, cantidad, pvp, dto, total }]
    totales: {
      base: 0,
      dtoGlobal: 0,
      iva: 0,
      totalConIva: 0,
    },
    nombreProyecto: "",
    cliente: "",
    fechaPresupuesto: null,
  },

  // Documentación / PDFs generados (si quieres usarlo luego)
  docs: appState.docs || {
    ultimaRutaPdf: null,
    ultimaFechaGeneracion: null,
  },
});
