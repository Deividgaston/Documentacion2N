// js/ui_tarifa.js
// Importar y subir tarifa 2N a Firestore (mínimas escrituras)

function renderTarifa(container) {
  container.innerHTML = `
    <div class="page-title">Tarifa 2N</div>
    <div class="page-subtitle">
      Importa la tarifa 2N desde Excel y súbela a Firestore para reutilizarla en todos los proyectos.
    </div>

    <div class="card">
      <div class="card-header">Importar tarifa</div>
      <p class="info-text" style="margin-bottom:10px;">
        El Excel debe contener columnas de <strong>Referencia</strong>, <strong>Descripción</strong> y <strong>PVP</strong>.
        Las cabeceras se detectan automáticamente (ref, referencia, desc, descripción, pvp, precio...).
      </p>
      <input type="file" id="fileTarifa" accept=".xlsx,.xls" />
      <button class="btn btn-blue" id="btnTarifa" style="margin-top:12px;">Procesar tarifa</button>
      <div id="resTarifa" style="margin-top:14px; font-size:0.85rem;"></div>
    </div>

    <div class="card card-soft">
      <div class="card-header">Estado de la tarifa cargada</div>
      <p class="info-text" id="estadoTarifa">
        ${
          appState.tarifas && Object.keys(appState.tarifas).length
            ? `Hay <strong>${Object.keys(appState.tarifas).length}</strong> referencias en memoria/localStorage.`
            : "Todavía no hay tarifa cargada en esta sesión."
        }
      </p>
    </div>
  `;

  const fileInput = document.getElementById("fileTarifa");
  const btn = document.getElementById("btnTarifa");
  const out = document.getElementById("resTarifa");
  const estado = document.getElementById("estadoTarifa");

  btn.onclick = async () => {
    if (!fileInput.files || !fileInput.files[0]) {
      out.innerHTML =
        `<span style="color:#b91c1c;">Selecciona un Excel de tarifa primero.</span>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Procesando...";
    out.innerHTML = "";

    const file = fileInput.files[0];

    leerExcelComoMatriz(file, async (err, rows) => {
      if (err) {
        console.error(err);
        btn.disabled = false;
        btn.textContent = "Procesar tarifa";
        out.innerHTML =
          `<span style="color:#b91c1c;">No se ha podido leer el Excel.</span>`;
        return;
      }

      if (!rows || rows.length < 2) {
        btn.disabled = false;
        btn.textContent = "Procesar tarifa";
        out.innerHTML =
          `<span style="color:#b91c1c;">El Excel no tiene datos suficientes.</span>`;
        return;
      }

      const header = rows[0].map((h) => String(h || "").toLowerCase());

      const idxRef = header.findIndex((h) => h.includes("ref"));
      const idxDesc = header.findIndex(
        (h) => h.includes("desc") || h.includes("concepto")
      );
      const idxPvp = header.findIndex(
        (h) => h.includes("pvp") || h.includes("precio") || h.includes("price")
      );

      if (idxRef === -1 || idxPvp === -1) {
        btn.disabled = false;
        btn.textContent = "Procesar tarifa";
        out.innerHTML = `
          <span style="color:#b91c1c;">
            No se han encontrado columnas de referencia/precio en la primera fila.
          </span>`;
        return;
      }

      const productos = {};
      let count = 0;

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const ref = (r[idxRef] || "").toString().trim();
        if (!ref) continue;

        const desc = idxDesc >= 0 ? (r[idxDesc] || "").toString().trim() : "";
        const pvp = toNum(r[idxPvp]);
        if (!pvp) continue;

        productos[ref] = {
          referencia: ref,
          descripcion: desc,
          pvp
        };
        count++;
      }

      try {
        // 1 escritura en Firestore
        await db.collection("tarifas").doc("v1").set({
          ultima_actualizacion: new Date().toISOString(),
          total_productos: count,
          productos
        });

        // cache local
        appState.tarifas = productos;
        try {
          localStorage.setItem(TARIFA_CACHE_KEY, JSON.stringify(productos));
        } catch (e) {
          console.warn("No se pudo cachear la tarifa", e);
        }

        out.innerHTML = `
          <p>
            Tarifa procesada con <strong>${count}</strong> referencias válidas.<br>
            Se ha guardado en Firestore (tarifas/v1) y en localStorage.
          </p>
        `;
        estado.innerHTML = `Hay <strong>${count}</strong> referencias en memoria/localStorage.`;
      } catch (e) {
        console.error(e);
        out.innerHTML =
          `<span style="color:#b91c1c;">Error guardando la tarifa en Firestore.</span>`;
      } finally {
        btn.disabled = false;
        btn.textContent = "Procesar tarifa";
      }
    });
  };
}
