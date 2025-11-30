// ===============================================
// js/ui_proyecto.js
// Página: PROYECTO (importar Excel del Project Designer)
// ===============================================

if (!window.appState) window.appState = {};
if (!appState.lineasProyecto) appState.lineasProyecto = [];

// ===============================
// Render principal de la página
// ===============================
function renderProyecto(root) {
  root.innerHTML = `
    <h2>Proyecto</h2>
    <p>Importa el Excel del Project Designer para generar el presupuesto.</p>

    <div class="card" style="padding:20px;">
      <h3>Importar proyecto <small>Excel Project Designer</small></h3>

      <input type="file" id="inputExcelProyecto" accept=".xlsx" />
      <button id="btnProcesarProyecto" class="btn-primary" style="margin-top:12px;">
        Procesar proyecto
      </button>
    </div>

    <div id="resultadoProyecto" style="margin-top:20px;"></div>
  `;

  document.getElementById("btnProcesarProyecto").onclick = handleImportProyecto;
}

// ===============================================
// EVENTO: Pulsar "Procesar proyecto"
// ===============================================
async function handleImportProyecto() {
  const fileInput = document.getElementById("inputExcelProyecto");
  if (!fileInput.files.length) {
    alert("Selecciona un archivo XLSX primero.");
    return;
  }

  const file = fileInput.files[0];
  await importarProyectoDesdeExcel(file);
}

// ===============================================
// FUNCIÓN PRINCIPAL: Importar XLSX Project Designer
// ===============================================
async function importarProyectoDesdeExcel(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      console.error("[Proyecto] Error: No se pudo leer la hoja.");
      return;
    }

    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    // ==========================
    // PARSE DEL EXCEL
    // ==========================
    const lineas = parsearExcelProyectoDesigner(json);

    console.log("[Proyecto] Líneas construidas:", lineas.length);

    appState.lineasProyecto = lineas;

    // Preparamos tarifas
    const refs = lineas
      .map((l) => l.ref)
      .filter((r) => r && r !== "" && r !== "-");

    console.log("[Proyecto] refs que pedimos a tarifa:", refs);

    // Llamamos al motor de tarifas
    if (window.loadTarifasForRefs) {
      await loadTarifasForRefs(refs);
    }

    console.log("[Proyecto] resultado importarProyectoDesdeExcel ->", true);

    // ==============================
    // REDIRECCIÓN AUTOMÁTICA A PRESUPUESTO
    // ==============================
    appState.currentTab = "presupuesto";
    renderShell();

  } catch (err) {
    console.error("[Proyecto] Error importando XLSX:", err);
    alert("Error procesando el archivo. Revisa la consola.");
  }
}

// ======================================================
// FUNCIÓN: Parseo detallado del Excel de Project Designer
// ======================================================
function parsearExcelProyectoDesigner(rows) {
  const lineas = [];

  let seccionActual = "";
  // Detecta filas que son SECCIÓN:
  // Ej: "PLACA DE CALLE", "MONITORES", "ACCESORIOS"
  const REGEX_SECCION = /^[A-ZÁÉÍÓÚÑ0-9 ]{3,}$/;

  for (let i = 0; i < rows.length; i++) {
    const fila = rows[i];
    if (!fila || fila.length < 2) continue;

    const colA = (fila[0] || "").toString().trim();
    const colB = (fila[1] || "").toString().trim();

    // -----------------------------------------
    // Si es una SECCIÓN (texto en mayúsculas)
    // -----------------------------------------
    if (REGEX_SECCION.test(colA) && colB === "") {
      seccionActual = colA;
      console.log("[Proyecto] Sección detectada:", seccionActual, "(fila " + i + ")");
      continue;
    }

    // -----------------------------------------
    // Caso: línea con referencia
    // -----------------------------------------
    const ref = colA;
    const descripcion = colB;
    const cantidad = Number(fila[2] || 1);

    // Validación de referencia típica 2N: numérica
    const esReferenciaValida = /^[0-9]{5,10}$/.test(ref);

    if (!esReferenciaValida) continue;

    lineas.push({
      ref,
      descripcion,
      seccion: seccionActual || "SIN SECCIÓN",
      cantidad,
      pvp: 0,
      importe: 0,
      ok: true,
    });
  }

  return lineas;
}

// ======================================================
// EXPOSE
// ======================================================
window.renderProyecto = renderProyecto;
window.importarProyectoDesdeExcel = importarProyectoDesdeExcel;
