// js/ui_shell.js
// Layout principal + navegación superior del programa de PRESUPUESTOS

function setActiveTab(tab) {
  appState.activeTab = tab;
  renderShell();
}

function renderShell() {
  clearApp();

  const shell = el("div", "app-shell");

  // ========== BARRA SUPERIOR ==========
  const nav = el("div", "main-nav");

  // IZQUIERDA: logo + tabs
  const navLeft = el("div", "nav-left");

  const brand = el("div", "nav-brand", "2N · Presupuestos");
  navLeft.appendChild(brand);

  const navTabs = el("div", "nav-tabs");

  const tabs = [
    { id: "proyecto", label: "Proyecto" },
    { id: "presupuesto", label: "Presupuesto" },
    { id: "tarifa", label: "Tarifa 2N" },
    { id: "doc", label: "Documentación" },
  ];

  tabs.forEach((t) => {
    const tabEl = el(
      "div",
      "nav-tab" + (appState.activeTab === t.id ? " active" : ""),
      t.label
    );
    tabEl.addEventListener("click", () => setActiveTab(t.id));
    navTabs.appendChild(tabEl);
  });

  navLeft.appendChild(navTabs);

  // DERECHA: información usuario (simple)
  const navRight = el("div", "nav-right");
  const userEmail = appState.user && appState.user.email ? appState.user.email : "Modo local";
  navRight.appendChild(el("span", "", userEmail));

  nav.appendChild(navLeft);
  nav.appendChild(navRight);

  // ========== MAIN CONTENT ==========
  const main = el("div", "main-content");
  main.id = "mainContent";

  shell.appendChild(nav);
  shell.appendChild(main);

  appRoot.appendChild(shell);

  renderActiveView();
}

function renderActiveView() {
  const c = document.getElementById("mainContent");
  if (!c) return;

  c.innerHTML = "";

  if (appState.activeTab === "proyecto") {
    renderProyecto(c);
  } else if (appState.activeTab === "presupuesto") {
    renderPresupuesto(c);
  } else if (appState.activeTab === "tarifa") {
    if (typeof renderTarifas === "function") {
      renderTarifas(c);
    } else {
      c.innerHTML = "<p>No hay vista de tarifas definida.</p>";
    }
  } else if (appState.activeTab === "doc") {
    if (typeof renderDoc === "function") {
      renderDoc(c);
    } else {
      c.innerHTML = "<p>No hay vista de documentación definida.</p>";
    }
  } else {
    // fallback
    renderProyecto(c);
  }
}
