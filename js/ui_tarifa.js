// js/ui_tarifa.js
// Pantalla TARIFA: muestra cuántas referencias hay en la base de datos (tarifa 2N)

window.appState = window.appState || {};
appState.tarifas = appState.tarifas || {};

// ====================
// RENDER PRINCIPAL
// ====================

function renderTarifaView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  container.innerHTML = `
    <div class="proyecto-layout">

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Tarifa 2N</div>
            <div class="card-subtitle">
              Información general de la tarifa guardada en la base de datos.
            </div>
          </div>
        </div>

        <div class="card-body" id="tarifaEstado">
          Cargando información de la tarifa 2N...
        </div>
      </div>

    </div>
  `;

  // Cargar info de la tarifa (con caché y mínima lectura a Firestore)
  cargarInfoTarifa();
}

// ====================
// CARGA Y PINTADO
// ====================

async function cargarInfoTarifa() {
  const estado = document.getElementById("tarifaEstado");
  if (!estado) return;

  try {
    const tarifas = await getTarifas(); // usa caché + 1 lectura Firestore como máximo
    const numRefs = tarifas ? Object.keys(tarifas).length : 0;

    if (!tarifas || numRefs === 0) {
      estado.innerHTML = `
        <p style="font-size:0.85rem; color:#4b5563;">
          No se han encontrado referencias en la tarifa 2N.
        </p>
        <p style="font-size:0.8rem; color:#6b7280; margin-top:0.35rem;">
          Revisa en Firebase la colección <code>tarifas/v1</code> o sube la tarifa desde la herramienta de administración.
        </p>
      `;
      return;
    }

    estado.innerHTML = `
      <div class="metric-card">
        <span class="metric-label">Referencias en tarifa 2N</span>
        <span class="metric-value">${numRefs.toLocaleString("es-ES")}</span>
      </div>

      <p class="mt-2" style="font-size:0.82rem; color:#4b5563;">
        Las referencias se cargan desde la colección
        <strong>tarifas &gt; v1</strong> en Firestore, con caché local para minimizar lecturas.
      </p>
    `;
  } catch (err) {
    console.error("Error cargando información de tarifa:", err);
    estado.innerHTML = `
      <div class="alert alert-error">
        No se ha podido obtener la información de la tarifa 2N.
      </div>
    `;
  }
}

console.log(
  "%cUI Tarifa cargada (ui_tarifa.js)",
  "color:#eab308; font-weight:600;"
);
