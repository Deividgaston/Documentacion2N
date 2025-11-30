// js/ui_shell.js
// Navegación principal (tabs superiores + logout)

function setupShellNav() {
  const shell = document.getElementById("appShell");
  if (!shell) {
    console.error("No se encuentra #appShell en el DOM.");
    return;
  }

  const links = shell.querySelectorAll(".top-nav-link");
  const btnLogout = document.getElementById("btnLogout");

  // Listeners de tabs
  links.forEach((link) => {
    link.addEventListener("click", (ev) => {
      ev.preventDefault();

      const view = link.getAttribute("data-view");
      if (!view) return;

      // Cambiar vista
      selectView(view);

      // Marcar tab activa
      links.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
    });
  });

  // Logout (siempre visible)
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await auth.signOut();
      } catch (err) {
        console.error("Error al cerrar sesión:", err);
      }
    });
  }
}

// Cambia la vista actual según la tab seleccionada
function selectView(view) {
  appState.currentView = view;

  switch (view) {
    case "proyecto":
      if (typeof renderProyectoView === "function") {
        renderProyectoView();
      }
      break;

    case "presupuesto":
      if (typeof renderPresupuestoView === "function") {
        renderPresupuestoView();
      } else {
        console.warn("renderPresupuestoView no está definida.");
      }
      break;

    case "tarifa":
      if (typeof renderTarifaView === "function") {
        renderTarifaView();
      } else {
        console.warn("renderTarifaView no está definida.");
      }
      break;

    case "docs":
      if (typeof renderDocsView === "function") {
        renderDocsView();
      } else {
        console.warn("renderDocsView no está definida.");
      }
      break;

    default:
      if (typeof renderProyectoView === "function") {
        renderProyectoView();
      }
      break;
  }
}

console.log(
  "%cUI shell (tabs + logout) cargada (ui_shell.js)",
  "color:#0f766e; font-weight:600;"
);
