// js/ui_proyecto.js
// Importación del Excel de proyecto (Project Designer 2N)

if (!window.appState) {
  window.appState = {};
}
if (!Array.isArray(appState.lineasProyecto)) {
  appState.lineasProyecto = [];
}

function renderProyecto(container) {
  container.innerHTML = `
    <div class="page-title">Proyecto</div>
    <div class="page-subtitle">Importa el Excel del Project Designer para generar el presupuesto.</div>

    <div class="card">
      <div class="card-header-row">
        <span class="card-header">Importar proyecto</span>
        <span class="badge-light">Excel Project Designer</span>
      </div>

      <input type="file" id="fileProyecto" accept=".xlsx,.xls" />

      <button class="btn btn-blue" id="btnProyecto" style="margin-top:16px;">
        Procesar proyecto
      </button>

      <div id="resProyecto" style="margin-top:16px; font-size:0.9rem;"></div>
    </div>
  `;

  document.getElementById("btnProyecto").onclick = importarProyectoYIrAPresupuesto;
}

// Botón: importar + cambiar a Presupuesto
async function importarProyectoYIrAPresupuesto() {
  const ok = await importarProyectoDesdeExcel();
  console.log("[Proyecto] resultado importarProyectoDesdeExcel ->", ok);

  if (!ok) return;

  if (typeof setActiveTab === "function") {
    setActiveTab("presupuesto");
  } else if (typeof renderShellContent === "function") {
    renderShellContent("presupuesto");
  }
}

// Helper número
function parseNumCell(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// IMPORTADOR DEL EXCEL (formato Project Designer)
async function importarProyectoDesdeExcel() {
  const fileInput = document.getElementById("fileProyecto");
  const out = document.getElementById("resProyecto");

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    if (out) out.textContent = "Selecciona un archivo Excel antes de procesar.";
    return false;
  }

  const file = fileInput.files[0];
  if (out) out.textContent = "Leyendo archivo…";

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        if (!sheet) {
          if (out) out.textContent = "No se pudo leer la hoja del Excel.";
          return resolve(false);
        }

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
        if (!rows || !rows.length) {
          if (out) out.textContent = "El archivo no tiene contenido.";
          return resolve(false);
        }

        console.log("[Proyecto] Filas leídas:", rows.length);
        console.log("[Proyecto] Primeras filas:", rows.slice(0, 15));

        const lineas = [];
        let currentSection = "";

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i] || [];
          const c0 = r[0];
          const c1 = r[1];
          const c2 = r[2];
          const c3 = r[3];
          const c4 = r[4]; // posible columna de PVP

          const s0 = c0 != null ? String(c0).trim() : "";
          const s1 = c1 != null ? String(c1).trim() : "";
          const s2 = c2 != null ? String(c2).trim() : "";
          const s3 = c3 != null ? String(c3).trim() : "";

          // Fila vacía
          if (!s0 && !s1 && !s2 && !s3 && (c4 == null || String(c4).trim() === "")) continue;

          // Fila de sección: texto solo en la primera celda
          if (s0 && !s1 && !s2 && !s3 && (c4 == null || String(c4).trim() === "")) {
            currentSection = s0;
            console.log("[Proyecto] Sección detectada:", currentSection, "(fila", i, ")");
            continue;
          }

          // Fila cabecera de productos: Foto | Nombre del producto | Número de pedido | Cantidad
          if (
            s0.toLowerCase() === "foto" &&
            s1.toLowerCase().includes("nombre") &&
            s2.toLowerCase().includes("número") &&
            s3.toLowerCase().includes("cantidad")
          ) {
            continue;
          }

          // Fila de producto de Project Designer:
          // (None, 'Nombre producto', 'Número de pedido', Cantidad, [PVP opcional])
          const ref = s2;        // Número de pedido
          const desc = s1;       // Nombre del producto
          const cantidad = parseNumCell(c3) || 1;
          const pvp = parseNumCell(c4); // si no hay precio en la col 5, será 0

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
          if (out) out.textContent = "No se encontraron líneas válidas en el Excel.";
          return resolve(false);
        }

        appState.lineasProyecto = lineas;

        if (out) {
          out.innerHTML = `
            <p>
              <strong>${lineas.length}</strong> líneas procesadas.<br>
              Última sección detectada: <strong>${lineas[lineas.length - 1].seccion || "SIN SECCIÓN"}</strong>
            </p>
          `;
        }

        console.log("[Proyecto] Ejemplo línea 0:", lineas[0]);
        resolve(true);
      } catch (err) {
        console.error("[Proyecto] Error procesando Excel:", err);
        if (out) out.textContent = "Error al procesar el archivo.";
        resolve(false);
      }
    };

    reader.onerror = () => {
      if (out) out.textContent = "No se pudo leer el archivo.";
      resolve(false);
    };

    reader.readAsArrayBuffer(file);
  });
}
