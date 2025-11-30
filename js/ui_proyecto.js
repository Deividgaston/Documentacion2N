// js/ui_proyecto.js
// Importación del Excel de proyecto

function renderProyecto(container) {
  container.innerHTML = `
    <div class="page-title">Proyecto</div>
    <div class="page-subtitle">
      Importa el Excel del proyecto para generar el presupuesto con la tarifa 2N.
    </div>

    <div class="card">
      <div class="card-header">Importar proyecto</div>
      <p class="info-text" style="margin-bottom:10px;">
        El Excel debe contener al menos columnas de <strong>Referencia</strong> y <strong>Cantidad</strong>.
        Opcionalmente también <strong>Descripción</strong>.
      </p>
      <input type="file" id="fileProyecto" accept=".xlsx,.xls" />
      <button class="btn btn-blue" id="btnProyecto" style="margin-top:12px;">Procesar proyecto</button>
      <div id="resProyecto" style="margin-top:14px; font-size:0.85rem;"></div>
    </div>

    <div class="card">
      <div class="card-header">Estado</div>
      <p class="info-text" id="estadoProyecto">
        ${
          appState.lineasProyecto.length
            ? `Actualmente hay <strong>${appState.lineasProyecto.length}</strong> líneas cargadas.`
            : "Todavía no se ha importado ningún proyecto."
        }
      </p>
    </div>
  `;

  const fileInput = document.getElementById("fileProyecto");
  const btn = document.getElementById("btnProyecto");
  const out = document.getElementById("resProyecto");
  const estado = document.getElementById("estadoProyecto");

  btn.onclick = async () => {
    if (!fileInput.files || !fileInput.files[0]) {
      out.innerHTML =
        `<span style="color:#b91c1c;">Selecciona un archivo Excel primero.</span>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Procesando...";
    out.innerHTML = "";

    const file = fileInput.files[0];

    try {
      const tarifas = await loadTarifasOnce(); // 1 sola lectura máx.
      leerExcelComoMatriz(file, (err, rows) => {
        btn.disabled = false;
        btn.textContent = "Procesar proyecto";

        if (err) {
          console.error(err);
          out.innerHTML =
            `<span style="color:#b91c1c;">No se ha podido leer el Excel.</span>`;
          return;
        }

        if (!rows || rows.length < 2) {
          out.innerHTML =
            `<span style="color:#b91c1c;">El Excel no tiene datos suficientes.</span>`;
          return;
        }

        const header = rows[0].map((h) => String(h || "").toLowerCase());

        const idxRef = header.findIndex((h) => h.includes("ref"));
        const idxQty = header.findIndex(
          (h) => h.includes("cant") || h.includes("qty") || h.includes("ud")
        );
        const idxDesc = header.findIndex(
          (h) => h.includes("desc") || h.includes("concepto")
        );

        if (idxRef === -1 || idxQty === -1) {
          out.innerHTML = `
            <span style="color:#b91c1c;">
              No se han encontrado columnas de referencia/cantidad. Revisa los encabezados.
            </span>`;
          return;
        }

        const lineas = [];
        let conTarifa = 0;
        let sinTarifa = 0;

        for (let i = 1; i < rows.length; i++) {
          const r = rows[i] || [];
          const ref = (r[idxRef] || "").toString().trim();
          if (!ref) continue;

          const qty = toNum(r[idxQty]);
          if (!qty) continue;

          const descExcel =
            idxDesc >= 0 ? (r[idxDesc] || "").toString().trim() : "";

          const tarifaItem = tarifas[ref] || null;
          const pvp = tarifaItem ? toNum(tarifaItem.pvp || tarifaItem.PVP || tarifaItem.precio) : 0;
          const descTarifa = tarifaItem ? tarifaItem.descripcion || "" : "";

          const linea = {
            ref,
            descripcion: descExcel || descTarifa || "",
            cantidad: qty,
            pvp,
            incluir: !!tarifaItem // por defecto solo entra si tiene precio en tarifa
          };

          if (tarifaItem) conTarifa++;
          else sinTarifa++;

          lineas.push(linea);
        }

        appState.lineasProyecto = lineas;

        out.innerHTML = `
          <p>
            <strong>${lineas.length}</strong> líneas procesadas.<br>
            Con tarifa: <strong>${conTarifa}</strong><br>
            Sin tarifa: <strong>${sinTarifa}</strong>
          </p>
          <p class="info-text" style="margin-top:6px;">
            Ahora puedes ir a la pestaña <strong>Presupuesto</strong> para ajustar cantidades,
            descuentos y exportar a PDF/Excel.
          </p>
        `;

        estado.innerHTML = `Actualmente hay <strong>${lineas.length}</strong> líneas cargadas.`;
      });
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      btn.textContent = "Procesar proyecto";
      out.innerHTML =
        `<span style="color:#b91c1c;">Error inesperado cargando tarifa/proyecto.</span>`;
    }
  };
}
