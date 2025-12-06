// js/ui_tarifas.js
// Pantalla de TIPOS DE TARIFA: descuentos no lineales por grupo (A/B/C/D)
// Firestore solo guarda la lógica de descuentos; el formato viene de plantillas Excel base.
// Los precios siempre salen de la tarifa PVP en Firestore (tarifas/v1/productos).

window.appState = window.appState || {};
appState.tarifasTipos = appState.tarifasTipos || {};
appState.tarifasTiposLoaded = appState.tarifasTiposLoaded || false;
appState.tarifasTipoSeleccionadoId =
  appState.tarifasTipoSeleccionadoId || null;

// ======================================================
// 1) CONFIGURACIÓN DE PLANTILLAS BASE (solo en código)
// ======================================================

const BASE_PLANTILLAS =
  "https://raw.githubusercontent.com/Deividgaston/Documentacion2N/main/plantillas/";

// Plantillas base oficiales (formato), NO lógica de descuentos.
// Cada template define solo el layout y qué columna es cada nivel de precio.
const TARIFA_TEMPLATES = {
  ES_PVP: {
    id: "ES_PVP",
    descripcion: "PVP Público ES",
    url: BASE_PLANTILLAS + "2N%20pricelist%202026_01%20ES%20EUR%20PVP.xlsx",
    hoja: "Price List",
    columnasPrecio: {
      msrp: 3, // única columna de precio
    },
  },

  ES_SUBD: {
    id: "ES_SUBD",
    descripcion: "Formato oficial ES SubD",
    url: BASE_PLANTILLAS + "2N%20pricelist%202026_01%20ES%20EUR%20SubD.xlsx",
    hoja: "Price List",
    columnasPrecio: {
      subd: 3,
      rp2: 4,
      rp1: 5,
      msrp: 6,
    },
  },

  ES_BBD: {
    id: "ES_BBD",
    descripcion: "Formato oficial ES BBD",
    url: BASE_PLANTILLAS + "2N%20pricelist%202026_01%20ES%20EUR%20BBD.xlsx",
    hoja: "Price List",
    columnasPrecio: {
      nfrDist: 3,
      nfrRes: 4,
      dist: 5,
      rp2: 6,
      rp1: 7,
      msrp: 8,
    },
  },

  EN_SUBD: {
    id: "EN_SUBD",
    descripcion: "Formato oficial EN SubD",
    url: BASE_PLANTILLAS + "2N%20pricelist%202026_01%20EN%20EUR%20SubD.xlsx",
    hoja: "Price List",
    columnasPrecio: {
      subd: 3,
      rp2: 4,
      rp1: 5,
      msrp: 6,
    },
  },

  EN_VAD: {
    id: "EN_VAD",
    descripcion: "Formato oficial EN VAD",
    url: BASE_PLANTILLAS + "2N%20pricelist%202026_01%20EN%20EUR%20VAD.xlsx",
    hoja: "Price List",
    columnasPrecio: {
      nfrDist: 3,
      nfrRes: 4,
      dist: 5,
      rp2: 6,
      rp1: 7,
      msrp: 8,
    },
  },
};

// ======================================================
// 2) GRUPOS A/B/C/D Y CAMPOS DE DESCUENTO
// ======================================================

// Campos de descuento que soporta el sistema.
// Se guardan como decimales (0.36, 0.28, etc.) en Firestore.
const DISCOUNT_FIELDS = [
  "nfrDist",
  "nfrRes",
  "dist",
  "subd",
  "rp2",
  "rp1",
];

// Identificadores de grupo lógicos
const GRUPOS_IDS = ["GRUPO_A", "GRUPO_B", "GRUPO_C", "GRUPO_D"];

const GRUPOS_LABELS = {
  GRUPO_A: "Grupo A · Main units + licencias",
  GRUPO_B: "Grupo B · Accesorios",
  GRUPO_C: "Grupo C · Fortis / Indoor / clásicos",
  GRUPO_D: "Grupo D · My2N / repuestos",
};

// Paleta de color suave por grupo (para las celdas de precio en el Excel)
const GROUP_COLORS = {
  GRUPO_A: "FFF7ED", // naranja muy claro
  GRUPO_B: "ECFEFF", // cian muy claro
  GRUPO_C: "EEF2FF", // índigo muy claro
  GRUPO_D: "F9FAFB", // gris casi blanco
};

// Clasificación aproximada por descripción (tarifa base Firestore)
// Lo usamos para decidir a qué grupo pertenece un SKU.
const GROUP_PATTERNS = {
  GRUPO_D: [
    "my2n",
    "subscription",
    "suscripción",
    "spare part",
    "spare parts",
    "repuesto",
    "repuestos",
  ],
  GRUPO_C: [
    "fortis",
    "indoor view",
    "indoor touch",
    "indoor compact",
    "indoor talk",
    "indoor clip",
    "ip one",
    "ip uni",
    "ip base",
    "ip vario",
    "sip audio",
  ],
  GRUPO_B: [
    "accessory",
    "accessories",
    "accesorio",
    "accesorios",
    "installation accessory",
    "installation accessories",
    "power supply",
    "fuente de alimentación",
    "psu",
    "mounting frame",
    "mounting accessories",
    "flush box",
    "backplate",
    "frame",
  ],
  // GRUPO_A: resto (main units, licencias, etc.)
};

function clasificarGrupoPorDescripcion(descripcionRaw) {
  const desc = (descripcionRaw || "").toString().toLowerCase();

  if (!desc) return "GRUPO_A";

  for (const gid of ["GRUPO_D", "GRUPO_C", "GRUPO_B"]) {
    const patterns = GROUP_PATTERNS[gid] || [];
    if (patterns.some((p) => desc.includes(p))) {
      return gid;
    }
  }
  return "GRUPO_A";
}

// ======================================================
// 3) TIPOS DE TARIFA POR DEFECTO (semilla en Firestore)
// ======================================================

// Cada tipo guarda:
// - templateId: qué formato de plantilla usar
// - grupos: descuentos no lineales por grupo A/B/C/D
// Todos los descuentos se guardan como decimales (0.36 = 36%).
const DEFAULT_TIPOS_TARIFA = {
  ES_PVP: {
    id: "ES_PVP",
    nombre: "PVP Público ES",
    idioma: "ES",
    moneda: "EUR",
    templateId: "ES_PVP",
    grupos: {
      GRUPO_A: {},
      GRUPO_B: {},
      GRUPO_C: {},
      GRUPO_D: {},
    },
    activo: true,
    orden: 10,
  },

  ES_SUBD: {
    id: "ES_SUBD",
    nombre: "Subdistribuidor ES",
    idioma: "ES",
    moneda: "EUR",
    templateId: "ES_SUBD",
    grupos: {
      GRUPO_A: { subd: 0.36, rp2: 0.28, rp1: 0.1 },
      GRUPO_B: { subd: 0.235, rp2: 0.15, rp1: 0.05 },
      GRUPO_C: { subd: 0.335, rp2: 0.26, rp1: 0.1 },
      GRUPO_D: { subd: 0.19, rp2: 0.1, rp1: 0.1 },
    },
    activo: true,
    orden: 20,
  },

  ES_BBD: {
    id: "ES_BBD",
    nombre: "Broadline Distributor ES (BBD)",
    idioma: "ES",
    moneda: "EUR",
    templateId: "ES_BBD",
    grupos: {
      GRUPO_A: { nfrDist: 0.55, nfrRes: 0.5, dist: 0.39, rp2: 0.28, rp1: 0.1 },
      GRUPO_B: { nfrDist: 0.55, nfrRes: 0.5, dist: 0.25, rp2: 0.15, rp1: 0.05 },
      GRUPO_C: { nfrDist: 0.55, nfrRes: 0.5, dist: 0.35, rp2: 0.26, rp1: 0.1 },
      GRUPO_D: { nfrDist: 0, nfrRes: 0, dist: 0.2, rp2: 0.1, rp1: 0.1 },
    },
    activo: true,
    orden: 30,
  },

  EN_SUBD: {
    id: "EN_SUBD",
    nombre: "Subdistributor EN",
    idioma: "EN",
    moneda: "EUR",
    templateId: "EN_SUBD",
    grupos: {
      GRUPO_A: { subd: 0.36, rp2: 0.28, rp1: 0.1 },
      GRUPO_B: { subd: 0.235, rp2: 0.15, rp1: 0.05 },
      GRUPO_C: { subd: 0.335, rp2: 0.26, rp1: 0.1 },
      GRUPO_D: { subd: 0.19, rp2: 0.1, rp1: 0.1 },
    },
    activo: true,
    orden: 40,
  },

  EN_VAD: {
    id: "EN_VAD",
    nombre: "VAD EN",
    idioma: "EN",
    moneda: "EUR",
    templateId: "EN_VAD",
    grupos: {
      GRUPO_A: { nfrDist: 0.55, nfrRes: 0.5, dist: 0.42, rp2: 0.28, rp1: 0.1 },
      GRUPO_B: { nfrDist: 0.55, nfrRes: 0.5, dist: 0.28, rp2: 0.15, rp1: 0.05 },
      GRUPO_C: { nfrDist: 0.55, nfrRes: 0.5, dist: 0.38, rp2: 0.26, rp1: 0.1 },
      GRUPO_D: { nfrDist: 0, nfrRes: 0, dist: 0.2, rp2: 0.1, rp1: 0.1 },
    },
    activo: true,
    orden: 50,
  },
};

// Asegura que un objeto grupos tiene las 4 claves y solo campos permitidos
function normalizarGrupos(gruposRaw) {
  const grupos = gruposRaw && typeof gruposRaw === "object" ? gruposRaw : {};
  const result = {};
  GRUPOS_IDS.forEach((gid) => {
    const g = grupos[gid] && typeof grupos[gid] === "object" ? grupos[gid] : {};
    const limpio = {};
    DISCOUNT_FIELDS.forEach((f) => {
      const val = Number(g[f]);
      if (!isNaN(val) && val > 0) limpio[f] = val;
    });
    result[gid] = limpio;
  });
  return result;
}

// ======================================================
// 4) HELPERS FIRESTORE (tarifas_tipos)
// ======================================================

async function loadTarifasTiposFromFirestore() {
  if (appState.tarifasTiposLoaded) return appState.tarifasTipos;

  const db = firebase.firestore();
  const colRef = db.collection("tarifas_tipos");

  try {
    const snap = await colRef.get();
    const result = {};

    if (snap.empty) {
      // Sembrar tipos oficiales si no hay nada
      const batch = db.batch();
      Object.values(DEFAULT_TIPOS_TARIFA).forEach((tipo) => {
        batch.set(colRef.doc(tipo.id), tipo, { merge: true });
        result[tipo.id] = {
          ...tipo,
          grupos: normalizarGrupos(tipo.grupos),
        };
      });
      await batch.commit();
    } else {
      snap.forEach((d) => {
        const data = d.data() || {};
        const id = data.id || d.id;
        const def = DEFAULT_TIPOS_TARIFA[id] || {};
        const merged = {
          ...def,
          ...data,
          id,
        };
        merged.grupos = normalizarGrupos(merged.grupos);
        result[id] = merged;
      });

      // Añadir por defecto los que falten (para tenerlos todos)
      Object.entries(DEFAULT_TIPOS_TARIFA).forEach(([id, def]) => {
        if (!result[id]) {
          result[id] = {
            ...def,
            grupos: normalizarGrupos(def.grupos),
          };
        }
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
    const fallback = {};
    Object.entries(DEFAULT_TIPOS_TARIFA).forEach(([id, def]) => {
      fallback[id] = {
        ...def,
        grupos: normalizarGrupos(def.grupos),
      };
    });
    appState.tarifasTipos = fallback;
    appState.tarifasTiposLoaded = true;

    if (!appState.tarifasTipoSeleccionadoId) {
      const ids = Object.values(fallback)
        .sort((a, b) => (a.orden || 0) - (b.orden || 0))
        .map((t) => t.id);
      appState.tarifasTipoSeleccionadoId = ids[0] || null;
    }

    return appState.tarifasTipos;
  }
}

async function guardarTarifaTipoEnFirestore(tipo) {
  if (!tipo || !tipo.id) return;
  const tipoGuardar = {
    ...tipo,
    grupos: normalizarGrupos(tipo.grupos),
  };

  try {
    const db = firebase.firestore();
    await db
      .collection("tarifas_tipos")
      .doc(tipoGuardar.id)
      .set(tipoGuardar, { merge: true });
    appState.tarifasTipos[tipoGuardar.id] = tipoGuardar;
  } catch (e) {
    console.warn(
      "[Tarifas] No se pudo guardar en Firestore, pero se mantiene en memoria:",
      e
    );
    appState.tarifasTipos[tipoGuardar.id] = tipoGuardar;
  }
}

// ======================================================
// 5) TARIFA BASE (PVP) DESDE FIRESTORE (ya lo tienes)
// ======================================================

async function getTarifasBase2N() {
  if (appState.tarifasCache) return appState.tarifasCache;
  if (typeof cargarTarifasDesdeFirestore === "function") {
    return await cargarTarifasDesdeFirestore();
  }
  console.warn("No existe cargarTarifasDesdeFirestore()");
  return {};
}

// ======================================================
// 6) RENDER PANTALLA TARIFAS
// ======================================================

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
                Descuentos por grupo de producto (A/B/C/D) guardados en Firestore.
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

// ======================================================
// 7) LISTADO TIPOS
// ======================================================

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
          <th>Plantilla base</th>
        </tr>
      </thead>
      <tbody>
        ${tipos
          .map((t) => {
            const tpl = TARIFA_TEMPLATES[t.templateId] || {};
            return `
              <tr class="tarifa-row ${
                t.id === appState.tarifasTipoSeleccionadoId
                  ? "row-selected"
                  : ""
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
                <td style="font-size:0.8rem; color:#4b5563;">
                  ${tpl.descripcion || t.templateId || "-"}
                </td>
              </tr>
            `;
          })
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

// ======================================================
// 8) FORMULARIO DETALLE / EDICIÓN
// ======================================================

function mostrarFormularioTipoTarifa(tipoOriginal) {
  const detalle = document.getElementById("tarifasDetalle");
  if (!detalle) return;

  const esNuevo = !tipoOriginal;

  const tipo = tipoOriginal || {
    id: "",
    nombre: "",
    idioma: "ES",
    moneda: "EUR",
    templateId: "ES_SUBD",
    grupos: normalizarGrupos(null),
    activo: true,
    orden: 100,
  };

  const opcionesTemplate = Object.values(TARIFA_TEMPLATES)
    .map(
      (tpl) => `
      <option value="${tpl.id}" ${
        tpl.id === tipo.templateId ? "selected" : ""
      }>
        ${tpl.id} · ${tpl.descripcion}
      </option>
    `
    )
    .join("");

  detalle.innerHTML = `
    <div class="form-grid">

      <div class="form-group">
        <label>ID tipo (único)</label>
        <input id="tipoId" type="text" value="${tipo.id}" ${
    esNuevo ? "" : "readonly"
  } />
        <p style="font-size:0.75rem; color:#6b7280;">
          Ej: ES_SUBD, ES_BBD, TARIFA_INSTALADOR_15
        </p>
      </div>

      <div class="form-group">
        <label>Nombre visible</label>
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
        <input id="tipoMoneda" type="text" value="${tipo.moneda || "EUR"}" />
      </div>

      <div class="form-group">
        <label>Plantilla base</label>
        <select id="tipoTemplateId">
          ${opcionesTemplate}
        </select>
        <p style="font-size:0.75rem; color:#6b7280;">
          Define el formato (columnas NFR/Dist/SubD/RP2/RP1/MSRP). Los precios siempre salen de la tarifa PVP en Firestore.
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

    <div style="margin-top:1rem;">
      <h4 style="font-size:0.85rem; font-weight:600; margin-bottom:0.5rem;">
        Descuentos por grupo de producto
      </h4>
      <p style="font-size:0.75rem; color:#6b7280; margin-bottom:0.5rem;">
        Valores en % sobre PVP. Se guardan por grupo A/B/C/D y por nivel (NFR, Dist, SubD, RP2, RP1).
      </p>

      <div class="table-wrapper" style="overflow-x:auto;">
        <table class="table" style="font-size:0.8rem; min-width:100%;">
          <thead>
            <tr>
              <th>Grupo</th>
              ${DISCOUNT_FIELDS.map(
                (f) => `<th style="text-align:right;">${f}</th>`
              ).join("")}
            </tr>
          </thead>
          <tbody>
            ${GRUPOS_IDS.map((gid) => {
              const g = (tipo.grupos && tipo.grupos[gid]) || {};
              return `
              <tr data-gid="${gid}">
                <td style="white-space:nowrap;">${GRUPOS_LABELS[gid] ||
                gid}</td>
                ${DISCOUNT_FIELDS.map((f) => {
                  const val = typeof g[f] === "number" ? g[f] * 100 : "";
                  return `
                    <td style="text-align:right;">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="90"
                        class="input input-xs input-dto-grupo"
                        data-gid="${gid}"
                        data-field="${f}"
                        value="${val !== "" ? val : ""}"
                        style="max-width:70px; text-align:right;"
                      />
                    </td>
                  `;
                }).join("")}
              </tr>`;
            }).join("")}
          </tbody>
        </table>
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
      const templateId =
        document.getElementById("tipoTemplateId").value || "ES_SUBD";
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

      // Leer descuentos por grupo
      const grupos = normalizarGrupos(tipo.grupos);
      document
        .querySelectorAll(".input-dto-grupo")
        .forEach((input) => {
          const gid = input.dataset.gid;
          const field = input.dataset.field;
          const val = Number(input.value);
          if (!gid || !field) return;
          if (!grupos[gid]) grupos[gid] = {};
          if (!isNaN(val) && val > 0) {
            grupos[gid][field] = val / 100;
          } else {
            delete grupos[gid][field];
          }
        });

      const nuevoTipo = {
        ...(tipoOriginal || {}),
        id,
        nombre,
        idioma,
        moneda,
        templateId,
        grupos,
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

// ======================================================
// 9) EXPORTAR EXCEL DESDE PLANTILLA (motor de cálculo + color)
// ======================================================

async function exportarTarifaExcel(tipoId) {
  const tipo = appState.tarifasTipos[tipoId];
  if (!tipo) {
    alert("Tipo de tarifa no encontrado.");
    return;
  }

  const tpl = TARIFA_TEMPLATES[tipo.templateId];
  if (!tpl) {
    alert(
      "La plantilla base configurada para este tipo no existe en el código: " +
        tipo.templateId
    );
    return;
  }

  const tarifasBase = await getTarifasBase2N();
  if (!tarifasBase || !Object.keys(tarifasBase).length) {
    alert(
      "No se han encontrado productos en la tarifa base. Revisa la colección 'tarifas'."
    );
    return;
  }

  try {
    // 1) Cargar plantilla Excel base (formato completo) **con estilos**
    const resp = await fetch(tpl.url);
    if (!resp.ok) {
      throw new Error("No se pudo cargar la plantilla: " + tpl.url);
    }
    const buf = await resp.arrayBuffer();

    // 👇 clave: cellStyles: true para preservar el formato
    const wb = XLSX.read(buf, { type: "array", cellStyles: true });

    const ws = wb.Sheets[tpl.hoja || "Price List"];
    if (!ws) {
      alert(`La hoja "${tpl.hoja}" no existe en la plantilla.`);
      return;
    }

    // 2) Mapear SKU -> fila (columna A)
    const skuToRow = {};
    for (let r = 1; r <= 30000; r++) {
      const cell = ws["A" + r];
      if (!cell || cell.v == null) continue;
      const sku = String(cell.v).trim();
      if (!sku) continue;
      skuToRow[sku] = r;
    }

    // 3) Rellenar precios calculados (sin tocar estilos)
    const grupos = normalizarGrupos(tipo.grupos);
    const columnasPrecio = tpl.columnasPrecio || {};
    const niveles = Object.keys(columnasPrecio); // ej: ['subd','rp2','rp1','msrp']

    for (const [sku, prod] of Object.entries(tarifasBase)) {
      const fila = skuToRow[sku];
      if (!fila) continue;

      const pvp = Number(prod.pvp || 0);
      if (!pvp) continue;

      const desc = prod.descripcion || prod.desc || "";
      const gid = clasificarGrupoPorDescripcion(desc);
      const dtoGrupo = grupos[gid] || {};

      niveles.forEach((nivel) => {
        const colIndex = columnasPrecio[nivel];
        if (!colIndex) return;

        let dto = 0;
        if (nivel === "msrp") {
          dto = 0;
        } else {
          dto = Number(dtoGrupo[nivel] || 0);
        }

        const valor = pvp * (1 - dto);
        const addr = XLSX.utils.encode_cell({
          r: fila - 1,
          c: colIndex - 1,
        });

        const existente = ws[addr] || {};
        // 👇 mantenemos el estilo existente (s) y solo cambiamos tipo/valor
        ws[addr] = {
          ...existente,
          t: "n",
          v: Number(valor.toFixed(2)),
        };
      });
    }

    const nombreBase = tipo.nombre || tipo.id || "Tarifa_2N";
    const fileName =
      nombreBase.replace(/[^a-zA-Z0-9_\-]+/g, "_") + ".xlsx";

    // 👇 clave: cellStyles: true al escribir para no perder formato
    XLSX.writeFile(wb, fileName, { cellStyles: true });
  } catch (e) {
    console.error("[Tarifas] Error exportando Excel:", e);
    alert(
      "Se ha producido un error al generar la tarifa en Excel. Revisa la plantilla base y los datos."
    );
  }
}

console.log("%c[UI Tarifas cargada · grupos no lineales + color]", "color:#0ea5e9;");

window.renderTarifasView = renderTarifasView;
