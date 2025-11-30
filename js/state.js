// js/state.js
// Estado global y referencias base

const appRoot = document.getElementById("app");

const TARIFA_CACHE_KEY = "tarifa_2n_v1";

const appState = {
  user: null,
  loginError: "",
  tarifas: null,
  lineasProyecto: [],
  activeTab: "dashboard",

  rol: "pvp",
  descuentoGlobal: 0,
  aplicarIVA: false,

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
