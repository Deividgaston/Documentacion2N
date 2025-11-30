// ui_proyecto.js
// Pantalla de importación del proyecto desde Excel (Project Designer)
// - Lee archivo XLSX
// - Detecta secciones automáticamente
// - Crea lineas de proyecto
// - Guarda en appState.lineasProyecto
// - Al terminar, navega a la página "presupuesto"

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

  const btn = document.getElementById("btnImportarProyecto");
  btn.onclick = async () => {
    const ok = await importarProyectoDesdeExcel();
    // si ha ido bien, cambiamos a PRESUPUESTO
    if (ok && typeof renderShellContent === "function") {
      renderShellContent("presupuesto");
    }
  };
}

/* ============================
   IMPORTADOR DEL EXCEL
   =========================== */

async function importarProyectoDesdeExcel() {
  const fileInput = document.getElementById("inputExcelProyecto");
  const infoBox = document.getElementById("importInfo");

  if (!fileInput.files || !fileInput.files[0]) {
    infoBox.textContent = "Selecciona un archivo XLSX antes de importar.";
    return false;
  }

  const file = fileInput.files[0];
  infoBox.textContent = "Leyendo archivo…";

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      infoBox.textContent = "No se pudo leer la hoja del Excel.";
      return false;
    }

    // raw:false para que convierta números como string (por si hay comas)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    if (!rows || !rows.length) {
      infoBox.textContent = "El archivo no tiene contenido.";
      return false;
    }

    const lineas = [];
    let currentSection = "SIN SECCIÓN";
    let headersDetected = false;

    // Función auxiliar para parsear números con coma o punto
    const parseNum = (v) => {
      if (v == null) return 0;
      if (typeof v === "number") return v;
      const s = String(v).trim().replace(/\./g, "").replace(",", ".");
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;

      const c0 = (r[0] ?? "").toString().trim();
      const c1 = (r[1] ?? "").toString().trim();
      const c2 = (r[2] ?? "").toString().trim();
      const c3 = (r[3] ?? "").toString().trim();

      // Saltar filas totalmente vacías
      if (!c0 && !c1 && !c2 && !c3) continue;

      // Detectar fila de CABECERAS (Referencia / Descripción / Cantidad / PVP...)
      if (!headersDetected) {
        const headerRowText = (c0 + " " + c1 + " " + c2 + " " + c3).toLowerCase();
        if (
          /ref/.test(headerRowText) ||
          /referencia/.test(headerRowText) ||
          /descrip/.test(headerRowText)
        ) {
          headersDetected = true;
          continue; // no es una línea del proyecto
        }
      }

      // Detectar SECCIÓN: texto solo en la primera celda
      if (c0 && !c1 && !c2 && !c3) {
        currentSection = c0;
        continue;
      }

      // A partir de aquí consideramos que es una LÍNEA:
      // Usamos la estructura REF | DESCRIPCIÓN | UD | PVP
      const ref = c0;           // referencia
      const desc = c1;          // descripción
      const cantidad = parseNum(c2) || 1;
      const pvp = parseNum(c3);

      // Si no hay ni ref ni descripción, no tiene sentido
      if (!ref && !desc) continue;

      lineas.push({
        ref,
        descripcion: desc,
        cantidad,
        pvp,
        incluir: true,
        seccion: currentSection,
        manual: false
      });
    }

    if (!lineas.length) {
      infoBox.textContent = "No se encontraron líneas válidas en el Excel.";
      return false;
    }

    // Guardamos en el estado global
    appState.lineasProyecto = lineas;

    infoBox.textContent = `Importación correcta: ${lineas.length} líneas. Abriendo presupuesto…`;
    return true;

  } catch (err) {
    console.error(err);
    infoBox.textContent = "Error al procesar el archivo.";
    return false;
  }
}
