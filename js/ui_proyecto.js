// ui_proyecto.js
// Pantalla de importación del proyecto desde Excel (Project Designer)
// - Lee archivo XLSX
// - Detecta secciones automáticamente
// - Crea lineas de proyecto
// - Guarda en appState
// - Redirige automáticamente a Presupuesto

function renderProyecto(container) {
  container.innerHTML = `
    <div class="page-header-row">
      <div>
        <div class="page-title">Proyecto</div>
        <div class="page-subtitle">Importa un proyecto desde Project Designer (Excel XLSX)</div>
      </div>
    </div>

    <div class="card" style="max-width:600px;">
      <div class="card-section-title">Importar archivo</div>

      <div>
        <input type="file" id="inputExcelProyecto" accept=".xlsx" class="input" />
      </div>

      <button class="btn btn-blue btn-full" style="margin-top:12px;" id="btnImportarProyecto">
        Importar proyecto
      </button>

      <div id="importInfo" style="margin-top:12px; font-size:0.85rem; color:#6b7280;"></div>
    </div>
  `;

  document.getElementById("btnImportarProyecto").onclick = importarProyectoDesdeExcel;
}

/* ============================
   IMPORTADOR DEL EXCEL
=============================== */

async function importarProyectoDesdeExcel() {
  const fileInput = document.getElementById("inputExcelProyecto");
  const infoBox = document.getElementById("importInfo");

  if (!fileInput.files || !fileInput.files[0]) {
    infoBox.textContent = "Selecciona un archivo XLSX antes de importar.";
    return;
  }

  const file = fileInput.files[0];
  infoBox.textContent = "Leyendo archivo…";

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    // Cogemos la primera hoja
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      infoBox.textContent = "No se pudo leer la hoja del Excel.";
      return;
    }

    // Convertimos a JSON
    let rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (!rows || !rows.length) {
      infoBox.textContent = "El archivo no tiene contenido.";
      return;
    }

    // EXTRAER LÍNEAS – detección automática de secciones
    const lineas = [];
    let currentSection = "SIN SECCIÓN";

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      if (!r || r.length === 0) continue;

      // Detectar filas que son SECCIONES (grandes títulos)
      if (typeof r[0] === "string" && r[0].trim() !== "" && r[1] == null) {
        currentSection = r[0].trim();
        continue;
      }

      // Detectar líneas del proyecto
      // Estructura típica: REF | DESCRIPCIÓN | UD | PVP
      const ref = (r[0] || "").toString().trim();
      const desc = (r[1] || "").toString().trim();
      const ud = Number(r[2]) || 0;
      const pvp = Number(r[3]) || 0;

      // Saltar filas vacías
      if (!ref && !desc) continue;

      // Crear línea
      const linea = {
        ref,
        descripcion: desc,
        cantidad: ud || 1,
        pvp,
        incluir: true,
        seccion: currentSection,
        manual: false
      };

      lineas.push(linea);
    }

    if (!lineas.length) {
      infoBox.textContent = "No se encontraron líneas válidas en el Excel.";
      return;
    }

    // GUARDAR EN appState
    appState.lineasProyecto = lineas;

    // Mensaje
    infoBox.textContent = `Importación correcta: ${lineas.length} líneas. Redirigiendo…`;

    // 🔥 REDIRIGIR DIRECTAMENTE A PRESUPUESTO
    setTimeout(() => {
      renderShellContent("presupuesto");
    }, 300);

  } catch (err) {
    console.error(err);
    infoBox.textContent = "Error al procesar el archivo.";
  }
}
