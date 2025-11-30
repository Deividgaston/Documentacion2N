// js/ui_shell.js
// Shell principal con barra tipo Salesforce (modo claro)

if (!window.appState) window.appState = {};
if (!appState.currentTab) appState.currentTab = "proyecto";

function renderShell() {
  const root = document.getElementById("app");
  if (!root) return;

  const user = firebase.auth().currentUser;
  const nombreUsuario = user?.displayName || user?.email || "Usuario";
  const inicial = (nombreUsuario || "?").charAt(0).toUpperCase();

  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div class="app-header-left">
          <div class="app-brand">Presupuestos 2N</div>
          <nav class="top-tabs">
            <button class="tab-btn" data-tab="proyecto" id="navProyecto">Proyecto</button>
            <button class="tab-btn" data-tab="presupuesto" id="navPresupuesto">Presupuesto</button>
            <button class="tab-btn" data-tab="tarifa" id="navTarifa">Tarifa 2N</button>
            <button class="tab-btn" data-tab="docs" id="navDocs">Documentación</button>
          </nav>
        </div>
        <div class="app-header-right">
          <div class="user-chip-wrapper">
            <div class="user-avatar">${inicial}</div>
            <div class="user-name">${nombreUsuario}</div>
          </div>
          <button id="btnLogout" class="btn-link-logout">Cerrar sesión</button>
        </div>
      </header>

      <main id="shellContent" class="shell-content" style="padding:16px;"></main>
    </div>
  `;

  // activar pestaña actual
  const tabs = ["proyecto", "presupuesto", "tarifa", "docs"];
  tabs.forEach((tab) => {
    const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (!btn) return;
    if (appState.currentTab === tab) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
    btn.onclick = () => switchTab(tab);
  });

  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.onclick = handleLogout;
  }

  renderShellContent();
}

function switchTab(tab) {
  appState.currentTab = tab;
  renderShell(); // repinta y subraya la pestaña activa
}

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

function handleLogout() {
  firebase
    .auth()
    .signOut()
    .then(() => {
      appState.user = null;
      location.reload();
    })
    .catch((err) => {
      console.error("Error al cerrar sesión:", err);
      alert("No se pudo cerrar sesión. Revisa la consola.");
    });
}
