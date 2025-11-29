// ======================================
// 1) CONFIGURACIÓN FIREBASE
// ======================================
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();


// ======================================
// 2) ESTADO GLOBAL
// ======================================
const appState = {
  user: null,
  loginError: ""
};

const appRoot = document.getElementById("app");

function clearApp() {
  appRoot.innerHTML = "";
}

function el(tag, className, html) {
  const x = document.createElement(tag);
  if (className) x.className = className;
  if (html) x.innerHTML = html;
  return x;
}


// ======================================
// 3) LOGIN
// ======================================
function renderLogin() {
  clearApp();

  const box = el("div", "login-container");
  const title = el("div", "login-title", "Acceso 2N Presupuestos");

  const form = el("div", "grid");
  form.style.gap = "12px";

  const g1 = el("div");
  g1.appendChild(el("label", null, "Email"));
  const email = el("input");
  email.type = "email";
  g1.appendChild(email);

  const g2 = el("div");
  g2.appendChild(el("label", null, "Contraseña"));
  const pass = el("input");
  pass.type = "password";
  g2.appendChild(pass);

  const err = el(
    "div",
    null,
    appState.loginError
      ? `<p style="color:#e74c3c; font-size:0.85rem;">${appState.loginError}</p>`
      : ""
  );

  const btn = el("button", "btn btn-blue", "Entrar");
  btn.style.width = "100%";
  btn.onclick = async () => {
    const e = email.value.trim();
    const p = pass.value.trim();

    if (!e || !p) {
      appState.loginError = "Introduce email y contraseña";
      renderLogin();
      return;
    }

    try {
      appState.loginError = "";
      await auth.signInWithEmailAndPassword(e, p);
    } catch (error) {
      console.error(error);
      let msg = "Error al iniciar sesión";
      if (error.code === "auth/user-not-found") msg = "Usuario no encontrado";
      if (error.code === "auth/wrong-password") msg = "Contraseña incorrecta";
      if (error.code === "auth/invalid-email") msg = "Email no válido";
      appState.loginError = msg;
      renderLogin();
    }
  };

  form.appendChild(g1);
  form.appendChild(g2);
  form.appendChild(err);
  form.appendChild(btn);

  box.appendChild(title);
  box.appendChild(form);

  appRoot.appendChild(box);
}


// ======================================
// 4) PANEL PRINCIPAL
// ======================================
function renderPanel() {
  clearApp();

  const top = el("div", "topbar");
  top.innerHTML = `
    <div class="topbar-title">2N · Presupuestos y Documentación</div>
    <div>
      ${appState.user.email}
      &nbsp;&nbsp;
      <button class="btn-logout" id="logoutBtn">Logout</button>
    </div>
  `;
  top.querySelector("#logoutBtn").onclick = () => auth.signOut();

  const main = el("div");
  main.style.marginTop = "20px";

  const card = el("div", "card");
  card.innerHTML = `
    <div class="card-header">
      Panel principal
      <span style="font-size:0.85rem; font-weight:400; color:#667;">
      Flujo: Tarifas → Proyecto → Presupuesto → Documentación → BC3
      </span>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">1. Tarifas 2N</div>
        <p>Importar Excel de tarifas.</p>
        <button class="btn btn-blue" id="goTarifas">Ir a tarifas</button>
      </div>

      <div class="card">
        <div class="card-header">2. Proyecto</div>
        <p>Importar Excel del proyecto.</p>
        <button class="btn btn-blue" id="goProyecto">Ir a proyectos</button>
      </div>

      <div class="card">
        <div class="card-header">3. Presupuesto</div>
        <p>Generar presupuesto y exportar PDF/Excel.</p>
        <button class="btn btn-blue" id="goPresupuesto">Ir a presupuestos</button>
      </div>

      <div class="card">
        <div class="card-header">4. Documentación & BC3</div>
        <p>Hojas técnicas, memoria y BC3.</p>
        <button class="btn btn-blue" id="goDoc">Ir a documentación</button>
      </div>
    </div>
  `;

  main.appendChild(card);

  appRoot.appendChild(top);
  appRoot.appendChild(main);

  document.getElementById("goTarifas").onclick = renderTarifas;
  document.getElementById("goProyecto").onclick = renderProyecto;
  document.getElementById("goPresupuesto").onclick = renderPresupuesto;
  document.getElementById("goDoc").onclick = renderDoc;
}


// ======================================
// 5) MÓDULOS
// ======================================
function moduleFrame(title, html) {
  clearApp();
  const top = el("div", "topbar");
  top.innerHTML = `
    <div class="topbar-title">${title}</div>
    <button class="btn-logout" id="logoutBtn">Logout</button>
  `;
  top.querySelector("#logoutBtn").onclick = () => auth.signOut();

  const card = el("div", "card");
  card.innerHTML = html;

  appRoot.appendChild(top);
  appRoot.appendChild(card);
}

function renderTarifas() {
  moduleFrame(
    "Tarifas 2N",
    `<p>Módulo de tarifas.</p>
     <button class="btn btn-grey" onclick="renderPanel()">Volver</button>`
  );
}

function renderProyecto() {
  moduleFrame(
    "Proyecto (Excel → Líneas)",
    `<p>Módulo de proyectos.</p>
     <button class="btn btn-grey" onclick="renderPanel()">Volver</button>`
  );
}

function renderPresupuesto() {
  moduleFrame(
    "Presupuesto",
    `<p>Módulo de presupuesto.</p>
     <button class="btn btn-grey" onclick="renderPanel()">Volver</button>`
  );
}

function renderDoc() {
  moduleFrame(
    "Documentación & BC3",
    `<p>Módulo de documentación.</p>
     <button class="btn btn-grey" onclick="renderPanel()">Volver</button>`
  );
}


// ======================================
// 6) OBSERVADOR DE AUTH
// ======================================
auth.onAuthStateChanged(user => {
  if (user) {
    appState.user = { email: user.email };
    renderPanel();
  } else {
    appState.user = null;
    renderLogin();
  }
});
