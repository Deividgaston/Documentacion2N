// js/ui_presupuesto.js
// Pantalla de presupuesto + cálculo

function renderPresupuesto(container) {
  container.innerHTML = `
    <div class="page-header-row">
      <div>
        <div class="page-title">Presupuesto</div>
        <div class="page-subtitle">
          Generador de presupuesto basado en PVP, descuento global e IVA opcional.
        </div>
      </div>
      <div id="summaryChip" class="summary-chip hidden"></div>
    </div>

    <div class="layout-presupuesto">
      
      <!-- COLUMNA IZQUIERDA -->
      <div class="presupuesto-side">

        <!-- DATOS DEL PRESUPUESTO -->
        <div class="card card-soft">
          <div class="card-header-row">
            <span class="card-header">Datos del presupuesto</span>
            <span class="badge-light">Cabecera</span>
          </div>

          <div class="form-grid">
            <div>
              <label>Cliente</label>
              <input type="text" id="p_cliente" class="input" value="${appState.infoPresupuesto.cliente}">
            </div>
            <div>
              <label>Proyecto / Obra</label>
              <input type="text" id="p_proyecto" class="input" value="${appState.infoPresupuesto.proyecto}">
            </div>
            <div>
              <label>Dirección</label>
              <input type="text" id="p_direccion" class="input" value="${appState.infoPresupuesto.direccion}">
            </div>
            <div>
              <label>Persona de contacto</label>
              <input type="text" id="p_contacto" class="input" value="${appState.infoPresupuesto.contacto}">
            </div>
            <div>
              <label>Email del contacto</label>
              <input type="email" id="p_email" class="input" value="${appState.infoPresupuesto.email}">
            </div>
            <div>
              <label>Teléfono</label>
              <input type="text" id="p_telefono" class="input" value="${appState.infoPresupuesto.telefono}">
            </div>
          </div>

          <label style="margin-top:16px;">Notas adicionales:</label>
          <textarea id="p_notas" class="input textarea-notas">${appState.infoPresupuesto.notas}</textarea>

          <button class="btn btn-blue btn-full" style="margin-top:16px;" id="btnGuardarDatos">
            Guardar datos
          </button>
        </div>

        <!-- OPCIONES DE CÁLCULO -->
        <div class="card card-soft">
          <div class="card-header-row">
            <span class="card-header">Parámetros económicos</span>
            <span class="badge-light">Cálculo</span>
          </div>

          <label>Rol (referencia interna):</label>
          <select id="rolSelect" class="input">
            <option value="pvp" ${appState.rol === "pvp" ? "selected" : ""}>PVP (sin márgenes)</option>
            <option value="distribuidor" ${appState.rol === "distribuidor" ? "selected" : ""}>Distribuidor</option>
            <option value="subdistribuidor" ${appState.rol === "subdistribuidor" ? "selected" : ""}>Subdistribuidor</option>
            <option value="integrador" ${appState.rol === "integrador" ? "selected" : ""}>Integrador</option>
            <option value="promotora" ${appState.rol === "promotora" ? "selected" : ""}>Promotora / Constructora</option>
          </select>

          <div class="form-inline">
            <div style="flex:1;">
              <label style="margin-top:12px;">Descuento global (%):</label>
              <input type="number" id="descuentoGlobal" class="input" value="${appState.descuentoGlobal}" />
            </div>
            <div class="checkbox-row">
              <label>
                <input type="checkbox" id="aplicarIVA" ${appState.aplicarIVA ? "checked" : ""}/>
                Aplicar IVA (21%)
              </label>
            </div>
          </div>

          <button class="btn btn-blue btn-full" style="margin-top:12px;" id="btnRecalcular">
            Recalcular totales
          </button>
        </div>

        <!-- TOTALES -->
        <div class="card card-highlight">
          <div class="card-header-row">
            <span class="card-header">Resumen económico</span>
          </div>
          <div id="totalesPresupuesto" class="totales-grid"></div>

          <div class="export-buttons">
            <button class="btn btn-blue" id="btnPdf">Exportar PDF</button>
            <button class="btn btn-blue btn-outline" id="btnExcel">Exportar Excel</button>
          </div>
        </div>

      </div>

      <!-- COLUMNA DERECHA: LÍNEAS -->
      <div class="presupuesto-main">
        <div class="card">
          <div class="card-header-row">
            <span class="card-header">Líneas del presupuesto</span>
            <span class="subtext-lines" id="linesInfo"></span>
          </div>
          <div id="tablaPresupuesto"></div>
        </div>
      </div>

    </div>
  `;

  document.getElementById("btnGuardarDatos").onclick = () => {
    appState.infoPresupuesto.cliente = document.getElementById("p_cliente").value;
    appState.infoPresupuesto.proyecto = document.getElementById("p_proyecto").value;
    appState.infoPresupuesto.direccion = document.getElementById("p_direccion").value;
    appState.infoPresupuesto.contacto = document.getElementById("p_contacto").value;
    appState.infoPresupuesto.email = document.getElementById("p_email").value;
    appState.infoPresupuesto.telefono = document.getElementById("p_telefono").value;
    appState.infoPresupuesto.notas = document.getElementById("p_notas").value;
    alert("Datos del presupuesto guardados.");
  };

  document.getElementById("btnRecalcular").onclick = () => {
    appState.rol = document.getElementById("rolSelect").value;
    appState.descuentoGlobal = Number(
      document.getElementById("descuentoGlobal").value || 0
    );
    appState.aplicarIVA = document.getElementById("aplicarIVA").checked;
    recalcularPresupuesto();
  };

  document.getElementById("btnPdf").onclick = () => generarPDF();
  document.getElementById("btnExcel").onclick = () => generarExcel();

  recalcularPresupuesto();
}

function recalcularPresupuesto() {
  const contTabla = document.getElementById("tablaPresupuesto");
  const contTotales = document.getElementById("totalesPresupuesto");
  const summaryChip = document.getElementById("summaryChip");
  const linesInfo = document.getElementById("linesInfo");

  if (!appState.lineasProyecto.length) {
    contTabla.innerHTML = `<p style="color:#666;">No hay líneas importadas desde el proyecto.</p>`;
    contTotales.innerHTML = "";
    if (summaryChip) summaryChip.classList.add("hidden");
    if (linesInfo) linesInfo.textContent = "";
    return;
  }

  let html = `
    <div class="table-wrapper">
      <table class="table-simple">
        <thead>
          <tr>
            <th>Referencia</th>
            <th>Descripción</th>
            <th class="text-right">Cant.</th>
            <th class="text-right">PVP</th>
            <th class="text-right">Total línea</th>
          </tr>
        </thead>
        <tbody>
  `;

  let subtotal = 0;

  appState.lineasProyecto.forEach((l) => {
    const pvp = Number(l.pvp || 0);
    const totalLinea = pvp * l.cantidad;
    subtotal += totalLinea;

    html += `
      <tr>
        <td>${l.referencia}</td>
        <td>${l.nombreTarifa}</td>
        <td class="text-right">${l.cantidad}</td>
        <td class="text-right">${pvp.toFixed(2)} €</td>
        <td class="text-right">${totalLinea.toFixed(2)} €</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  contTabla.innerHTML = html;

  const descuentoEur = subtotal * (appState.descuentoGlobal / 100);
  const baseImponible = subtotal - descuentoEur;
  let iva = 0;
  if (appState.aplicarIVA) iva = baseImponible * 0.21;
  const totalFinal = baseImponible + iva;

  contTotales.innerHTML = `
    <div class="totales-row">
      <span>Subtotal</span>
      <span>${subtotal.toFixed(2)} €</span>
    </div>
    <div class="totales-row">
      <span>Descuento (${appState.descuentoGlobal}%)</span>
      <span>- ${descuentoEur.toFixed(2)} €</span>
    </div>
    <div class="totales-row">
      <span>Base imponible</span>
      <span>${baseImponible.toFixed(2)} €</span>
    </div>
    <div class="totales-row">
      <span>IVA (21%)</span>
      <span>${iva.toFixed(2)} €</span>
    </div>
    <div class="totales-row totales-row-total">
      <span>TOTAL</span>
      <span>${totalFinal.toFixed(2)} €</span>
    </div>
  `;

  if (summaryChip) {
    summaryChip.classList.remove("hidden");
    summaryChip.innerHTML = `
      <span>${appState.lineasProyecto.length} líneas</span>
      <span class="dot"></span>
      <span>Subtotal: ${subtotal.toFixed(0)} €</span>
    `;
  }

  if (linesInfo) {
    linesInfo.textContent = `${appState.lineasProyecto.length} líneas cargadas desde el Excel del proyecto`;
  }
}
