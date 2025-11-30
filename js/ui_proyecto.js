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
// ======================================================
function parsearExcelProyectoDesigner(rows) {
  const lineas = [];
  let seccionActual = "";

  // Sección: texto en mayúsculas en la primera columna y resto casi vacío
  const esFilaSeccion = (values) => {
    const col0 = (values[0] || "").trim();
    if (!col0) return false;
    if (col0.length < 3) return false;
    // mayúsculas o números
    const esMayus = col0 === col0.toUpperCase();
    const restoVacio = values.slice(1).every((v) => !v || !v.trim());
    return esMayus && restoVacio;
  };

  // Referencia típica 2N: 5-8 dígitos, opcional letra al final (ej. 9155011B)
  const REGEX_REF = /^[0-9]{5,8}[A-Z]?$/;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const values = row.map((c) => (c || "").toString().trim());

    if (values.every((v) => v === "")) continue; // fila vacía

    // -------- SECCIÓN --------
    if (esFilaSeccion(values)) {
      seccionActual = values[0];
      console.log("[Proyecto] Sección detectada:", seccionActual, "(fila " + i + ")");
      continue;
    }

    // -------- LÍNEA CON REFERENCIA --------
    // Buscamos la primera celda que parezca una ref 2N
    let refIndex = -1;
    for (let c = 0; c < values.length; c++) {
      if (REGEX_REF.test(values[c])) {
        refIndex = c;
        break;
      }
    }
    if (refIndex === -1) continue; // sin referencia -> no es línea de producto

    const ref = values[refIndex];

    // Descripción: primer texto no vacío después de la referencia
    let descripcion = "";
    for (let c = refIndex + 1; c < values.length; c++) {
      if (values[c] && values[c].length > 0) {
        descripcion = values[c];
        break;
      }
    }

    // Cantidad: último número significativo de la fila (si no, 1)
    let cantidad = 1;
    for (let c = values.length - 1; c > refIndex; c--) {
      const raw = values[c].replace(",", ".");
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 0) {
        cantidad = num;
        break;
      }
    }

    const linea = {
      ref,
      descripcion,
      seccion: seccionActual || "SIN SECCIÓN",
      cantidad,
      pvp: 0,
      importe: 0,
      ok: true,
    };

    lineas.push(linea);
  }

  return lineas;
}

// ======================================================
// EXPOSE
// ======================================================
window.renderProyecto = renderProyecto;
window.importarProyectoDesdeExcel = importarProyectoDesdeExcel;
