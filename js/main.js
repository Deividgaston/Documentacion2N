// js/main.js
// Router principal de vistas para Presupuestos 2N

window.appState = window.appState || {};
appState.currentView = appState.currentView || "proyecto";

// ==============================
// Helpers de router / UI
// ==============================

function setCurrentView(viewKey) {
  appState.currentView = viewKey;

  // 1) Marcar pestaña activa en la topbar
  const navLinks = document.querySelectorAll(".top-nav-link[data-view]");
  navLinks.forEach((link) => {
    const v = link.getAttribute("data-view");
    if (v === viewKey) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // 2) Actualizar subtítulo de la vista actual
  updateViewSubtitle(viewKey);

  // 3) Renderizar la vista correspondiente
  renderViewByKey(viewKey);
}

function updateViewSubtitle(viewKey) {
  const subtitleEl = document.getElementById("currentViewSubtitle");
  if (!subtitleEl) return;

  let text = "";
  switch (viewKey) {
    case "proyecto":
      text = "Importa y gestiona el proyecto base desde Excel / Project Designer.";
      break;
    case "presupuesto":
      text = "Edita el presupuesto a partir del proyecto importado.";
      break;
    case "simulador":
      text = "Simula tarifas y descuentos sobre el presupuesto actual.";
      break;
    case "tarifa":
      text = "Consulta la tarifa PVP de 2N y añade partidas al presupuesto.";
      break;
    case "tarifas":
      text = "Gestiona los tipos de tarifa y descuentos avanzados.";
      break;
    case "docs":
      text = "Genera la memoria de calidades y documentación del proyecto.";
      break;
    default:
      text = "";
  }

  subtitleEl.textContent = text;
}

function callIfFn(fnName) {
  const fn = window[fnName];
  if (typeof fn === "function") {
    fn();
    return true;
  }
  return false;
}

function renderViewByKey(viewKey) {
  switch (viewKey) {
    case "proyecto":
      callIfFn("renderProyectoView");
      break;

    case "presupuesto":
      callIfFn("renderPresupuestoView");
      break;

    case "simulador":
      callIfFn("renderSimuladorView");
      break;

    case "tarifa":
      // Según cómo se haya definido en ui_tarifa.js
      if (!callIfFn("renderTarifaView")) {
        callIfFn("renderTarifa2NView");
      }
      break;

    case "tarifas":
      // Según cómo se haya definido en ui_tarifas.js
      if (!callIfFn("renderTarifasView")) {
        callIfFn("renderTarifasTiposView");
      }
      break;

    case "docs":
      // Nueva página de Documentación
      callIfFn("renderDocumentacionView");
      break;

    default:
      // Fallback: ir a Proyecto
      appState.currentView = "proyecto";
      callIfFn("renderProyectoView");
      break;
  }
}

// ==============================
// Inicialización de navegación
// ==============================

function initTopbarNavigation() {
  const navLinks = document.querySelectorAll(".top-nav-link[data-view]");
  navLinks.forEach((link) => {
    link.addEventListener("click", (ev) => {
      ev.preventDefault();
      const viewKey = link.getAttribute("data-view");
      if (!viewKey) return;
      setCurrentView(viewKey);
    });
  });
}

// ==============================
// Hook de arranque
// ==============================

document.addEventListener("DOMContentLoaded", () => {
  // Inicializar navegación de la barra superior
  initTopbarNavigation();

  // Si ya hay una vista en appState, úsala; si no, "proyecto"
  const initialView = appState.currentView || "proyecto";
  setCurrentView(initialView);
});

// Exponer por si quieres cambiar de vista desde otros módulos
window.setCurrentView = setCurrentView;
window.renderViewByKey = renderViewByKey;
