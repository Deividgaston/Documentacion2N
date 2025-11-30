// js/ui_proyecto.js
// Importación del Excel de proyecto
// Soporta formato "normal" y formato Project Designer 2N (con secciones)

function renderProyecto(container) {
  container.innerHTML = `
    <div class="page-title">Proyecto</div>
    <div class="page-subtitle">
      Importa el Excel del proyecto (Project Designer 2N o Excel propio) para generar el presupuesto con la tarifa 2N.
    </div>

    <div class="card">
      <div class="card-header">Importar proyecto</div>
      <p class="info-text" style="margin-bottom:10px;">
        Formatos soportados:
        <br>• Excel "normal" con columnas de <strong>Referencia</strong> y <strong>Cantidad</strong>.
        <br>• Exportación desde <strong>Project Designer 2N</strong> con columnas de <strong>Nombre del producto / Número de pedido / Cantidad</strong>.
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

        // Intento 1: formato "normal" (cabeceras en la primera fila)
        const resultadoNormal = parseProyectoFormatoNormal(rows, tarifas);

        let lineas = resultadoNormal.lineas;
        let conTarifa = resultadoNormal.conTarifa;
        let sinTarifa = resultadoNormal.sinTarifa;
        let usadoFormato = resultadoNormal.usadoFormato;

        // Si no se ha podido detectar formato normal, intentamos Project Designer
        if (!usadoFormato) {
          const resultadoDesigner = parseProyectoProjectDesigner(rows, tarifas);
          lineas = resultadoDesigner.lineas;
          conTarifa = resultadoDesigner.conTarifa;
          sinTarifa = resultadoDesigner.sinTarifa;
          usadoFormato = resultadoDesigner.usadoFormato;
        }

        if (!usadoFormato || !lineas.length) {
          out.innerHTML = `
            <span style="color:#b91c1c;">
              No se ha podido interpretar el formato del Excel.
              Revisa que tenga columnas de referencia/cantidad o que sea una exportación de Project Designer 2N.
            </span>`;
          return;
        }

        appState.lineasProyecto = lineas;

        out.innerHTML = `
          <p>
            <strong>${lineas.length}</strong> líneas procesadas.<br>
            Con tarifa: <strong>${conTarifa}</strong><br>
            Sin tarifa: <strong>${sinTarifa}</strong>
          </p>
          <p class="info-text" style="margin-top:6px;">
            ${
              lineas.some(l => l.seccion)
                ? "Se han detectado secciones del proyecto (p.ej. intercomunicadores / monitores) desde Project Designer."
                : "Si el archivo procede de Project Designer, asegúrate de exportar el listado de productos con cantidades."
            }
            <br>Ahora puedes ir a la pestaña <strong>Presupuesto</strong> para ajustar cantidades,
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

/**
 * Formato "normal":
 * - Primera fila = cabeceras
 * - Buscamos columnas que contengan "ref", "cant", "desc"
 */
function parseProyectoFormatoNormal(rows, tarifas) {
  let lineas = [];
  let conTarifa = 0;
  let sinTarifa = 0;
  let usadoFormato = false;

  const header = (rows[0] || []).map((h) => String(h || "").toLowerCase());

  const idxRef = header.findIndex((h) => h.includes("ref"));
  const idxQty = header.findIndex(
    (h) => h.includes("cant") || h.includes("qty") || h.includes("ud")
  );
  const idxDesc = header.findIndex(
    (h) => h.includes("desc") || h.includes("concepto")
  );

  // Si no hay columnas mínimas, devolvemos que no se ha usado este formato
  if (idxRef === -1 || idxQty === -1) {
    return { lineas, conTarifa, sinTarifa, usadoFormato: false };
  }

  usadoFormato = true;

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
      incluir: !!tarifaItem,
      seccion: "" // en formato normal no tenemos secciones
    };

    if (tarifaItem) conTarifa++;
    else sinTarifa++;

    lineas.push(linea);
  }

  return { lineas, conTarifa, sinTarifa, usadoFormato };
}

/**
 * Formato Project Designer 2N:
 * - Varias "bloques" con títulos (intercomunicadores, PLACA DE CALLE, MONITORES, etc.).
 * - Dentro de cada bloque, una fila cabecera con:
 *   "Nombre del producto" / "Número de pedido" / "Cantidad"
 * - Las filas de productos tienen:
 *   nombre en una columna, código (número de pedido) y cantidad.
 *
 * Extraemos además la combinación de secciones:
 *   p.ej. "intercomunicadores / PLACA DE CALLE"
 */
function parseProyectoProjectDesigner(rows, tarifas) {
  let lineas = [];
  let conTarifa = 0;
  let sinTarifa = 0;
  let usadoFormato = false;

  let currentTitles = []; // para acumular últimas 1-2 secciones/títulos
  let headerIdx = null;   // índices de Nombre, Ref, Cantidad

  const isEmpty = (val) =>
    val === null || val === undefined || String(val).trim() === "";

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const c0 = (r[0] || "").toString().trim();

    // Detectar si es una fila "título/sección" (solo primera celda con texto)
    const restHasData = r.slice(1).some((v) => !isEmpty(v));
    const lower0 = c0.toLowerCase();

    const isTitleRow =
      c0 &&
      !restHasData &&
      !/foto/i.test(c0) &&
      !/nombre del producto/i.test(c0) &&
      !/número de pedido/i.test(c0) &&
      !/cantidad/i.test(c0);

    if (isTitleRow) {
      // Guardamos la sección. Solo mantenemos las dos últimas para combinar.
      currentTitles.push(c0);
      if (currentTitles.length > 2) currentTitles.shift();
      continue;
    }

    // Detectar fila cabecera de tabla de productos
    const rowLower = r.map((x) => String(x || "").toLowerCase());
    const isHeader =
      rowLower.some((x) => x.includes("nombre del producto")) &&
      rowLower.some((x) => x.includes("número de pedido")) &&
      rowLower.some((x) => x.includes("cantidad"));

    if (isHeader) {
      usadoFormato = true;

      const idxName = r.findIndex((x) =>
        String(x || "").toLowerCase().includes("nombre del producto")
      );
      const idxRef = r.findIndex((x) =>
        String(x || "").toLowerCase().includes("número de pedido")
      );
      const idxQty = r.findIndex((x) =>
        String(x || "").toLowerCase().includes("cantidad")
      );

      headerIdx = { idxName, idxRef, idxQty };
      continue;
    }

    // Si tenemos cabeceras detectadas, interpretamos las filas siguientes como posibles productos
    if (headerIdx && headerIdx.idxRef >= 0 && headerIdx.idxQty >= 0) {
      const refRaw = r[headerIdx.idxRef];
      const qtyRaw = r[headerIdx.idxQty];

      const ref = (refRaw || "").toString().trim();
      const qty = toNum(qtyRaw);

      if (!ref || !qty) {
        // puede ser línea vacía o separador, lo ignoramos
        continue;
      }

      const descExcel =
        headerIdx.idxName >= 0
          ? (r[headerIdx.idxName] || "").toString().trim()
          : "";

      const tarifaItem = tarifas[ref] || null;
      const pvp = tarifaItem
        ? toNum(tarifaItem.pvp || tarifaItem.PVP || tarifaItem.precio)
        : 0;
      const descTarifa = tarifaItem ? tarifaItem.descripcion || "" : "";

      const seccion = currentTitles.length
        ? currentTitles.join(" / ")
        : "";

      const linea = {
        ref,
        descripcion: descExcel || descTarifa || "",
        cantidad: qty,
        pvp,
        incluir: !!tarifaItem, // por defecto solo entra si hay precio en tarifa
        seccion
      };

      if (tarifaItem) conTarifa++;
      else sinTarifa++;

      lineas.push(linea);
    }
  }

  return { lineas, conTarifa, sinTarifa, usadoFormato };
}
