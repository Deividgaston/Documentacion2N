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
  btnLogin.addEventListener("click", () => {
    const email = emailInput.value || "demo@2n.com";
    appState.user = { email };
    renderApp();
  });

  form.appendChild(emailGroup);
  form.appendChild(passGroup);
  form.appendChild(btnLogin);

  container.appendChild(title);
  container.appendChild(form);

  appRoot.appendChild(container);
}

// ==============================
// LAYOUT PRINCIPAL
// ==============================
function renderMainLayout() {
  clearApp();

  // TOPBAR
  const topbar = createElement("div", "topbar");
  const left = createElement("div", "topbar-title", "2N · Presupuestos y Documentación");
  const right = createElement("div");

  const userEmail = appState.user?.email || "";
  const userLabel = createElement("span", null, userEmail ? userEmail + " &nbsp;&nbsp;" : "");

  const btnLogout = createElement("button", "btn-logout", "Logout");
  btnLogout.addEventListener("click", handleLogout);

  right.appendChild(userLabel);
  right.appendChild(btnLogout);

  topbar.appendChild(left);
  topbar.appendChild(right);

  // CONTENIDO
  const main = createElement("div");
  main.style.marginTop = "20px";

  const cardDashboard = createElement("div", "card");
  const headerDash = createElement(
    "div",
    "card-header",
    `
    Panel principal
    <span style="font-size:0.85rem; font-weight:400; color:#667;">
      Flujo: Tarifas → Proyecto → Presupuesto → Documentación → BC3
    </span>
  `
  );

  const modulesGrid = createElement("div", "grid grid-2");

  const mod1 = createElement("div", "card");
  mod1.innerHTML = `
    <div class="card-header">1. Tarifas 2N (Excel → Tarifa interna)</div>
    <p>Importa la lista de precios oficial desde un Excel. La app la usará para todos los presupuestos.</p>
    <button class="btn btn-blue" id="btnIrTarifas" style="margin-top:10px;">Ir a tarifas</button>
  `;

  const mod2 = createElement("div", "card");
  mod2.innerHTML = `
    <div class="card-header">2. Proyecto (Excel → Líneas)</div>
    <p>Importa el Excel del proyecto (cantidades, referencias) y genera las líneas de presupuesto automáticamente.</p>
    <button class="btn btn-blue" id="btnIrProyecto" style="margin-top:10px;">Ir a proyectos</button>
  `;

  const mod3 = createElement("div", "card");
  mod3.innerHTML = `
    <div class="card-header">3. Presupuesto</div>
    <p>Selecciona rol (distribuidor, instalador, constructora, promotora), aplica descuentos y exporta a PDF / Excel.</p>
    <button class="btn btn-blue" id="btnIrPresupuesto" style="margin-top:10px;">Ir a presupuestos</button>
  `;

  const mod4 = createElement("div", "card");
  mod4.innerHTML = `
    <div class="card-header">4. Documentación & BC3</div>
    <p>Adjunta hojas técnicas, declaraciones, memoria descriptiva y exporta BC3 para Presto.</p>
    <button class="btn btn-blue" id="btnIrDoc" style="margin-top:10px;">Ir a documentación / BC3</button>
  `;

  modulesGrid.appendChild(mod1);
  modulesGrid.appendChild(mod2);
  modulesGrid.appendChild(mod3);
  modulesGrid.appendChild(mod4);

  cardDashboard.appendChild(headerDash);
  cardDashboard.appendChild(modulesGrid);

  main.appendChild(cardDashboard);

  appRoot.appendChild(topbar);
  appRoot.appendChild(main);

  // Navegación
  document.getElementById("btnIrTarifas").addEventListener("click", renderTarifasModule);
  document.getElementById("btnIrProyecto").addEventListener("click", renderProyectoModule);
  document.getElementById("btnIrPresupuesto").addEventListener("click", renderPresupuestoModule);
  document.getElementById("btnIrDoc").addEventListener("click", renderDocumentacionModule);
}

// ==============================
// MÓDULOS (placeholders)
// ==============================
function renderTarifasModule() {
  clearApp();

  const topbar = createElement("div", "topbar");
  topbar.innerHTML = `
    <div class="topbar-title">Tarifas 2N</div>
    <button class="btn-logout" id="btnLogout">Logout</button>
  `;
  topbar.querySelector("#btnLogout").addEventListener("click", handleLogout);

  const card = createElement("div", "card");
  const header = createElement("div", "card-header", "Importar tarifas desde Excel");
  const body = createElement("div");
  body.innerHTML = `
    <p>Aquí importaremos tu Excel oficial de tarifas y lo prepararemos para usarlo en todos los cálculos.</p>
    <button class="btn btn-grey" id="btnVolver" style="margin-top:10px;">Volver al panel</button>
  `;

  card.appendChild(header);
  card.appendChild(body);

  appRoot.appendChild(topbar);
  appRoot.appendChild(card);

  document.getElementById("btnVolver").addEventListener("click", renderApp);
}

function renderProyectoModule() {
  clearApp();

  const topbar = createElement("div", "topbar");
  topbar.innerHTML = `
    <div class="topbar-title">Proyecto (Excel → Líneas)</div>
    <button class="btn-logout" id="btnLogout">Logout</button>
  `;
  topbar.querySelector("#btnLogout").addEventListener("click", handleLogout);

  const card = createElement("div", "card");
  const header = createElement("div", "card-header", "Importar Excel de proyecto");
  const body = createElement("div");
  body.innerHTML = `
    <p>Aquí cruzaremos las referencias del proyecto con las tarifas para generar todas las líneas.</p>
    <button class="btn btn-grey" id="btnVolver" style="margin-top:10px;">Volver al panel</button>
  `;

  card.appendChild(header);
  card.appendChild(body);

  appRoot.appendChild(topbar);
  appRoot.appendChild(card);

  document.getElementById("btnVolver").addEventListener("click", renderApp);
}

function renderPresupuestoModule() {
  clearApp();

  const topbar = createElement("div", "topbar");
  topbar.innerHTML = `
    <div class="topbar-title">Presupuesto</div>
    <button class="btn-logout" id="btnLogout">Logout</button>
  `;
  topbar.querySelector("#btnLogout").addEventListener("click", handleLogout);

  const card = createElement("div", "card");
  const header = createElement("div", "card-header", "Generar presupuesto por rol");
  const body = createElement("div");
  body.innerHTML = `
    <p>Aquí podrás elegir rol, aplicar descuentos y exportar el presupuesto.</p>
    <button class="btn btn-grey" id="btnVolver" style="margin-top:10px;">Volver al panel</button>
  `;

  card.appendChild(header);
  card.appendChild(body);

  appRoot.appendChild(topbar);
  appRoot.appendChild(card);

  document.getElementById("btnVolver").addEventListener("click", renderApp);
}

function renderDocumentacionModule() {
  clearApp();

  const topbar = createElement("div", "topbar");
  topbar.innerHTML = `
    <div class="topbar-title">Documentación & BC3</div>
    <button class="btn-logout" id="btnLogout">Logout</button>
  `;
  topbar.querySelector("#btnLogout").addEventListener("click", handleLogout);

  const card = createElement("div", "card");
  const header = createElement("div", "card-header", "Hojas técnicas, memoria y BC3");
  const body = createElement("div");
  body.innerHTML = `
    <p>Aquí añadiremos la selección de PDFs, la memoria descriptiva y la exportación BC3.</p>
    <button class="btn btn-grey" id="btnVolver" style="margin-top:10px;">Volver al panel</button>
  `;

  card.appendChild(header);
  card.appendChild(body);

  appRoot.appendChild(topbar);
  appRoot.appendChild(card);

  document.getElementById("btnVolver").addEventListener("click", renderApp);
}

// ==============================
// RENDER PRINCIPAL
// ==============================
function renderApp() {
  if (!appState.user) {
    renderLoginView();
  } else {
    renderMainLayout();
  }
}

// Inicio
renderApp();
