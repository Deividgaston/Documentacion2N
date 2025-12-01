// js/ui_login.js
// Lógica de la pantalla de login (email+password y Google)

function initLoginUI() {
  const loginPage = document.getElementById("loginPage");
  const appShell = document.getElementById("appShell");
  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPass");
  const btnLogin = document.getElementById("btnLogin");
  const btnLoginGoogle = document.getElementById("btnLoginGoogle");
  const loginError = document.getElementById("loginError");

  if (!loginPage || !appShell || !emailInput || !passInput || !btnLogin) {
    console.error("Faltan elementos del login en el HTML.");
    return;
  }

  // Aseguramos estado inicial: se ve login, oculta app
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

  // ----- LOGIN EMAIL + PASSWORD -----
  async function manejarLogin() {
    limpiarError();

    const email = emailInput.value.trim();
    const pass = passInput.value.trim();

    if (!email || !pass) {
      mostrarError("Introduce email y contraseña.");
      return;
    }

    if (typeof auth === "undefined") {
      mostrarError("Error interno de autenticación (auth no inicializado).");
      console.error("Firebase auth no está definido.");
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

  // ----- LOGIN CON GOOGLE -----
  async function manejarLoginGoogle() {
    limpiarError();

    if (typeof firebase === "undefined" || !firebase.auth) {
      mostrarError("Login con Google no disponible (Firebase no cargado).");
      console.error("Firebase o firebase.auth no están disponibles.");
      return;
    }

    if (typeof auth === "undefined") {
      mostrarError("Error interno de autenticación (auth no inicializado).");
      console.error("Firebase auth no está definido.");
      return;
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      // provider.setCustomParameters({ hd: "tuempresa.com" }); // opcional

      await auth.signInWithPopup(provider);
      // initOnAuthChange() hará el resto
    } catch (err) {
      console.error("Error login con Google:", err);

      let msg = "No se ha podido iniciar sesión con Google.";
      if (err.code === "auth/popup-closed-by-user") {
        msg =
          "Se cerró la ventana de Google antes de completar el inicio de sesión.";
      }
      mostrarError(msg);
    }
  }

  // Click en botón email+password
  btnLogin.addEventListener("click", function (e) {
    e.preventDefault();
    manejarLogin();
  });

  // Click en botón Google
  if (btnLoginGoogle) {
    btnLoginGoogle.addEventListener("click", function (e) {
      e.preventDefault();
      manejarLoginGoogle();
    });
  }

  // Enter en inputs → login email/password
  [emailInput, passInput].forEach(function (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        manejarLogin();
      }
    });
  });
}

console.log(
  "%cUI login inicializada (ui_login.js) con Google",
  "color:#1d4fd8; font-weight:600;"
);
