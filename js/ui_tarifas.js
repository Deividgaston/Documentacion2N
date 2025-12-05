// js/ui_tarifas.js
// Pantalla de TIPOS DE TARIFA: definición en Firestore + export a Excel con plantillas

window.appState = window.appState || {};
appState.tarifasTipos = appState.tarifasTipos || {};
appState.tarifasTiposLoaded = appState.tarifasTiposLoaded || false;
appState.tarifasTipoSeleccionadoId =
  appState.tarifasTipoSeleccionadoId || null;

// ================================
// CONFIG INICIAL (patrón actual)
// ================================
//
// OJO: estos son los tipos de tarifa estándar que has subido:
//
//  - ES_PVP   -> 2N pricelist 2026_01 ES EUR PVP.xlsx
//  - ES_SUBD  -> 2N pricelist 2026_01 ES EUR SubD.xlsx
//  - ES_BBD   -> 2N pricelist 2026_01 ES EUR BBD.xlsx
//  - ES_RP1   -> 2N pricelist 2026_01 ES EUR RP1.xlsx
//  - ES_RP2   -> 2N pricelist 2026_01 ES EUR RP2.xlsx
//  - EN_SUBD  -> 2N pricelist 2026_01 EN EUR SubD.xlsx
//  - EN_VAD   -> 2N pricelist 2026_01 EN EUR VAD.xlsx
//
// Estos se crearán en Firestore SOLO si la colección tarifas_tipos está vacía.

const DEFAULT_TIPOS_TARIFA = {
  ES_PVP: {
    id: "ES_PVP",
    nombre: "PVP Público ES",
    idioma: "ES",
    moneda: "EUR",
    plantillaPath: "plantillas/2N_pricelist_2026_01_ES_EUR_PVP.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: null, // no hay descuentos en cabecera
    columnas: [
      // MSRP en columna C
      { id: "msrp", col: 3, descuento: 0, actualizarCabecera: false },
    ],
    descuentoPrincipal: 0,
    activo: true,
    orden: 10,
  },

  ES_RP1: {
    id: "ES_RP1",
    nombre: "Recommended Reseller Price 1 ES",
    idioma: "ES",
    moneda: "EUR",
    plantillaPath: "plantillas/2N_pricelist_2026_01_ES_EUR_RP1.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
      // Col 3 = RP1 (10% dto), col 4 = MSRP
      { id: "rp1", col: 3, descuento: 0.10, actualizarCabecera: true },
      { id: "msrp", col: 4, descuento: 0, actualizarCabecera: false },
    ],
    descuentoPrincipal: 0.10,
    activo: true,
    orden: 20,
  },

  ES_RP2: {
    id: "ES_RP2",
    nombre: "Recommended Reseller Price 2 ES",
    idioma: "ES",
    moneda: "EUR",
    plantillaPath: "plantillas/2N_pricelist_2026_01_ES_EUR_RP2.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
      // Col 3 = RP2 (28% dto), col 4 = MSRP
      { id: "rp2", col: 3, descuento: 0.28, actualizarCabecera: true },
      { id: "msrp", col: 4, descuento: 0, actualizarCabecera: false },
    ],
    descuentoPrincipal: 0.28,
    activo: true,
    orden: 30,
  },

  ES_SUBD: {
    id: "ES_SUBD",
    nombre: "Subdistribuidor ES (plantilla SUBD)",
    idioma: "ES",
    moneda: "EUR",
    plantillaPath: "plantillas/2N_pricelist_2026_01_ES_EUR_SubD.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
      // Col 3 = SubD (36%), col 4 = RP2 (28%), col 5 = RP1 (10%), col 6 = MSRP
      { id: "subd", col: 3, descuento: 0.36, actualizarCabecera: true },
      { id: "rp2", col: 4, descuento: 0.28, actualizarCabecera: true },
      { id: "rp1", col: 5, descuento: 0.10, actualizarCabecera: true },
      { id: "msrp", col: 6, descuento: 0, actualizarCabecera: false },
    ],
    descuentoPrincipal: 0.36,
    activo: true,
    orden: 40,
  },

  ES_BBD: {
    id: "ES_BBD",
    nombre: "Broadline Distributor ES (BBD)",
    idioma: "ES",
    moneda: "EUR",
    plantillaPath: "plantillas/2N_pricelist_2026_01_ES_EUR_BBD.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
      // Col 3..7: NFR Dist, NFR Res, SubD(39%), RP2, RP1 · Col 8 = MSRP
      { id: "nfrDist", col: 3, descuento: 0.55, actualizarCabecera: true },
      { id: "nfrRes", col: 4, descuento: 0.50, actualizarCabecera: true },
      { id: "subd", col: 5, descuento: 0.39, actualizarCabecera: true },
      { id: "rp2", col: 6, descuento: 0.28, actualizarCabecera: true },
      { id: "rp1", col: 7, descuento: 0.10, actualizarCabecera: true },
      { id: "msrp", col: 8, descuento: 0, actualizarCabecera: false },
    ],
    descuentoPrincipal: 0.39,
    activo: true,
    orden: 50,
  },

  EN_SUBD: {
    id: "EN_SUBD",
    nombre: "Subdistributor EN (plantilla SUBD EN)",
    idioma: "EN",
    moneda: "EUR",
    plantillaPath: "plantillas/2N_pricelist_2026_01_EN_EUR_SubD.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
      { id: "subd", col: 3, descuento: 0.36, actualizarCabecera: true },
      { id: "rp2", col: 4, descuento: 0.28, actualizarCabecera: true },
      { id: "rp1", col: 5, descuento: 0.10, actualizarCabecera: true },
      { id: "msrp", col: 6, descuento: 0, actualizarCabecera: false },
    ],
    descuentoPrincipal: 0.36,
    activo: true,
    orden: 60,
  },

  EN_VAD: {
    id: "EN_VAD",
    nombre: "VAD EN",
    idioma: "EN",
    moneda: "EUR",
    plantillaPath: "plantillas/2N_pricelist_2026_01_EN_EUR_VAD.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
      // Col 3..7: NFR Dist, NFR Res, VAD(42%), RP2, RP1 · Col 8 = MSRP
      { id: "nfrDist", col: 3, descuento: 0.55, actualizarCabecera: true },
      { id: "nfrRes", col: 4, descuento: 0.50, actualizarCabecera: true },
      { id: "vad", col: 5, descuento: 0.42, actualizarCabecera: true },
      { id: "rp2", col: 6, descuento: 0.28, actualizarCabecera: true },
      { id: "rp1", col: 7, descuento: 0.10, actualizarCabecera: true },
      { id: "msrp", col: 8, descuento: 0, actualizarCabecera: false },
    ],
    descuentoPrincipal: 0.42,
    activo: true,
    orden: 70,
  },
};

// ================================
// Helpers Firestore
// ================================

async function loadTarifasTiposFromFirestore() {
  if (appState.tarifasTiposLoaded) {
    return appState.tarifasTipos;
  }

  const db = firebase.firestore();
  const colRef = db.collection("tarifas_tipos");
  const snap = await colRef.get();

  const result = {};

  if (snap.empty) {
    // Primera vez -> sembramos los tipos estándar
    const batch = db.batch();
    Object.values(DEFAULT_TIPOS_TARIFA).forEach((tipo) => {
      const docRef = colRef.doc(tipo.id);
      batch.set(docRef, tipo, { merge: true });
      result[tipo.id] = { ...tipo };
    });
    await batch.commit();
  } else {
    snap.forEach((doc) => {
      const data = doc.data() || {};
      const id = data.id || doc.id;
      result[id] = { id, ...data };
    });

    // Rellenar con defaults si falta algún campo importante
    Object.entries(result).forEach(([id, tipo]) => {
      const def = DEFAULT_TIPOS_TARIFA[id];
      if (def) {
        result[id] = {
          ...def,
          ...tipo, // el usuario puede haber sobreescrito cosas
        };
      }
    });
  }

  appState.tarifasTipos = result;
  appState.tarifasTiposLoaded = true;

  // Seleccionamos el primero por defecto
  if (!appState.tarifasTipoSeleccionadoId) {
    const idsOrdenados = Object.values(result)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map((t) => t.id);
    appState.tarifasTipoSeleccionadoId = idsOrdenados[0] || null;
  }

  return result;
}

async function guardarTarifaTipoEnFirestore(tipo) {
  if (!tipo || !tipo.id) return;
  const db = firebase.firestore();
  const docRef = db.collection("tarifas_tipos").doc(tipo.id);
  const payload = { ...tipo };
  await docRef.set(payload, { merge: true });
  appState.tarifasTipos[tipo.id] = payload;
}

// ================================
// Helper: tarifa base 2N (PVP)
// Reutiliza la caché que ya usas en presupuesto
// ================================
async function getTarifasBase2N() {
  // En ui_presupuesto.js ya tienes cargarTarifasDesdeFirestore() + appState.tarifasCache
  if (appState.tarifasCache) return appState.tarifasCache;
  if (typeof cargarTarifasDesdeFirestore === "function") {
    const data = await cargarTarifasDesdeFirestore();
    return data;
  }
  console.warn(
    "[Tarifas] cargarTarifasDesdeFirestore no está disponible. Revisa el orden de scripts."
  );
  return {};
}

// ================================
// RENDER PRINCIPAL
// ================================

function renderTarifasView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  const subtitle = document.getElementById("currentViewSubtitle");
  if (subtitle) {
    subtitle.textContent =
      "Define los tipos de tarifa (descuentos sobre PVP) y genera las listas de precios oficiales desde plantillas Excel.";
  }

  container.innerHTML = `
    <div class="presupuesto-layout">
      <!-- Columna izquierda: listado de tipos -->
      <div class="presupuesto-left-column">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Tipos de tarifa</div>
              <div class="card-subtitle">
                Configuración guardada en Firestore (colección <code>tarifas_tipos</code>).
              </div>
            </div>
            <button id="btnNuevoTipoTarifa" class="btn btn-secondary btn-sm">
              Nuevo tipo
            </button>
          </div>
          <div class="card-body" id="tarifasLista">
            Cargando tipos de tarifa...
          </div>
        </div>
      </div>

      <!-- Columna derecha: detalle / edición / export -->
      <div class="presupuesto-right-column">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Detalle del tipo de tarifa</div>
          </div>
          <div class="card-body" id="tarifasDetalle">
            Selecciona un tipo de tarifa de la lista.
          </div>
        </div>
      </div>
    </div>
  `;

  // Listeners básicos
  const btnNuevo = document.getElementById("btnNuevoTipoTarifa");
  if (btnNuevo) {
    btnNuevo.addEventListener("click", () => {
      mostrarFormularioTipoTarifa(null); // nuevo
    });
  }

  // Cargar datos
  loadTarifasTiposFromFirestore()
    .then(() => {
      pintarListadoTiposTarifa();
      if (appState.tarifasTipoSeleccionadoId) {
        mostrarFormularioTipoTarifa(
          appState.tarifasTipos[appState.tarifasTipoSeleccionadoId]
        );
      }
    })
    .catch((err) => {
      console.error("[Tarifas] Error cargando tipos:", err);
      const lista = document.getElementById("tarifasLista");
      if (lista) {
        lista.innerHTML = `
          <p style="color:#b91c1c; font-size:0.85rem;">
            Error cargando la configuración de tipos de tarifa.
          </p>
        `;
      }
    });
}

// ================================
// Listado de tipos (columna izq.)
// ================================

function pintarListadoTiposTarifa() {
  const lista = document.getElementById("tarifasLista");
  if (!lista) return;

  const tipos = Object.values(appState.tarifasTipos || {}).sort((a, b) => {
    const oa = a.orden || 0;
    const ob = b.orden || 0;
    if (oa !== ob) return oa - ob;
    return (a.nombre || "").localeCompare(b.nombre || "");
  });

  if (!tipos.length) {
    lista.innerHTML = `
      <p style="font-size:0.85rem; color:#6b7280;">
        No hay tipos de tarifa configurados. Se crearán los tipos estándar al recargar.
      </p>
    `;
    return;
  }

  const filas = tipos
    .map((t) => {
      const activo = t.activo !== false;
      const seleccionado = t.id === appState.tarifasTipoSeleccionadoId;
      return `
        <tr class="tarifa-row ${
          seleccionado ? "row-selected" : ""
        }" data-id="${t.id}">
          <td style="width:26px;">
            <span class="status-dot ${activo ? "bg-green" : "bg-gray"}"></span>
          </td>
          <td>
            <div style="font-weight:500;">${t.nombre}</div>
            <div style="font-size:0.78rem; color:#6b7280;">
              ID: <code>${t.id}</code> · Idioma: ${t.idioma || "-"} · ${
        t.moneda || "EUR"
      }
            </div>
          </td>
          <td style="width:90px; text-align:right; font-size:0.8rem;">
            ${typeof t.descuentoPrincipal === "number"
              ? `${(t.descuentoPrincipal * 100).toFixed(0)}%`
              : "-"}
          </td>
        </tr>
      `;
    })
    .join("");

  lista.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th style="width:26px;"></th>
          <th>Tipo de tarifa</th>
          <th style="width:90px; text-align:right;">Dto. PVP</th>
        </tr>
      </thead>
      <tbody>
        ${filas}
      </tbody>
    </table>
  `;

  lista.querySelectorAll(".tarifa-row").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.dataset.id;
      appState.tarifasTipoSeleccionadoId = id;
      pintarListadoTiposTarifa();
      mostrarFormularioTipoTarifa(appState.tarifasTipos[id]);
    });
  });
}

// ================================
// Formulario de detalle / edición
// ================================

function mostrarFormularioTipoTarifa(tipoOriginal) {
  const detalle = document.getElementById("tarifasDetalle");
  if (!detalle) return;

  const esNuevo = !tipoOriginal;

  const tipo = tipoOriginal || {
    id: "",
    nombre: "",
    idioma: "ES",
    moneda: "EUR",
    plantillaPath: "",
    descuentoPrincipal: 0,
    activo: true,
    orden: 100,
  };

  detalle.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>ID tipo (único)</label>
        <input id="tipoId" type="text" ${esNuevo ? "" : "readonly"} value="${
    tipo.id || ""
  }" />
        <p style="font-size:0.75rem; color:#6b7280; margin-top:0.25rem;">
          Ejemplos: <code>ES_PVP</code>, <code>ES_INSTALADOR_15</code>
        </p>
      </div>

      <div class="form-group">
        <label>Nombre visible</label>
        <input id="tipoNombre" type="text" value="${tipo.nombre || ""}" />
      </div>

      <div class="form-group">
        <label>Idioma</label>
        <select id="tipoIdioma">
          <option value="ES" ${
            tipo.idioma === "ES" ? "selected" : ""
          }>ES</option>
          <option value="EN" ${
            tipo.idioma === "EN" ? "selected" : ""
          }>EN</option>
        </select>
      </div>

      <div class="form-group">
        <label>Moneda</label>
        <input id="tipoMoneda" type="text" value="${
          tipo.moneda || "EUR"
        }" />
      </div>

      <div class="form-group">
        <label>Descuento principal sobre PVP (%)</label>
        <input id="tipoDescuento" type="number" min="0" max="90" step="1"
          value="${
            typeof tipo.descuentoPrincipal === "number"
              ? (tipo.descuentoPrincipal * 100).toFixed(0)
              : "0"
          }" />
        <p style="font-size:0.75rem; color:#6b7280; margin-top:0.25rem;">
          Para plantillas simples tipo PVP / RP1 / RP2. Para plantillas multi-columna (BBD, VAD) el detalle está en la configuración avanzada.
        </p>
      </div>

      <div class="form-group">
        <label>Ruta plantilla Excel</label>
        <input id="tipoPlantillaPath" type="text"
          value="${tipo.plantillaPath || ""}"
          placeholder="plantillas/2N_pricelist_2026_01_ES_EUR_PVP.xlsx" />
        <p style="font-size:0.75rem; color:#6b7280; margin-top:0.25rem;">
          Debe ser accesible por el navegador (misma ruta donde subas las plantillas .xlsx).
        </p>
      </div>

      <div class="form-group">
        <label>Orden</label>
        <input id="tipoOrden" type="number" step="1" value="${
          tipo.orden || 100
        }" />
      </div>

      <div class="form-group">
        <label>Activo</label>
        <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.85rem;">
          <input id="tipoActivo" type="checkbox" ${
            tipo.activo !== false ? "checked" : ""
          } />
          Disponible para exportar
        </label>
      </div>
    </div>

    <div class="form-group mt-3">
      <label>Configuración avanzada de columnas (solo lectura aquí)</label>
      <p style="font-size:0.78rem; color:#6b7280;">
        Para los tipos estándar (PVP, RP1, RP2, SubD, BBD, VAD) la configuración de columnas
        (qué columna lleva qué descuento) viene precargada y se guarda en Firestore.
        En tipos nuevos simples se usará por defecto la columna 3 como precio con el descuento principal.
      </p>
      <pre style="
        background:#f9fafb;
        border-radius:0.5rem;
        padding:0.5rem 0.75rem;
        font-size:0.75rem;
        max-height:160px;
        overflow:auto;
      ">${
        tipo.columnas
          ? JSON.stringify(tipo.columnas, null, 2)
          : "// Sin columnas específicas: se usará la columna 3 con descuentoPrincipal."
      }</pre>
    </div>

    <div class="mt-3" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <button id="btnGuardarTipoTarifa" class="btn btn-primary btn-sm">
        Guardar tipo
      </button>
      ${
        !esNuevo
          ? `<button id="btnDuplicarTipoTarifa" class="btn btn-secondary btn-sm">
               Duplicar como nuevo
             </button>`
          : ""
      }
      ${
        !esNuevo
          ? `<button id="btnExportarTipoTarifa" class="btn btn-secondary btn-sm">
               Exportar Excel
             </button>`
          : ""
      }
    </div>

    <div id="tarifasDetalleMsg" class="alert mt-3" style="display:none;"></div>
  `;

  const msgBox = document.getElementById("tarifasDetalleMsg");

  const btnGuardar = document.getElementById("btnGuardarTipoTarifa");
  if (btnGuardar) {
    btnGuardar.addEventListener("click", async () => {
      const id = (document.getElementById("tipoId").value || "").trim();
      const nombre = (document.getElementById("tipoNombre").value || "").trim();
      const idioma = document.getElementById("tipoIdioma").value || "ES";
      const moneda = (document.getElementById("tipoMoneda").value || "EUR").trim();
      const dtoNum =
        Number(document.getElementById("tipoDescuento").value) || 0;
      const plantillaPath =
        (document.getElementById("tipoPlantillaPath").value || "").trim();
      const orden =
        Number(document.getElementById("tipoOrden").value) || 100;
      const activo = !!document.getElementById("tipoActivo").checked;

      if (!id) {
        mostrarMsgTarifaDetalle(
          "El ID del tipo de tarifa es obligatorio.",
          true
        );
        return;
      }
      if (!nombre) {
        mostrarMsgTarifaDetalle(
          "El nombre visible es obligatorio.",
          true
        );
        return;
      }

      const descuentoPrincipal = dtoNum / 100;

      const nuevoTipo = {
        ...(tipoOriginal || {}),
        id,
        nombre,
        idioma,
        moneda,
        plantillaPath,
        descuentoPrincipal,
        activo,
        orden,
      };

      try {
        await guardarTarifaTipoEnFirestore(nuevoTipo);
        appState.tarifasTipos[id] = nuevoTipo;
        appState.tarifasTipoSeleccionadoId = id;
        pintarListadoTiposTarifa();
        mostrarFormularioTipoTarifa(nuevoTipo);
        mostrarMsgTarifaDetalle("Tipo de tarifa guardado correctamente.", false);
      } catch (e) {
        console.error("[Tarifas] Error guardando tipo:", e);
        mostrarMsgTarifaDetalle(
          "Error guardando el tipo de tarifa en Firestore.",
          true
        );
      }
    });
  }

  const btnDuplicar = document.getElementById("btnDuplicarTipoTarifa");
  if (btnDuplicar && tipoOriginal) {
    btnDuplicar.addEventListener("click", () => {
      const copia = {
        ...tipoOriginal,
        id: "",
        nombre: tipoOriginal.nombre + " (copia)",
      };
      mostrarFormularioTipoTarifa(copia);
    });
  }

  const btnExportar = document.getElementById("btnExportarTipoTarifa");
  if (btnExportar && tipoOriginal) {
    btnExportar.addEventListener("click", () => {
      exportarTarifaExcel(tipoOriginal.id);
    });
  }
}

function mostrarMsgTarifaDetalle(texto, esError) {
  const msg = document.getElementById("tarifasDetalleMsg");
  if (!msg) return;
  msg.style.display = "flex";
  msg.textContent = texto;
  msg.className = "alert mt-3 " + (esError ? "alert-error" : "alert-success");
}

// ================================
// EXPORTAR EXCEL MANTENIENDO DISEÑO
// ================================
//
// Usa la plantilla original (misma estructura, colores, merges…)
// y solo sobrescribe las celdas de precios y, si aplica, la fila de descuentos.
//

async function exportarTarifaExcel(tipoId) {
  const tipo = appState.tarifasTipos[tipoId];
  if (!tipo) {
    alert("Tipo de tarifa no encontrado.");
    return;
  }
  if (!tipo.plantillaPath) {
    alert(
      "Este tipo de tarifa no tiene definida la ruta de la plantilla Excel (plantillaPath)."
    );
    return;
  }

  const tarifasBase = await getTarifasBase2N();
  const refs = Object.keys(tarifasBase || {});
  if (!refs.length) {
    alert(
      "No se han encontrado productos en la tarifa base. Revisa la carga desde Firestore."
    );
    return;
  }

  let columnas = tipo.columnas;
  if (!Array.isArray(columnas) || !columnas.length) {
    // Caso sencillo: una sola columna con descuentoPrincipal en la columna 3
    const dto =
      typeof tipo.descuentoPrincipal === "number"
        ? tipo.descuentoPrincipal
        : 0;
    columnas = [
      {
        id: "precio",
        col: 3,
        descuento: dto,
        actualizarCabecera: false,
      },
    ];
  }

  const hoja = tipo.hoja || "Price List";
  const filaCabDesc = tipo.filaCabeceraDescuentos || null;

  try {
    // 1) Cargar plantilla
    const resp = await fetch(tipo.plantillaPath);
    if (!resp.ok) {
      throw new Error(
        "No se pudo cargar la plantilla: " + tipo.plantillaPath
      );
    }
    const buf = await resp.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[hoja];
    if (!ws) {
      alert(
        `La hoja "${hoja}" no existe en la plantilla seleccionada.`
      );
      return;
    }

    // 2) Mapear SKU -> fila usando la columna A
    const skuToRow = {};
    const maxRows = 20000; // tope razonable
    for (let r = 1; r <= maxRows; r++) {
      const cellAddr = "A" + r;
      const cell = ws[cellAddr];
      if (!cell || cell.v == null) continue;
      const sku = String(cell.v).trim();
      if (!sku) continue;
      skuToRow[sku] = r;
    }

    // 3) Actualizar fila de descuentos en cabecera (si aplica)
    if (filaCabDesc && Array.isArray(columnas)) {
      columnas.forEach((colDef) => {
        if (!colDef.actualizarCabecera) return;
        const dto = colDef.descuento || 0;
        const texto =
          dto > 0 ? `${(dto * 100).toFixed(0)} %` : "";
        if (!texto) return;

        const colIndex = colDef.col - 1;
        const addr = XLSX.utils.encode_cell({
          r: filaCabDesc - 1,
          c: colIndex,
        });
        ws[addr] = { t: "s", v: texto };
      });
    }

    // 4) Rellenar precios por SKU
    for (const sku of Object.keys(tarifasBase)) {
      const fila = skuToRow[sku];
      if (!fila) continue;

      const prod = tarifasBase[sku] || {};
      const pvp = Number(prod.pvp || 0);
      if (!pvp) continue;

      columnas.forEach((colDef) => {
        const col = colDef.col;
        if (!col || col < 1) return;

        let valor = pvp;
        const dto = colDef.descuento || 0;
        if (colDef.id !== "msrp") {
          valor = pvp * (1 - dto);
        }

        const addr = XLSX.utils.encode_cell({
          r: fila - 1,
          c: col - 1,
        });
        ws[addr] = {
          t: "n",
          v: Number(valor.toFixed(2)),
        };
      });
    }

    // 5) Descargar con el mismo diseño
    const nombreBase =
      tipo.nombre ||
      tipo.id ||
      "Tarifa_2N";
    const fileName = nombreBase.replace(/[^a-zA-Z0-9_\-]+/g, "_") + ".xlsx";

    XLSX.writeFile(wb, fileName);
  } catch (e) {
    console.error("[Tarifas] Error exportando Excel:", e);
    alert(
      "Se ha producido un error al generar la tarifa en Excel. Revisa la ruta de la plantilla y los datos."
    );
  }
}

console.log(
  "%cUI Tarifas cargada (ui_tarifas.js)",
  "color:#0ea5e9; font-weight:600;"
);

window.renderTarifasView = renderTarifasView;
