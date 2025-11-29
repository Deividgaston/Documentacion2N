// app.js – Versión sin Firebase, estructura completa de la app

// ==============================
// ESTADO SIMPLE
// ==============================
const appState = {
  user: null
};

const appRoot = document.getElementById("app");

function clearApp() {
  appRoot.innerHTML = "";
}

function createElement(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html) el.innerHTML = html;
  return el;
}

// ==============================
// LOGIN / LOGOUT (sin Firebase aún)
// ==============================
function handleLogout() {
  appState.user = null;
  renderApp();
}

function renderLoginView() {
  clearApp();

  const container = createElement("div", "login-container");
  const title = createElement("div", "login-title", "Acceso 2N Presupuestos");

  const form = createElement("div", "grid");
  form.style.gap = "12px";

  const emailGroup = createElement("div");
  const emailLabel = createElement("label", null, "Email");
  const emailInput = createElement("input");
  emailInput.type = "email";
  emailInput.id = "loginEmail";
  emailGroup.appendChild(emailLabel);
  emailGroup.appendChild(emailInput);

  const passGroup = createElement("div");
  const passLabel = createElement("label", null, "Contraseña");
  const passInput = createElement("input");
  passInput.type = "password";
  passInput.id = "loginPassword";
  passGroup.appendChild(passLabel);
  passGroup.appendChild(passInput);

  const btnLogin = createElement("button", "btn btn-blue", "Entrar");
  btnLogin.style.width = "100%";
  btnLogin.addEventListen
