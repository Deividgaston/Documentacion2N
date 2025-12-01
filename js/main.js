// ==========================================
// main.js · Control principal de la app
// ==========================================

window.addEventListener("DOMContentLoaded", () => {
  initAuthWatcher();
});

// ==========================================
// OBSERVADOR DE AUTENTICACIÓN
// ==========================================

function initAuthWatcher() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      // Usuario logueado → mostrar shell
      mostrarApp(user);
    } else {
      // Usuario fuera → mostrar login
      mostrarLogin();
    }
  });
}

// ==========================================
// MOSTRAR LOGIN
// ==========================================

function mostrarLogin() {
  const loginPage = document.getElementById("loginPage");
  const appShell = document.getElementById("appShell");

  if (loginPage) loginPage.style.display = "flex";
  if (appShell) appShell.style.display = "none";

  // Botón login Google
  const btnGoogle = document.getElementById("btnLoginGoogle");
  if (btnGoogle) {
    btnGoogle.onclick = async () => {
      try {
        await loginWithGoogle();
      } catch (e) {
        alert("Error al iniciar sesión con Google");
      }
    };
  }

  // Botón login email/password
  const btnEmail = document.getElementById("btnLoginEmail");
  if (btnEmail) {
    btnEmail.onclick = async () => {
      const email = document.getElementById("loginEmail").value.trim();
      const pass = document.getElementById("loginPassword").value.trim();

      if (!email || !pass) {
        alert("Introduce email y contraseña");
        return;
      }

      try {
        await loginWithEmailPassword(email, pass);
      } catch (e) {
        alert("Credenciales incorrectas");
      }
    };
  }
}

// ==========================================
// MOSTRAR APLICACIÓN
// ==========================================

function mostrarApp(user) {
  const loginPage = document.getElementById("loginPage");
  const appShell = document.getElementById("appShell");

  if (loginPage) loginPage.style.display = "none";
  if (appShell) appShell.style.display = "flex";

  // Mostrar email usuario en la barra superior
  const badge = document.getElementById("userBadge");
  if (badge) badge.textContent = user.email;

  // Inicializar navegación shell
  initShellUI();
}

// ==========================================
// LOGOUT
// ==========================================

async function cerrarSesion() {
  try {
    await auth.signOut();
  } catch (e) {
    console.error("Error al cerrar sesión:", e);
  }
}

console.log("%cMain iniciado (main.js)", "color:#4ade80; font-weight:600;");
