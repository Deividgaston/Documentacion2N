// js/ui_shell.js
// Shell de la app: navegación superior + logout + selección de vistas

window.appState = window.appState || {};

// Inicializar shell (se llama tras login correcto)
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

  // Listeners de navegación
  document.querySelectorAll(".top-nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const view = link.getAttribute("data-view");
      if (view) {
        selectView(view);
      }
    });
  });

  // Logout
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await auth.signOut();
      } catch (e) {
        console.error("Error al cerrar sesión:", e);
      }
    });
  }

  // Vista inicial: Proyecto (si no hay otra lógica)
  selectView("proyecto");
}

// Cambiar de vista y marcar pestaña activa
function selectView(viewName) {
  // 1. Render de la vista
  if (viewName === "proyecto" && typeof renderProyectoView === "function") {
    renderProyectoView();
  } else if (
    viewName === "presupuesto" &&
    typeof renderPresupuestoView === "function"
  ) {
    renderPresupuestoView();
  } else if (viewName === "tarifa" && typeof renderTarifaView === "function") {
    renderTarifaView();
  } else if (viewName === "docs" && typeof renderDocumentacionView === "function") {
    renderDocumentacionView();
  }

  // 2. Actualizar pestañas activas
  document.querySelectorAll(".top-nav-link").forEach((el) => {
    el.classList.remove("active");
  });

  const activeTab = document.querySelector(`.top-nav-link[data-view="${viewName}"]`);
  if (activeTab) {
    activeTab.classList.add("active");
  }
}

console.log(
  "%cUI Shell inicializada (ui_shell.js)",
  "color:#4f46e5; font-weight:600;"
);
