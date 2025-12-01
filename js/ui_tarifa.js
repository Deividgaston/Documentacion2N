// js/ui_tarifa.js
// Pantalla TARIFA 2N: importar Excel de tarifa y cargarla en Firestore

window.appState = window.appState || {};
appState.tarifaUpload = appState.tarifaUpload || {
  productos: null,
  total: 0,
};

function renderTarifaView() {
  const container = document.getElementById("appContent");
  if (!container) return;

  container.innerHTML = `
    <div class="tarifa-layout">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Tarifa 2N</div>
            <div class="card-subtitle">
              Importa la tarifa oficial de 2N (Excel) para que el sistema pueda calcular los PVP de los presupuestos.
            </div>
          </div>
        </div>

        <div class="card-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Archivo de tarifa (Excel)</label>
              <p style="font-size:0.78rem; color:#6b7280; margin-bottom:0.45rem;">
                El archivo debe incluir al menos: 
                <strong>Referencia</strong> (2N SKU / Número de pedido) 
                y <strong>MSRP (EUR)</strong> o equivalente.
              </p>
              <input id="tarifaFileInput" type="file" accept=".xlsx,.xls,.csv" />

              <div class="form-row mt-3">
                <button id="btnLeerTarifa" class="btn btn-secondary">
                  1 · Leer archivo y preparar tarifa
                </button>
                <button id="btnSubirTarifa" class="btn btn-primary" disabled>
                  2 · Cargar tarifa en Firebase
                </button>
              </div>
            </div>
          </div>

          <div id="tarifaMensaje" class="alert alert-info mt-3" style="display:none;"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Estado de la tarifa</div>
        </div>
        <div class="card-body" id="tarifaEstado">
          Cargando información de la tarifa...
        </div>
      </div>
    </div>
  `;

  const btnLeer = document.getElementById("btnLeerTarifa");
  const btnSubir = document.getElementById("btnSubirTarifa");

  if (btnLeer) {
    btnLeer.addEventListener("click", onLeerTarifaClick);
  }
  if (btnSubir) {
    btnSubir.addEventListener("click", onSubirTarifaClick);
  }

  // Estado inicial de la tarifa
  actualizarEstadoTarifaFirebase();
}

// =============================
// LECTURA DEL EXCEL DE TARIFA
// =============================

async function onLeerTarifaClick() {
  const fileInput = document.getElementById("tarifaFileInput");
  const msg = document.getElementById("tarifaMensaje");
  const btnSubir = document.getElementById("btnSubirTarifa");

  if (msg) {
    msg.style.display = "none";
    msg.textContent = "";
  }

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    if (msg) {
      msg.className = "alert alert-error mt-3";
      msg.textContent = "Selecciona un archivo de tarifa antes de continuar.";
      msg.style.display = "flex";
    }
    return;
  }

  const file = fileInput.files[0];

  try {
    if (msg) {
      msg.className = "alert alert-info mt-3";
      msg.textContent = "Leyendo archivo de tarifa...";
      msg.style.display = "flex";
    }

    const productosMap = await leerTarifaDesdeExcel(file);

    const totalRefs = Object.keys(productosMap).length;
    appState.tarifaUpload = {
      productos: productosMap,
      total: totalRefs,
    };

    if (totalRefs === 0) {
      if (msg) {
        msg.className = "alert alert-warning mt-3";
        msg.textContent =
          "No se han encontrado referencias con precio. Revisa las cabeceras del archivo.";
      }
      if (btnSubir) btnSubir.disabled = true;
      return;
    }

    if (msg) {
      msg.className = "alert alert-success mt-3";
      msg.textContent = `Archivo leído correctamente: ${totalRefs} referencias con PVP encontradas.`;
      msg.style.display = "flex";
    }

    if (btnSubir) btnSubir.disabled = false;
    console.log(
      `%cTarifa · Archivo preparado con ${totalRefs} referencias`,
      "color:#22c55e;"
    );
  } catch (error) {
    console.error("Error leyendo la tarifa desde Excel:", error);
    if (msg) {
      msg.className = "alert alert-error mt-3";
      msg.textContent =
        "Se ha producido un error al leer el archivo de tarifa. Revisa el formato.";
      msg.style.display = "flex";
    }
    if (btnSubir) btnSubir.disabled = true;
  }
}

// Parser de tarifa desde Excel
// Devuelve: { ref: { pvp, descripcion, rawRow }, ... }
function leerTarifaDesdeExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });

        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const productos = {};

        json.forEach((row) => {
          // Referencia: soportamos varios nombres de columna
          const refRaw =
            row["2N SKU"] ||
            row["SKU"] ||
            row["Referencia"] ||
            row["Número de pedido"] ||
            row["Numero de pedido"] ||
            row["Referencia 2N"] ||
            row["Referencia_2N"] ||
            row["Ref"] ||
            "";

          // Precio: columnas típicas
          const pvpRaw =
            row["MSRP (EUR)"] ||
            row["MSRP EUR"] ||
            row["MSRP"] ||
            row["PVP"] ||
            row["PVP (EUR)"] ||
            "";

          const descRaw =
            row["Nombre del producto"] ||
            row["Product Name"] ||
            row["Nombre producto"] ||
            row["Descripción"] ||
            row["Descripcion"] ||
            "";

          const ref = String(refRaw)
            .trim()
            .replace(/\s+/g, "")
            .replace(/\./g, "")
            .toUpperCase();

          const pvp = Number(pvpRaw) || 0;

          if (!ref || pvp <= 0) {
            return; // ignoramos filas sin ref o sin precio
          }

          productos[ref] = {
            pvp,
            descripcion: limpiarTexto(descRaw),
            rawRow: row,
          };
        });

        resolve(productos);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = function (err) {
      reject(err);
    };

    reader.readAsArrayBuffer(file);
  });
}

// =============================
// SUBIDA DE TARIFA A FIRESTORE
// =============================

async function onSubirTarifaClick() {
  const msg = document.getElementById("tarifaMensaje");
  const btnSubir = document.getElementById("btnSubirTarifa");

  if (msg) {
    msg.style.display = "none";
    msg.textContent = "";
  }

  const productos = appState.tarifaUpload.productos;
  const total = appState.tarifaUpload.total || 0;

  if (!productos || total === 0) {
    if (msg) {
      msg.className = "alert alert-warning mt-3";
      msg.textContent =
        "Primero debes leer un archivo de tarifa válido (paso 1).";
      msg.style.display = "flex";
    }
    return;
  }

  if (btnSubir) btnSubir.disabled = true;

  try {
    if (msg) {
      msg.className = "alert alert-info mt-3";
      msg.textContent = `Subiendo ${total} referencias a Firebase...`;
      msg.style.display = "flex";
    }

    const subidos = await subirTarifaAFirestore(productos);

    if (msg) {
      msg.className = "alert alert-success mt-3";
      msg.textContent = `Tarifa actualizada correctamente: ${subidos} referencias subidas a Firebase.`;
      msg.style.display = "flex";
    }

    // Refrescar estado de tarifa desde Firestore
    actualizarEstadoTarifaFirebase();
  } catch (error) {
    console.error("Error subiendo tarifa a Firestore:", error);
    if (msg) {
      msg.className = "alert alert-error mt-3";
      msg.textContent =
        "Se ha producido un error al subir la tarifa a Firebase. Revisa la consola para más detalles.";
      msg.style.display = "flex";
    }
  } finally {
    if (btnSubir) btnSubir.disabled = false;
  }
}

// =============================
// ESTADO DE LA TARIFA ACTUAL
// =============================

async function actualizarEstadoTarifaFirebase() {
  const estado = document.getElementById("tarifaEstado");
  if (!estado) return;

  estado.textContent = "Cargando información de la tarifa...";

  try {
    const tarifas = await getTarifas();
    const totalRefs = Object.keys(tarifas || {}).length;

    if (!tarifas || totalRefs === 0) {
      estado.innerHTML = `
        <p style="font-size:0.9rem; color:#4b5563;">
          No hay referencias de tarifa cargadas en Firebase todavía.
        </p>
      `;
      return;
    }

    estado.innerHTML = `
      <div class="metric-card">
        <span class="metric-label">Referencias con PVP</span>
        <span class="metric-value">${totalRefs}</span>
      </div>
      <p class="mt-2" style="font-size:0.82rem; color:#4b5563;">
        Estos precios se utilizan automáticamente al generar los presupuestos.
      </p>
    `;
  } catch (error) {
    console.error("Error obteniendo estado de tarifa:", error);
    estado.innerHTML = `
      <p style="font-size:0.9rem; color:#b91c1c;">
        No se ha podido cargar la información de la tarifa. Revisa la consola.
      </p>
    `;
  }
}

console.log(
  "%cUI Tarifa cargada (ui_tarifa.js)",
  "color:#4f46e5; font-weight:600;"
);
