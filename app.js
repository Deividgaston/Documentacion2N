// app.js
// Núcleo de la app de presupuestos 2N

// Estado global base
window.appState = window.appState || {};
appState.currentView = appState.currentView || "proyecto";
appState.user = appState.user || null;

// Mostrar / ocultar login y app
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

// Actualiza el badge de usuario en la esquina derecha
function updateUserBadge() {
  const badge = document.getElementById("userBadge");
  if (!badge) return;

  if (appState.user && appState.user.email) {
    badge.textContent = appState.user.email;
  } else {
    badge.textContent = "Usuario";
  }
}

// Listener de cambios de autenticación
function initOnAuthChange() {
  if (typeof auth === "undefined") {
    console.error("Firebase Auth no está inicializado.");
    return;
  }

  auth.onAuthStateChanged((user) => {
    if (user) {
      // Usuario logueado
      appState.user = {
        uid: user.uid,
        email: user.email,
      };

      showShell();
      updateUserBadge();

      // Configurar navegación superior (tabs)
      if (typeof setupShellNav === "function") {
        setupShellNav();
      }

      // Seleccionar vista inicial
      if (typeof selectView === "function") {
        selectView(appState.currentView || "proyecto");
      }
    } else {
      // Usuario no logueado
      appState.user = null;
      showLogin();
    }
  });
}
