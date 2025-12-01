// js/ui_tarifa.js
// Pantalla TARIFA 2N: importar Excel de tarifa y cargarla en Firestore

import { subirTarifaAFirestore, getTarifas } from "./firebase_tarifa.js";

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
                y una columna con el <strong>precio</strong> (MSRP, LIST PRICE, PVP, etc.).
                El programa detecta automáticamente la fila de cabeceras aunque haya filas vacías o títulos encima.
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
  ";

  const btnLeer = document.getElementById("btnLeerTarifa");
  const btnSubir = document.getElementById("btnSubirTarifa");

  if (btnLeer) btnLeer.addEventListener("click", onLeerTarifaClick);
  if (btnSubir) btnSubir.addEventListener("click", onSubirTarifaClick);

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
          Fila cabeceras: <strong>${meta.headerRowIndex + 1}</strong> ·
          Columna referencia: <strong>${meta.refHeader}</strong> ·
          Columna precio: <strong>${meta.priceHeader}</strong> ·
          Columna nombre: <strong>${meta.descHeader || "N/D"}</strong>
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

// --------- helpers de detección de cabeceras y números ---------

function normalizarTextoPlano(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumeroEuro(value) {
  if (typeof value === "number") return value;
  let s = String(value || "").trim();
  if (!s) return 0;

  // quitar espacios
  s = s.replace(/\s+/g, "");

  // "1.234,56" -> "1234.56"
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function esReferencia2N(val) {
  const s = String(val || "").trim();
  if (!s) return false;
  // la mayoría de SKUs son numéricos de 5–8 dígitos, a veces con letras
  if (s.length < 4) return false;
  // evitar títulos tipo "Access Control"
  if (/[a-zA-Z]/.test(s) && !/\d/.test(s)) return false;
  return true;
}

// Parser de tarifa desde Excel usando header:1 (array de filas)
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

        // Obtenemos todas las filas como arrays
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!rows || rows.length === 0) {
          resolve({ productosMap: {}, meta: {} });
          return;
        }

        // 1) Buscar la fila que contenga "2N SKU" (cabeceras reales)
        let headerRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const has2NSKU = row.some(
            (cell) => normalizarTextoPlano(cell) === "2n sku"
          );
          if (has2NSKU) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          console.warn(
            "No se encontró fila de cabeceras con '2N SKU'. Se usará la primera fila no vacía como cabecera."
          );
          headerRowIndex = rows.findIndex((r) =>
            r.some((c) => String(c).trim() !== "")
          );
          if (headerRowIndex === -1) {
            resolve({ productosMap: {}, meta: {} });
            return;
          }
        }

        const headerRow = rows[headerRowIndex];
        const headersNorm = headerRow.map((h) => normalizarTextoPlano(h));

        const colRef =
          headersNorm.findIndex((h) => h === "2n sku") !== -1
            ? headersNorm.findIndex((h) => h === "2n sku")
            : headersNorm.findIndex(
                (h) =>
                  h.includes("sku") ||
                  h.includes("ordering number") ||
                  h.includes("numero de pedido") ||
                  h.includes("número de pedido") ||
                  h.includes("referencia")
              );

        const colName = headersNorm.findIndex(
          (h) =>
            h.includes("nombre del producto") ||
            h === "nombre" ||
            h.includes("product name")
        );

        const colMSRP = headersNorm.findIndex(
          (h) => h.includes("msrp") || h.includes("list price") || h.includes("pvp")
        );

        if (colRef === -1 || colMSRP === -1) {
          console.warn(
            "No se detectaron correctamente columna de referencia o precio.",
            { headerRow }
          );
        }

        const productos = {};

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const rawRef = colRef !== -1 ? row[colRef] : "";
          const rawPrice = colMSRP !== -1 ? row[colMSRP] : "";
          const rawName = colName !== -1 ? row[colName] : "";

          if (!esReferencia2N(rawRef)) continue;

          const ref = String(rawRef).trim().replace(/\s+/g, "").toUpperCase();
          const pvp = parseNumeroEuro(rawPrice);

          if (!ref || !pvp || pvp <= 0) continue;

          const desc = String(rawName || "").trim();

          productos[ref] = {
            pvp,
            descripcion: desc,
            rawRow: row,
          };
        }

        const meta = {
          headerRowIndex,
          refHeader: headerRow[colRef] || null,
          priceHeader: headerRow[colMSRP] || null,
          descHeader: colName !== -1 ? headerRow[colName] : null,
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

// Exponer la función para que el shell pueda llamarla
window.renderTarifaView = renderTarifaView;
