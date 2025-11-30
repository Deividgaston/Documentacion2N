// js/ui_dashboard_doc.js
// Dashboard + Documentación (placeholder)

function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-title">Dashboard general</div>
    <div class="page-subtitle">Resumen del estado del sistema.</div>
    <div class="card">
      <div class="card-header">Estado rápido</div>
      <p style="font-size:0.9rem; color:#6b7280;">
        Importa la tarifa, después el Excel del proyecto y genera el presupuesto en la pestaña "Presupuesto".
      </p>
    </div>
  `;
}

function renderDoc(container) {
  container.innerHTML = `
    <div class="page-title">Documentación</div>
    <div class="page-subtitle">Hojas técnicas, declaraciones de conformidad, etc. (pendiente de implementar).</div>
    <div class="card">
      <div class="card-header">Próximamente</div>
      <p style="font-size:0.9rem; color:#6b7280;">
        Aquí añadiremos la selección de fichas técnicas 2N, declaraciones CE y memoria descriptiva.
      </p>
    </div>
  `;
}
