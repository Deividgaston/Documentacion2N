// js/ui_dashboard_doc.js
// Dashboard + Documentación + Pipeline (Kanban estilo Salesforce)

function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-title">Dashboard general</div>
    <div class="page-subtitle">
      Vista rápida de proyectos, encaje 2N y notas rápidas.
    </div>

    <div class="card-grid-3">
      <div class="card kpi-card">
        <div class="kpi-label">Proyectos totales</div>
        <div class="kpi-value">30</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-label">En curso</div>
        <div class="kpi-value kpi-ok">26</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-label">Perdidos</div>
        <div class="kpi-value kpi-bad">4</div>
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <div class="card-header">Resumen</div>
      <p style="font-size:0.9rem; color:#6b7280; margin-top:4px;">
        Este dashboard es solo informativo. El núcleo del programa está en
        <strong>Proyecto</strong>, <strong>Presupuesto</strong> y <strong>Pipeline</strong>.
      </p>
    </div>
  `;
}

function renderDoc(container) {
  container.innerHTML = `
    <div class="page-title">Documentación</div>
    <div class="page-subtitle">
      Hojas técnicas, declaraciones de conformidad y memoria descriptiva (pendiente de implementar).
    </div>

    <div class="card">
      <div class="card-header">Próximamente</div>
      <p style="font-size:0.9rem; color:#6b7280; margin-top:4px;">
        Aquí añadiremos la selección de fichas técnicas 2N, declaraciones CE y una memoria descriptiva
        generada automáticamente a partir del proyecto.
      </p>
    </div>
  `;
}

// ===============================
// PIPELINE / KANBAN (estilo Salesforce)
// ===============================
function renderPipeline(container) {
  container.innerHTML = `
    <div class="page-title">Pipeline</div>
    <div class="page-subtitle">
      Vista Kanban de oportunidades de prescripción / proyectos 2N.
    </div>

    <div class="kanban-board">
      ${kanbanColumn("Prospección", "prospeccion", [
        "Residencial BTR Málaga - consulta inicial",
        "Hotel 160 habitaciones - primera llamada"
      ])}
      ${kanbanColumn("Oferta enviada", "oferta", [
        "Residencial premium Madrid - oferta 2N enviada",
        "Coliving Valencia - en estudio por cliente"
      ])}
      ${kanbanColumn("Pendiente respuesta", "pendiente", [
        "Hospital Barcelona - espera de feedback",
        "Residencial Mallorca - revisión de memoria"
      ])}
      ${kanbanColumn("Negociación", "negociacion", [
        "BTR Fuengirola - ajustes de alcance",
        "Oficinas Madrid - integración con control de ascensores"
      ])}
      ${kanbanColumn("Ganado", "ganado", [
        "Residencial lujo Marbella - IP Style + Access Unit M",
        "Apartamentos turísticos Sevilla - 2N + PMS"
      ])}
      ${kanbanColumn("Perdido", "perdido", [
        "Residencial Bilbao - eligieron otra solución"
      ])}
    </div>

    <p style="font-size:0.85rem; color:#9ca3af; margin-top:10px;">
      * Por ahora los datos del Kanban son de ejemplo y solo sirven como referencia visual. Más adelante
      podemos conectarlo a Firestore o al propio CRM.
    </p>
  `;
}

function kanbanColumn(titulo, id, items) {
  const cards = items
    .map(
      (txt) => `
      <div class="kanban-card">
        <div class="kanban-card-title">${txt}</div>
        <div class="kanban-card-meta">Sincronizado con 2N Prescripción</div>
      </div>
    `
    )
    .join("");

  return `
    <div class="kanban-column" data-col="${id}">
      <div class="kanban-column-header">
        <span class="kanban-column-title">${titulo}</span>
        <span class="kanban-count">${items.length}</span>
      </div>
      <div class="kanban-column-body">
        ${cards || '<div class="kanban-empty">Sin proyectos en esta fase</div>'}
      </div>
    </div>
  `;
}
