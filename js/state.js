// js/state.js
// Estado global simple

window.appState = {
  currentTab: "proyecto",
  user: null,
  lineasProyecto: [],
  presupuestoCabecera: {
    cliente: "",
    proyecto: "",
    direccion: "",
    contacto: "",
    email: "",
    telefono: "",
    notas: "",
  },
  presupuestoOpciones: {
    descuentoGlobal: 0,
    aplicarIVA: false,
  },
  presupuestoTotales: {
    subtotal: 0,
    descuento: 0,
    base: 0,
    iva: 0,
    total: 0,
  },
  tarifas: {}, // se llena desde firebase_tarifa.js
};
