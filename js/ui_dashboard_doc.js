// js/ui_dashboard_doc.js
// Solo pantalla de Documentación para el programa de Presupuestos

function renderDoc(container) {
  container.innerHTML = `
    <div class="page-title">Documentación</div>
    <div class="page-subtitle">
      Hojas técnicas, declaraciones de conformidad y memoria descriptiva.
      (Pendiente de implementar: aquí solo definimos el diseño base.)
    </div>

    <div class="card">
      <div class="card-header">Documentación del sistema 2N</div>
      <p style="font-size:0.9rem; color:#6b7280; margin-top:4px;">
        En esta sección añadiremos:
      </p>
      <ul style="font-size:0.9rem; color:#4b5563; margin-top:8px; padding-left:18px;">
        <li>Hojas de datos de los dispositivos 2N incluidos en el presupuesto.</li>
        <li>Declaraciones de conformidad y certificados necesarios.</li>
        <li>Memoria descriptiva generada automáticamente a partir del proyecto.</li>
      </ul>
      <p style="font-size:0.85rem; color:#9ca3af; margin-top:10px;">
        * De momento esta pantalla es estática. Más adelante conectaremos con Firestore o con una
        carpeta de documentación para generar PDFs y dossiers completos de forma automática.
      </p>
    </div>
  `;
}
