// app.js
// Firebase YA se inicializa en js/firebase.js (no repetir firebaseConfig aquí)

window.appState = window.appState || {};
appState.currentView = "proyecto";
appState.user = null;

// Mostrar / ocultar login y shell
function showLogin() {
  const loginPage = document.getElementById("loginPage");
  const appShell = document.getElementById("appShell");
  if (loginPage) loginPage.style.display = "flex";
  if (appShell) appShell.style.display = "none";
}

function showShell() {
  const loginPage = document.getElementById("loginPage");
  const appShell = document.getElementById("appShell");
  if (loginPage) loginPage.style.display = "none";
  if (appShell) appShell.style.display = "flex";
}

function updateUserBadge() {
  const badge = document.getElementById("userBadge");
  if (badge && appState.user?.email) {
    badge.textContent = appState.user.email;
  }
}

// Listener de autenticación
function initOnAuthChange() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      appState.user = {
        uid: user.uid,
        email: user.email,
      };
      showShell();
      updateUserBadge();
      setupShellNav();            // definir en ui_shell.js
      selectView(appState.currentView || "proyecto");
    } else {
      appState.user = null;
      showLogin();
    }
  });
}
