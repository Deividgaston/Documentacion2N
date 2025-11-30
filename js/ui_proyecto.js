// js/ui_proyecto.js
// Página PROYECTO – importar Excel Project Designer (con secciones)

function renderProyecto(root) {
  root.innerHTML = `
    <h2 class="page-title">Proyecto</h2>
    <p class="page-subtitle">
      Importa el Excel del Project Designer para generar el presupuesto.
    </p>

    <div class="card" style="max-width:900px;">
      <h3>Importar proyecto <small>Excel Project Designer</small></h3>
      <div class="mt-3">
        <input type="file" id="inputExcelProyecto" accept=".xlsx" />
      </div>
      <button id="btnProcesarProyecto" class="btn-primary mt-3">Procesar proyecto</button>
    </div>
  `;

  document.getElementById("btnProcesarProyecto").onclick = handleImportProyecto;
}

async function handleImportProyecto() {
  const input = document.getElementById("inputExcelProyecto");
  if (!input.files.length) {
    alert("Selecciona un archivo XLSX primero.");
    return;
  }
  await importarProyectoDesdeExcel(input.files[0]);
}

async function importarProyectoDesdeExcel(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      alert("No se pudo leer la hoja del Excel.");
      return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    const lineas = parsearExcelProyectoDesigner(rows);

    console.log("[Proyecto] Líneas construidas:", lineas.length);
    appState.lineasProyecto = lineas;

    const refs = [...new Set(lineas.map(l => l.ref).filter(Boolean))];
    console.log("[Proyecto] refs para tarifa:", refs);

    if (refs.length && window.loadTarifasForRefs) {
      await loadTarifasForRefs(refs);
    }

    appState.currentTab = "presupuesto";
    renderShell();
  } catch (err) {
    console.error("[Proyecto] Error importando XLSX:", err);
    alert("Error procesando el archivo. Revisa la consola.");
  }
}

// Parser robusto por filas:
// - Filas en MAYÚSCULAS = secciones
// - Fila con un patrón de referencia = línea
function parsearExcelProyectoDesigner(rows) {
  const lineas = [];
  let seccionActual = "";

  const REGEX_REF = /^[0-9]{5,8}[A-Z]?$/;

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i] || [];
    const values = rawRow.map(v => (v || "").toString().trim());
    if (values.every(v => v === "")) continue;

    // ¿Sección?
    const firstNonEmpty = values.find(v => v !== "");
    const resto = values.filter(v => v !== firstNonEmpty);
    if (
      firstNonEmpty &&
      firstNonEmpty.length >= 3 &&
      firstNonEmpty === firstNonEmpty.toUpperCase() &&
      resto.every(v => v === "")
    ) {
      seccionActual = firstNonEmpty;
      console.log("[Proyecto] Sección detectada:", seccionActual, "(fila", i, ")");
      continue;
    }

    // ¿Línea con referencia?
    let refIndex = -1;
    for (let c = 0; c < values.length; c++) {
      if (REGEX_REF.test(values[c])) {
        refIndex = c;
        break;
      }
    }
    if (refIndex === -1) continue;

    const ref = values[refIndex];

    // Descripción: primer texto no vacío después de la ref
    let descripcion = "";
    for (let c = refIndex + 1; c < values.length; c++) {
      if (values[c]) {
        descripcion = values[c];
        break;
      }
    }

    // Cantidad: último número positivo en la fila (después de la ref)
    let cantidad = 1;
    for (let c = values.length - 1; c > refIndex; c--) {
      const raw = values[c].replace(",", ".");
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 0) {
        cantidad = num;
        break;
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

window.renderProyecto = renderProyecto;
window.importarProyectoDesdeExcel = importarProyectoDesdeExcel;
