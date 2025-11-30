// js/ui_proyecto.js
// Importación del Excel de proyecto

function renderProyecto(container) {
  container.innerHTML = `
    <div class="page-title">Proyecto</div>
    <div class="page-subtitle">Importa el Excel del proyecto para generar el presupuesto.</div>

    <div class="card">
      <div class="card-header">Importar proyecto</div>
      <input type="file" id="fileProyecto" accept=".xlsx,.xls"/>
      <button class="btn btn-blue" id="btnProyecto" style="margin-top:16px;">Procesar proyecto</button>
      <div id="resProyecto" style="margin-top:16px; font-size:0.9rem;"></div>
    </div>
  `;

  document.getElementById("btnProyecto").onclick = procesarProyectoExcel;
}

async function procesarProyectoExcel() {
  const file = document.getElementById("fileProyecto").files[0];
  const out = document.getElementById("resProyecto");

  if (!file) {
    out.innerHTML = `<span style="color:red;">Selecciona un archivo.</span>`;
    return;
  }

  out.innerHTML = "Procesando proyecto…";

  const tarifas = await loadTarifasOnce();

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      out.innerHTML = `<span style="color:red;">El Excel del proyecto está vacío.</span>`;
      return;
    }

    const sample = rows[0];
    const cols = Object.keys(sample);
    const colRef = cols.find((c) => /sku|ref|referencia/i.test(c));
    const colQty = cols.find((c) => /cant|qty|cantidad/i.test(c));

    if (!colRef || !colQty) {
      out.innerHTML =
        `<span style="color:red;">No encuentro columnas de referencia/cantidad.</span>`;
      return;
    }

    const lineas = [];
    let conTarifa = 0;
    let sinTarifa = 0;

    rows.forEach((r) => {
      const ref = r[colRef]?.toString().trim();
      if (!ref) return;

      const qty = Number(r[colQty] || 0);
      if (!qty) return;

      const tarifa = tarifas[ref];

      if (tarifa) conTarifa++;
      else sinTarifa++;

      lineas.push({
        referencia: ref,
        cantidad: qty,
        nombreTarifa: tarifa ? tarifa.nombre : "",
        pvp: tarifa ? tarifa.pvp : 0
      });
    });

    appState.lineasProyecto = lineas;

    out.innerHTML = `
      <p>
        <strong>${lineas.length}</strong> líneas procesadas<br>
        Con tarifa: <strong>${conTarifa}</strong><br>
        Sin tarifa: <strong>${sinTarifa}</strong>
      </p>
    `;
  };

  reader.readAsArrayBuffer(file);
}
