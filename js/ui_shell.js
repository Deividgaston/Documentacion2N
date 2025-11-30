// js/ui_shell.js
// Shell principal del programa de PRESUPUESTOS 2N
// NO modifica el HTML ni los estilos existentes.
// Solo controla qué página se renderiza dentro del contenedor principal.

if (!window.appState) {
  window.appState = {};
}

if (!appState.currentPage) {
  appState.currentPage = "proyecto";
}

// Intenta encontrar el contenedor principal de contenido
function getMainContentEl() {
  return (
    document.getElementById("mainContent") ||
    document.getElementById("content") ||
    document.getElementById("appContent") ||
    document.getElementById("app") // último recurso
  );
}

// Marca la pestaña activa en la navegación, si existe
function markActiveNav(page) {
  document.querySelectorAll("[data-page]").forEach((btn) => {
    btn.classList.toggle("nav-item-active", btn.dataset.page === page);
  });
}

// Función central para cambiar de página
function renderShellContent(page) {
  const contentEl = getMainContentEl();
  if (!contentEl) {
    console.error("[Shell] No se encontró contenedor para el contenido (mainContent/content/appContent/app)");
    return;
  }

  appState.currentPage = page;
  markActiveNav(page);

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

// Inicializa los listeners de navegación sin tocar el HTML
function initShell() {
  // Asignar eventos a los botones de menú que ya tengas en el HTML
  document.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      renderShellContent(page);
    });
  });

  // Primera carga
  renderShellContent(appState.currentPage || "proyecto");
}

document.addEventListener("DOMContentLoaded", () => {
  initShell();
});
