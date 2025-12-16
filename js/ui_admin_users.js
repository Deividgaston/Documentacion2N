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

  function normalizeRole(r) {
    return String(r || "").trim().toUpperCase();
  }

  function buildCapabilitiesForRole(role) {
    const r = normalizeRole(role);

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
        tarifasWrite: false, // add/edit/delete
        docExportTecnico: false,
        docModo: "none", // "none" | "commercial" | "technical"
        prescTemplatesWrite: false,
        prescExtraRefsWrite: false,
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

      base.features.tarifasWrite = false;
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
      base.views.documentacion = true;
      base.views.docGestion = true;
      base.features.docModo = "technical";
      return base;
    }

    return base;
  }

  function isSuperAdmin() {
    const role = normalizeRole(appState?.user?.role);
    return role === "SUPER_ADMIN";
  }

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(ts) {
    try {
      if (!ts) return "";
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString();
    } catch (_) {
      return "";
    }
  }

  async function loadUsersAndInvitesOnce() {
    // 1 lectura por colección (sin listeners)
    const [usersSnap, invitesSnap] = await Promise.all([
      db.collection("users").orderBy("updatedAt", "desc").limit(50).get(),
      db.collection("invites").orderBy("createdAt", "desc").limit(50).get(),
    ]);

    const users = [];
    usersSnap.forEach((doc) => users.push({ id: doc.id, ...(doc.data() || {}) }));

    const invites = [];
    invitesSnap.forEach((doc) =>
      invites.push({ id: doc.id, ...(doc.data() || {}) })
    );

    return { users, invites };
  }

  async function createInvite({ email, role }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanRole = normalizeRole(role) || "ACCOUNT_MANAGER";
    const capabilities = buildCapabilitiesForRole(cleanRole);

    // 24h desde ahora
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const payload = {
      email: cleanEmail,
      role: cleanRole,
      capabilities,
      active: true,
      status: "pending",
      expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: appState?.user?.uid || null,
    };

    // ID determinista por email (para evitar duplicados)
    const inviteId = cleanEmail.replace(/[^\w.-]+/g, "_");
    await db.collection("invites").doc(inviteId).set(payload, { merge: true });
  }

  async function updateUserRole(uid, role) {
    const cleanRole = normalizeRole(role);
    const capabilities = buildCapabilitiesForRole(cleanRole);
    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          role: cleanRole,
          capabilities,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  async function setUserActive(uid, active) {
    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          active: !!active,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  async function deleteInvite(inviteId) {
    await db.collection("invites").doc(inviteId).delete();
  }

  async function refresh() {
    const status = el("adminUsersStatus");
    const usersWrap = el("adminUsersList");
    const invitesWrap = el("adminInvitesList");

    if (status) status.textContent = "Cargando…";

    try {
      const { users, invites } = await loadUsersAndInvitesOnce();

      if (invitesWrap) {
        invitesWrap.innerHTML =
          invites.length === 0
            ? `<div style="color:#6b7280; font-size:0.9rem;">Sin invitaciones.</div>`
            : invites
                .map((inv) => {
                  const exp = inv.expiresAt ? formatDate(inv.expiresAt) : "";
                  return `
                  <div class="card" style="margin-top:10px;">
                    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
                      <div>
                        <div style="font-weight:700;">${escapeHtml(inv.email || "")}</div>
                        <div style="font-size:0.85rem; color:#6b7280;">
                          Rol: <b>${escapeHtml(inv.role || "")}</b> · Estado: <b>${escapeHtml(inv.status || "")}</b>
                        </div>
                        <div style="font-size:0.85rem; color:#6b7280;">Caduca: ${escapeHtml(exp)}</div>
                      </div>
                      <div style="display:flex; gap:8px;">
                        <button class="btn btn-secondary btn-sm" data-action="deleteInvite" data-id="${escapeHtml(
                          inv.id
                        )}">Borrar</button>
                      </div>
                    </div>
                  </div>
                `;
                })
                .join("");
      }

      if (usersWrap) {
        usersWrap.innerHTML =
          users.length === 0
            ? `<div style="color:#6b7280; font-size:0.9rem;">Sin usuarios.</div>`
            : users
                .map((u) => {
                  const uid = u.id;
                  const email = u.email || "";
                  const role = normalizeRole(u.role) || "";
                  const active = u.active !== false;

                  const roleOptions = ROLES.map(
                    (r) =>
                      `<option value="${r}" ${
                        r === role ? "selected" : ""
                      }>${r}</option>`
                  ).join("");

                  return `
                  <div class="card" style="margin-top:10px;">
                    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
                      <div>
                        <div style="font-weight:700;">${escapeHtml(email)}</div>
                        <div style="font-size:0.85rem; color:#6b7280;">UID: ${escapeHtml(uid)}</div>
                        <div style="font-size:0.85rem; color:#6b7280;">
                          Activo: <b style="color:${active ? "#16a34a" : "#ef4444"};">${
                    active ? "Sí" : "No"
                  }</b>
                        </div>
                      </div>

                      <div style="min-width:280px; display:flex; flex-direction:column; gap:8px;">
                        <div style="display:flex; gap:8px; align-items:center;">
                          <label style="font-size:0.85rem; color:#6b7280; min-width:44px;">Rol</label>
                          <select class="form-control" data-role-select="${escapeHtml(
                            uid
                          )}">
                            ${roleOptions}
                          </select>
                          <button class="btn btn-primary btn-sm" data-action="saveRole" data-id="${escapeHtml(
                            uid
                          )}">Guardar</button>
                        </div>

                        <div style="display:flex; gap:8px;">
                          <button class="btn btn-secondary btn-sm" data-action="toggleActive" data-id="${escapeHtml(
                            uid
                          )}" data-active="${active ? "1" : "0"}">
                            ${active ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
                })
                .join("");
      }

      if (status) status.textContent = "OK";
    } catch (e) {
      console.error("AdminUsers refresh error:", e);
      if (status) status.textContent = "Error cargando datos.";
    }
  }

  function wireActions(container) {
    if (!container || container._wiredAdminUsers) return;
    container._wiredAdminUsers = true;

    container.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.("button[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");

      try {
        if (action === "deleteInvite") {
          await deleteInvite(id);
          await refresh();
          return;
        }

        if (action === "saveRole") {
          const sel = container.querySelector(`select[data-role-select="${id}"]`);
          const role = sel ? sel.value : "ACCOUNT_MANAGER";
          await updateUserRole(id, role);
          await refresh();
          return;
        }

        if (action === "toggleActive") {
          const current = btn.getAttribute("data-active") === "1";
          await setUserActive(id, !current);
          await refresh();
          return;
        }
      } catch (e) {
        console.error("AdminUsers action error:", e);
        alert("No se pudo completar la acción.");
      }
    });

    // Crear invitación
    const btnCreate = el("btnCreateInvite");
    if (btnCreate && !btnCreate._wired) {
      btnCreate._wired = true;
      btnCreate.addEventListener("click", async (ev) => {
        ev.preventDefault();

        const email = el("inviteEmail")?.value || "";
        const role = el("inviteRole")?.value || "ACCOUNT_MANAGER";

        const cleanEmail = String(email).trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes("@")) {
          alert("Email no válido.");
          return;
        }

        try {
          await createInvite({ email: cleanEmail, role });
          el("inviteEmail").value = "";
          await refresh();
          alert("Invitación creada en Firestore (pendiente).");
        } catch (e) {
          console.error("createInvite error:", e);
          alert("No se pudo crear la invitación.");
        }
      });
    }

    const btnReload = el("btnReloadUsers");
    if (btnReload && !btnReload._wired) {
      btnReload._wired = true;
      btnReload.addEventListener("click", async (ev) => {
        ev.preventDefault();
        await refresh();
      });
    }
  }

  // ==========================
  // Render principal
  // ==========================
  window.renderAdminUsersView = function renderAdminUsersView() {
    const container = document.getElementById("appContent");
    if (!container) return;

    if (!isSuperAdmin()) {
      container.innerHTML = `
        <div class="page-title">Usuarios</div>
        <div class="card">
          <div class="card-header">Acceso denegado</div>
          <div style="color:#6b7280; font-size:0.9rem;">
            Esta página es solo para SUPER_ADMIN.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="page-title">Usuarios</div>
      <div class="page-subtitle">Alta y gestión de roles/permisos (Firestore).</div>

      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span>Crear invitación (por defecto: ACCOUNT_MANAGER)</span>
          <span id="adminUsersStatus" style="font-size:0.85rem; color:#6b7280;">—</span>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
          <div style="flex:1; min-width:240px;">
            <label style="font-size:0.85rem; color:#6b7280;">Email</label>
            <input id="inviteEmail" type="email" placeholder="usuario@empresa.com" />
          </div>

          <div style="min-width:220px;">
            <label style="font-size:0.85rem; color:#6b7280;">Rol</label>
            <select id="inviteRole">
              ${ROLES.filter((r) => r !== "SUPER_ADMIN")
                .map(
                  (r) =>
                    `<option value="${r}" ${
                      r === "ACCOUNT_MANAGER" ? "selected" : ""
                    }>${r}</option>`
                )
                .join("")}
            </select>
          </div>

          <div style="display:flex; gap:8px;">
            <button id="btnCreateInvite" class="btn btn-primary">Crear</button>
            <button id="btnReloadUsers" class="btn btn-secondary">Refrescar</button>
          </div>
        </div>

        <div style="margin-top:10px; font-size:0.85rem; color:#6b7280;">
          Nota: Esto crea una “invitación” en Firestore. El envío de email + creación en Auth vendrá después (Cloud Functions).
        </div>
      </div>

      <div class="page-title" style="margin-top:18px; font-size:1.05rem;">Invitaciones</div>
      <div id="adminInvitesList"></div>

      <div class="page-title" style="margin-top:18px; font-size:1.05rem;">Usuarios (Auth ya creado)</div>
      <div id="adminUsersList"></div>
    `;

    wireActions(container);
    refresh();
  };

  console.log(
    "%cUI Admin Users cargada (ui_admin_users.js)",
    "color:#0ea5e9; font-weight:600;"
  );
})();
