// js/ui_tarifa.js
// Vista simple para ver cuántos productos hay en tarifas/v1

async function renderTarifa(root) {
  root.innerHTML = `
    <h2 class="page-title">Tarifa 2N</h2>
    <p class="page-subtitle">Resumen rápido de la tarifa cargada desde Firestore.</p>
    <div class="card">
      <p id="tarifaInfo">Cargando tarifas...</p>
    </div>
  `;

  await ensureTarifaLoaded();
  const n = tarifaProductosMap ? Object.keys(tarifaProductosMap).length : 0;
  document.getElementById("tarifaInfo").innerText =
    `Productos cargados desde tarifas/v1: ${n}`;
}

window.renderTarifa = renderTarifa;
