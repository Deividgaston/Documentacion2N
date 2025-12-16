// js/ui_login.js
// Lógica de la pantalla de login (solo email+password)
// Google deshabilitado + allowlist superadmin

function initLoginUI() {
  const loginPage = document.getElementById("loginPage");
  const appShell = document.getElementById("appShell");
  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPass");
  const btnLogin = document.getElementById("btnLogin");
  const btnLoginGoogle = document.getElementById("btnLoginGoogle");
  const loginError = document.getElementById("loginError");

  const SUPERADMIN_EMAIL = "gastonortigosa@gmail.com";

  if (!loginPage || !appShell) {
    console.error("Error: faltan elementos del login en HTML.");
    return;
  }

  // Estado inicial: login visible
  loginPage.style.display = "flex";
  appShell.style.display = "none";

  // Ocultar Google si existe en DOM
  if (btnLoginGoogle) btnLoginGoogle.style.display = "none";

  function mostrarError(msg) {
    if (!loginError) return;
    loginError.textContent = msg;
    loginError.style.display = "flex";
  }

  function limpiarError() {
    if (!loginError) return;
    loginError.textContent = "";
    loginError.style.display = "none";
  }

  async function forceLogoutWithMsg(msg) {
    try {
      await auth.signOut();
    } catch (_) {}
    mostrarError(msg);
  }

  // ============================================
  // LOGIN EMAIL + PASSWORD
  // ============================================
  async function manejarLogin() {
    limpiarError();

    const email = emailInput.value.trim().toLowerCase();
    const pass = passInput.value.trim();

    if (!email || !pass) {
      mostrarError("Introduce email y contraseña.");
      return;
    }

    // ✅ Allowlist antes incluso de intentar auth
    if (email !== SUPERADMIN_EMAIL) {
      mostrarError("Acceso no permitido.");
      return;
    }

    if (typeof auth === "undefined") {
      mostrarError("Error interno: auth no inicializado.");
      return;
    }

    try {
      const cred = await auth.signInWithEmailAndPassword(email, pass);

      // ✅ Post-check seguridad
      const loggedEmail = (cred?.user?.email || "").toLowerCase();
      if (loggedEmail !== SUPERADMIN_EMAIL) {
        await forceLogoutWithMsg("Acceso no permitido.");
        return;
      }

      // initOnAuthChange() / ui_shell se encargan de mostrar la app (según tu app.js)
    } catch (err) {
      console.error("Error login email:", err);
      let msg = "No se ha podido iniciar sesión.";
      if (err.code === "auth/user-not-found") msg = "Usuario no encontrado.";
      if (err.code === "auth/wrong-password") msg = "Contraseña incorrecta.";
      if (err.code === "auth/invalid-email") msg = "Email no válido.";
      mostrarError(msg);
    }
  }

  // Eventos
  btnLogin.addEventListener("click", (e) => {
    e.preventDefault();
    manejarLogin();
  });

  // Enter para login rápido
  [emailInput, passInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") manejarLogin();
    });
  });
}

console.log("%cUI Login cargada (solo email)", "color:#1d4fd8; font-weight:600;");
