// js/ui_shell.js
// Shell principal del programa de PRESUPUESTOS 2N
// - Layout con barra superior tipo Salesforce (claro)
// - Navegación entre "Proyecto" y "Presupuesto"
// - Estado global appState compartido con el resto de archivos

// ==============================
// ESTADO GLOBAL
// ==============================
if (!window.appState) {
  window.appState = {};
}

// Valores por defecto (solo si no existen)
if (!appState.infoPresupuesto) {
  appState.infoPresupuesto = {
    cliente: "",
    proyecto: "",
    direccion: "",
    contacto: "",
    email: "",
    telefono: "",
    notas: ""
  };
}

if (!Array.isArray(appState.lineasProyecto)) {
  appState.lineasProyecto = [];
}

if (typeof appState.descuentoGlobal !== "number") {
  appState.descuentoGlobal = 0;
}

if (typeof appState.aplicarIVA !== "boolean") {
  appState.aplicarIVA = true;
}

if (!appState.tarifas) {
  appState.tarifas = {}; // cache en memoria si en algún momento se cargan tarifas
}

if (!appState.currentPage) {
  appState.currentPage = "proyecto";
}

// ==============================
// INICIALIZAR SHELL
// ==============================
function initShell() {
  const appEl = document.getElementById("app");
  if (!appEl) {
    console.error("[Shell] No se encontró el elemento raíz con id='app'");
    return;
  }

  // Layout general: barra superior + contenido
  appEl.innerHTML = `
    <div class="shell-root">
      <header class="shell-topbar">
        <div class="shell-topbar-left">
          <div class="shell-logo-mark">2N</div>
          <div class="shell-logo-text">
            <div class="shell-logo-title">Presupuestos 2N</div>
            <div class="shell-logo-subtitle">Project Designer · Oferta al cliente</div>
          </div>
        </div>
        <nav class="shell-topbar-nav">
          <button class="nav-item" data-page="proyecto">Proyecto</button>
          <button class="nav-item" data-page="presupuesto">Presupuesto</button>
        </nav>
        <div class="shell-topbar-right">
          <span class="shell-badge">Modo local · Sincronización mínima</span>
        </div>
      </header>

      <main class="shell-main">
        <div id="mainContent"></div>
      </main>
    </div>
  `;

  // Eventos de navegación
  document.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      renderShellContent(page);
    });
  });

  // Página inicial
  renderShellContent(appState.currentPage || "proyecto");
}

// ==============================
// RENDER CONTENIDO SEGÚN PÁGINA
// ==============================
function renderShellContent(page) {
  const contentEl = document.getElementById("mainContent");
  if (!contentEl) {
    console.error("[Shell] No se encontró #mainContent");
    return;
  }

  appState.currentPage = page;

  // Marcar active en la barra superior
  document.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
    btn.classList.toggle("nav-item-active", btn.dataset.page === page);
  });

  // Render según página
  if (page === "proyecto") {
    if (typeof renderProyecto === "function") {
      renderProyecto(contentEl);
    } else {
      console.error("[Shell] renderProyecto no está definida");
      contentEl.innerHTML = "<p>Error: página Proyecto no disponible.</p>";
    }
  } else if (page === "presupuesto") {
    if (typeof renderPresupuesto === "function") {
      renderPresupuesto(contentEl);
    } else {
      console.error("[Shell] renderPresupuesto no está definida");
      contentEl.innerHTML = "<p>Error: página Presupuesto no disponible.</p>";
    }
  } else {
    // Fallback
    if (typeof renderProyecto === "function") {
      renderProyecto(contentEl);
    } else {
      contentEl.innerHTML = "<p>Error: página no disponible.</p>";
    }
  }
}

// ==============================
// AUTO-INIT AL CARGAR LA PÁGINA
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  initShell();
});
