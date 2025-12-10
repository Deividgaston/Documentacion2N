// js/main.js
// Router principal de vistas para Presupuestos 2N

window.appState = window.appState || {};
appState.currentView = appState.currentView || "proyecto";

const VIEW_STORAGE_KEY = "presup2n_currentView";

// ==============================
// Helpers de router / UI
// ==============================

function setCurrentView(viewKey) {
  // ⭐ compat: normalizar posibles claves antiguas
  if (viewKey === "docs") viewKey = "documentacion";
  if (viewKey === "docs-gestion") viewKey = "docGestion";

  appState.currentView = viewKey;

  // Guardar la vista actual en localStorage para mantenerla tras F5
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewKey);
  } catch (e) {
    console.warn("No se pudo guardar la vista actual en localStorage:", e);
  }

  // 1) Marcar pestaña activa en la topbar
  const navLinks = document.querySelectorAll(".top-nav-link[data-view]");
  navLinks.forEach((link) => {
    const v = link.getAttribute("data-view");

    const normalized =
      v === "docs"
        ? "documentacion"
        : v === "docs-gestion"
        ? "docGestion"
        : v;

    if (normalized === viewKey) {
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

    case "documentacion":
    case "docs":
      text = "Genera la memoria de calidades y documentación del proyecto.";
      break;

    case "prescripcion":
      text = "Vista de prescripción: resumen inteligente de documentación para memorias.";
      break;

    case "docGestion":
    case "docs-gestion":
      text = "Gestiona la documentación subida: fichas, imágenes, certificados y declaraciones.";
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
  // compat
  if (viewKey === "docs") viewKey = "documentacion";
  if (viewKey === "docs-gestion") viewKey = "docGestion";

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
      if (!callIfFn("renderTarifaView")) callIfFn("renderTarifa2NView");
      break;

    case "tarifas":
      if (!callIfFn("renderTarifasView")) callIfFn("renderTarifasTiposView");
      break;

    case "documentacion":
      callIfFn("renderDocumentacionView");
      break;

    case "prescripcion":         // ⭐ NUEVA PÁGINA
      callIfFn("renderDocPrescripcionView");
      break;

    case "docGestion":
      callIfFn("renderDocGestionView");
      break;

    default:
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
  initTopbarNavigation();

  let initialView = "proyecto";
  try {
    const storedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (storedView) {
      initialView = storedView;
    } else if (appState.currentView) {
      initialView = appState.currentView;
    }
  } catch (e) {
    console.warn("No se pudo leer la vista actual desde localStorage:", e);
    initialView = appState.currentView || "proyecto";
  }

  setCurrentView(initialView);
});

// Exponer
window.setCurrentView = setCurrentView;
window.renderViewByKey = renderViewByKey;
