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

    <div class="card" style="padding:20px; max-width:900px;">
      <h3 style="margin-bottom:12px;">Importar proyecto <small>Excel Project Designer</small></h3>

      <div class="mb-3">
        <input type="file" id="inputExcelProyecto" accept=".xlsx" />
      </div>
      <button id="btnProcesarProyecto" class="btn-primary">
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
      alert("No se pudo leer la hoja del Excel.");
      return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    // ==========================
    // PARSE DEL EXCEL
    // ==========================
    const lineas = parsearExcelProyectoDesigner(rows);

    console.log("[Proyecto] Líneas construidas:", lineas.length);
    console.log("[Proyecto] Ejemplo línea 0:", lineas[0]);

    appState.lineasProyecto = lineas;

    // Preparamos tarifas
    const refs = lineas
      .map((l) => l.ref)
      .filter((r) => r && r !== "" && r !== "-");

    console.log("[Proyecto] refs que pedimos a tarifa:", refs);

    // Llamamos al motor de tarifas (Firestore)
    if (window.loadTarifasForRefs && refs.length > 0) {
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
// FUNCIÓN: Parseo flexible del Excel Project Designer
//  - Usa la columna "Número de pedido" como referencia
//  - Detecta secciones en filas en mayúsculas
// ======================================================
function parsearExcelProyectoDesigner(rows) {
  const lineas = [];
  if (!rows || !rows.length) return lineas;

  let headerRowIndex = -1;
  let refCol = -1;
  let descCol = -1;
  let qtyCol = -1;

  // Buscar cabecera y columnas dentro de las primeras 30 filas
  const maxHeaderScan = Math.min(rows.length, 30);
  for (let i = 0; i < maxHeaderScan; i++) {
    const row = rows[i] || [];
    for (let c = 0; c < row.length; c++) {
      const val = (row[c] || "").toString().toLowerCase();

      if (
        refCol === -1 &&
        (val.includes("numero de pedido") ||
          val.includes("número de pedido") ||
          val.includes("num pedido"))
      ) {
        headerRowIndex = i;
        refCol = c;
      }

      if (
        descCol === -1 &&
        (val.includes("descripcion") ||
          val.includes("descripción") ||
          val.includes("producto"))
      ) {
        descCol = c;
      }

      if (
        qtyCol === -1 &&
        (val.includes("cantidad") ||
          val.includes("qty") ||
          val.includes("unidades"))
      ) {
        qtyCol = c;
      }
    }
    if (headerRowIndex !== -1) break;
  }

  if (headerRowIndex === -1 || refCol === -1) {
    console.warn("[Proyecto] No se encontró cabecera 'Número de pedido'. Se devuelve vacío.");
    return lineas;
  }

  let seccionActual = "";

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const rawRow = rows[i] || [];
    const values = rawRow.map((c) => (c || "").toString().trim());
    if (values.every((v) => v === "")) continue;

    const refCell = values[refCol];

    // Si la columna de ref está vacía, puede ser una fila de sección
    if (!refCell) {
      const firstNonEmpty = values.find((v) => v !== "");
      if (
        firstNonEmpty &&
        firstNonEmpty.length >= 3 &&
        firstNonEmpty === firstNonEmpty.toUpperCase()
      ) {
        seccionActual = firstNonEmpty;
        console.log("[Proyecto] Sección detectada:", seccionActual, "(fila " + i + ")");
        continue;
      }
      continue;
    }

    const ref = refCell;

    // Descripción
    let descripcion = "";
    if (descCol !== -1) {
      descripcion = values[descCol] || "";
    } else {
      descripcion =
        values.find((v, idx) => idx !== refCol && v !== "") || "";
    }

    // Cantidad
    let cantidad = 1;
    if (qtyCol !== -1) {
      const raw = (values[qtyCol] || "").replace(",", ".");
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 0) cantidad = num;
    } else {
      for (let c = values.length - 1; c >= 0; c--) {
        const rawN = (values[c] || "").replace(",", ".");
        const num = parseFloat(rawN);
        if (!isNaN(num) && num > 0) {
          cantidad = num;
          break;
        }
      }
    }

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
