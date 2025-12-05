// js/ui_tarifas.js
// Pantalla de TIPOS DE TARIFA: definición en Firestore + export a Excel con plantillas

window.appState = window.appState || {};
appState.tarifasTipos = appState.tarifasTipos || {};
appState.tarifasTiposLoaded = appState.tarifasTiposLoaded || false;
appState.tarifasTipoSeleccionadoId =
  appState.tarifasTipoSeleccionadoId || null;

// ================================
// CONFIG INICIAL (patrón oficial plantillas 2026)
// ================================

const BASE_PLANTILLAS =
  "https://raw.githubusercontent.com/Deividgaston/Documentacion2N/main/plantillas/";

const DEFAULT_TIPOS_TARIFA = {
  ES_PVP: {
    id: "ES_PVP",
    nombre: "PVP Público ES",
    idioma: "ES",
    moneda: "EUR",
    plantillaPath: BASE_PLANTILLAS + "2N%20pricelist%202026_01%20ES%20EUR%20PVP.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: null,
    columnas: [
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
    plantillaPath: BASE_PLANTILLAS + "2N%20pricelist%202026_01%20ES%20EUR%20RP1.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
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
    plantillaPath: BASE_PLANTILLAS + "2N%20pricelist%202026_01%20ES%20EUR%20RP2.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
      { id: "rp2", col: 3, descuento: 0.28, actualizarCabecera: true },
      { id: "msrp", col: 4, descuento: 0, actualizarCabecera: false },
    ],
    descuentoPrincipal: 0.28,
    activo: true,
    orden: 30,
  },

  ES_SUBD: {
    id: "ES_SUBD",
    nombre: "Subdistribuidor ES (ES SubD)",
    idioma: "ES",
    moneda: "EUR",
    plantillaPath: BASE_PLANTILLAS + "2N%20pricelist%202026_01%20ES%20EUR%20SubD.xlsx",
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
    orden: 40,
  },

  ES_BBD: {
    id: "ES_BBD",
    nombre: "Broadline Distributor ES (BBD)",
    idioma: "ES",
    moneda: "EUR",
    plantillaPath: BASE_PLANTILLAS + "2N%20pricelist%202026_01%20ES%20EUR%20BBD.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
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
    nombre: "Subdistributor EN",
    idioma: "EN",
    moneda: "EUR",
    plantillaPath: BASE_PLANTILLAS + "2N%20pricelist%202026_01%20EN%20EUR%20SubD.xlsx",
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
    plantillaPath: BASE_PLANTILLAS + "2N%20pricelist%202026_01%20EN%20EUR%20VAD.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
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
  if (appState.tarifasTiposLoaded) return appState.tarifasTipos;

  const db = firebase.firestore();
  const colRef = db.collection("tarifas_tipos");
  const snap = await colRef.get();

  const result = {};

  // Si Firestore está vacío → sembramos todas las tarifas oficiales
  if (snap.empty) {
    const batch = db.batch();
    Object.values(DEFAULT_TIPOS_TARIFA).forEach((tipo) => {
      batch.set(colRef.doc(tipo.id), tipo, { merge: true });
      result[tipo.id] = { ...tipo };
    });
    await batch.commit();
  } else {
    snap.forEach((d) => {
      const data = d.data();
      result[d.id] = { ...DEFAULT_TIPOS_TARIFA[d.id], ...data };
    });
  }

  appState.tarifasTipos = result;
  appState.tarifasTiposLoaded = true;

  // Seleccionar el primero
  if (!appState.tarifasTipoSeleccionadoId) {
    const ids = Object.values(result)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map((t) => t.id);
    appState.tarifasTipoSeleccionadoId = ids[0] || null;
  }

  return result;
}

async function guardarTarifaTipoEnFirestore(tipo) {
  const db = firebase.firestore();
  await db.collection("tarifas_tipos").doc(tipo.id).set(tipo, { merge: true });
  appState.tarifasTipos[tipo.id] = tipo;
}

// ================================
// Reutilizar tarifa base (PVP) desde ui_presupuesto.js
// ================================
async function getTarifasBase2N() {
  if (appState.tarifasCache) return appState.tarifasCache;
  if (typeof cargarTarifasDesdeFirestore === "function")
    return await cargarTarifasDesdeFirestore();
  console.warn("No existe cargarTarifasDesdeFirestore()");
  return {};
}

// ================================
// RENDER PRINCIPAL
// ================================

function renderTarifasView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  container.innerHTML = `
    <div class="presupuesto-layout">

      <div class="presupuesto-left-column">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Tipos de tarifa</div>
              <div class="card-subtitle">
                Configuración guardada en Firestore.
              </div>
            </div>
            <button id="btnNuevoTipoTarifa" class="btn btn-secondary btn-sm">Nuevo tipo</button>
          </div>
          <div class="card-body" id="tarifasLista">Cargando...</div>
        </div>
      </div>

      <div class="presupuesto-right-column">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Detalle del tipo</div>
          </div>
          <div class="card-body" id="tarifasDetalle">
            Selecciona un tipo en la lista.
          </div>
        </div>
      </div>

    </div>
  `;

  document
    .getElementById("btnNuevoTipoTarifa")
    .addEventListener("click", () => mostrarFormularioTipoTarifa(null));

  loadTarifasTiposFromFirestore().then(() => {
    pintarListadoTiposTarifa();
    const id = appState.tarifasTipoSeleccionadoId;
    if (id) mostrarFormularioTipoTarifa(appState.tarifasTipos[id]);
  });
}

// ================================
// LISTADO
// ================================

function pintarListadoTiposTarifa() {
  const lista = document.getElementById("tarifasLista");
  const tipos = Object.values(appState.tarifasTipos).sort(
    (a, b) => (a.orden || 0) - (b.orden || 0)
  );

  lista.innerHTML = `
    <table class="table">
      <thead>
        <tr><th></th><th>Tarifa</th><th style="text-align:right;">Dto</th></tr>
      </thead>
      <tbody>
        ${tipos
          .map(
            (t) => `
          <tr class="tarifa-row ${
            t.id === appState.tarifasTipoSeleccionadoId ? "row-selected" : ""
          }" data-id="${t.id}">
            <td><span class="status-dot ${
              t.activo !== false ? "bg-green" : "bg-gray"
            }"></span></td>
            <td>
              <div style="font-weight:500;">${t.nombre}</div>
              <div style="font-size:0.75rem; color:#6b7280;">
                ${t.id} · ${t.idioma}
              </div>
            </td>
            <td style="text-align:right;">${
              t.descuentoPrincipal * 100
            }%</td>
          </tr>
        `
          )
          .join("")}
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
// FORMULARIO DETALLE / EDICIÓN
// ================================

function mostrarFormularioTipoTarifa(tipoOriginal) {
  const detalle = document.getElementById("tarifasDetalle");
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
        <label>ID tipo</label>
        <input id="tipoId" type="text" value="${tipo.id}" ${
    esNuevo ? "" : "readonly"
  } />
      </div>

      <div class="form-group">
        <label>Nombre</label>
        <input id="tipoNombre" type="text" value="${tipo.nombre}" />
      </div>

      <div class="form-group">
        <label>Idioma</label>
        <select id="tipoIdioma">
          <option value="ES" ${tipo.idioma === "ES" ? "selected" : ""}>ES</option>
          <option value="EN" ${tipo.idioma === "EN" ? "selected" : ""}>EN</option>
        </select>
      </div>

      <div class="form-group">
        <label>Moneda</label>
        <input id="tipoMoneda" type="text" value="${tipo.moneda}" />
      </div>

      <div class="form-group">
        <label>Descuento principal (%)</label>
        <input id="tipoDescuento" type="number" value="${
          tipo.descuentoPrincipal * 100
        }" />
      </div>

      <div class="form-group">
        <label>Plantilla Excel</label>
        <input id="tipoPlantillaPath" type="text" value="${tipo.plantillaPath}" />
      </div>

      <div class="form-group">
        <label>Orden</label>
        <input id="tipoOrden" type="number" value="${tipo.orden}" />
      </div>

      <div class="form-group">
        <label>Activo</label>
        <input id="tipoActivo" type="checkbox" ${
          tipo.activo !== false ? "checked" : ""
        } />
      </div>

    </div>

    <div style="margin-top:1rem; display:flex; gap:0.5rem;">
      <button id="btnGuardarTipoTarifa" class="btn btn-primary btn-sm">
        Guardar
      </button>
      ${
        !esNuevo
          ? `<button id="btnExportarTipoTarifa" class="btn btn-secondary btn-sm">
               Exportar Excel
             </button>`
          : ""
      }
    </div>

    <div id="tarifasDetalleMsg" class="alert" style="display:none;"></div>
  `;

  document
    .getElementById("btnGuardarTipoTarifa")
    .addEventListener("click", async () => {
      const nuevo = {
        ...(tipoOriginal || {}),
        id: document.getElementById("tipoId").value.trim(),
        nombre: document.getElementById("tipoNombre").value.trim(),
        idioma: document.getElementById("tipoIdioma").value,
        moneda: document.getElementById("tipoMoneda").value,
        plantillaPath: document.getElementById("tipoPlantillaPath").value.trim(),
        descuentoPrincipal:
          Number(document.getElementById("tipoDescuento").value) / 100,
        activo: document.getElementById("tipoActivo").checked,
        orden: Number(document.getElementById("tipoOrden").value) || 100,
      };

      await guardarTarifaTipoEnFirestore(nuevo);
      pintarListadoTiposTarifa();
      mostrarFormularioTipoTarifa(nuevo);
      mostrarMsgTarifaDetalle("Guardado", false);
    });

  if (!esNuevo) {
    document
      .getElementById("btnExportarTipoTarifa")
      .addEventListener("click", () => exportarTarifaExcel(tipo.id));
  }
}

function mostrarMsgTarifaDetalle(msg, error) {
  const box = document.getElementById("tarifasDetalleMsg");
  box.style.display = "block";
  box.textContent = msg;
  box.className = "alert " + (error ? "alert-error" : "alert-success");
}

// ================================
// EXPORTAR EXCEL DESDE PLANTILLA
// ================================

async function exportarTarifaExcel(tipoId) {
  const tipo = appState.tarifasTipos[tipoId];
  if (!tipo) return alert("Tipo no encontrado");

  let columnas = tipo.columnas;
  if (!columnas || !columnas.length) {
    columnas = [
      {
        id: "precio",
        col: 3,
        descuento: tipo.descuentoPrincipal || 0,
        actualizarCabecera: false,
      },
    ];
  }

  const tarifasBase = await getTarifasBase2N();
  if (!Object.keys(tarifasBase).length)
    return alert("No hay tarifa base cargada");

  const resp = await fetch(tipo.plantillaPath);
  const buf = await resp.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const ws = wb.Sheets[tipo.hoja || "Price List"];
  if (!ws) return alert("Hoja no encontrada: " + tipo.hoja);

  const skuToRow = {};
  for (let i = 1; i < 20000; i++) {
    const c = ws["A" + i];
    if (c && c.v) skuToRow[String(c.v).trim()] = i;
  }

  // Actualizar fila descuentos
  if (tipo.filaCabeceraDescuentos) {
    columnas.forEach((c) => {
      if (!c.actualizarCabecera) return;
      const dto = c.descuento * 100;
      const addr = XLSX.utils.encode_cell({
        r: tipo.filaCabeceraDescuentos - 1,
        c: c.col - 1,
      });
      ws[addr] = { t: "s", v: `${dto}%` };
    });
  }

  // Rellenar precios
  for (const sku of Object.keys(tarifasBase)) {
    const row = skuToRow[sku];
    if (!row) continue;

    const pvp = tarifasBase[sku].pvp;
    if (!pvp) continue;

    columnas.forEach((c) => {
      const val =
        c.id === "msrp" ? pvp : Number((pvp * (1 - c.descuento)).toFixed(2));

      const addr = XLSX.utils.encode_cell({
        r: row - 1,
        c: c.col - 1,
      });
      ws[addr] = { t: "n", v: val };
    });
  }

  const name =
    tipo.nombre.replace(/[^a-zA-Z0-9_\-]/g, "_") + "_2N.xlsx";

  XLSX.writeFile(wb, name);
}

console.log("%c[UI Tarifas cargado]", "color:#0ea5e9;");

window.renderTarifasView = renderTarifasView;
