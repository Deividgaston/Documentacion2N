// js/main.js
// Arranque: escucha login de Firebase

auth.onAuthStateChanged(user => {
  if (user) {
    appState.user = user;
    renderShell();
  } else {
    appState.user = null;
    renderLogin();
  }
});
