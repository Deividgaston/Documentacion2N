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
                El archivo debe incluir al menos una columna con la <strong>referencia</strong> (2N SKU / Ordering Number)
                y una columna con el <strong>precio</strong> (LIST PRICE, MSRP, Recommended Reseller Price, etc.).
                El programa detecta automáticamente las cabeceras más habituales.
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

    const { productosMap, meta } = await leerTarifaDesdeExcel(file);

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
        msg.style.display = "flex";
      }
      if (btnSubir) btnSubir.disabled = true;
      console.warn("Tarifa · No se encontraron productos. Meta:", meta);
      return;
    }

    if (msg) {
      msg.className = "alert alert-success mt-3";
      msg.innerHTML = `
        Archivo leído correctamente: <strong>${totalRefs}</strong> referencias con PVP.<br/>
        <span style="font-size:0.78rem; color:#6b7280;">
          Columna referencia: <strong>${meta.refField}</strong> ·
          Columna precio: <strong>${meta.priceField}</strong> ·
          Columna nombre: <strong>${meta.descField || "N/D"}</strong>
        </span>
      `;
      msg.style.display = "flex";
    }

    if (btnSubir) btnSubir.disabled = false;
    console.log(
      `%cTarifa · Archivo preparado con ${totalRefs} referencias`,
      "color:#22c55e;"
    );
    console.log("Meta detección cabeceras:", meta);
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

// --------- helpers de detección de cabeceras ---------

function normalizarCabecera(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function encontrarMejorCabecera(headers, candidatos) {
  let mejor = null;
  let mejorScore = -1;

  headers.forEach((h) => {
    const norm = normalizarCabecera(h);
    candidatos.forEach((cand) => {
      if (norm.includes(cand.token) && cand.score > mejorScore) {
        mejor = h;
        mejorScore = cand.score;
      }
    });
  });

  return mejor;
}

// Parser de tarifa desde Excel
// Devuelve: { productosMap, meta }
function leerTarifaDesdeExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });

        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        // Usamos la primera hoja y cabecera automática
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!json || json.length === 0) {
          resolve({ productosMap: {}, meta: {} });
          return;
        }

        const headers = Object.keys(json[0] || {});

        // Detectar campo de referencia
        const refField =
          encontrarMejorCabecera(headers, [
            { token: "2n sku", score: 10 },
            { token: "ordering number", score: 9 },
            { token: "ordering no", score: 9 },
            { token: "order number", score: 8 },
            { token: "sku", score: 7 },
            { token: "número de pedido", score: 7 },
            { token: "numero de pedido", score: 7 },
            { token: "referencia", score: 6 },
            { token: "item no", score: 5 },
            { token: "part number", score: 5 },
          ]) || headers[0]; // fallback

        // Detectar campo de precio
        const priceField =
          encontrarMejorCabecera(headers, [
            { token: "msrp (eur", score: 10 },
            { token: "msrp", score: 9 },
            { token: "pvp", score: 9 },
            { token: "list price (€", score: 9 },
            { token: "list price", score: 8 },
            { token: "recommended reseller price 1", score: 8 },
            { token: "recommended reseller price 2", score: 8 },
            { token: "recommended reseller price", score: 7 },
            { token: "price (eur", score: 7 },
            { token: "retail price", score: 7 },
            { token: "distributor price", score: 6 },
          ]) || null;

        // Detectar campo de descripción
        const descField =
          encontrarMejorCabecera(headers, [
            { token: "product name", score: 10 },
            { token: "nombre del producto", score: 9 },
            { token: "nombre", score: 7 },
            { token: "descripción", score: 7 },
            { token: "descripcion", score: 7 },
          ]) || null;

        if (!priceField) {
          console.warn(
            "No se detectó claramente una columna de precio. Cabeceras:",
            headers
          );
        }

        const productos = {};

        json.forEach((row) => {
          const refRaw = row[refField];
          const priceRaw = priceField ? row[priceField] : null;
          const descRaw = descField ? row[descField] : "";

          let ref = String(refRaw || "")
            .trim()
            .replace(/\s+/g, "")
            .replace(/\./g, "")
            .toUpperCase();

          if (!ref || ref.toLowerCase() === "nan") return;

          let pvpNum = 0;
          if (priceRaw != null && priceRaw !== "") {
            let s = String(priceRaw).trim();
            // "1.234,56" -> "1234.56"
            if (s.includes(",") && s.includes(".")) {
              s = s.replace(/\./g, "").replace(",", ".");
            } else if (s.includes(",")) {
              s = s.replace(",", ".");
            }
            const parsed = Number(s);
            if (!isNaN(parsed)) pvpNum = parsed;
          }

          if (!pvpNum || pvpNum <= 0) {
            return; // ignoramos filas sin precio
          }

          productos[ref] = {
            pvp: pvpNum,
            descripcion: limpiarTexto(descRaw),
            rawRow: row,
          };
        });

        const meta = {
          refField,
          priceField,
          descField,
          headers,
        };

        resolve({ productosMap: productos, meta });
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
        <span class="metric-label">REFERENCIAS CON PVP</span>
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
