// js/main.js

document.addEventListener("DOMContentLoaded", () => {
  // Inicializar UI de login (definida en ui_login.js)
  if (typeof initLoginUI === "function") {
    initLoginUI();
  }

  // Empezar a escuchar cambios de autenticación
  if (typeof initOnAuthChange === "function") {
    initOnAuthChange();
  }
});
