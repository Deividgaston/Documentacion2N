// ui_proyecto.js
// Pantalla de importación del proyecto desde Excel (Project Designer)
// - Lee archivo XLSX
// - Detecta una fila de cabeceras
// - Detecta secciones (filas con solo texto en la primera celda)
// - Genera appState.lineasProyecto con ref, descripcion, cantidad, pvp, seccion
// - Al terminar, navega a la página "presupuesto"

// ========== RENDER PÁGINA ==========
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
  btn.onclick = importarProyectoYIrAPresupuesto;
}

// ========== HANDLER BOTÓN (IMPORTAR + IR A PRESUPUESTO) ==========
async function importarProyectoYIrAPresupuesto() {
  const ok = await importarProyectoDesdeExcel();
  console.log("[Proyecto] resultado importarProyectoDesdeExcel ->", ok);

  if (!ok) return;

  // Intento 1: función global del shell
  if (typeof renderShellContent === "function") {
    console.log("[Proyecto] Llamando a renderShellContent('presupuesto')");
    renderShellContent("presupuesto");
    return;
  }

  // Intento 2: simular click en algún elemento de menú
  const btnNav =
    document.querySelector('[data-page="presupuesto"]') ||
    document.querySelector('[data-page-key="presupuesto"]') ||
    document.querySelector('#nav-presupuesto');

  if (btnNav) {
    console.log("[Proyecto] Haciendo click en botón de menú de Presupuesto");
    btnNav.click();
  } else {
    console.warn("[Proyecto] No he encontrado cómo navegar a Presupuesto; revisa el shell.");
  }
}

/* ============================
   IMPORTADOR DEL EXCEL
   =========================== */

async function importarProyectoDesdeExcel() {
  const fileInput = document.getElementById("inputExcelProyecto");
  const infoBox = document.getElementById("importInfo");

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    if (infoBox) infoBox.textContent = "Selecciona un archivo XLSX antes de importar.";
    return false;
  }

  const file = fileInput.files[0];
  if (infoBox) infoBox.textContent = "Leyendo archivo…";
  console.log("[Proyecto] Leyendo archivo:", file.name);

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      if (infoBox) infoBox.textContent = "No se pudo leer la hoja del Excel.";
      console.error("[Proyecto] Hoja no encontrada");
      return false;
    }

    // raw:false para tratar números como string, así gestionamos comas
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    if (!rows || !rows.length) {
      if (infoBox) infoBox.textContent = "El archivo no tiene contenido.";
      console.warn("[Proyecto] Excel sin filas");
      return false;
    }

    console.log("[Proyecto] Nº filas leídas:", rows.length);

    // ---- Helper numérico ----
    const parseNum = (v) => {
      if (v == null) return 0;
      if (typeof v === "number") return v;
      const s = String(v).trim().replace(/\./g, "").replace(",", ".");
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    const lineas = [];
    let currentSection = "SIN SECCIÓN";

    // Intentar detectar cabeceras
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || [];
      const t0 = (r[0] || "").toString().toLowerCase();
      const t1 = (r[1] || "").toString().toLowerCase();
      const t2 = (r[2] || "").toString().toLowerCase();
      const t3 = (r[3] || "").toString().toLowerCase();
      const joined = `${t0} ${t1} ${t2} ${t3}`;
      if (
        joined.includes("ref") ||
        joined.includes("referencia") ||
        joined.includes("descrip") ||
        joined.includes("cantidad") ||
        joined.includes("ud") ||
        joined.includes("pvp") ||
        joined.includes("precio")
      ) {
        headerRowIndex = i;
        break;
      }
    }

    console.log("[Proyecto] Fila de cabeceras detectada en índice:", headerRowIndex);

    // Si no detectamos cabeceras, asumimos que todos los datos relevantes están “debajo” de donde empiezan a aparecer refs
    const startIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

    // Recorremos filas a partir de startIndex
    for (let i = startIndex; i < rows.length; i++) {
      const r = rows[i] || [];
      const c0 = (r[0] ?? "").toString().trim();
      const c1 = (r[1] ?? "").toString().trim();
      const c2 = (r[2] ?? "").toString().trim();
      const c3 = (r[3] ?? "").toString().trim();

      // fila totalmente vacía
      if (!c0 && !c1 && !c2 && !c3) continue;

      // Fila de SECCIÓN: texto solo en la primera celda
      if (c0 && !c1 && !c2 && !c3) {
        currentSection = c0;
        console.log("[Proyecto] Sección detectada:", currentSection, " (fila", i, ")");
        continue;
      }

      // Posible línea: REF | DESCRIPCIÓN | UD | PVP
      const ref = c0;
      const desc = c1;
      const cantidad = parseNum(c2) || 1;
      const pvp = parseNum(c3);

      // Si no hay ni ref ni descripción, descartamos
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

    console.log("[Proyecto] Líneas construidas:", lineas.length);
    if (!lineas.length) {
      if (infoBox) infoBox.textContent = "No se encontraron líneas válidas en el Excel.";
      return false;
    }

    // Guardamos en el estado global
    if (typeof appState === "undefined") {
      window.appState = {};
    }
    if (!appState.infoPresupuesto) {
      appState.infoPresupuesto = {
        cliente: "",
        proyecto: "",
        direccion: "",
        contacto: "",
        email: "",
        telefono: "",
        notas: ""
      };
    }

    appState.lineasProyecto = lineas;

    console.log("[Proyecto] appState.lineasProyecto ejemplo[0]:", lineas[0]);
    if (infoBox) {
      infoBox.textContent = `Importación correcta: ${lineas.length} líneas. Abriendo presupuesto…`;
    }

    return true;
  } catch (err) {
    console.error("[Proyecto] Error al procesar el archivo:", err);
    if (infoBox) infoBox.textContent = "Error al procesar el archivo.";
    return false;
  }
}
