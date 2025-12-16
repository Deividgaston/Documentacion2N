// js/ui_shell.js
// Shell de la app: navegación superior + logout + selección de vistas

window.appState = window.appState || {};

// ==========================
// CONFIG
// ==========================
const SUPERADMIN_EMAIL = "gastonortigosa@gmail.com";

// ==========================
// Roles -> capabilities (base futuro)
// ==========================
function buildCapabilitiesForRole(role) {
  const r = String(role || "").toUpperCase();

  const base = {
    views: {
      proyecto: false,
      presupuesto: false,
      simulador: false,
      tarifa: false,
      tarifas: false,
      documentacion: false,
      prescripcion: false,
      docGestion: false,
      usuarios: false,
    },
    features: {
      tarifasWrite: false,         // add/edit/delete tarifas
      docExportTecnico: false,     // export técnico
      docModo: "none",             // "none" | "commercial" | "technical"
      prescTemplatesWrite: false,  // plantillas prescripción
      prescExtraRefsWrite: false,  // refs extra prescripción
    },
  };

  if (r === "SUPER_ADMIN") {
    Object.keys(base.views).forEach((k) => (base.views[k] = true));
    base.features.tarifasWrite = true;
    base.features.docExportTecnico = true;
    base.features.docModo = "technical";
    base.features.prescTemplatesWrite = true;
    base.features.prescExtraRefsWrite = true;
    return base;
  }

  if (r === "ACCOUNT_MANAGER") {
    base.views.proyecto = true;
    base.views.presupuesto = true;
    base.views.simulador = true;
    base.views.tarifa = true;
    base.views.tarifas = true;
    base.views.documentacion = true;
    base.views.prescripcion = false;
    base.views.docGestion = true;

    base.features.tarifasWrite = false; // solo consultar/imprimir
    base.features.docExportTecnico = false;
    base.features.docModo = "commercial";
    return base;
  }

  if (r === "PRESCRIPTOR") {
    base.views.proyecto = true;
    base.views.presupuesto = true;
    base.views.simulador = true;
    base.views.tarifa = true;
    base.views.tarifas = true;
    base.views.documentacion = true;
    base.views.prescripcion = false;
    base.views.docGestion = true;

    base.features.tarifasWrite = false;
    base.features.docExportTecnico = true;
    base.features.docModo = "technical";
    return base;
  }

  if (r === "SUPER_PRESCRIPTOR") {
    base.views.proyecto = true;
    base.views.presupuesto = true;
    base.views.simulador = true;
    base.views.tarifa = true;
    base.views.tarifas = true;
    base.views.documentacion = true;
    base.views.prescripcion = true;
    base.views.docGestion = true;

    base.features.tarifasWrite = false;
    base.features.docExportTecnico = true;
    base.features.docModo = "technical";
    base.features.prescTemplatesWrite = false; // read-only
    base.features.prescExtraRefsWrite = false; // read-only
    return base;
  }

  if (r === "DOC_MANAGER") {
    base.views.docGestion = true;
    base.views.documentacion = true;
    base.features.docModo = "technical";
    return base;
  }

  // default seguro
  return base;
}

function isViewAllowed(viewKey) {
  const caps = appState?.user?.capabilities;
  if (!caps || !caps.views) return false;
  return !!caps.views[viewKey];
}

function getFirstAllowedView() {
  const order = ["proyecto", "presupuesto", "simulador", "tarifa", "tarifas", "documentacion", "prescripcion", "docGestion", "usuarios"];
  for (const v of order) if (isViewAllowed(v)) return v;
  return null;
}

// ==========================
// Firestore: cargar/crear user profile
// ==========================
async function ensureAndLoadUserProfile(firebaseUser) {
  const uid = firebaseUser.uid;
  const email = String(firebaseUser.email || "").toLowerCase();

  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();

  // Si no existe: lo creamos (default ACCOUNT_MANAGER salvo superadmin)
  if (!snap.exists) {
    const role = email === SUPERADMIN_EMAIL ? "SUPER_ADMIN" : "ACCOUNT_MANAGER";
    const capabilities = buildCapabilitiesForRole(role);

    await ref.set(
      {
        uid,
        email,
        role,
        capabilities,
        active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { uid, email, role, capabilities, active: true };
  }

  const data = snap.data() || {};
  const role = String(data.role || "").toUpperCase() || (email === SUPERADMIN_EMAIL ? "SUPER_ADMIN" : "ACCOUNT_MANAGER");
  const active = data.active !== false;

  // capabilities: si faltan o están incompletas, regeneramos (merge)
  const capabilities = data.capabilities && data.capabilities.views ? data.capabilities : buildCapabilitiesForRole(role);

  // Ajuste: superadmin único por email (si alguien intenta “ponerse” SUPER_ADMIN sin ser el email)
  if (role === "SUPER_ADMIN" && email !== SUPERADMIN_EMAIL) {
    return null; // denegamos
  }

  // Si hay que normalizar/guardar capabilities
  try {
    await ref.set(
      {
        email,
        role,
        capabilities,
        active,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (_) {}

  return { uid, email, role, capabilities, active };
}

// ==========================
// UI: aplicar visibilidad de pestañas
// ==========================
function applyNavVisibility() {
  const links = document.querySelectorAll(".top-nav-link[data-view]");
  links.forEach((a) => {
    const v = a.getAttribute("data-view");
    if (!v) return;

    // normalizar compat
    const viewKey = v === "docs" ? "documentacion" : v === "docs-gestion" ? "docGestion" : v;

    // Si no hay user, ocultar todo (hasta login)
    if (!appState.user) {
      a.style.display = "none";
      return;
    }

    // Mostrar solo vistas permitidas
    a.style.display = isViewAllowed(viewKey) ? "" : "none";
  });
}

// ==========================
// Inicializar shell (se llama tras login correcto)
// ==========================
function initShellUI() {
  const loginPage = document.getElementById("loginPage");
  const appShell = document.getElementById("appShell");
  const btnLogout = document.getElementById("btnLogout");

  if (!loginPage || !appShell) {
    console.error("Faltan loginPage o appShell en el HTML.");
    return;
  }

  // Mostrar app, ocultar login
  loginPage.style.display = "none";
  appShell.style.display = "flex";

  // Badge usuario
  const userBadge = document.getElementById("userBadge");
  if (userBadge && appState.user?.email) {
    userBadge.textContent = `${appState.user.email} · ${appState.user.role || ""}`.trim();
  }

  // Listeners de navegación (evitar duplicados)
  if (!appState._shellNavInited) {
    appState._shellNavInited = true;

    document.querySelectorAll(".top-nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const view = link.getAttribute("data-view");
        if (!view) return;

        const viewKey = view === "docs" ? "documentacion" : view === "docs-gestion" ? "docGestion" : view;

        // Bloqueo por permisos
        if (!isViewAllowed(viewKey)) return;

        if (typeof window.setCurrentView === "function") {
          window.setCurrentView(viewKey);
        } else {
          selectView(viewKey);
        }
      });
    });
  }

  // Logout
  if (btnLogout && !appState._logoutInited) {
    appState._logoutInited = true;
    btnLogout.addEventListener("click", async () => {
      try {
        await auth.signOut();
      } catch (e) {
        console.error("Error al cerrar sesión:", e);
      }
    });
  }

  // Aplicar tabs
  applyNavVisibility();
}

// Cambiar de vista y marcar pestaña activa (fallback legacy)
function selectView(viewName) {
  if (viewName === "proyecto" && typeof renderProyectoView === "function") {
    renderProyectoView();
  } else if (viewName === "presupuesto" && typeof renderPresupuestoView === "function") {
    renderPresupuestoView();
  } else if (viewName === "tarifa" && typeof renderTarifaView === "function") {
    renderTarifaView();
  } else if (viewName === "tarifas" && typeof renderTarifasView === "function") {
    renderTarifasView();
  } else if (viewName === "docs" && typeof renderDocumentacionView === "function") {
    renderDocumentacionView();
  } else if (viewName === "simulador" && typeof renderSimuladorView === "function") {
    renderSimuladorView();
  }

  document.querySelectorAll(".top-nav-link").forEach((el) => el.classList.remove("active"));

  const activeTab = document.querySelector(`.top-nav-link[data-view="${viewName}"]`);
  if (activeTab) activeTab.classList.add("active");
}

// ==========================
// AUTH GATE (NUEVO)
// ==========================
function initAuthGate() {
  const loginPage = document.getElementById("loginPage");
  const appShell = document.getElementById("appShell");

  if (!loginPage || !appShell) return;

  // estado inicial
  loginPage.style.display = "flex";
  appShell.style.display = "none";

  if (typeof initLoginUI === "function") initLoginUI();

  auth.onAuthStateChanged(async (user) => {
    try {
      if (!user) {
        appState.user = null;
        appState.authReady = true;

        // ocultar tabs mientras no haya user
        applyNavVisibility();

        loginPage.style.display = "flex";
        appShell.style.display = "none";
        return;
      }

      // Cargar/crear perfil
      const profile = await ensureAndLoadUserProfile(user);

      // Denegado por superadmin único
      if (!profile) {
        try {
          await auth.signOut();
        } catch (_) {}
        appState.user = null;
        appState.authReady = true;
        loginPage.style.display = "flex";
        appShell.style.display = "none";
        return;
      }

      // Denegado por active=false
      if (profile.active === false) {
        try {
          await auth.signOut();
        } catch (_) {}
        appState.user = null;
        appState.authReady = true;
        loginPage.style.display = "flex";
        appShell.style.display = "none";
        return;
      }

      appState.user = profile;
      appState.authReady = true;

      // Mostrar app + aplicar permisos
      initShellUI();

      // Si la vista actual no está permitida, saltar a la primera permitida
      const current = appState.currentView || "proyecto";
      if (typeof window.setCurrentView === "function") {
        if (!isViewAllowed(current)) {
          const fallback = getFirstAllowedView() || "proyecto";
          window.setCurrentView(fallback);
        }
      }
    } catch (e) {
      console.error("AuthGate error:", e);
      try {
        await auth.signOut();
      } catch (_) {}
      appState.user = null;
      appState.authReady = true;
      loginPage.style.display = "flex";
      appShell.style.display = "none";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initAuthGate();
});

console.log("%cUI Shell inicializada (ui_shell.js)", "color:#4f46e5; font-weight:600;");
