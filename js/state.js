// js/state.js
// Estado global y referencias base

const appRoot = document.getElementById("app");

// cache local de tarifa
const TARIFA_CACHE_KEY = "tarifa_2n_v1";

const appState = {
  user: null,
  loginError: "",
  tarifas: null,          // Productos de la tarifa 2N
  lineasProyecto: [],     // Líneas importadas desde el Excel del proyecto

  // Pestaña activa del menú superior
  activeTab: "proyecto",

  // Parámetros económicos del presupuesto
  rol: "pvp",             // por defecto PVP sin márgenes
  descuentoGlobal: 0,
  aplicarIVA: false,

  // Datos de cabecera del presupuesto
  infoPresupuesto: {
    cliente: "",
    proyecto: "",
    direccion: "",
    contacto: "",
    email: "",
    telefono: "",
    notas:
      "Para la alimentación de los equipos se requiere de un switch PoE acorde con el consumo de los dispositivos."
  }
};
