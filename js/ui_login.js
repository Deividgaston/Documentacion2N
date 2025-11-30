// js/ui_login.js
// Pantalla de login con Google

function renderLogin() {
  clearApp();

  const wrapper = el("div", "login-container");
  const card = el("div", "login-card");

  const title = el("div", "login-title", "Acceso 2N · Presupuestos");

  const content = el(
    "div",
    null,
    `
      <p style="font-size:0.9rem; margin-bottom:14px; text-align:center; color:#4b5563;">
        Inicia sesión con tu cuenta de Google para generar presupuestos
        con la tarifa 2N y exportarlos a PDF/Excel.
      </p>
    `
  );

  const err = el(
    "div",
    null,
    appState.loginError
      ? `<div style="color:#dc2626; font-size:0.8rem; margin-bottom:10px;">${appState.loginError}</div>`
      : ""
  );

  const btn = el(
    "button",
    "btn btn-blue btn-full",
    `<span>Continuar con Google</span>`
  );

  btn.onclick = async () => {
    btn.disabled = true;
    btn.innerHTML = "Conectando...";
    appState.loginError = "";

    try {
      await auth.signInWithPopup(googleProvider);
    } catch (error) {
      console.error(error);
      appState.loginError = "No se pudo iniciar sesión con Google";
      renderLogin();
    }
  };

  content.appendChild(err);
  content.appendChild(btn);

  card.appendChild(title);
  card.appendChild(content);
  wrapper.appendChild(card);
  appRoot.appendChild(wrapper);
}
