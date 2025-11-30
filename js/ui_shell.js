// js/ui_shell.js
// Shell principal + navegación

function renderShell() {
  clearApp();

  const shell = el("div", "app-shell");

  // NAVBAR
  const nav = el("div", "main-nav");

  const left = el("div", "nav-left");
  const brand = el("div", "brand-pill", "2N · Presupuestos");
  const title = el("div", "app-title", "Generador de presupuestos");

  const tabs = el("div", "nav-tabs");

  const tabsDef = [
    { id: "proyecto", label: "Proyecto" },
    { id: "presupuesto", label: "Presupuesto" },
    { id: "tarifa", label: "Tarifa 2N" },
    { id: "doc", label: "Documentación" }
  ];

  tabsDef.forEach((t) => {
    const b = el("button", "nav-tab" + (appState.activeTab === t.id ? " active" : ""), t.label);
    b.dataset.tab = t.id;
    b.onclick = () => {
      appState.activeTab = t.id;
      document
        .querySelectorAll(".nav-tab")
        .forEach((x) => x.classList.toggle("active", x.dataset.tab === t.id));
      renderShellContent(); // solo re-render del cuerpo
    };
    tabs.appendChild(b);
  });

  left.appendChild(brand);
  left.appendChild(title);
  left.appendChild(tabs);

  const right = el("div", "nav-right");
  const userChip = el(
    "div",
    "user-chip",
    appState.user ? appState.user.email || appState.user.displayName || "Usuario" : "Invitado"
  );
  const btnLogout = el("button", "btn btn-outline btn-sm", "Cerrar sesión");
  btnLogout.onclick = () => auth.signOut();

  right.appendChild(userChip);
  right.appendChild(btnLogout);

  nav.appendChild(left);
  nav.appendChild(right);

  // MAIN CONTENT
  const main = el("div", "app-main");
  const inner = el("div", "app-inner");
  inner.id = "appContent";
  main.appendChild(inner);

  // FOOTER
  const footer = el(
    "div",
    "app-footer",
    "Presupuestos 2N · Uso interno. Datos y precios orientativos, validar siempre con tarifa actualizada."
  );

  shell.appendChild(nav);
  shell.appendChild(main);
  shell.appendChild(footer);

  appRoot.appendChild(shell);

  renderShellContent();
}

function renderShellContent() {
  const container = document.getElementById("appContent");
  if (!container) return;

  if (appState.activeTab === "proyecto") {
    renderProyecto(container);
  } else if (appState.activeTab === "presupuesto") {
    renderPresupuesto(container);
  } else if (appState.activeTab === "tarifa") {
    renderTarifa(container);
  } else if (appState.activeTab === "doc") {
    renderDashboardDoc(container);
  }
}
