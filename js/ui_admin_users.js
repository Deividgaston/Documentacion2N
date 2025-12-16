// js/ui_admin_users.js
// Vista: Configuración de usuarios (solo superadmin)

function renderAdminUsersView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  container.innerHTML = `
    <div class="page-title">Usuarios</div>
    <div class="page-subtitle">
      Configuración de usuarios y permisos (solo superadministrador).
    </div>

    <div class="card">
      <div class="card-header">Estado</div>
      <div style="font-size:0.9rem; color:#374151;">
        Esta pantalla está creada y conectada al router.
        <br/>
        Siguiente paso: alta de usuarios + roles + email invitación (24h) con Cloud Functions.
      </div>
    </div>
  `;
}

console.log(
  "%cUI Admin Users cargada (ui_admin_users.js)",
  "color:#0ea5e9; font-weight:600;"
);
