// js/ui_shell.js
// Shell principal con navbar tipo Salesforce

function renderShell() {
  const root = document.getElementById("app");
  const user = auth.currentUser;
  const nombre = user?.displayName || user?.email || "Usuario";
  const inicial = (nombre || "?").charAt(0).toUpperCase();

  root.innerHTML = `
    <div>
      <header class="navbar">
        <div class="navbar-left">
          <div class="navbar-title">Presupuestos 2N</div>
          <nav class="navbar-tabs">
            <div class="nav-tab" data-tab="proyecto">Proyecto</div>
            <div class="nav-tab" data-tab="presupuesto">Presupuesto</div>
            <div class="nav-tab" data-tab="tarifa">Tarifa 2N</div>
            <div class="nav-tab" data-tab="docs">Documentación</div>
          </nav>
        </div>
        <div class="navbar-right">
          <div class="nav-avatar">${inicial}</div>
          <div class="nav-username">${nombre}</div>
          <div class="logout-link" id="logoutLink">Cerrar sesión</div>
        </div>
      </header>

      <main id="shellContent"></main>
    </div>
  `;

  // activar pestaña
  document.querySelectorAll(".nav-tab").forEach(el => {
    const tab = el.getAttribute("data-tab");
    if (tab === appState.currentTab) {
      el.classList.add("nav-tab-active");
    }
    el.onclick = () => {
      appState.currentTab = tab;
      renderShell();
    };
  });

  document.getElementById("logoutLink").onclick = () => {
    auth.signOut().then(() => location.reload());
  };

  renderShellContent();
}

function renderShellContent() {
  const content = document.getElementById("shellContent");
  content.innerHTML = "";

  if (appState.currentTab === "proyecto") {
    renderProyecto(content);
  } else if (appState.currentTab === "presupuesto") {
    renderPresupuesto(content);
  } else if (appState.currentTab === "tarifa") {
    renderTarifa(content);
  } else {
    content.innerHTML = `<p>Sección en preparación.</p>`;
  }
}

window.renderShell = renderShell;
window.renderShellContent = renderShellContent;
