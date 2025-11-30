// js/ui_login.js
// Lógica de la pantalla de login

function initLoginUI() {
  const loginPage = document.getElementById("loginPage");
  const appShell = document.getElementById("appShell");
  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPass");
  const btnLogin = document.getElementById("btnLogin");
  const loginError = document.getElementById("loginError");

  if (!loginPage || !appShell || !emailInput || !passInput || !btnLogin) {
    console.error("Faltan elementos del login en el HTML.");
    return;
  }

  // Mostrar login por defecto hasta que Firebase diga lo contrario
  loginPage.style.display = "flex";
  appShell.style.display = "none";

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

  async function manejarLogin() {
    limpiarError();

    const email = emailInput.value.trim();
    const pass = passInput.value.trim();

    if (!email || !pass) {
      mostrarError("Introduce email y contraseña.");
      return;
    }

    try {
      await auth.signInWithEmailAndPassword(email, pass);
      // El cambio de pantalla lo gestiona initOnAuthChange() en app.js
    } catch (err) {
      console.error("Error de login:", err);

      let msg = "No se ha podido iniciar sesión.";
      if (err.code === "auth/user-not-found") {
        msg = "Usuario no encontrado.";
      } else if (err.code === "auth/wrong-password") {
        msg = "Contraseña incorrecta.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Email no válido.";
      }

      mostrarError(msg);
    }
  }

  // Click en botón
  btnLogin.addEventListener("click", (e) => {
    e.preventDefault();
    manejarLogin();
  });

  // Enter en inputs
  [emailInput, passInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        manejarLogin();
      }
    });
  });
}

console.log(
  "%cUI login inicializada (ui_login.js)",
  "color:#1d4fd8; font-weight:600;"
);
