// js/ui_proyecto.js

// Asegurar appState básico
window.appState = window.appState || {};
appState.proyecto = appState.proyecto || {
  filas: [],
  archivoNombre: null,
  fechaImportacion: null,
};

// Elementos clave
function getAppContent() {
  return document.getElementById("appContent");
}

function setSubtitleProyecto() {
  const sub = document.getElementById("currentViewSubtitle");
  if (sub) {
    sub.textContent =
      "Importa el Excel del proyecto para generar el presupuesto con la tarifa 2N.";
  }
}

// Render principal de la vista Proyecto
function renderProyectoView() {
  const container = getAppContent();
  if (!container) return;

  setSubtitleProyecto();

  container.innerHTML = `
    <div class="proyecto-layout">

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Proyecto</div>
            <div class="card-subtitle">
              Importa el Excel del proyecto para generar el presupuesto con la tarifa 2N.
            </div>
          </div>
          <div class="chip">Paso 1 de 3</div>
        </div>

        <div class="card-body">

          <div class="form-grid">
            <div class="form-group">
              <label>Importar proyecto</label>
              <p style="font-size:0.78rem; color:#6b7280; margin-bottom:0.5rem;">
                El Excel debe contener al menos las columnas
                <strong>Referencia</strong> y <strong>Cantidad</strong>.
                Opcionalmente también <strong>Descripción</strong>.
              </p>

              <input id="proyectoFileInput" type="file" accept=".xlsx,.xls,.csv" />

              <button id="btnProcesarProyecto" class="btn btn-primary mt-3">
                Procesar proyecto
              </button>
            </div>
          </div>

        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Estado</div>
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

  // Mostrar estado actual si ya había un proyecto cargado
  actualizarEstadoProyecto();
}

// Maneja clic en "Procesar proyecto"
async function onProcesarProyectoClick() {
  const fileInput = document.getElementById("proyectoFileInput");
  const estado = document.getElementById("proyectoEstado");

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    if (estado) {
      estado.textContent = "Selecciona un archivo antes de procesar.";
    }
    return;
  }

  const file = fileInput.files[0];

  try {
    const filas = await leerProyectoDesdeExcel(file);

    if (!filas || filas.length === 0) {
      if (estado) {
        estado.textContent =
          "No se han encontrado filas válidas en el archivo. Revisa que tenga columnas 'Referencia' y 'Cantidad'.";
      }
      return;
    }

    appState.proyecto = {
      filas,
      archivoNombre: file.name,
      fechaImportacion: new Date().toISOString(),
    };

    // Opcional: guardar en localStorage para persistir en la sesión
    try {
      localStorage.setItem(
        "proyecto_actual",
        JSON.stringify(appState.proyecto)
      );
    } catch (e) {
      console.warn("No se pudo guardar proyecto en localStorage:", e);
    }

    actualizarEstadoProyecto();
  } catch (err) {
    console.error("Error procesando proyecto:", err);
    if (estado) {
      estado.textContent =
        "Se ha producido un error al leer el archivo. Revisa el formato.";
    }
  }
}

// Lectura del Excel usando SheetJS (xlsx)
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

        // Normalizar columnas: Referencia, Cantidad, Descripcion
        const filas = json
          .map((row) => {
            // admitir variantes de nombre de columna
            const ref =
              row["Referencia"] ||
              row["REF"] ||
              row["Ref"] ||
              row["Referencia 2N"] ||
              "";
            const cant = row["Cantidad"] || row["Cant"] || row["Qty"] || "";
            const desc =
              row["Descripción"] ||
              row["Descripcion"] ||
              row["DESCRIPCION"] ||
              "";

            return {
              referencia: String(ref).trim(),
              cantidad: Number(cant) || 0,
              descripcion: String(desc).trim(),
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

// Actualiza el texto de la tarjeta de estado
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
    ? new Date(proyecto.fechaImportacion).toLocaleString()
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

// Si quieres que la vista Proyecto sea la inicial al arrancar,
// puedes llamar a renderProyectoView() desde tu main.js/ui_shell
// cuando se seleccione el menú "Proyecto".
