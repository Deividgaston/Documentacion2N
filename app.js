// app.js – Estructura base 2N Presupuestos (optimizada para pocas llamadas a Firebase)

// ==============================
// 1) CONFIGURACIÓN FIREBASE
// ==============================
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Inicialización Firebase (vía CDN namespaced)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ==============================
// 2) ESTADO GLOBAL (mínimo)
// ==============================
const appState = {
  user: null,          // se rellenará con Firebase Auth
  tarifas: null,       // cache en memoria
  tarifasLoaded: false // bandera para evitar llamadas repetidas
};

const TARIFAS_CACHE_KEY = "2n_tarifas_v1";

// ==============================
// 3) UTILIDADES DOM
// ==============================
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
// 4) CARGA DE TARIFAS (OPTIMIZADO)
// - 1 sola lectura a Firestore si no hay nada en cache/localStorage
// ==============================
async function loadTarifasOnce() {
  if (appState.tarifasLoaded && appState.tarifas) return appState.tarifas;

  // 1) Intentar desde localStorage (0 llamadas a Firebase)
  try {
    const cached = localStorage.getItem(TARIFAS_CACHE_KEY);
    if (cached) {
      appState.tarifas = JSON.parse(cached);
      appState.tarifasLoaded = true;
      return appState.tarifas;
    }
  } catch (e) {
    console.warn("Error leyendo tarifas de localStorage", e);
  }

  // 2) Si no hay cache → 1 lectura a Firestore
  try {
    const docRef = db.collection("tarifas").doc("v1");
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      appState.tarifas = data.productos || {};
      appState.tarifasLoaded = true;

      try {
        localStorage.setItem(TARIFAS_CACHE_KEY, JSON.stringify(appState.tarifas));
      } catch (e) {
        console.warn("No se pudo guardar tarifas en localStorage", e);
      }

      return appState.tarifas;
    } else {
      console.warn("Documento tarifas/v1 no existe todavía");
      appState.tarifas = {};
      appState.tarifasLoaded = true;
      return appState.tarifas;
    }
  } catch (e) {
    console.error("Error cargando tarifas desde Firestore", e);
    appState.tarifas = {};
    appState.tarifasLoaded = true;
    return appState.tarifas;
  }
}

// ==============================
// 5) LOGOUT (ya preparado)
// ==============================
function handleLogout() {
  auth.signOut().catch((err) => {
    console.error("Error al hacer logout", err);
  });
  appState.user = null;
  renderApp();
}

// ==============================
// 6) VISTAS
// ==============================

// ---- 6.1 Vista de Login (aún sin lógica Auth, la añadiremos luego) ----
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
    // Aquí conectaremos Firebase Auth más adelante.
    // De momento, simulamos login para poder ver la app.
    appState.user = { email: emailInput.value || "demo@2n.com" };
    renderApp();
  });

  form.appendChild(emailGroup);
  form.appendChild(passGroup);
  form.appendChild(btnLogin);

  container.appendChild(title);
  container.appendChild(form);

  appRoot.appendChild(container);
}

// ---- 6.2 Layout principal (topbar + contenido) ----
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

  // CONTENEDOR PRINCIPAL
  const main = createElement("div");
  main.style.marginTop = "20px";

  // Tarjeta resumen módulos
  const cardDashboard = createElement("div", "card");
  const headerDash = createElement("div", "card-header", `
    Panel principal
    <span style="font-size:0.85rem; font-weight:400; color:#667;">Flujo: Tarifas → Proyecto → Presupuesto → Documentación → BC3</span>
  `);

  const modulesGrid = createElement("div", "grid grid-2");

  const mod1 = createElement("div", "card");
  mod1.innerHTML = `
    <div class="card-header">1. Tarifas 2N (Excel → Firestore)</div>
    <p>Importa la lista de precios oficial desde un Excel y súbela a Firestore una sola vez. El sistema la cacheará localmente para evitar llamadas repetidas.</p>
    <button class="btn btn-blue" id="btnIrTarifas" style="margin-top:10px;">Ir a tarifas</button>
  `;

  const mod2 = createElement("div", "card");
  mod2.innerHTML = `
    <div class="card-header">2. Proyecto (Excel → Líneas)</div>
    <p>Importa el Excel del proyecto (cantidades, referencias) y genera las líneas de presupuesto con precios por rol automáticamente.</p>
    <button class="btn btn-blue" id="btnIrProyecto" style="margin-top:10px;">Ir a proyectos</button>
  `;

  const mod3 = createElement("div", "card");
  mod3.innerHTML = `
    <div class="card-header">3. Presupuesto</div>
    <p>Selecciona rol (distribuidor, instalador, constructora, promotora), aplica descuentos adicionales y exporta a PDF o Excel.</p>
    <button class="btn btn-blue" id="btnIrPresupuesto" style="margin-top:10px;">Ir a presupuestos</button>
  `;

  const mod4 = createElement("div", "card");
  mod4.innerHTML = `
    <div class="card-header">4. Documentación y BC3</div>
    <p>Adjunta hojas técnicas, declaraciones de conformidad, genera memoria descriptiva y exporta BC3 para Presto.</p>
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

  // Listeners de navegación (de momento placeholders)
  document.getElementById("btnIrTarifas").addEventListener("click", () => {
    renderTarifasModule();
  });

  document.getElementById("btnIrProyecto").addEventListener("click", () => {
    renderProyectoModule();
  });

  document.getElementById("btnIrPresupuesto").addEventListener("click", () => {
    renderPresupuestoModule();
  });

  document.getElementById("btnIrDoc").addEventListener("click", () => {
    renderDocumentacionModule();
  });
}

// ---- 6.3 Placeholders de módulos (ya con estructura de card) ----
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
    <p> aquí importaremos tu Excel oficial y lo subiremos como <strong>tarifas/v1</strong> a Firestore con una sola escritura.</p>
    <p style="margin-top:10px;">Más adelante implementamos aquí el input de archivo y el procesamiento.</p>
    <button class="btn btn-grey" id="btnVolver">Volver al panel</button>
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
    <p>Aquí leeremos las referencias y cantidades desde tu Excel de proyecto y cruzaremos con las tarifas ya cargadas.</p>
    <button class="btn btn-grey" id="btnVolver">Volver al panel</button>
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
    <p>Aquí aplicaremos precios por rol, descuentos y exportaremos a PDF / Excel.</p>
    <button class="btn btn-grey" id="btnVolver">Volver al panel</button>
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
    <p>Aquí seleccionaremos hojas técnicas, declaraciones de conformidad, generaremos memoria y exportaremos BC3.</p>
    <button class="btn btn-grey" id="btnVolver">Volver al panel</button>
  `;

  card.appendChild(header);
  card.appendChild(body);

  appRoot.appendChild(topbar);
  appRoot.appendChild(card);

  document.getElementById("btnVolver").addEventListener("click", renderApp);
}

// ==============================
// 7) RENDER PRINCIPAL
// ==============================
function renderApp() {
  if (!appState.user) {
    renderLoginView();
  } else {
    renderMainLayout();
  }
}

// ==============================
// 8) INICIO
// ==============================
renderApp();
