// js/ui_shell.js
// Shell principal: barra superior estilo Salesforce + tabs + logout

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

      <!-- TOP BAR -->
      <header class="app-header" style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid #e5e7eb;background:#f9fafb;">
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="font-weight:600;font-size:14px;color:#111827;">
            Presupuestos 2N
          </div>

          <nav style="display:flex;gap:8px;">
            <button class="tab-btn" id="navProyecto" data-tab="proyecto">Proyecto</button>
            <button class="tab-btn" id="navPresupuesto" data-tab="presupuesto">Presupuesto</button>
            <button class="tab-btn" id="navTarifa" data-tab="tarifa">Tarifa 2N</button>
            <button class="tab-btn" id="navDocs" data-tab="docs">Documentación</button>
          </nav>
        </div>

        <div style="display:flex;align-items:center;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:999px;background:#eef2ff;">
            <div style="width:24px;height:24px;border-radius:999px;background:#4f46e5;color:white;font-size:12px;display:flex;align-items:center;justify-content:center;">
              ${inicial}
            </div>
            <span style="font-size:12px;color:#111827;">${nombreUsuario}</span>
          </div>
          <button id="btnLogout" style="border:none;background:none;color:#2563eb;font-size:12px;cursor:pointer;">
            Cerrar sesión
          </button>
        </div>
      </header>

      <!-- CONTENIDO -->
      <main id="shellContent" class="shell-content" style="padding:16px;"></main>
    </div>
  `;

  // Activar pestaña actual
  const tabs = ["proyecto", "presupuesto", "tarifa", "docs"];
  tabs.forEach(tab => {
    const btn = document.getElementById("nav" + capitalizar(tab));
    if (!btn) return;
    if (appState.currentTab === tab) {
      btn.classList.add("active");
      btn.style.background = "#2563eb";
      btn.style.color = "#ffffff";
    } else {
      btn.classList.remove("active");
      btn.style.background = "#e5e7eb";
      btn.style.color = "#111827";
    }
    btn.onclick = () => switchTab(tab);
  });

  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.onclick = handleLogout;
  }

  renderShellContent();
}

function capitalizar(txt) {
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function switchTab(tab) {
  appState.currentTab = tab;
  renderShell(); // re-pinta barra + contenido y aplica la pestaña activa
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
