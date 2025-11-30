// js/ui_shell.js
// Shell principal de la app: barra superior + tabs + logout

if (!window.appState) window.appState = {};
if (!appState.currentTab) appState.currentTab = "proyecto";

// Render principal del shell
function renderShell() {
  const root = document.getElementById("app");
  if (!root) return;

  const user = firebase.auth().currentUser;
  const nombreUsuario = user?.displayName || user?.email || "Usuario";
  const inicial = (nombreUsuario || "?").charAt(0).toUpperCase();

  root.innerHTML = `
    <div class="shell">
      <!-- TOP BAR -->
      <header class="topbar">
        <div class="topbar-left">
          <div class="brand">
            <span class="brand-main">Presupuestos 2N</span>
          </div>

          <nav class="topnav">
            <button id="navProyecto" class="topnav-item" data-tab="proyecto">
              Proyecto
            </button>
            <button id="navPresupuesto" class="topnav-item" data-tab="presupuesto">
              Presupuesto
            </button>
            <button id="navTarifa" class="topnav-item" data-tab="tarifa">
              Tarifa 2N
            </button>
            <button id="navDocs" class="topnav-item" data-tab="docs">
              Documentación
            </button>
          </nav>
        </div>

        <div class="topbar-right">
          <div class="user-chip">
            <div class="user-avatar">${inicial}</div>
            <div class="user-info">
              <div class="user-name">${nombreUsuario}</div>
              <button id="btnLogout" class="btn-link">Cerrar sesión</button>
            </div>
          </div>
        </div>
      </header>

      <!-- CONTENIDO -->
      <main id="shellContent" class="shell-content"></main>
    </div>
  `;

  // Activar tab actual visualmente
  const navIds = {
    proyecto: "navProyecto",
    presupuesto: "navPresupuesto",
    tarifa: "navTarifa",
    docs: "navDocs",
  };
  Object.entries(navIds).forEach(([tab, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (appState.currentTab === tab) el.classList.add("active");
    el.onclick = () => switchTab(tab);
  });

  // Logout
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.onclick = handleLogout;
  }

  // Pintar contenido inicial
  renderShellContent();
}

// Cambiar de pestaña
function switchTab(tab) {
  appState.currentTab = tab;
  // actualizar estado visual de los botones
  document
    .querySelectorAll(".topnav-item")
    .forEach((btn) => btn.classList.remove("active"));

  const currentId =
    tab === "proyecto"
      ? "navProyecto"
      : tab === "presupuesto"
      ? "navPresupuesto"
      : tab === "tarifa"
      ? "navTarifa"
      : "navDocs";

  const currentBtn = document.getElementById(currentId);
  if (currentBtn) currentBtn.classList.add("active");

  renderShellContent();
}

// Render del contenido según la pestaña
function renderShellContent() {
  const content = document.getElementById("shellContent");
  if (!content) return;

  if (appState.currentTab === "proyecto") {
    if (typeof renderProyecto === "function") {
      renderProyecto(content);
    } else {
      content.innerHTML = "<p>No se encontró la página de Proyecto.</p>";
    }
  } else if (appState.currentTab === "presupuesto") {
    if (typeof renderPresupuesto === "function") {
      renderPresupuesto(content);
    } else {
      content.innerHTML = "<p>No se encontró la página de Presupuesto.</p>";
    }
  } else if (appState.currentTab === "tarifa") {
    if (typeof renderTarifa === "function") {
      renderTarifa(content);
    } else if (typeof renderTarifa2N === "function") {
      renderTarifa2N(content);
    } else {
      content.innerHTML = "<p>No se encontró la página de Tarifa 2N.</p>";
    }
  } else if (appState.currentTab === "docs") {
    if (typeof renderDocumentacion === "function") {
      renderDocumentacion(content);
    } else {
      content.innerHTML = "<p>No se encontró la página de Documentación.</p>";
    }
  } else {
    content.innerHTML = "<p>Pestaña no reconocida.</p>";
  }
}

// Logout Firebase
function handleLogout() {
  firebase
    .auth()
    .signOut()
    .then(() => {
      // Opcional: limpiar estado local
      appState.user = null;
      // Puedes redirigir a una página de login si la tienes
      // window.location.href = "login.html";
      location.reload();
    })
    .catch((err) => {
      console.error("Error al cerrar sesión:", err);
      alert("No se pudo cerrar sesión. Revisa la consola.");
    });
}

// Inicialización desde main.js:
// firebase.auth().onAuthStateChanged(user => {
//   if (user) {
//     appState.user = user;
//     renderShell();
//   } else {
//     // aquí muestras tu pantalla de login
//   }
// });
