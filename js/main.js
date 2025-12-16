// js/main.js
// Router principal de vistas para Presupuestos 2N

window.appState = window.appState || {};
appState.currentView = appState.currentView || "proyecto";

const VIEW_STORAGE_KEY = "presup2n_currentView";

// ==============================
// Helpers de router / UI
// ==============================

function _normalizeViewKey(viewKey) {
  if (viewKey === "docs") return "documentacion";
  if (viewKey === "docs-gestion") return "docGestion";
  return viewKey;
}

function _isViewAllowedSafe(viewKey) {
  const v = _normalizeViewKey(viewKey);
  const caps = appState?.user?.capabilities;
  if (!caps || !caps.views) return false;
  return !!caps.views[v];
}

function setCurrentView(viewKey) {
  viewKey = _normalizeViewKey(viewKey);

  // Si auth aún no está listo, guardamos intención y salimos (evita salto a proyecto al refrescar)
  if (!appState.authReady) {
    appState.pendingView = viewKey;
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, viewKey);
    } catch (e) {
      console.warn("No se pudo guardar la vista actual en localStorage:", e);
    }
    return;
  }

  // Si había una vista pendiente, priorízala (p.ej. refresco)
  if (appState.pendingView) {
    viewKey = _normalizeViewKey(appState.pendingView);
    appState.pendingView = null;
  }

  // Bloqueo por permisos
  if (!_isViewAllowedSafe(viewKey)) {
    // buscar primera vista permitida
    const order = [
      "proyecto",
      "presupuesto",
      "simulador",
      "tarifa",
      "tarifas",
      "documentacion",
      "prescripcion",
      "docGestion",
      "usuarios",
    ];
    const fallback = order.find((k) => _isViewAllowedSafe(k));
    if (!fallback) return;
    viewKey = fallback;
  }

  appState.currentView = viewKey;

  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewKey);
  } catch (e) {
    console.warn("No se pudo guardar la vista actual en localStorage:", e);
  }

  const navLinks = document.querySelectorAll(".top-nav-link[data-view]");
  navLinks.forEach((link) => {
    const vRaw = link.getAttribute("data-view");
    const v = _normalizeViewKey(vRaw);

    if (v === viewKey) link.classList.add("active");
    else link.classList.remove("active");
  });

  updateViewSubtitle(viewKey);
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
      text = "Genera la memoria de calidades y documentación del proyecto.";
      break;
    case "prescripcion":
      text = "Vista de prescripción: resumen inteligente de documentación para memorias.";
      break;
    case "docGestion":
      text =
        "Gestiona la documentación subida: fichas, imágenes, certificados y declaraciones.";
      break;
    case "usuarios":
      text = "Configuración de usuarios y permisos.";
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
  viewKey = _normalizeViewKey(viewKey);

  // Bloqueo por permisos
  if (!appState.authReady) return;
  if (!_isViewAllowedSafe(viewKey)) return;

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

    case "prescripcion":
      callIfFn("renderDocPrescripcionView");
      break;

    case "docGestion":
      callIfFn("renderDocGestionView");
      break;

    case "usuarios":
      callIfFn("renderAdminUsersView");
      break;

    default:
      callIfFn("renderProyectoView");
      break;
  }
}

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

document.addEventListener("DOMContentLoaded", () => {
  initTopbarNavigation();

  // Determinar vista inicial (aunque auth aún no esté listo)
  let initialView = "proyecto";
  try {
    const storedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (storedView) initialView = storedView;
    else if (appState.currentView) initialView = appState.currentView;
  } catch (e) {
    console.warn("No se pudo leer la vista actual desde localStorage:", e);
    initialView = appState.currentView || "proyecto";
  }

  initialView = _normalizeViewKey(initialView);

  // Guardar intención para que, cuando authReady sea true, NO vuelva a proyecto
  appState.pendingView = initialView;
  appState.currentView = initialView;

  // Si ya hay authReady, render inmediato. Si no, esperamos a authReady con un poll ligero.
  if (appState.authReady) {
    setCurrentView(initialView);
    return;
  }

  const start = Date.now();
  const maxWaitMs = 15000; // seguridad: no dejar interval infinito
  const t = setInterval(() => {
    if (appState.authReady) {
      clearInterval(t);
      // setCurrentView consumirá pendingView y marcará el botón correcto
      setCurrentView(appState.pendingView || initialView);
      return;
    }
    if (Date.now() - start > maxWaitMs) {
      clearInterval(t);
    }
  }, 200);
});

window.setCurrentView = setCurrentView;
window.renderViewByKey = renderViewByKey;
