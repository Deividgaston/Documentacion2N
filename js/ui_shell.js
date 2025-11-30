// js/ui_shell.js
// Layout principal + navegación superior del programa de PRESUPUESTOS

function setActiveTab(tab) {
  appState.activeTab = tab;
  renderShell();
}

function renderShell() {
  clearApp();

  const shell = el("div", "app-shell");
  const nav = el("div", "main-nav");

  // IZQUIERDA: logo + tabs
  const navLeft = el("div", "nav-left");
  const brand = el("div", "nav-brand", "Presupuestos 2N");

  const tabs = el("div", "nav-tabs");
  const items = [
    ["proyecto", "Proyecto"],
    ["presupuesto", "Presupuesto"],
    ["tarifa", "Tarifa 2N"],
    ["doc", "Documentación"]
  ];

  items.forEach(([id, label]) => {
    const t = el(
      "div",
      "nav-tab" + (appState.activeTab === id ? " active" : ""),
      label
    );
    t.onclick = () => setActiveTab(id);
    tabs.appendChild(t);
  });

  navLeft.appendChild(brand);
  navLeft.appendChild(tabs);

  // DERECHA: usuario + logout
  const navRight = el("div", "nav-right");
  navRight.innerHTML = `
    <span>${appState.user?.email || ""}</span>
    <button class="btn-logout" id="btnLogout">Salir</button>
  `;

  nav.appendChild(navLeft);
  nav.appendChild(navRight);

  // CONTENIDO
  const main = el("div", "main-content");
  main.id = "mainContent";

  shell.appendChild(nav);
  shell.appendChild(main);
  appRoot.appendChild(shell);

  document.getElementById("btnLogout").onclick = () => auth.signOut();

  renderActiveView();
}

function renderActiveView() {
  const c = document.getElementById("mainContent");
  c.innerHTML = "";

  if (appState.activeTab === "proyecto") {
    renderProyecto(c);
  } else if (appState.activeTab === "presupuesto") {
    renderPresupuesto(c);
  } else if (appState.activeTab === "tarifa") {
    renderTarifas(c);
  } else if (appState.activeTab === "doc") {
    renderDoc(c);
  }
}
