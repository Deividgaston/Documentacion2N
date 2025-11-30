// js/ui_tarifa.js
// Importación de tarifa 2N

function renderTarifas(container) {
  container.innerHTML = `
    <div class="page-title">Tarifa 2N</div>
    <div class="page-subtitle">Importa la tarifa oficial (solo cuando cambie el Excel).</div>

    <div class="card">
      <div class="card-header">Actualizar tarifa</div>
      <input type="file" id="fileTarifa" accept=".xlsx,.xls"/>
      <button class="btn btn-blue" id="btnProcesarTarifa" style="margin-top:16px;">Importar tarifa</button>
      <div id="resultadoTarifa" style="margin-top:16px; font-size:0.9rem;"></div>
    </div>
  `;

  document.getElementById("btnProcesarTarifa").onclick = procesarTarifaExcel;
}

async function procesarTarifaExcel() {
  const file = document.getElementById("fileTarifa").files[0];
  const out = document.getElementById("resultadoTarifa");

  if (!file) {
    out.innerHTML = `<span style="color:red;">Selecciona un archivo.</span>`;
    return;
  }

  out.innerHTML = "Procesando tarifa…";

  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });

    const sheet = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    let headerRow = -1;
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i].some((c) => String(c).toLowerCase().includes("2n sku"))) {
        headerRow = i;
        break;
      }
    }

    if (headerRow === -1) {
      out.innerHTML = `<span style="color:red;">No se encontró la columna 2N SKU.</span>`;
      return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      range: headerRow,
      defval: ""
    });

    if (!rows.length) {
      out.innerHTML = `<span style="color:red;">Tarifa vacía.</span>`;
      return;
    }

    const keys = Object.keys(rows[0]);
    const skuKey = findHeaderKey(keys, [/sku/i]);
    const nombreKey = findHeaderKey(keys, [/nombre/i, /name/i]);
    const msrpKey = findHeaderKey(keys, [/msrp/i, /pvp/i]);

    const productos = {};
    let count = 0;

    rows.forEach((r) => {
      const sku = r[skuKey]?.toString().trim();
      if (!sku) return;

      productos[sku] = {
        sku,
        nombre: r[nombreKey] || "",
        pvp: toNum(r[msrpKey]),
        campos_originales: r
      };
      count++;
    });

    await db.collection("tarifas").doc("v1").set({
      ultima_actualizacion: new Date().toISOString(),
      total_productos: count,
      productos
    });

    localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(productos));
    appState.tarifas = productos;

    out.innerHTML = `<span style="color:green;">Tarifa importada correctamente (${count} productos).</span>`;
  };

  reader.readAsArrayBuffer(file);
}
