// js/main.js
// Arranque principal de la aplicación

document.addEventListener("DOMContentLoaded", () => {
  // Inicializar UI del login (definido en ui_login.js)
  if (typeof initLoginUI === "function") {
    initLoginUI();
  }

  // Escuchar cambios de autenticación (app.js)
  if (typeof initOnAuthChange === "function") {
    initOnAuthChange();
  }
});
