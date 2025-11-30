// js/ui_shell.js

function setupShellNav() {
  const shell = document.getElementById("appShell");
  if (!shell) return;

  const links = shell.querySelectorAll(".app-nav-link");
  links.forEach((link) => {
    link.addEventListener("click", (ev) => {
      ev.preventDefault();
      const view = link.getAttribute("data-view");
      if (!view) return;

      // Cambiar vista
      selectView(view);

      // Marcar activo en menú
      links.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
    });
  });

  // Logout
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await auth.signOut();
      } catch (err) {
        console.error("Error al cerrar sesión", err);
      }
    });
  }
}

// Cambia la vista actual
function selectView(view) {
  appState.currentView = view;

  switch (view) {
    case "proyecto":
      renderProyectoView();
      break;
    case "presupuesto":
      if (typeof renderPresupuestoView === "function") {
        renderPresupuestoView();
      }
      break;
    case "tarifa":
      if (typeof renderTarifaView === "function") {
        renderTarifaView();
      }
      break;
    case "docs":
      if (typeof renderDocsView === "function") {
        renderDocsView();
      }
      break;
    default:
      renderProyectoView();
  }
}
