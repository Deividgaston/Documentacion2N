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
  "%cUI Presupuesto · versión EXPORT-EXCEL-PDF + IVA",
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
  ";

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
  if (!nombre) return;

  const titulo = prompt("Título dentro de la sección (opcional):") || "";

  const presu = appState.presupuesto || {};
  presu.extraSections = presu.extraSections || [];
  presu.extraSections.push({
    id: Date.now().toString(),
    seccion: nombre,
    titulo,
    nota: "",
  });

  presu.sectionOrder = presu.sectionOrder || [];
  if (!presu.sectionOrder.includes(nombre)) {
    presu.sectionOrder.push(nombre);
  }

  appState.presupuesto = presu;

  if (presu.lineas && presu.resumen) {
    renderResultados(
      presu.lineas,
      presu.resumen.totalBruto || 0,
      presu.resumen.totalNeto || 0,
      presu.resumen.dto || 0
    );
  }
}

// ===============================================
// Mostrar resultados en pantalla (detalle tipo tabla proyecto)
// ===============================================
function renderResultados(lineas, totalBruto, totalNeto, dto) {
  const detalle = document.getElementById("presuDetalle");
  const resumen = document.getElementById("presuResumen");
  const presu = appState.presupuesto || {};
  const sectionNotes = presu.sectionNotes || {};
  const extraSections = presu.extraSections || [];
  presu.sectionOrder = presu.sectionOrder || [];

  if (!detalle || !resumen) return;

  // Filtro actual
  const filtro = (appState.presupuestoFiltroRef || "").toLowerCase();

  const lineasFiltradas = filtro
    ? lineas.filter((l) => {
        const ref = String(l.ref || "").toLowerCase();
        const desc = String(l.descripcion || "").toLowerCase();
        const sec = String(l.seccion || "").toLowerCase();
        const tit = String(l.titulo || "").toLowerCase();
        return (
          ref.includes(filtro) ||
          desc.includes(filtro) ||
          sec.includes(filtro) ||
          tit.includes(filtro)
        );
      })
    : lineas;

  // Actualizar contador en cabecera derecha
  const countLabel = document.getElementById("presuLineCount");
  if (countLabel) {
    countLabel.textContent = `${
      lineasFiltradas ? lineasFiltradas.length : 0
    } líneas cargadas desde el proyecto`;
  }

  if (!lineasFiltradas || lineasFiltradas.length === 0) {
    detalle.textContent = "No hay líneas de presupuesto generadas.";
    resumen.textContent = "No se ha generado todavía el presupuesto.";
    return;
  }

  // Agrupar por sección
  const seccionesMap = {};
  lineasFiltradas.forEach((l) => {
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
    if (!seccionesMap[sec]) seccionesMap[sec] = [];
    seccionesMap[sec].push(l);
  });

  // Asegurar que todas las secciones están en el orden
  Object.keys(seccionesMap).forEach((sec) => {
    if (!presu.sectionOrder.includes(sec)) {
      presu.sectionOrder.push(sec);
    }
  });

  let htmlDetalle = `
    <table class="table">
      <thead>
        <tr>
          <th style="width:48px;">OK</th>
          <th>Ref.</th>
          <th>Sección</th>
          <th>Descripción</th>
          <th style="width:70px;">Ud.</th>
          <th style="width:90px;">PVP</th>
          <th style="width:110px;">Importe</th>
        </tr>
      </thead>
      <tbody>
  `;

  // Render según orden de secciones
  presu.sectionOrder.forEach((sec) => {
    const lineasSec = seccionesMap[sec];
    if (!lineasSec || !lineasSec.length) return;

    let currentTitle = null;

    // Fila de sección (DRAGGABLE)
    htmlDetalle += `
      <tr class="presu-section-row" data-section="${sec}" draggable="true">
        <td colspan="7" style="background:#eef2ff; font-weight:600; text-transform:uppercase; cursor:move;">
          <span style="margin-right:0.5rem;">↕</span>${sec}
        </td>
      </tr>
      <tr>
        <td colspan="7">
          <textarea
            class="section-note"
            data-section="${sec}"
            rows="2"
            style="width:100%; font-size:0.78rem; resize:vertical;"
            placeholder="Notas de la sección (opcional)"
          >${sectionNotes[sec] || ""}</textarea>
        </td>
      </tr>
    `;

    lineasSec.forEach((l) => {
      const tit =
        l.titulo ||
        l.title ||
        l.subseccion ||
        l["Título"] ||
        l["TITULO"] ||
        "";

      // Título gris
      if (tit && tit !== currentTitle) {
        currentTitle = tit;
        htmlDetalle += `
          <tr>
            <td colspan="7" style="background:#f3f4f6; font-weight:500;">
              ${tit}
            </td>
          </tr>
        `;
      }

      const importe = l.subtotal || l.pvp * l.cantidad || 0;

      htmlDetalle += `
        <tr>
          <td>
            <input type="checkbox" class="presu-line-check" checked />
          </td>
          <td>${l.ref}</td>
          <td>${sec}</td>
          <td>${l.descripcion}</td>
          <td>${l.cantidad}</td>
          <td>${l.pvp.toFixed(2)} €</td>
          <td>${importe.toFixed(2)} €</td>
        </tr>
      `;
    });
  });

  htmlDetalle += `
      </tbody>
    </table>
  `;

  // Secciones adicionales (solo notas)
  if (extraSections.length) {
    htmlDetalle += `
      <div style="border-top:1px solid #e5e7eb; margin-top:1rem; padding-top:1rem;">
        <div style="font-size:0.85rem; color:#6b7280; margin-bottom:0.5rem;">
          Secciones adicionales
        </div>
    `;

    extraSections.forEach((sec) => {
      htmlDetalle += `
        <div class="section-block" style="margin-bottom:1rem;">
          <div style="font-weight:600; font-size:0.9rem; margin-bottom:0.25rem;">
            ${sec.seccion}
          </div>
          ${
            sec.titulo
              ? `<div style="background:#f3f4f6; padding:0.25rem 0.5rem; font-size:0.8rem; margin-bottom:0.25rem;">
                  ${sec.titulo}
                 </div>`
              : ""
          }
          <div class="form-group">
            <label style="font-size:0.8rem; color:#6b7280;">Notas de la sección</label>
            <textarea class="section-note-extra" data-id="${sec.id}" rows="2"
              style="width:100%;">${sec.nota || ""}</textarea>
          </div>
        </div>
      `;
    });

    htmlDetalle += `</div>`;
  }

  detalle.innerHTML = htmlDetalle;

  // Guardar notas de sección en estado
  const currentSectionNotes = (appState.presupuesto.sectionNotes =
    sectionNotes);

  detalle.querySelectorAll(".section-note").forEach((ta) => {
    ta.addEventListener("input", (e) => {
      const sec = e.target.dataset.section;
      currentSectionNotes[sec] = e.target.value;
    });
  });

  detalle.querySelectorAll(".section-note-extra").forEach((ta) => {
    ta.addEventListener("input", (e) => {
      const id = e.target.dataset.id;
      const presu2 = appState.presupuesto || {};
      presu2.extraSections = presu2.extraSections || [];
      const found = presu2.extraSections.find((s) => s.id === id);
      if (found) {
        found.nota = e.target.value;
      }
    });
  });

  // Drag & Drop de secciones
  inicializarDragSecciones();

  // Listeners de checkboxes para recalcular totales
  detalle.querySelectorAll(".presu-line-check").forEach((cb) => {
    cb.addEventListener("change", () => {
      recalcularResumenDesdeSeleccion(lineasFiltradas, dto);
    });
  });

  // Cálculo inicial
  recalcularResumenDesdeSeleccion(lineasFiltradas, dto);
}

// ===============================================
// Drag & Drop de secciones (reordenar bloques)
// ===============================================
function inicializarDragSecciones() {
  const presu = appState.presupuesto || {};
  presu.sectionOrder = presu.sectionOrder || [];

  const rows = document.querySelectorAll(".presu-section-row");
  if (!rows.length) return;

  let dragSrcSection = null;

  rows.forEach((row) => {
    row.addEventListener("dragstart", (e) => {
      dragSrcSection = row.dataset.section;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      row.classList.add("drag-over");
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-over");
    });

    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");
      const targetSection = row.dataset.section;
      if (!dragSrcSection || dragSrcSection === targetSection) return;

      const order = presu.sectionOrder || [];
      const srcIdx = order.indexOf(dragSrcSection);
      const tgtIdx = order.indexOf(targetSection);
      if (srcIdx === -1 || tgtIdx === -1) return;

      // mover sección
      const [moved] = order.splice(srcIdx, 1);
      order.splice(tgtIdx, 0, moved);

      presu.sectionOrder = order;
      appState.presupuesto = presu;

      const p = appState.presupuesto;
      renderResultados(
        p.lineas,
        p.resumen.totalBruto || 0,
        p.resumen.totalNeto || 0,
        p.resumen.dto || 0
      );
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
    });
  });
}

// ===============================================
// Recalcular resumen económico según selección
// + botones de exportar
// ===============================================
function recalcularResumenDesdeSeleccion(lineasVisibles, dto) {
  const resumen = document.getElementById("presuResumen");
  const detalle = document.getElementById("presuDetalle");
  if (!resumen || !detalle) return;

  const checks = detalle.querySelectorAll(".presu-line-check");

  let totalBrutoSel = 0;
  let lineasSel = 0;

  lineasVisibles.forEach((l, idx) => {
    const cb = checks[idx];
    if (!cb || !cb.checked) return;
    const importe = l.subtotal || l.pvp * l.cantidad || 0;
    totalBrutoSel += importe;
    lineasSel += 1;
  });

  const presu = appState.presupuesto || {};
  const incluirIVA =
    typeof presu.incluirIVA === "boolean" ? presu.incluirIVA : true;

  const factorDto = dto > 0 ? 1 - dto / 100 : 1;
  const subtotal = totalBrutoSel * factorDto;
  const iva = incluirIVA ? subtotal * 0.21 : 0;
  const totalConIva = subtotal + iva;

  const leyendaIVA = incluirIVA
    ? "Los precios indicados incluyen IVA (21%) en el total mostrado."
    : "Los precios indicados no incluyen IVA. El IVA se añadirá según la legislación vigente.";

  const textoEstadoIVA = incluirIVA
    ? "IVA incluido en el total del presupuesto."
    : "IVA NO incluido en el total del presupuesto.";

  resumen.innerHTML = `
    <div style="display:flex; gap:0.5rem; margin-bottom:0.75rem;">
      <button id="btnExportExcel" class="btn btn-secondary btn-sm">Exportar a Excel</button>
      <button id="btnExportPDF" class="btn btn-primary btn-sm">Exportar a PDF</button>
    </div>

    <div class="metric-card">
      <span class="metric-label">SUBTOTAL (base imponible)</span>
      <span class="metric-value">${subtotal.toFixed(2)} €</span>
    </div>

    <div class="metric-card">
      <span class="metric-label">IVA 21%</span>
      <span class="metric-value">${iva.toFixed(2)} €</span>
    </div>

    <div class="metric-card">
      <span class="metric-label">TOTAL ${incluirIVA ? "CON IVA" : "SIN IVA"}</span>
      <span class="metric-value">${totalConIva.toFixed(2)} €</span>
    </div>

    <div class="form-group" style="margin-top:0.75rem; font-size:0.8rem;">
      <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;">
        <input type="checkbox" id="presuIncluirIVA" ${
          incluirIVA ? "checked" : ""
        } />
        Incluir IVA (21%) en el total
      </label>
      <p id="presuIVAEstado" style="margin-top:0.25rem; font-size:0.78rem; color:#4b5563;">
        Estado: <strong>${textoEstadoIVA}</strong>
      </p>
    </div>

    <p style="font-size:0.8rem; color:#6b7280; margin-top:0.5rem;">
      Líneas seleccionadas: <strong>${lineasSel}</strong><br/>
      Total bruto sin descuento (seleccionadas): <strong>${totalBrutoSel.toFixed(
        2
      )} €</strong> ·
      Descuento global aplicado: <strong>${dto}%</strong>
    </p>

    <p style="font-size:0.8rem; color:#4b5563; margin-top:0.5rem;">
      Este presupuesto tiene una validez de <strong>60 días</strong> desde la fecha de emisión,
      salvo indicación contraria por escrito. ${leyendaIVA}
    </p>
  `;

  const chkIVA = document.getElementById("presuIncluirIVA");
  if (chkIVA) {
    chkIVA.addEventListener("change", (e) => {
      const presu2 = appState.presupuesto || {};
      presu2.incluirIVA = !!e.target.checked;
      appState.presupuesto = presu2;
      recalcularResumenDesdeSeleccion(lineasVisibles, dto);
    });
  }

  const btnExcel = document.getElementById("btnExportExcel");
  const btnPDF = document.getElementById("btnExportPDF");
  if (btnExcel) btnExcel.addEventListener("click", exportarPresupuestoExcel);
  if (btnPDF) btnPDF.addEventListener("click", exportarPresupuestoPDF);
}

// ===============================================
// EXPORTAR A EXCEL (XLSX)
// ===============================================
function exportarPresupuestoExcel() {
  const presu = appState.presupuesto || {};
  if (!presu.lineas || !presu.lineas.length) {
    alert("No hay líneas de presupuesto para exportar.");
    return;
  }

  const fechaHoy = presu.fecha || new Date().toISOString().split("T")[0];
  const nombreProyecto = presu.nombre || "Proyecto sin nombre";
  const cliente = presu.cliente || "";

  const incluirIVA =
    typeof presu.incluirIVA === "boolean" ? presu.incluirIVA : true;
  const dto = presu.resumen?.dto || 0;

  // Recalcular totales sobre TODAS las líneas
  let totalBruto = 0;
  presu.lineas.forEach((l) => {
    totalBruto += l.subtotal || l.pvp * l.cantidad || 0;
  });
  const factorDto = dto > 0 ? 1 - dto / 100 : 1;
  const base = totalBruto * factorDto;
  const iva = incluirIVA ? base * 0.21 : 0;
  const total = base + iva;

  const textoEstadoIVA = incluirIVA
    ? "IVA incluido en el total del presupuesto."
    : "IVA NO incluido en el total del presupuesto. El IVA se añadirá según la legislación vigente.";

  // ===== Construimos AOA (Array of Arrays) =====
  const rows = [];

  // Cabecera / título
  rows.push(["PRESUPUESTO 2N"]);
  rows.push([]);
  rows.push(["Empresa", COMPANY_INFO.nombre]);
  rows.push(["Dirección", COMPANY_INFO.direccion]);
  rows.push(["NIF", COMPANY_INFO.nif]);
  rows.push(["Teléfono", COMPANY_INFO.telefono]);
  rows.push(["Email", COMPANY_INFO.email]);
  rows.push([]);
  rows.push(["Proyecto", nombreProyecto]);
  rows.push(["Cliente", cliente]);
  rows.push(["Fecha", fechaHoy]);
  rows.push([]);
  rows.push(["Descripción", ""]);
  rows.push([presu.notas || ""]);

  rows.push([]);
  rows.push([
    "Sección",
    "Título",
    "Referencia",
    "Descripción",
    "Cantidad",
    "PVP (€)",
    "Importe (€)",
  ]);

  // Agrupar por sección
  const mapSec = {};
  presu.lineas.forEach((l) => {
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
    if (!mapSec[sec]) mapSec[sec] = [];
    mapSec[sec].push(l);
  });

  const secciones =
    presu.sectionOrder && presu.sectionOrder.length
      ? presu.sectionOrder
      : Object.keys(mapSec);

  secciones.forEach((sec) => {
    const list = mapSec[sec];
    if (!list || !list.length) return;
    // Fila de sección (separador)
    rows.push([]);
    rows.push([sec.toUpperCase()]);
    list.forEach((l) => {
      rows.push([
        sec,
        l.titulo || "",
        l.ref || "",
        l.descripcion || "",
        l.cantidad || 0,
        (l.pvp || 0).toFixed(2),
        (l.subtotal || l.pvp * l.cantidad || 0).toFixed(2),
      ]);
    });
  });

  rows.push([]);
  rows.push(["Subtotal (base imponible)", "", "", "", "", "", base.toFixed(2)]);
  rows.push(["IVA 21%", "", "", "", "", "", iva.toFixed(2)]);
  rows.push(["TOTAL", "", "", "", "", "", total.toFixed(2)]);

  // 👉 Texto claro de IVA al final (opción A)
  rows.push([]);
  rows.push([textoEstadoIVA]);

  // Crear workbook
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");

  const fileName =
    "Presupuesto_" +
    (nombreProyecto || "2N") +
    "_" +
    fechaHoy.replace(/-/g, "") +
    ".xlsx";

  XLSX.writeFile(wb, fileName);
}

// ===============================================
// EXPORTAR A PDF (ventana nueva + print -> PDF)
// ===============================================
function exportarPresupuestoPDF() {
  const presu = appState.presupuesto || {};
  if (!presu.lineas || !presu.lineas.length) {
    alert("No hay líneas de presupuesto para exportar.");
    return;
  }

  const fechaHoy = presu.fecha || new Date().toISOString().split("T")[0];
  const nombreProyecto = presu.nombre || "Proyecto sin nombre";
  const cliente = presu.cliente || "";

  const incluirIVA =
    typeof presu.incluirIVA === "boolean" ? presu.incluirIVA : true;
  const dto = presu.resumen?.dto || 0;

  let totalBruto = 0;
  presu.lineas.forEach((l) => {
    totalBruto += l.subtotal || l.pvp * l.cantidad || 0;
  });
  const factorDto = dto > 0 ? 1 - dto / 100 : 1;
  const base = totalBruto * factorDto;
  const iva = incluirIVA ? base * 0.21 : 0;
  const total = base + iva;

  const textoEstadoIVA = incluirIVA
    ? "IVA incluido en el total del presupuesto."
    : "IVA NO incluido en el total del presupuesto. El IVA se añadirá según la legislación vigente.";

  // Agrupar por sección
  const mapSec = {};
  presu.lineas.forEach((l) => {
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
    if (!mapSec[sec]) mapSec[sec] = [];
    mapSec[sec].push(l);
  });

  const secciones =
    presu.sectionOrder && presu.sectionOrder.length
      ? presu.sectionOrder
      : Object.keys(mapSec);

  const win = window.open("", "_blank");
  if (!win) {
    alert("El navegador ha bloqueado la ventana emergente. Permite pop-ups para exportar a PDF.");
    return;
  }

  const estilos = `
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color:#111827; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      h2 { font-size: 15px; margin: 16px 0 8px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1d4ed8; padding-bottom:12px; margin-bottom:18px; }
      .brand { font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:#1d4ed8; font-weight:600; }
      .company-name { font-size:16px; font-weight:700; }
      .company-block, .client-block { font-size:11px; line-height:1.3; }
      .pill { padding:4px 10px; border-radius:999px; font-size:10px; background:#e0ecff; color:#1d4ed8; font-weight:600; }
      table { width:100%; border-collapse:collapse; margin-top:10px; font-size:11px; }
      th, td { border-bottom:1px solid #e5e7eb; padding:6px 4px; text-align:left; vertical-align:top; }
      th { background:#f3f4f6; font-weight:600; }
      .sec-row { background:#eef2ff; font-weight:600; text-transform:uppercase; }
      .title-row { background:#f9fafb; font-weight:500; }
      .totals { margin-top:16px; font-size:11px; width:280px; margin-left:auto; }
      .totals td { padding:4px 4px; }
      .totals tr:last-child td { font-weight:700; border-top:2px solid #1f2937; }
      .notes { margin-top:16px; font-size:10px; color:#4b5563; }
      .footer { margin-top:12px; font-size:9px; color:#6b7280; }
    </style>
  `;

  let html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Presupuesto 2N</title>
        ${estilos}
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">Presupuesto 2N</div>
            <div class="company-name">${COMPANY_INFO.nombre}</div>
            <div class="company-block">
              ${COMPANY_INFO.direccion}<br/>
              NIF: ${COMPANY_INFO.nif}<br/>
              Tel: ${COMPANY_INFO.telefono}<br/>
              Email: ${COMPANY_INFO.email}
            </div>
          </div>
          <div>
            <div class="pill">Documento de oferta</div>
            <div class="client-block" style="margin-top:8px;">
              <strong>Proyecto:</strong> ${nombreProyecto}<br/>
              <strong>Cliente:</strong> ${cliente || "-"}<br/>
              <strong>Fecha:</strong> ${fechaHoy}
            </div>
          </div>
        </div>

        <h2>Detalle del suministro</h2>
        <table>
          <thead>
            <tr>
              <th style="width:18%;">Sección</th>
              <th style="width:18%;">Título</th>
              <th style="width:12%;">Ref.</th>
              <th>Descripción</th>
              <th style="width:8%; text-align:right;">Ud.</th>
              <th style="width:12%; text-align:right;">PVP (€)</th>
              <th style="width:14%; text-align:right;">Importe (€)</th>
            </tr>
          </thead>
          <tbody>
  `;

  secciones.forEach((sec) => {
    const list = mapSec[sec];
    if (!list || !list.length) return;

    html += `
      <tr class="sec-row">
        <td colspan="7">${sec}</td>
      </tr>
    `;

    let currentTitle = null;
    list.forEach((l) => {
      const titulo =
        l.titulo ||
        l.title ||
        l.subseccion ||
        l["Título"] ||
        l["TITULO"] ||
        "";

      if (titulo && titulo !== currentTitle) {
        currentTitle = titulo;
        html += `
          <tr class="title-row">
            <td colspan="7">${titulo}</td>
          </tr>
        `;
      }

      const importe = l.subtotal || l.pvp * l.cantidad || 0;

      html += `
        <tr>
          <td>${sec}</td>
          <td>${titulo || ""}</td>
          <td>${l.ref || ""}</td>
          <td>${l.descripcion || ""}</td>
          <td style="text-align:right;">${l.cantidad || 0}</td>
          <td style="text-align:right;">${(l.pvp || 0).toFixed(2)}</td>
          <td style="text-align:right;">${importe.toFixed(2)}</td>
        </tr>
      `;
    });
  });

  html += `
          </tbody>
        </table>

        <table class="totals">
          <tr>
            <td>Subtotal (base imponible)</td>
            <td style="text-align:right;">${base.toFixed(2)} €</td>
          </tr>
          <tr>
            <td>IVA 21%</td>
            <td style="text-align:right;">${iva.toFixed(2)} €</td>
          </tr>
          <tr>
            <td>Total oferta</td>
            <td style="text-align:right;">${total.toFixed(2)} €</td>
          </tr>
        </table>

        <!-- 👉 Texto claro de estado IVA (opción A) -->
        <p style="margin-top:6px; font-size:10px; color:#111827;">
          Estado IVA: <strong>${textoEstadoIVA}</strong>
        </p>

        <div class="notes">
          ${
            presu.notas
              ? `<strong>Observaciones generales:</strong><br/>${presu.notas
                  .split("\n")
                  .join("<br/>")}`
              : ""
          }
        </div>

        <div class="footer">
          Este presupuesto tiene una validez de <strong>60 días</strong> desde la fecha de emisión,
          salvo indicación contraria por escrito. ${
            incluirIVA
              ? "Los precios indicados incluyen IVA (21%) en el total mostrado."
              : "Los precios indicados no incluyen IVA. El IVA se añadirá según la legislación vigente."
          }<br/>
          La presente oferta no incluye instalación, cableado ni obra civil salvo que se indique expresamente.
        </div>
      </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

console.log(
  "%cUI Presupuesto cargado (ui_presupuesto.js)",
  "color:#0284c7;"
);
window.renderPresupuestoView = renderPresupuestoView;
