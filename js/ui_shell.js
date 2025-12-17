// js/ui_shell.js
// Shell de la app: navegación superior + logout + selección de vistas
// + AUTH GATE + roles/permisos + invitaciones (invites/{emailId})

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
      tarifasWrite: false, // add/edit/delete tarifas
      docExportTecnico: false, // export técnico
      docModo: "none", // "none" | "commercial" | "technical"
      prescTemplatesWrite: false, // plantillas prescripción
      prescExtraRefsWrite: false, // refs extra prescripción
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

  return base;
}

function isViewAllowed(viewKey) {
  const caps = appState?.user?.capabilities;
  if (!caps || !caps.views) return false;
  return !!caps.views[viewKey];
}

function getFirstAllowedView() {
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
  for (const v of order) if (isViewAllowed(v)) return v;
  return null;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function inviteIdFromEmail(email) {
  return normalizeEmail(email).replace(/[^\w.-]+/g, "_");
}

// ==========================
// Firestore: cargar/crear user profile (con invitación)
// ==========================
async function ensureAndLoadUserProfile(firebaseUser) {
  const uid = firebaseUser.uid;
  const email = normalizeEmail(firebaseUser.email);

  // Seguridad: email requerido
  if (!email) return null;

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();

  // ================
  // EXISTE USER: normalizar y devolver
  // ================
  if (userSnap.exists) {
    const data = userSnap.data() || {};
    let role = String(data.role || "").toUpperCase();
    const active = data.active !== false;

    // Superadmin único por email
    if (role === "SUPER_ADMIN" && email !== SUPERADMIN_EMAIL) {
      return null;
    }

    if (!role) {
      role = email === SUPERADMIN_EMAIL ? "SUPER_ADMIN" : "ACCOUNT_MANAGER";
    }

    const capabilities =
      data.capabilities && data.capabilities.views
        ? data.capabilities
        : buildCapabilitiesForRole(role);

    // merge de normalización
    try {
      await userRef.set(
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

  // ================
  // NO EXISTE USER: crear según superadmin o invitación válida
  // ================
  if (email === SUPERADMIN_EMAIL) {
    const role = "SUPER_ADMIN";
    const capabilities = buildCapabilitiesForRole(role);

    await userRef.set(
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

  // Buscar invitación por email (id determinista)
  const invId = inviteIdFromEmail(email);
  const invRef = db.collection("invites").doc(invId);
  const invSnap = await invRef.get();

  if (!invSnap.exists) {
    // No invitado => no entra
    return null;
  }

  const inv = invSnap.data() || {};
  const status = String(inv.status || "pending").toLowerCase();
  const invEmail = normalizeEmail(inv.email);

  // Validaciones básicas
  if (invEmail && invEmail !== email) return null;
  if (status !== "pending") return null;

  // Caducidad 24h
  const nowMs = Date.now();
  const exp = inv.expiresAt?.toDate ? inv.expiresAt.toDate().getTime() : null;
  if (!exp || exp < nowMs) {
    // marcar expirado (best-effort)
    try {
      await invRef.set(
        {
          status: "expired",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (_) {}
    return null;
  }

  // Crear user con rol/capabilities de invitación (o default)
  const role = String(inv.role || "ACCOUNT_MANAGER").toUpperCase();
  const capabilities =
    inv.capabilities && inv.capabilities.views
      ? inv.capabilities
      : buildCapabilitiesForRole(role);

  await userRef.set(
    {
      uid,
      email,
      role,
      capabilities,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdFromInvite: invId,
    },
    { merge: true }
  );

  // Marcar invitación como usada (best-effort)
  try {
    await invRef.set(
      {
        status: "used",
        usedAt: firebase.firestore.FieldValue.serverTimestamp(),
        usedByUid: uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (_) {}

  return { uid, email, role, capabilities, active: true };
}

// ==========================
// UI: aplicar visibilidad de pestañas
// ==========================
function applyNavVisibility() {
  const links = document.querySelectorAll(".top-nav-link[data-view]");
  links.forEach((a) => {
    const v = a.getAttribute("data-view");
    if (!v) return;

    const viewKey =
      v === "docs" ? "documentacion" : v === "docs-gestion" ? "docGestion" : v;

    if (!appState.user) {
      a.style.display = "none";
      return;
    }

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

  loginPage.style.display = "none";
  appShell.style.display = "flex";

  // Badge usuario
  const userBadge = document.getElementById("userBadge");
  if (userBadge && appState.user?.email) {
    userBadge.textContent = `${appState.user.email} · ${appState.user.role || ""}`.trim();
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

  applyNavVisibility();
}

// Fallback legacy
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
// AUTH GATE
// ==========================
function initAuthGate() {
  const loginPage = document.getElementById("loginPage");
  const appShell = document.getElementById("appShell");
  const loginError = document.getElementById("loginError");

  if (!loginPage || !appShell) return;

  loginPage.style.display = "flex";
  appShell.style.display = "none";

  if (typeof initLoginUI === "function") initLoginUI();

  function showLoginError(msg) {
    if (!loginError) return;
    loginError.textContent = msg;
    loginError.style.display = "flex";
  }

  auth.onAuthStateChanged(async (user) => {
    try {
      if (!user) {
        appState.user = null;
        appState.authReady = true;
        applyNavVisibility();
        loginPage.style.display = "flex";
        appShell.style.display = "none";
        return;
      }

      const profile = await ensureAndLoadUserProfile(user);

      if (!profile) {
        try {
          await auth.signOut();
        } catch (_) {}

        appState.user = null;
        appState.authReady = true;
        applyNavVisibility();
        loginPage.style.display = "flex";
        appShell.style.display = "none";
        showLoginError("Acceso no autorizado o invitación caducada/no existente.");
        return;
      }

      if (profile.active === false) {
        try {
          await auth.signOut();
        } catch (_) {}

        appState.user = null;
        appState.authReady = true;
        applyNavVisibility();
        loginPage.style.display = "flex";
        appShell.style.display = "none";
        showLoginError("Usuario desactivado.");
        return;
      }

      appState.user = profile;
      appState.authReady = true;

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
      applyNavVisibility();
      loginPage.style.display = "flex";
      appShell.style.display = "none";
      showLoginError("Error de autenticación.");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initAuthGate();
});

console.log("%cUI Shell inicializada (ui_shell.js)", "color:#4f46e5; font-weight:600;");
