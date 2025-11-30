// js/ui_proyecto.js
// Pantalla de PROYECTO: importar Excel y guardar en appState + localStorage

// Aseguramos estructura mínima
window.appState = window.appState || {};
appState.proyecto = appState.proyecto || {
  filas: [],
  archivoNombre: null,
  fechaImportacion: null,
};

function getAppContent() {
  return document.getElementById("appContent");
}

function setSubtitleProyecto() {
  const sub = document.getElementById("currentViewSubtitle");
  if (sub) {
    sub.textContent =
      "Paso 1 · Importa el Excel del proyecto para poder generar el presupuesto con la tarifa 2N.";
  }
}

// ====================
// RENDER PRINCIPAL
// ====================

function renderProyectoView() {
  const container = getAppContent();
  if (!container) return;

  setSubtitleProyecto();

  container.innerHTML = `
    <div class="proyecto-layout">

      <!-- Card de importación -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Proyecto</div>
            <div class="card-subtitle">
              Importa el Excel del proyecto con las referencias y cantidades.
            </div>
          </div>
          <span class="chip">Paso 1 de 3</span>
        </div>

        <div class="card-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Archivo de proyecto (Excel o CSV)</label>
              <p style="font-size:0.78rem; color:#6b7280; margin-bottom:0.45rem;">
                El archivo debe incluir al menos las columnas
                <strong>Referencia</strong> y <strong>Cantidad</strong>.
                Opcionalmente puede incluir <strong>Descripción</strong>.
              </p>

              <input id="proyectoFileInput" type="file" accept=".xlsx,.xls,.csv" />

              <button id="btnProcesarProyecto" class="btn btn-primary mt-3">
                Procesar proyecto
              </button>
            </div>
          </div>

          <div id="proyectoMensaje" class="alert alert-info mt-3" style="display:none;"></div>
        </div>
      </div>

      <!-- Card de estado -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Estado del proyecto</div>
        </div>
        <div class="card-body" id="proyectoEstado">
          Todavía no se ha importado ningún proyecto.
        </div>
      </div>

    </div>
  `;

  // Eventos
  const btnProcesar = document.getElementById("btnProcesarProyecto");
  if (btnProcesar) {
    btnProcesar.addEventListener("click", onProcesarProyectoClick);
  }

  // Si hay proyecto en localStorage, cargarlo
  cargarProyectoDesdeCache();
  actualizarEstadoProyecto();
}

// ====================
// MANEJO DE IMPORTACIÓN
// ====================

async function onProcesarProyectoClick() {
  const fileInput = document.getElementById("proyectoFileInput");
  const msg = document.getElementById("proyectoMensaje");

  if (msg) {
    msg.style.display = "none";
    msg.textContent = "";
  }

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    if (msg) {
      msg.className = "alert alert-error mt-3";
      msg.textContent = "Selecciona un archivo antes de procesar.";
      msg.style.display = "flex";
    }
    return;
  }

  const file = fileInput.files[0];

  try {
    const filas = await leerProyectoDesdeExcel(file);

    if (!filas || filas.length === 0) {
      if (msg) {
        msg.className = "alert alert-error mt-3";
        msg.textContent =
          "No se han encontrado filas válidas. Revisa que existan columnas 'Referencia' y 'Cantidad'.";
        msg.style.display = "flex";
      }
      return;
    }

    appState.proyecto = {
      filas,
      archivoNombre: file.name,
      fechaImportacion: new Date().toISOString(),
    };

    // Guardar en localStorage
    try {
      localStorage.setItem(
        PROYECTO_CACHE_KEY,
        JSON.stringify(appState.proyecto)
      );
    } catch (e) {
      console.warn("No se pudo guardar el proyecto en localStorage:", e);
    }

    if (msg) {
      msg.className = "alert alert-success mt-3";
      msg.textContent = `Proyecto importado correctamente: ${filas.length} líneas.`;
      msg.style.display = "flex";
    }

    actualizarEstadoProyecto();
  } catch (err) {
    console.error("Error procesando proyecto:", err);
    if (msg) {
      msg.className = "alert alert-error mt-3";
      msg.textContent =
        "Se ha producido un error al leer el archivo. Revisa que el formato sea correcto.";
      msg.style.display = "flex";
    }
  }
}

// Lee el Excel usando SheetJS
function leerProyectoDesdeExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });

        // Primera hoja
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const filas = json
          .map((row) => {
            // Flexibilidad en nombres de columnas
            const ref =
              row["Referencia"] ||
              row["REF"] ||
              row["Ref"] ||
              row["Referencia 2N"] ||
              row["Referencia_2N"] ||
              row["Codigo"] ||
              row["Código"] ||
              "";

            const cant =
              row["Cantidad"] ||
              row["Cant"] ||
              row["QTY"] ||
              row["Qty"] ||
              row["Unidades"] ||
              row["Und"] ||
              "";

            const desc =
              row["Descripción"] ||
              row["Descripcion"] ||
              row["DESCRIPCION"] ||
              row["DESCRIPCIÓN"] ||
              row["Nombre producto"] ||
              row["Producto"] ||
              "";

            const referencia = normalizarRef(ref);
            const cantidad = Number(cant) || 0;

            return {
              referencia,
              cantidad,
              descripcion: limpiarTexto(desc),
            };
          })
          .filter((r) => r.referencia && r.cantidad > 0);

        resolve(filas);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = function (err) {
      reject(err);
    };

    reader.readAsArrayBuffer(file);
  });
}

// ====================
// CACHE LOCAL
// ====================

function cargarProyectoDesdeCache() {
  try {
    const cached = localStorage.getItem(PROYECTO_CACHE_KEY);
    if (!cached) return;

    const data = JSON.parse(cached);
    if (!data || !Array.isArray(data.filas)) return;

    appState.proyecto = {
      filas: data.filas,
      archivoNombre: data.archivoNombre || null,
      fechaImportacion: data.fechaImportacion || null,
    };
  } catch (e) {
    console.warn("No se pudo cargar proyecto desde cache:", e);
  }
}

// ====================
// ESTADO VISUAL
// ====================

function actualizarEstadoProyecto() {
  const estado = document.getElementById("proyectoEstado");
  if (!estado) return;

  const proyecto = appState.proyecto;
  if (!proyecto || !proyecto.filas || proyecto.filas.length === 0) {
    estado.textContent = "Todavía no se ha importado ningún proyecto.";
    return;
  }

  const numFilas = proyecto.filas.length;
  const nombre = proyecto.archivoNombre || "Proyecto";
  const fecha = proyecto.fechaImportacion
    ? new Date(proyecto.fechaImportacion).toLocaleString("es-ES")
    : "N/D";

  estado.innerHTML = `
    <div class="metric-card">
      <span class="metric-label">Proyecto importado</span>
      <span class="metric-value">${numFilas} líneas</span>
    </div>
    <p class="mt-2" style="font-size:0.82rem; color:#4b5563;">
      Archivo: <strong>${nombre}</strong><br/>
      Importado: ${fecha}
    </p>
  `;
}

console.log(
  "%cUI Proyecto cargada (ui_proyecto.js)",
  "color:#1d4fd8; font-weight:600;"
);
