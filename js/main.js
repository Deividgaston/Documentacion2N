// js/main.js
// Router principal de vistas para Presupuestos 2N

window.appState = window.appState || {};
appState.currentView = appState.currentView || "proyecto";

const VIEW_STORAGE_KEY = "presup2n_currentView";

// ==============================
// Helpers storage
// ==============================

function _viewStorageGet(key) {
  try {
    const v = window.sessionStorage ? window.sessionStorage.getItem(key) : null;
    if (v !== null && v !== undefined) return v;
  } catch (_) {}
  try {
    const v2 = window.localStorage ? window.localStorage.getItem(key) : null;
    if (v2 !== null && v2 !== undefined) {
      try {
        if (window.sessionStorage) window.sessionStorage.setItem(key, v2);
        if (window.localStorage) window.localStorage.removeItem(key);
      } catch (_) {}
      return v2;
    }
  } catch (_) {}
  return null;
}

function _viewStorageSet(key, val) {
  try {
    if (window.sessionStorage) window.sessionStorage.setItem(key, val);
    else if (window.localStorage) window.localStorage.setItem(key, val);
  } catch (e) {
    try {
      if (window.localStorage) window.localStorage.setItem(key, val);
    } catch (_) {}
  }
}

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
  if (!caps) return false;

  if (caps.pages && typeof caps.pages === "object") {
    const val = caps.pages[v];
    if (val === undefined || val === null) return false;
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val !== "none";
    return !!val;
  }

  if (caps.views && typeof caps.views === "object") {
    return !!caps.views[v];
  }

  return false;
}

// ✅ NUEVO: oculta/enseña links del topbar según permisos reales
function _applyNavVisibility() {
  if (!appState.authReady) return;

  document.querySelectorAll(".top-nav-link[data-view]").forEach((link) => {
    const v = _normalizeViewKey(link.getAttribute("data-view"));
    const ok = _isViewAllowedSafe(v);
    link.style.display = ok ? "" : "none";
  });
}

// ==============================
// 🔐 VALIDACIÓN DE INVITACIÓN (m2)
// ==============================

async function validateInviteIfNeeded() {
  if (appState._inviteValidated) return;
  appState._inviteValidated = true;

  try {
    const user = appState.user;
    if (!user || !user.email || user.role === "SUPER_ADMIN") return;

    const email = String(user.email).trim().toLowerCase();
    const inviteId = email.replace(/[^\w.-]+/g, "_");

    const ref = await db.collection("invites").doc(inviteId).get();
    if (!ref.exists) throw new Error("invite_not_found");

    const inv = ref.data() || {};
    const now = Date.now();
    const exp = inv.expiresAt?.toDate?.()?.getTime?.() || 0;

    if (!inv.active || inv.status !== "pending" || exp < now) {
      throw new Error("invite_invalid");
    }

    // marcar aceptada (best-effort)
    ref.ref.set(
      {
        status: "accepted",
        acceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("Invitación no válida:", e.message || e);
    alert("Tu invitación no es válida o ha caducado.");
    firebase.auth().signOut();
  }
}

// ==============================
// Router principal
// ==============================

function setCurrentView(viewKey) {
  viewKey = _normalizeViewKey(viewKey);

  if (!appState.authReady) {
    appState.pendingView = viewKey;
    _viewStorageSet(VIEW_STORAGE_KEY, viewKey);
    return;
  }

  if (appState.pendingView) {
    viewKey = _normalizeViewKey(appState.pendingView);
    appState.pendingView = null;
  }

  // ✅ ocultar/enseñar menú según permisos actuales
  _applyNavVisibility();

  // 🔒 Refuerzo explícito para TARIFA
  if (viewKey === "tarifa" && !_isViewAllowedSafe("tarifa")) {
    viewKey = "proyecto";
  }

  if (!_isViewAllowedSafe(viewKey)) {
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
  _viewStorageSet(VIEW_STORAGE_KEY, viewKey);

  document.querySelectorAll(".top-nav-link[data-view]").forEach((link) => {
    const v = _normalizeViewKey(link.getAttribute("data-view"));
    link.classList.toggle("active", v === viewKey);
  });

  updateViewSubtitle(viewKey);
  renderViewByKey(viewKey);
}

function updateViewSubtitle(viewKey) {
  const el = document.getElementById("currentViewSubtitle");
  if (!el) return;

  const map = {
    proyecto: "Importa y gestiona el proyecto base desde Excel / Project Designer.",
    presupuesto: "Edita el presupuesto a partir del proyecto importado.",
    simulador: "Simula tarifas y descuentos sobre el presupuesto actual.",
    tarifa: "Consulta la tarifa PVP de 2N y añade partidas al presupuesto.",
    tarifas: "Gestiona los tipos de tarifa y descuentos avanzados.",
    documentacion: "Genera la memoria de calidades y documentación del proyecto.",
    prescripcion: "Vista de prescripción: resumen inteligente de documentación.",
    docGestion: "Gestiona la documentación subida.",
    usuarios: "Configuración de usuarios y permisos.",
  };

  el.textContent = map[viewKey] || "";
}

function callIfFn(fnName) {
  if (typeof window[fnName] === "function") {
    window[fnName]();
    return true;
  }
  return false;
}

function renderViewByKey(viewKey) {
  viewKey = _normalizeViewKey(viewKey);
  if (!appState.authReady) return;
  if (!_isViewAllowedSafe(viewKey)) return;

  switch (viewKey) {
    case "proyecto": callIfFn("renderProyectoView"); break;
    case "presupuesto": callIfFn("renderPresupuestoView"); break;
    case "simulador": callIfFn("renderSimuladorView"); break;
    case "tarifa":
      if (!callIfFn("renderTarifaView")) callIfFn("renderTarifa2NView");
      break;
    case "tarifas":
      if (!callIfFn("renderTarifasView")) callIfFn("renderTarifasTiposView");
      break;
    case "documentacion": callIfFn("renderDocumentacionView"); break;
    case "prescripcion": callIfFn("renderDocPrescripcionView"); break;
    case "docGestion": callIfFn("renderDocGestionView"); break;
    case "usuarios": callIfFn("renderAdminUsersView"); break;
    default: callIfFn("renderProyectoView");
  }
}

function initTopbarNavigation() {
  if (appState._mainNavInited) return;
  appState._mainNavInited = true;

  document.querySelectorAll(".top-nav-link[data-view]").forEach((link) => {
    link.addEventListener("click", (ev) => {
      ev.preventDefault();
      setCurrentView(link.getAttribute("data-view"));
    });
  });
}

// ==============================
// Boot
// ==============================

document.addEventListener("DOMContentLoaded", () => {
  initTopbarNavigation();

  let initialView = _viewStorageGet(VIEW_STORAGE_KEY) || appState.currentView || "proyecto";
  initialView = _normalizeViewKey(initialView);

  appState.pendingView = initialView;
  appState.currentView = initialView;

  const start = Date.now();
  const t = setInterval(async () => {
    if (appState.authReady) {
      clearInterval(t);
      await validateInviteIfNeeded();
      _applyNavVisibility(); // ✅ también al entrar
      setCurrentView(appState.pendingView || initialView);
    }
    if (Date.now() - start > 15000) clearInterval(t);
  }, 200);
});

window.setCurrentView = setCurrentView;
window.renderViewByKey = renderViewByKey;
