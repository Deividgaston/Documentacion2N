// js/ui_simulador.js
// Simulador de márgenes por rol a partir del presupuesto actual

window.appState = window.appState || {};

function renderSimuladorView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  container.innerHTML = `
    <div class="presupuesto-layout">

      <!-- COLUMNA IZQUIERDA: parámetros de simulación -->
      <div class="presupuesto-left-column">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Simulador de márgenes</div>
              <div class="card-subtitle">
                Define los márgenes para cada rol y obtén precios de compra sobre el presupuesto actual.
              </div>
            </div>
          </div>
          <div class="card-body">
            <div class="form-grid">
              <div class="form-group">
                <label>Margen distribuidor (%)</label>
                <input id="simMargDist" type="number" min="0" max="80" value="25" />
              </div>
              <div class="form-group">
                <label>Margen integrador / instalador (%)</label>
                <input id="simMargInt" type="number" min="0" max="80" value="15" />
              </div>
              <div class="form-group">
                <label>Margen partner / ingeniería (%)</label>
                <input id="simMargPartner" type="number" min="0" max="80" value="10" />
              </div>
              <div class="form-group">
                <label>Descuento global presupuesto (%)</label>
                <input id="simDto" type="number" min="0" max="90" value="0" />
              </div>
            </div>

            <p style="font-size:0.8rem; color:#6b7280; margin-top:0.5rem;">
              El PVP base se toma de las líneas del presupuesto actual.
              Los precios de compra se calculan aplicando los márgenes de forma encadenada:
              2N → Distribuidor → Integrador → Partner.
            </p>

            <button id="btnSimCalcular" class="btn btn-primary w-full mt-3">
              Calcular simulación
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Resumen por rol</div>
          </div>
          <div class="card-body" id="simResumen">
            Genera primero la simulación.
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA: tabla detallada -->
      <div class="presupuesto-right-column">
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              Líneas simuladas
            </div>
          </div>
          <div class="card-body" id="simDetalle">
            Para usar el simulador, primero genera un presupuesto en la pestaña "Presupuesto".
          </div>
        </div>
      </div>

    </div>
  `;

  const btn = document.getElementById("btnSimCalcular");
  if (btn) {
    btn.addEventListener("click", simRecalcular);
  }

  const presu = appState.presupuesto;
  if (presu && presu.lineas && presu.lineas.length) {
    const d = document.getElementById("simDetalle");
    if (d) {
      d.textContent =
        'Pulsa "Calcular simulación" para ver los precios por rol.';
    }
  }
}

function simRecalcular() {
  const presu = appState.presupuesto;
  const detalle = document.getElementById("simDetalle");
  const resumen = document.getElementById("simResumen");

  if (!presu || !presu.lineas || !presu.lineas.length) {
    if (detalle) {
      detalle.textContent =
        "No hay líneas de presupuesto. Genera primero un presupuesto desde la pestaña 'Presupuesto'.";
    }
    if (resumen) {
      resumen.textContent = "";
    }
    return;
  }

  const margDist = Number(document.getElementById("simMargDist").value) || 0;
  const margInt = Number(document.getElementById("simMargInt").value) || 0;
  const margPartner =
    Number(document.getElementById("simMargPartner").value) || 0;
  const dtoGlobal = Number(document.getElementById("simDto").value) || 0;

  const factorDto = dtoGlobal > 0 ? 1 - dtoGlobal / 100 : 1;

  let total2N = 0;
  let totalDist = 0;
  let totalInt = 0;
  let totalPartner = 0;

  let html = `
    <table class="table">
      <thead>
        <tr>
          <th>Ref.</th>
          <th>Descripción</th>
          <th style="width:70px;">Ud.</th>
          <th style="width:90px;">PVP</th>
          <th style="width:90px;">Distribuidor</th>
          <th style="width:90px;">Integrador</th>
          <th style="width:90px;">Partner</th>
        </tr>
      </thead>
      <tbody>
  `;

  presu.lineas.forEach((l) => {
    const pvpBase = l.pvp || 0;
    const cantidad = l.cantidad || 0;
    const pvpConDto = pvpBase * factorDto;

    const precioDist = pvpConDto * (1 - margDist / 100);
    const precioInt = precioDist * (1 - margInt / 100);
    const precioPartner = precioInt * (1 - margPartner / 100);

    total2N += pvpConDto * cantidad;
    totalDist += precioDist * cantidad;
    totalInt += precioInt * cantidad;
    totalPartner += precioPartner * cantidad;

    html += `
      <tr>
        <td>${l.ref}</td>
        <td>${l.descripcion}</td>
        <td>${cantidad}</td>
        <td>${pvpConDto.toFixed(2)} €</td>
        <td>${precioDist.toFixed(2)} €</td>
        <td>${precioInt.toFixed(2)} €</td>
        <td>${precioPartner.toFixed(2)} €</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  if (detalle) detalle.innerHTML = html;

  if (resumen) {
    resumen.innerHTML = `
      <div class="metric-card">
        <span class="metric-label">Total PVP (tras descuento global)</span>
        <span class="metric-value">${total2N.toFixed(2)} €</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Coste para distribuidor</span>
        <span class="metric-value">${totalDist.toFixed(2)} €</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Coste para integrador / instalador</span>
        <span class="metric-value">${totalInt.toFixed(2)} €</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Coste para partner / ingeniería</span>
        <span class="metric-value">${totalPartner.toFixed(2)} €</span>
      </div>
      <p style="font-size:0.8rem; color:#6b7280; margin-top:0.5rem;">
        Los márgenes se aplican de forma encadenada: primero distribuidor, luego integrador, luego partner.
      </p>
    `;
  }
}

console.log(
  "%cUI Simulador cargado (ui_simulador.js)",
  "color:#10b981;"
);
window.renderSimuladorView = renderSimuladorView;
