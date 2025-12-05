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
    plantillaPath:
      BASE_PLANTILLAS +
      "2N%20pricelist%202026_01%20ES%20EUR%20PVP.xlsx",
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
    plantillaPath:
      BASE_PLANTILLAS +
      "2N%20pricelist%202026_01%20ES%20EUR%20RP1.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
      { id: "rp1", col: 3, descuento: 0.1, actualizarCabecera: true },
      { id: "msrp", col: 4, descuento: 0, actualizarCabecera: false },
    ],
    descuentoPrincipal: 0.1,
    activo: true,
    orden: 20,
  },

  ES_RP2: {
    id: "ES_RP2",
    nombre: "Recommended Reseller Price 2 ES",
    idioma: "ES",
    moneda: "EUR",
    plantillaPath:
      BASE_PLANTILLAS +
      "2N%20pricelist%202026_01%20ES%20EUR%20RP2.xlsx",
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
    nombre: "Subdistribuidor ES (SubD)",
    idioma: "ES",
    moneda: "EUR",
    plantillaPath:
      BASE_PLANTILLAS +
      "2N%20pricelist%202026_01%20ES%20EUR%20SubD.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
      { id: "subd", col: 3, descuento: 0.36, actualizarCabecera: true },
      { id: "rp2", col: 4, descuento: 0.28, actualizarCabecera: true },
      { id: "rp1", col: 5, descuento: 0.1, actualizarCabecera: true },
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
    plantillaPath:
      BASE_PLANTILLAS +
      "2N%20pricelist%202026_01%20ES%20EUR%20BBD.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
      { id: "nfrDist", col: 3, descuento: 0.55, actualizarCabecera: true },
      { id: "nfrRes", col: 4, descuento: 0.5, actualizarCabecera: true },
      { id: "subd", col: 5, descuento: 0.39, actualizarCabecera: true },
      { id: "rp2", col: 6, descuento: 0.28, actualizarCabecera: true },
      { id: "rp1", col: 7, descuento: 0.1, actualizarCabecera: true },
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
    plantillaPath:
      BASE_PLANTILLAS +
      "2N%20pricelist%202026_01%20EN%20EUR%20SubD.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
      { id: "subd", col: 3, descuento: 0.36, actualizarCabecera: true },
      { id: "rp2", col: 4, descuento: 0.28, actualizarCabecera: true },
      { id: "rp1", col: 5, descuento: 0.1, actualizarCabecera: true },
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
    plantillaPath:
      BASE_PLANTILLAS +
      "2N%20pricelist%202026_01%20EN%20EUR%20VAD.xlsx",
    hoja: "Price List",
    filaCabeceraDescuentos: 5,
    columnas: [
      { id: "nfrDist", col: 3, descuento: 0.55, actualizarCabecera: true },
      { id: "nfrRes", col: 4, descuento: 0.5, actualizarCabecera: true },
      { id: "vad", col: 5, descuento: 0.42, actualizarCabecera: true },
      { id: "rp2", col: 6, descuento: 0.28, actualizarCabecera: true },
      { id: "rp1", col: 7, descuento: 0.1, actualizarCabecera: true },
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

  try {
    const snap = await colRef.get();
    const result = {};

    if (snap.empty) {
      // Colección vacía: sembramos los tipos oficiales
      const batch = db.batch();
      Object.values(DEFAULT_TIPOS_TARIFA).forEach((tipo) => {
        batch.set(colRef.doc(tipo.id), tipo, { merge: true });
        result[tipo.id] = { ...tipo };
      });
      await batch.commit();
    } else {
      snap.forEach((d) => {
        const data = d.data() || {};
        const id = data.id || d.id;
        const def = DEFAULT_TIPOS_TARIFA[id] || {};
        result[id] = { ...def, ...data, id };
      });
    }

    appState.tarifasTipos = result;
    appState.tarifasTiposLoaded = true;

    if (!appState.tarifasTipoSeleccionadoId) {
      const ids = Object.values(result)
        .sort((a, b) => (a.orden || 0) - (b.orden || 0))
        .map((t) => t.id);
      appState.tarifasTipoSeleccionadoId = ids[0] || null;
    }

    return result;
  } catch (err) {
    console.warn(
      "[Tarifas] No se ha podido leer Firestore, usando DEFAULT_TIPOS_TARIFA solo en memoria:",
      err
    );

    appState.tarifasTipos = { ...DEFAULT_TIPOS_TARIFA };
    appState.tarifasTiposLoaded = true;

    if (!appState.tarifasTipoSeleccionadoId) {
      const ids = Object.values(appState.tarifasTipos)
        .sort((a, b) => (a.orden || 0) - (b.orden || 0))
        .map((t) => t.id);
      appState.tarifasTipoSeleccionadoId = ids[0] || null;
    }

    return appState.tarifasTipos;
  }
}

async function guardarTarifaTipoEnFirestore(tipo) {
  if (!tipo || !tipo.id) return;
  try {
    const db = firebase.firestore();
    await db.collection("tarifas_tipos").doc(tipo.id).set(tipo, { merge: true });
    appState.tarifasTipos[tipo.id] = tipo;
  } catch (e) {
    console.warn(
      "[Tarifas] No se pudo guardar en Firestore, pero se mantiene en memoria:",
      e
    );
    appState.tarifasTipos[tipo.id] = tipo;
  }
}

// ================================
// Reutilizar tarifa base (PVP) desde ui_presupuesto.js
// ================================
async function getTarifasBase2N() {
  if (appState.tarifasCache) return appState.tarifasCache;
  if (typeof cargarTarifasDesdeFirestore === "function") {
    return await cargarTarifasDesdeFirestore();
  }
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
                Configuración guardada en Firestore (o en memoria si no hay permisos).
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

  const btnNuevo = document.getElementById("btnNuevoTipoTarifa");
  const lista = document.getElementById("tarifasLista");

  if (btnNuevo) {
    btnNuevo.addEventListener("click", () => mostrarFormularioTipoTarifa(null));
  }

  loadTarifasTiposFromFirestore()
    .then(() => {
      pintarListadoTiposTarifa();
      const id = appState.tarifasTipoSeleccionadoId;
      if (id && appState.tarifasTipos[id]) {
        mostrarFormularioTipoTarifa(appState.tarifasTipos[id]);
      }
    })
    .catch((err) => {
      console.error("[Tarifas] Error cargando tipos:", err);
      if (lista) {
        lista.innerHTML = `
          <p style="font-size:0.85rem; color:#b91c1c;">
            Error cargando los tipos de tarifa.<br/>
            Detalle: ${err && err.message ? err.message : "desconocido"}
          </p>
        `;
      }
    });
}

// ================================
// LISTADO
// ================================

function pintarListadoTiposTarifa() {
  const lista = document.getElementById("tarifasLista");
  if (!lista) return;

  const tipos = Object.values(appState.tarifasTipos || {}).sort(
    (a, b) => (a.orden || 0) - (b.orden || 0)
  );

  if (!tipos.length) {
    lista.innerHTML = `
      <p style="font-size:0.85rem; color:#6b7280;">
        No hay tipos de tarifa configurados.
      </p>
    `;
    return;
  }

  lista.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th></th>
          <th>Tarifa</th>
          <th style="text-align:right;">Dto</th>
        </tr>
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
                ${t.id} · Idioma: ${t.idioma || "-"} · ${t.moneda || "EUR"}
              </div>
            </td>
            <td style="text-align:right;">
              ${typeof t.descuentoPrincipal === "number"
                ? (t.descuentoPrincipal * 100).toFixed(0) + "%"
                : "-"}
            </td>
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
        <input id="tipoId" type="text" value="${tipo.id}" ${
    esNuevo ? "" : "readonly"
  } />
        <p style="font-size:0.75rem; color:#6b7280;">
          Ej: ES_PVP, ES_INSTALADOR_15
        </p>
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
        <label>Descuento principal sobre PVP (%)</label>
        <input id="tipoDescuento" type="number" min="0" max="90"
          value="${
            typeof tipo.descuentoPrincipal === "number"
              ? (tipo.descuentoPrincipal * 100).toFixed(0)
              : "0"
          }" />
      </div>

      <div class="form-group">
        <label>Ruta plantilla Excel</label>
        <input id="tipoPlantillaPath" type="text" value="${
          tipo.plantillaPath || ""
        }" />
        <p style="font-size:0.75rem; color:#6b7280;">
          Debe ser una URL válida (por ejemplo, RAW de GitHub).
        </p>
      </div>

      <div class="form-group">
        <label>Orden</label>
        <input id="tipoOrden" type="number" value="${tipo.orden || 100}" />
      </div>

      <div class="form-group">
        <label>Activo</label>
        <label style="display:flex; align-items:center; gap:0.35rem;">
          <input id="tipoActivo" type="checkbox" ${
            tipo.activo !== false ? "checked" : ""
          } />
          Disponible para exportar
        </label>
      </div>

    </div>

    <div style="margin-top:1rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
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

    <div id="tarifasDetalleMsg" class="alert mt-3" style="display:none;"></div>
  `;

  const btnGuardar = document.getElementById("btnGuardarTipoTarifa");
  const btnExportar = document.getElementById("btnExportarTipoTarifa");

  if (btnGuardar) {
    btnGuardar.addEventListener("click", async () => {
      const id = (document.getElementById("tipoId").value || "").trim();
      const nombre = (document.getElementById("tipoNombre").value || "").trim();
      const idioma = document.getElementById("tipoIdioma").value || "ES";
      const moneda =
        (document.getElementById("tipoMoneda").value || "EUR").trim();
      const dtoNum =
        Number(document.getElementById("tipoDescuento").value) || 0;
      const plantillaPath =
        (document.getElementById("tipoPlantillaPath").value || "").trim();
      const orden =
        Number(document.getElementById("tipoOrden").value) || 100;
      const activo = !!document.getElementById("tipoActivo").checked;

      if (!id) {
        mostrarMsgTarifaDetalle("El ID del tipo de tarifa es obligatorio.", true);
        return;
      }
      if (!nombre) {
        mostrarMsgTarifaDetalle("El nombre visible es obligatorio.", true);
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
        mostrarMsgTarifaDetalle(
          "Tipo de tarifa guardado correctamente.",
          false
        );
      } catch (e) {
        console.error("[Tarifas] Error guardando tipo:", e);
        mostrarMsgTarifaDetalle(
          "Error guardando el tipo de tarifa.",
          true
        );
      }
    });
  }

  if (btnExportar && !esNuevo) {
    btnExportar.addEventListener("click", () => {
      exportarTarifaExcel(tipo.id);
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
// EXPORTAR EXCEL DESDE PLANTILLA
// ================================

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

  let columnas = tipo.columnas;
  if (!Array.isArray(columnas) || !columnas.length) {
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

  const tarifasBase = await getTarifasBase2N();
  if (!tarifasBase || !Object.keys(tarifasBase).length) {
    alert("No se han encontrado productos en la tarifa base.");
    return;
  }

  try {
    const resp = await fetch(tipo.plantillaPath);
    if (!resp.ok) {
      throw new Error(
        "No se pudo cargar la plantilla: " + tipo.plantillaPath
      );
    }
    const buf = await resp.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });

    const hoja = tipo.hoja || "Price List";
    const ws = wb.Sheets[hoja];
    if (!ws) {
      alert(`La hoja "${hoja}" no existe en la plantilla.`);
      return;
    }

    // Mapear SKU -> fila (columna A)
    const skuToRow = {};
    for (let r = 1; r <= 20000; r++) {
      const cell = ws["A" + r];
      if (!cell || cell.v == null) continue;
      const sku = String(cell.v).trim();
      if (!sku) continue;
      skuToRow[sku] = r;
    }

    // Actualizar fila de descuentos (si aplica)
    const filaCabDesc = tipo.filaCabeceraDescuentos || null;
    if (filaCabDesc) {
      columnas.forEach((c) => {
        if (!c.actualizarCabecera) return;
        const dto = c.descuento || 0;
        const texto = dto > 0 ? `${(dto * 100).toFixed(0)}%` : "";
        if (!texto) return;

        const addr = XLSX.utils.encode_cell({
          r: filaCabDesc - 1,
          c: c.col - 1,
        });
        ws[addr] = { t: "s", v: texto };
      });
    }

    // Rellenar precios
    for (const sku of Object.keys(tarifasBase)) {
      const fila = skuToRow[sku];
      if (!fila) continue;

      const prod = tarifasBase[sku] || {};
      const pvp = Number(prod.pvp || 0);
      if (!pvp) continue;

      columnas.forEach((c) => {
        const col = c.col;
        if (!col || col < 1) return;

        let valor = pvp;
        const dto = c.descuento || 0;
        if (c.id !== "msrp") {
          valor = pvp * (1 - dto);
        }
        const addr = XLSX.utils.encode_cell({
          r: fila - 1,
          c: col - 1,
        });
        ws[addr] = { t: "n", v: Number(valor.toFixed(2)) };
      });
    }

    const nombreBase = tipo.nombre || tipo.id || "Tarifa_2N";
    const fileName =
      nombreBase.replace(/[^a-zA-Z0-9_\-]+/g, "_") + ".xlsx";

    XLSX.writeFile(wb, fileName);
  } catch (e) {
    console.error("[Tarifas] Error exportando Excel:", e);
    alert(
      "Se ha producido un error al generar la tarifa en Excel. Revisa la ruta de la plantilla y los datos."
    );
  }
}

console.log("%c[UI Tarifas cargada]", "color:#0ea5e9;");

window.renderTarifasView = renderTarifasView;
