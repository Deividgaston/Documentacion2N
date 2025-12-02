// js/ui_presupuesto.js
// Generación del presupuesto a partir de los datos del proyecto y la tarifa

window.appState = window.appState || {};
appState.presupuesto = appState.presupuesto || {
  lineas: [],
  resumen: {},
  notas: "",
  sectionNotes: {}, // notas por sección
  extraSections: [], // secciones manuales añadidas desde la UI
  sectionOrder: [], // orden de secciones para drag & drop
  incluirIVA: true,
};

appState.tarifasCache = appState.tarifasCache || null; // cache de tarifas en memoria
appState.presupuestoFiltroRef = appState.presupuestoFiltroRef || "";

// Datos de la empresa para el presupuesto (puedes cambiarlos aquí)
const COMPANY_INFO = {
  nombre: "2N TELEKOMUNIKACE a.s.",
  direccion: "Modřanská 621/143, 143 01 Praha 4, CZ",
  nif: "CZ26183960",
  telefono: "660204003",
  email: "gaston@2n.com",
};

console.log(
  "%cUI Presupuesto · versión EXPORT-EXCEL-PDF",
  "color:#22c55e; font-weight:bold;"
);

// ===============================================
// Render de la vista de PRESUPUESTO
// ===============================================
function renderPresupuestoView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  container.innerHTML = `
    <div class="presupuesto-layout">

      <!-- COLUMNA IZQUIERDA: datos + notas + resumen -->
      <div class="presupuesto-left-column">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Datos del presupuesto</div>
              <div class="card-subtitle">
                Revisa los datos del proyecto, añade notas y genera el presupuesto.
              </div>
            </div>
            <span class="badge-step">Paso 2 de 3</span>
          </div>

          <div class="card-body">
            <div class="form-grid">

              <div class="form-group">
                <label>Nombre del proyecto</label>
                <input id="presuNombre" type="text" />
              </div>

              <div class="form-group">
                <label>Cliente (opcional)</label>
                <input id="presuCliente" type="text" />
              </div>

              <div class="form-group">
                <label>Fecha presupuesto</label>
                <input id="presuFecha" type="date" />
              </div>

              <div class="form-group">
                <label>Descuento global (%)</label>
                <input id="presuDto" type="number" min="0" max="90" value="0" />
              </div>
            </div>

            <div class="form-group mt-3">
              <label>Notas del presupuesto</label>
              <textarea id="presuNotas" rows="3"></textarea>
              <p style="font-size:0.78rem; color:#6b7280; margin-top:0.25rem;">
                Estas notas se usarán como observaciones generales
                (ej. requisitos de red, alimentación, alcances, exclusiones...).
              </p>
            </div>

            <button id="btnGenerarPresupuesto" class="btn btn-primary w-full mt-3">
              Generar / Recalcular presupuesto
            </button>

            <div id="presuMsg" class="alert alert-success mt-3" style="display:none;">
              Presupuesto generado correctamente
            </div>
          </div>
        </div>

        <!-- RESUMEN ECONÓMICO -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Resumen económico</div>
          </div>
          <div class="card-body" id="presuResumen">
            No se ha generado todavía el presupuesto.
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA: DETALLE DEL PRESUPUESTO (SECCIONES) -->
      <div class="presupuesto-right-column">
        <div class="card">
          <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
            <div class="card-title">
              Líneas del presupuesto
              <span id="presuLineCount" style="font-size:0.8rem; color:#6b7280; font-weight:400;">
                0 líneas cargadas desde el proyecto
              </span>
            </div>
            <div class="presu-header-actions" style="display:flex; align-items:center; gap:0.5rem; font-size:0.8rem;">
              <span>Filtro ref:</span>
              <input id="presuFiltroRef" type="text" class="input" style="width:130px;" />
              <button id="btnAddLinea" class="btn btn-secondary">
                Añadir línea
              </button>
              <button id="btnAddSection" class="btn btn-secondary">
                Añadir sección
              </button>
            </div>
          </div>
          <div class="card-body" id="presuDetalle">
            No hay líneas de presupuesto generadas.
          </div>
        </div>
      </div>

    </div>

    <!-- MODAL: Añadir línea manual -->
    <div id="presuLineaOverlay" class="modal-overlay" style="display:none;">
      <div class="modal-card">
        <div class="modal-title">Añadir línea al presupuesto</div>
        <div class="modal-text">
          <div class="form-group">
            <label>Sección</label>
            <input id="lineaSeccion" type="text" placeholder="Ej: CONTROL DE ACCESOS VIVIENDAS" />
          </div>
          <div class="form-group">
            <label>Título (opcional)</label>
            <input id="lineaTitulo" type="text" placeholder="Ej: Cerraduras electrónicas" />
          </div>
          <div class="form-group">
            <label>Referencia (opcional)</label>
            <div style="display:flex; gap:0.5rem;">
              <input id="lineaRef" type="text" style="flex:1;" placeholder="Ej: 9155101" />
              <button id="btnLineaBuscarRef" class="btn btn-secondary btn-sm">
                Buscar ref
              </button>
            </div>
            <p style="font-size:0.75rem; color:#6b7280; margin-top:0.25rem;">
              Si la referencia existe en la tarifa, se rellenarán automáticamente la descripción y el PVP.
            </p>
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <textarea id="lineaDesc" rows="2" placeholder="Descripción del producto"></textarea>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Cantidad</label>
              <input id="lineaCantidad" type="number" min="1" value="1" />
            </div>
            <div class="form-group">
              <label>PVP unidad (€)</label>
              <input id="lineaPvp" type="number" min="0" step="0.01" value="0" />
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button id="btnLineaCancelar" class="btn btn-secondary btn-sm">Cancelar</button>
          <button id="btnLineaGuardar" class="btn btn-primary btn-sm">Añadir línea</button>
        </div>
      </div>
    </div>
  `;

  // Botón generar
  const btnGenerar = document.getElementById("btnGenerarPresupuesto");
  if (btnGenerar) {
    btnGenerar.addEventListener("click", generarPresupuesto);
  }

  // Botón añadir sección manual
  const btnAddSection = document.getElementById("btnAddSection");
  if (btnAddSection) {
    btnAddSection.addEventListener("click", onAddManualSection);
  }

  // Botón añadir línea: abrir modal
  const btnAddLinea = document.getElementById("btnAddLinea");
  if (btnAddLinea) {
    btnAddLinea.addEventListener("click", abrirModalLinea);
  }

  // Filtro ref / texto
  const filtroRefInput = document.getElementById("presuFiltroRef");
  if (filtroRefInput) {
    filtroRefInput.value = appState.presupuestoFiltroRef || "";
    filtroRefInput.addEventListener("input", () => {
      appState.presupuestoFiltroRef = filtroRefInput.value.trim().toLowerCase();
      const presu = appState.presupuesto || {};
      if (presu.lineas && presu.lineas.length && presu.resumen) {
        renderResultados(
          presu.lineas,
          presu.resumen.totalBruto || 0,
          presu.resumen.totalNeto || 0,
          presu.resumen.dto || 0
        );
      }
    });
  }

  // Eventos del modal de línea
  const overlay = document.getElementById("presuLineaOverlay");
  const btnCancelarLinea = document.getElementById("btnLineaCancelar");
  const btnGuardarLinea = document.getElementById("btnLineaGuardar");
  const btnBuscarRef = document.getElementById("btnLineaBuscarRef");

  if (btnCancelarLinea && overlay) {
    btnCancelarLinea.addEventListener("click", () => {
      overlay.style.display = "none";
    });
  }

  if (btnGuardarLinea && overlay) {
    btnGuardarLinea.addEventListener("click", guardarLineaManual);
  }

  if (btnBuscarRef) {
    btnBuscarRef.addEventListener("click", autofillLineaDesdeTarifa);
  }

  precargarDatosProyecto();
}

// ===============================================
// Modal línea manual
// ===============================================
function abrirModalLinea() {
  const overlay = document.getElementById("presuLineaOverlay");
  if (!overlay) return;

  // Rellenar sección por defecto con la última usada si existe
  const presu = appState.presupuesto || {};
  const ultLinea = presu.lineas && presu.lineas.length
    ? presu.lineas[presu.lineas.length - 1]
    : null;

  document.getElementById("lineaSeccion").value = ultLinea?.seccion || "";
  document.getElementById("lineaTitulo").value = ultLinea?.titulo || "";
  document.getElementById("lineaRef").value = "";
  document.getElementById("lineaDesc").value = "";
  document.getElementById("lineaCantidad").value = "1";
  document.getElementById("lineaPvp").value = "0";

  overlay.style.display = "flex";
}

async function autofillLineaDesdeTarifa() {
  const refInput = document.getElementById("lineaRef");
  const descInput = document.getElementById("lineaDesc");
  const pvpInput = document.getElementById("lineaPvp");
  if (!refInput || !pvpInput || !descInput) return;

  const refRaw = (refInput.value || "").trim();
  if (!refRaw) return;

  const producto = await buscarProductoEnTarifa(refRaw);
  if (!producto) {
    alert("No se ha encontrado esta referencia en la tarifa.");
    return;
  }

  if (producto.descripcion && !descInput.value) {
    descInput.value = producto.descripcion;
  }
  pvpInput.value = (Number(producto.pvp) || 0).toFixed(2);
}

async function guardarLineaManual() {
  const overlay = document.getElementById("presuLineaOverlay");
  const seccion = (document.getElementById("lineaSeccion").value || "").trim() || "Sección manual";
  const titulo = (document.getElementById("lineaTitulo").value || "").trim();
  const refRaw = (document.getElementById("lineaRef").value || "").trim();
  const desc = (document.getElementById("lineaDesc").value || "").trim();
  const cantVal = Number(document.getElementById("lineaCantidad").value) || 0;
  const pvpVal = Number(document.getElementById("lineaPvp").value) || 0;

  if (!cantVal) {
    alert("La cantidad es obligatoria.");
    return;
  }

  let pvp = pvpVal;
  let descripcion = desc;

  // Si hay referencia y no hay pvp, intentamos buscar en la tarifa
  if (!pvp && refRaw) {
    const prod = await buscarProductoEnTarifa(refRaw);
    if (prod) {
      pvp = Number(prod.pvp) || 0;
      if (!descripcion && prod.descripcion) {
        descripcion = prod.descripcion;
      }
    }
  }

  const refNormalizada = refRaw ? refRaw.replace(/\s+/g, "") : "";

  const subtotal = pvp * cantVal;

  const presu = appState.presupuesto || { lineas: [], resumen: {} };
  presu.lineas = presu.lineas || [];

  presu.lineas.push({
    ref: refNormalizada || "-", // puede ir sin referencia real
    descripcion: descripcion || refRaw || "Línea sin referencia",
    cantidad: cantVal,
    pvp,
    subtotal,
    seccion,
    titulo,
  });

  // Actualizar orden de secciones
  presu.sectionOrder = presu.sectionOrder || [];
  if (!presu.sectionOrder.includes(seccion)) {
    presu.sectionOrder.push(seccion);
  }

  // Recalcular resumen (sin tocar IVA aquí)
  const dto = Number(document.getElementById("presuDto").value) || 0;
  let totalBruto = 0;
  presu.lineas.forEach((l) => {
    totalBruto += (l.subtotal || l.pvp * l.cantidad || 0);
  });
  const factorDto = dto > 0 ? 1 - dto / 100 : 1;
  const totalNeto = totalBruto * factorDto;

  presu.resumen = {
    totalBruto,
    dto,
    totalNeto,
  };

  appState.presupuesto = presu;

  renderResultados(presu.lineas, totalBruto, totalNeto, dto);

  if (overlay) overlay.style.display = "none";
}

// ===============================================
// Precargar datos del proyecto en el formulario
// ===============================================
function precargarDatosProyecto() {
  const p = appState.proyecto || {};
  const presu = appState.presupuesto || {};

  document.getElementById("presuNombre").value =
    p.nombre || presu.nombre || "Proyecto sin nombre";
  document.getElementById("presuCliente").value =
    p.cliente || presu.cliente || "";
  document.getElementById("presuFecha").value =
    p.fecha || presu.fecha || new Date().toISOString().split("T")[0];
  document.getElementById("presuDto").value = presu.resumen?.dto || p.dto || 0;

  const notasPorDefecto =
    "Se requiere de switch PoE para alimentar los equipos.";
  document.getElementById("presuNotas").value =
    presu.notas || p.notas || notasPorDefecto;
}

// ===============================================
// Carga directa de tarifas desde Firestore (con caché)
// ===============================================
async function cargarTarifasDesdeFirestore() {
  if (appState.tarifasCache) {
    console.log(
      "%cTarifa · usar caché (" +
        Object.keys(appState.tarifasCache).length +
        " refs)",
      "color:#16a34a;"
    );
    return appState.tarifasCache;
  }

  const db = firebase.firestore();
  const snap = await db
    .collection("tarifas")
    .doc("v1")
    .collection("productos")
    .get();

  const result = {};
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (!d) return;
    const ref = docSnap.id;
    const pvp = Number(d.pvp) || 0;
    if (!pvp) return;
    result[ref] = {
      pvp,
      descripcion:
        d.descripcion ||
        d.desc ||
        d.nombre ||
        d.title ||
        d.titulo ||
        "",
    };
  });

  console.log(
    "%cTarifa · cargarTarifasDesdeFirestore() -> " +
      Object.keys(result).length +
      " referencias",
    "color:#3b82f6;"
  );

  appState.tarifasCache = result;
  return result;
}

// Buscar un producto en la tarifa normalizando la referencia
async function buscarProductoEnTarifa(refRaw) {
  const tarifas = await cargarTarifasDesdeFirestore();
  if (!tarifas) return null;

  const refOriginal = String(refRaw || "").trim();
  let ref = refOriginal.replace(/\s+/g, "");

  if (/^9\d{7}$/.test(ref)) {
    ref = ref.slice(0, 7);
  }

  const candidatos = [];
  if (refOriginal) candidatos.push(refOriginal.replace(/\s+/g, ""));
  if (ref) candidatos.push(ref);

  if (ref.length === 7) {
    candidatos.push(ref + "0");
    candidatos.push(ref + "00");
  } else if (ref.length === 8) {
    candidatos.push(ref.slice(0, 7));
  }

  const candidatosUnicos = [...new Set(candidatos)];

  for (const key of candidatosUnicos) {
    if (tarifas[key]) {
      return tarifas[key];
    }
  }

  return null;
}

// ===============================================
// Generación del presupuesto completo
// ===============================================
async function generarPresupuesto() {
  const msg = document.getElementById("presuMsg");
  if (msg) msg.style.display = "none";

  const tarifas = await cargarTarifasDesdeFirestore();

  const proyecto = appState.proyecto || {};
  const lineasProyecto =
    (proyecto.lineas && proyecto.lineas.length
      ? proyecto.lineas
      : proyecto.filas) || [];

  console.log(
    "[Presupuesto] tarifas cargadas (reales):",
    Object.keys(tarifas).length
  );
  console.log("[Presupuesto] líneas de proyecto:", lineasProyecto.length);

  let lineasPresupuesto = [];
  let totalBruto = 0;
  let totalNeto = 0;

  for (const item of lineasProyecto) {
    const refCampo =
      item.ref ||
      item.referencia ||
      item.numeroPedido ||
      item["numero de pedido"] ||
      item["Número de pedido"] ||
      item.orderingNumber ||
      item["Ordering Number"];

    if (!item || !refCampo) {
      console.warn("⚠ Línea sin referencia válida:", item);
      continue;
    }

    const refOriginal = String(refCampo || "").trim();
    let ref = refOriginal.replace(/\s+/g, "");

    if (/^9\d{7}$/.test(ref)) {
      ref = ref.slice(0, 7);
    }

    const candidatos = [];
    if (refOriginal) candidatos.push(refOriginal.replace(/\s+/g, ""));
    if (ref) candidatos.push(ref);

    if (ref.length === 7) {
      candidatos.push(ref + "0");
      candidatos.push(ref + "00");
    } else if (ref.length === 8) {
      candidatos.push(ref.slice(0, 7));
    }

    const candidatosUnicos = [...new Set(candidatos)];

    const cantidad =
      Number(item.cantidad) ||
      Number(item.qty) ||
      Number(item["Cantidad"]) ||
      Number(item["cantidad"]) ||
      1;

    if (!cantidad || cantidad <= 0) {
      console.warn("⚠ Cantidad inválida:", item);
      continue;
    }

    let pvp = 0;
    let descTarifa = "";

    for (const key of candidatosUnicos) {
      const prod = tarifas[key];
      if (prod && prod.pvp) {
        pvp = Number(prod.pvp) || 0;
        descTarifa = prod.descripcion || "";
        if (pvp) break;
      }
    }

    if (!pvp) {
      console.warn("⚠ Línea sin precio en tarifa", {
        refOriginal,
        refNormalizada: ref,
        candidatos: candidatosUnicos,
        cantidad,
        desc:
          item.descripcion ||
          item["Nombre del producto"] ||
          item.nombreProducto ||
          item.titulo,
      });
      continue;
    }

    const subtotal = pvp * cantidad;
    totalBruto += subtotal;

    // === sección y título procedentes del Excel/proyecto ===
    const seccion =
      item.seccion ||
      item.section ||
      item.apartado ||
      item.grupo ||
      item["Sección"] ||
      item["SECCION"] ||
      item["Grupo"] ||
      item["Apartado"] ||
      ""; // puede ir vacío

    const titulo =
      item.titulo ||
      item.title ||
      item.subseccion ||
      item["Título"] ||
      item["TITULO"] ||
      item.descripcionTitulo ||
      "";

    const descripcion =
      item.descripcion ||
      item["Nombre del producto"] ||
      item.nombreProducto ||
      item.titulo ||
      descTarifa ||
      "";

    lineasPresupuesto.push({
      ref,
      descripcion,
      cantidad,
      pvp,
      subtotal,
      seccion,
      titulo,
    });
  }

  const dto = Number(document.getElementById("presuDto").value) || 0;
  const factorDto = dto > 0 ? 1 - dto / 100 : 1;

  totalNeto = totalBruto * factorDto;

  const notas = document.getElementById("presuNotas").value || "";

  const prevSectionNotes = appState.presupuesto.sectionNotes || {};
  const prevExtraSections = appState.presupuesto.extraSections || [];
  const incluirIVA =
    appState.presupuesto && typeof appState.presupuesto.incluirIVA === "boolean"
      ? appState.presupuesto.incluirIVA
      : true;

  // Orden de secciones según aparecen
  const sectionOrder = [];
  lineasPresupuesto.forEach((l) => {
    const sec =
      l.seccion ||
      l.section ||
      l.apartado ||
      l.grupo ||
      l["Sección"] ||
      l["SECCION"] ||
      l["Grupo"] ||
      l["Apartado"] ||
      l.titulo ||
      l.title ||
      "Sin sección";
    if (!sectionOrder.includes(sec)) sectionOrder.push(sec);
  });

  appState.presupuesto = {
    lineas: lineasPresupuesto,
    resumen: {
      totalBruto,
      dto,
      totalNeto,
    },
    notas,
    nombre: document.getElementById("presuNombre").value || "",
    cliente: document.getElementById("presuCliente").value || "",
    fecha: document.getElementById("presuFecha").value || "",
    sectionNotes: prevSectionNotes,
    extraSections: prevExtraSections,
    sectionOrder,
    incluirIVA,
  };

  renderResultados(lineasPresupuesto, totalBruto, totalNeto, dto);

  if (msg) {
    msg.textContent = `Presupuesto generado: ${lineasPresupuesto.length} líneas con precio.`;
    msg.style.display = "flex";
  }
}

// ===============================================
// Añadir sección manual (sin líneas) desde la UI
// ===============================================
function onAddManualSection() {
  const nombre = prompt("Nombre de la nueva sección:");
  if (!nombre) re
