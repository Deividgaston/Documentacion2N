// js/main.js
// Punto de entrada: escucha de autenticación

auth.onAuthStateChanged((user) => {
  if (user) {
    appState.user = user;
    renderShell();
  } else {
    appState.user = null;
    renderLogin();
  }
});
