// js/ui_admin_users.js
// Vista: Configuración de usuarios (solo superadmin)
// Firestore: users/{uid} + invites/{inviteId}

(function () {
  window.appState = window.appState || {};

  const ROLES = [
    "ACCOUNT_MANAGER",
    "PRESCRIPTOR",
    "SUPER_PRESCRIPTOR",
    "DOC_MANAGER",
    "SUPER_ADMIN",
  ];

  let _cacheUsers = [];
  let _cacheInvites = [];
  let _searchTerm = "";

  function normalizeRole(r) {
    return String(r || "").trim().toUpperCase();
  }

  function normalizeAlias(a) {
    return String(a || "").trim();
  }

  function lower(s) {
    return String(s || "").toLowerCase();
  }

  // ==========================
  // Capabilities (SIN CAMBIOS)
  // ==========================
  function buildCapabilitiesForRoleDual(role) {
    /* === TU CÓDIGO ORIGINAL SIN CAMBIOS === */
    const r = normalizeRole(role);

    const legacy = {
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
        tarifasWrite: false,
        docExportTecnico: false,
        docModo: "none",
        prescTemplatesWrite: false,
        prescExtraRefsWrite: false,
      },
    };

    const v2 = {
      pages: {
        proyecto: false,
        presupuesto: false,
        simulador: false,
        tarifa: false,
        tarifas: "none",
        documentacion: "none",
        prescripcion: "none",
        docGestion: false,
        usuarios: false,
      },
      documentacion: { exportTecnico: false },
      prescripcion: { templates: "readOnly", extraRefs: "readOnly" },
    };

    function allowView(k) {
      legacy.views[k] = true;
      if (k === "tarifas") v2.pages.tarifas = "view";
      else if (k === "documentacion") v2.pages.documentacion = "commercial";
      else if (k === "prescripcion") v2.pages.prescripcion = "view";
      else if (k === "docGestion") v2.pages.docGestion = true;
      else if (k === "usuarios") v2.pages.usuarios = true;
      else v2.pages[k] = true;
    }

    if (r === "SUPER_ADMIN") {
      Object.keys(legacy.views).forEach((k) => allowView(k));
      legacy.features.tarifasWrite = true;
      legacy.features.docExportTecnico = true;
      legacy.features.docModo = "technical";
      legacy.features.prescTemplatesWrite = true;
      legacy.features.prescExtraRefsWrite = true;

      v2.pages.tarifas = "view";
      v2.pages.documentacion = "technical";
      v2.documentacion.exportTecnico = true;
      v2.pages.prescripcion = "view";
      v2.prescripcion.templates = "full";
      v2.prescripcion.extraRefs = "full";
      return { ...legacy, ...v2 };
    }

    if (r === "ACCOUNT_MANAGER") {
      allowView("proyecto");
      allowView("presupuesto");
      allowView("simulador");
      allowView("tarifa");
      allowView("tarifas");
      allowView("documentacion");
      allowView("docGestion");
      legacy.features.docModo = "commercial";
      return { ...legacy, ...v2 };
    }

    if (r === "PRESCRIPTOR") {
      allowView("proyecto");
      allowView("presupuesto");
      allowView("simulador");
      allowView("tarifa");
      allowView("tarifas");
      allowView("documentacion");
      allowView("docGestion");
      legacy.features.docModo = "technical";
      legacy.features.docExportTecnico = true;
      return { ...legacy, ...v2 };
    }

    if (r === "SUPER_PRESCRIPTOR") {
      allowView("proyecto");
      allowView("presupuesto");
      allowView("simulador");
      allowView("tarifa");
      allowView("tarifas");
      allowView("documentacion");
      allowView("prescripcion");
      allowView("docGestion");
      legacy.features.docModo = "technical";
      legacy.features.docExportTecnico = true;
      return { ...legacy, ...v2 };
    }

    if (r === "DOC_MANAGER") {
      allowView("documentacion");
      allowView("docGestion");
      legacy.features.docModo = "technical";
      return { ...legacy, ...v2 };
    }

    return { ...legacy, ...v2 };
  }

  function isSuperAdmin() {
    return normalizeRole(appState?.user?.role) === "SUPER_ADMIN";
  }

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function loadOnce() {
    const [u, i] = await Promise.all([
      db.collection("users").orderBy("updatedAt", "desc").limit(100).get(),
      db.collection("invites").orderBy("createdAt", "desc").limit(50).get(),
    ]);

    _cacheUsers = u.docs.map((d) => ({ id: d.id, ...d.data() }));
    _cacheInvites = i.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // ==========================
  // NUEVO: update alias
  // ==========================
  async function updateUserAlias(uid, alias) {
    const a = normalizeAlias(alias);
    await db.collection("users").doc(uid).set(
      {
        alias: a || null,
        aliasLower: a ? lower(a) : null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  // ==========================
  // NUEVO: borrar usuario (CF)
  // ==========================
  async function deleteUser(uid) {
    const fn =
      window.functions && typeof window.functions.httpsCallable === "function"
        ? window.functions
        : firebase.functions();
    const call = fn.httpsCallable("adminDeleteUser");
    await call({ uid });
  }

  function render() {
    const usersWrap = el("adminUsersList");
    if (!usersWrap) return;

    const term = lower(_searchTerm);

    const users = _cacheUsers.filter((u) => {
      if (!term) return true;
      return (
        lower(u.email).includes(term) ||
        lower(u.alias).includes(term)
      );
    });

    usersWrap.innerHTML =
      users.length === 0
        ? `<div style="color:#6b7280;">Sin usuarios.</div>`
        : users
            .map((u) => {
              const uid = u.id;
              const role = normalizeRole(u.role);
              return `
              <div class="card" style="margin-top:10px;">
                <div style="display:flex; justify-content:space-between; gap:12px;">
                  <div>
                    <div style="font-weight:700;">${escapeHtml(u.email)}</div>
                    <div style="font-size:0.85rem;">UID: ${escapeHtml(uid)}</div>
                  </div>

                  <div style="min-width:360px; display:flex; flex-direction:column; gap:8px;">
                    <input
                      placeholder="Alias / apodo"
                      value="${escapeHtml(u.alias || "")}"
                      data-alias="${escapeHtml(uid)}"
                    />

                    <div style="display:flex; gap:8px;">
                      <select data-role="${escapeHtml(uid)}">
                        ${ROLES.map(
                          (r) =>
                            `<option value="${r}" ${
                              r === role ? "selected" : ""
                            }>${r}</option>`
                        ).join("")}
                      </select>

                      <button class="btn btn-primary btn-sm" data-save-role="${escapeHtml(
                        uid
                      )}">Guardar</button>

                      <button class="btn btn-danger btn-sm" data-delete-user="${escapeHtml(
                        uid
                      )}">Borrar</button>
                    </div>
                  </div>
                </div>
              </div>
            `;
            })
            .join("");
  }

  function wire(container) {
    container.addEventListener("input", (e) => {
      if (e.target?.id === "userSearch") {
        _searchTerm = e.target.value || "";
        render();
      }
    });

    container.addEventListener("change", async (e) => {
      const uid = e.target?.getAttribute("data-alias");
      if (uid) {
        await updateUserAlias(uid, e.target.value);
      }
    });

    container.addEventListener("click", async (e) => {
      const del = e.target?.getAttribute("data-delete-user");
      if (del) {
        if (!confirm("¿BORRAR USUARIO DEFINITIVAMENTE?")) return;
        await deleteUser(del);
        await loadOnce();
        render();
      }
    });
  }

  window.renderAdminUsersView = async function () {
    const c = el("appContent");
    if (!c) return;

    if (!isSuperAdmin()) {
      c.innerHTML = `<div class="card">Acceso denegado</div>`;
      return;
    }

    c.innerHTML = `
      <div class="page-title">Usuarios</div>
      <input id="userSearch" placeholder="Buscar por email o alias…" />
      <div id="adminUsersList"></div>
    `;

    wire(c);
    await loadOnce();
    render();
  };
})();
