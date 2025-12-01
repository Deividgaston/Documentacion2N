// js/ui_proyecto.js
// Pantalla de PROYECTO: importar Excel (incl. Project Designer) y guardar en appState + localStorage

window.appState = window.appState || {};
appState.proyecto = appState.proyecto || {
  filas: [],
  archivoNombre: null,
  fechaImportacion: null,
};
// Preview temporal para el modal
appState.proyectoPreview = null;

function getAppContent() {
  return document.getElementById("appContent");
}

// ====================
// RENDER PRINCIPAL
// ====================

function renderProyectoView() {
  const container = getAppContent();
  if (!container) return;

  container.innerHTML = `
    <div class="proyecto-layout">

      <!-- Card de importación -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Proyecto</div>
            <div class="card-subtitle">
              Importa el archivo de proyecto (Project Designer 2N o Excel propio) con las referencias y cantidades.
            </div>
          </div>
          <span class="chip">Paso 1 de 3</span>
        </div>

        <div class="card-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Archivo de proyecto (Excel o CSV)</label>
              <p style="font-size:0.78rem; color:#6b7280; margin-bottom:0.45rem;">
                Para el <strong>Project Designer 2N</strong> se leerán automáticamente:
                <em>Sección</em>, <em>Título</em>, <em>Nombre del producto</em>, 
                <em>Número de pedido</em> (referencia) y <em>Cantidad</em>.
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

    <!-- Modal de confirmación importación -->
    <div id="proyectoConfirmOverlay" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-title">Importar proyecto</div>
        <div id="proyectoConfirmText" class="modal-text">
          <!-- Se rellena por JS -->
        </div>
        <div class="modal-actions">
          <button id="btnProyectoCancelar" class="btn btn-secondary btn-sm">
            Cancelar
          </button>
          <button id="btnProyectoConfirmar" class="btn btn-primary btn-sm">
            Importar y generar presupuesto
          </button>
        </div>
      </div>
    </div>
  `;

  // Eventos
  const btnProcesar = document.getElementById("btnProcesarProyecto");
  if (btnProcesar) {
    btnProcesar.addEventListener("click", onProcesarProyectoClick);
  }

  const overlay = document.getElementById("proyectoConfirmOverlay");
  const btnCancelar = document.getElementById("btnProyectoCancelar");
  const btnConfirmar = document.getElementById("btnProyectoConfirmar");

  if (overlay && btnCancelar && btnConfirmar) {
    btnCancelar.addEventListener("click", () => {
      appState.proyectoPreview = null;
      overlay.style.display = "none";
    });

    btnConfirmar.addEventListener("click", () => {
      confirmarImportacionProyecto();
    });
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
    const resultado = await leerProyectoDesdeExcel(file);
    const filas = resultado.filas;
    const seccion = resultado.seccion;
    const titulo = resultado.titulo;

    if (!filas || filas.length === 0) {
      if (msg) {
        msg.className = "alert alert-error mt-3";
        msg.textContent =
          "No se han encontrado filas válidas. Revisa que existan referencias y cantidades.";
        msg.style.display = "flex";
      }
      return;
    }

    // Guardamos una preview temporal en memoria
    appState.proyectoPreview = {
      filas,
      archivoNombre: file.name,
      fechaImportacion: new Date().toISOString(),
      seccion,
      titulo,
    };

    // Mostramos el modal de confirmación
    mostrarModalConfirmacionProyecto(filas.length, file.name, seccion, titulo);
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

// Mostrar modal con nº de productos y datos básicos
function mostrarModalConfirmacionProyecto(numProductos, archivoNombre, seccion, titulo) {
  const overlay = document.getElementById("proyectoConfirmOverlay");
  const txt = document.getElementById("proyectoConfirmText");
  if (!overlay || !txt) return;

  const secTxt = seccion ? `<br/><strong>Sección:</strong> ${seccion}` : "";
  const titTxt = titulo ? `<br/><strong>Título:</strong> ${titulo}` : "";

  txt.innerHTML = `
    Se han detectado <strong>${numProductos}</strong> productos en el archivo
    <strong>${archivoNombre}</strong>.
    ${secTxt}
    ${titTxt}
    <br/><br/>
    ¿Quieres importar este proyecto y pasar directamente a la página de <strong>Presupuesto</strong>?
  `;

  overlay.style.display = "flex";
}

// Confirmar importación definitiva y pasar a Presupuesto
function confirmarImportacionProyecto() {
  const overlay = document.getElementById("proyectoConfirmOverlay");
  const msg = document.getElementById("proyectoMensaje");
  if (!appState.proyectoPreview) {
    if (overlay) overlay.style.display = "none";
    return;
  }

  const preview = appState.proyectoPreview;
  appState.proyecto = {
    filas: preview.filas,
    archivoNombre: preview.archivoNombre,
    fechaImportacion: preview.fechaImportacion,
    seccion: preview.seccion || null,
    titulo: preview.titulo || null,
  };
  appState.proyectoPreview = null;

  // Guardar en localStorage
  try {
    localStorage.setItem(PROYECTO_CACHE_KEY, JSON.stringify(appState.proyecto));
  } catch (e) {
    console.warn("No se pudo guardar el proyecto en localStorage:", e);
  }

  if (overlay) overlay.style.display = "none";

  if (msg) {
    msg.className = "alert alert-success mt-3";
    msg.textContent = `Proyecto importado correctamente: ${appState.proyecto.filas.length} líneas.`;
    msg.style.display = "flex";
  }

  actualizarEstadoProyecto();

  // Ir directamente a Presupuesto
  if (typeof selectView === "function") {
    selectView("presupuesto");
    // marcar tab active la maneja ui_shell.js
  }
}

// ====================
// LECTURA DE EXCEL
// ====================

// Devuelve: { filas: [...], seccion, titulo }
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

        // Array crudo para detectar formato Project Designer
        const hojaArray = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
        });

        const resultadoPD = intentarParsearProjectDesigner(hojaArray);
        if (resultadoPD) {
          resolve(resultadoPD);
          return;
        }

        // Si no es formato Project Designer, usamos el parser genérico (cabeceras normales)
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const filas = json
          .map((row) => {
            const ref =
              row["Referencia"] ||
              row["REF"] ||
              row["Ref"] ||
              row["Referencia 2N"] ||
              row["Referencia_2N"] ||
              row["Codigo"] ||
              row["Código"] ||
              row["Número de pedido"] ||
              row["Numero de pedido"] ||
              row["Número pedido"] ||
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
              row["Nombre del producto"] ||
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

        resolve({ filas, seccion: null, titulo: null });
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

// Intenta detectar y parsear formato Project Designer 2N
function intentarParsearProjectDesigner(hojaArray) {
  if (!Array.isArray(hojaArray) || hojaArray.length === 0) return null;

  // Buscar fila de cabecera: donde aparezcan "Nombre del producto" y "Número de pedido"
  let headerIndex = -1;
  let idxNombre = -1;
  let idxRef = -1;
  let idxCant = -1;

  for (let i = 0; i < hojaArray.length; i++) {
    const row = hojaArray[i];
    if (!Array.isArray(row)) continue;

    const lowerRow = row.map((c) => String(c).toLowerCase().trim());

    const iNombre = lowerRow.findIndex((c) =>
      c.includes("nombre del producto")
    );
    const iRef = lowerRow.findIndex(
      (c) => c.includes("número de pedido") || c.includes("numero de pedido")
    );
    const iCant = lowerRow.findIndex((c) => c === "cantidad");

    if (iNombre !== -1 && iRef !== -1 && iCant !== -1) {
      headerIndex = i;
      idxNombre = iNombre;
      idxRef = iRef;
      idxCant = iCant;
      break;
    }
  }

  if (headerIndex === -1) {
    // No parece ser formato Project Designer
    return null;
  }

  // Sección y título: filas no vacías inmediatamente anteriores a la cabecera
  let seccion = "";
  let titulo = "";

  const prevRows = hojaArray.slice(0, headerIndex).filter((row) =>
    Array.isArray(row)
      ? row.some((c) => String(c).trim() !== "")
      : false
  );

  if (prevRows.length >= 1) {
    const tituloRow = prevRows[prevRows.length - 1];
    titulo =
      (tituloRow.find((c) => String(c).trim() !== "") || "").toString().trim();
  }
  if (prevRows.length >= 2) {
    const seccionRow = prevRows[prevRows.length - 2];
    seccion =
      (seccionRow.find((c) => String(c).trim() !== "") || "").toString().trim();
  }

  const filas = [];
  for (let i = headerIndex + 1; i < hojaArray.length; i++) {
    const row = hojaArray[i];
    if (!Array.isArray(row)) continue;

    const nombre = row[idxNombre] || "";
    const ref = row[idxRef] || "";
    const cant = row[idxCant] || "";

    // Fin de tabla: si todo está vacío
    if (
      String(nombre).trim() === "" &&
      String(ref).trim() === "" &&
      String(cant).trim() === ""
    ) {
      continue;
    }

    const referencia = normalizarRef(ref);
    const cantidad = Number(cant) || 0;

    if (!referencia || cantidad <= 0) continue;

    filas.push({
      seccion: limpiarTexto(seccion),
      titulo: limpiarTexto(titulo),
      descripcion: limpiarTexto(nombre),
      referencia,
      cantidad,
    });
  }

  if (filas.length === 0) return null;

  return {
    filas,
    seccion: limpiarTexto(seccion),
    titulo: limpiarTexto(titulo),
  };
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
      seccion: data.seccion || null,
      titulo: data.titulo || null,
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

  const seccionTxt = proyecto.seccion
    ? `<br/>Sección: <strong>${proyecto.seccion}</strong>`
    : "";
  const tituloTxt = proyecto.titulo
    ? `<br/>Título: <strong>${proyecto.titulo}</strong>`
    : "";

  estado.innerHTML = `
    <div class="metric-card">
      <span class="metric-label">Proyecto importado</span>
      <span class="metric-value">${numFilas} líneas</span>
    </div>
    <p class="mt-2" style="font-size:0.82rem; color:#4b5563;">
      Archivo: <strong>${nombre}</strong><br/>
      Importado: ${fecha}
      ${seccionTxt}
      ${tituloTxt}
    </p>
  `;
}

console.log(
  "%cUI Proyecto cargada (ui_proyecto.js · Project Designer OK)",
  "color:#1d4fd8; font-weight:600;"
);
