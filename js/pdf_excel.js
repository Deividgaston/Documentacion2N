// ======================================================================
// pdf_excel.js — EXPORTACIÓN EN PDF Y EXCEL PARA PRESUPUESTO Y SIMULADOR
// ======================================================================

// =========================================================
//  PRESUPUESTO → PDF
// =========================================================
function generarPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("No se ha cargado jsPDF. Revisa los <script> del index.html.");
    return;
  }

  const lineas = getLineasSeleccionadas();
  if (!lineas.length) {
    alert("No hay líneas seleccionadas para el presupuesto.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const codigo = generarCodigoPresupuesto();
  const d = appState.infoPresupuesto;

  // --------------------------
  // CABECERA
  // --------------------------
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("PRESUPUESTO 2N", 40, 40);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Código: ${codigo}`, 40, 60);
  pdf.text(`Cliente: ${d.cliente || "-"}`, 40, 76);
  pdf.text(`Proyecto: ${d.proyecto || "-"}`, 40, 92);

  // --------------------------
  // TABLA
  // --------------------------
  const startY = 140;
  let y = startY;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("Ref.", 40, y);
  pdf.text("Descripción", 90, y);
  pdf.text("Ud.", 380, y);
  pdf.text("PVP", 420, y);
  pdf.text("Importe", 500, y);
  pdf.setFont("helvetica", "normal");
  y += 16;

  lineas.forEach((l) => {
    const cantidad = Number(l.cantidad) || 0;
    const pvp = Number(l.pvp) || 0;
    const importe = cantidad * pvp;

    if (y > 520) {
      pdf.addPage();
      y = 60;
    }

    pdf.text(String(l.ref || ""), 40, y);
    pdf.text(String(l.descripcion || "").substring(0, 70), 90, y);
    pdf.text(String(cantidad), 380, y);
    pdf.text(`${pvp.toFixed(2)} €`, 430, y, { align: "right" });
    pdf.text(`${importe.toFixed(2)} €`, 520, y, { align: "right" });

    y += 14;
  });

  // --------------------------
  // TOTALES
  // --------------------------
  let subtotal = lineas.reduce(
    (acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.pvp) || 0),
    0
  );

  const descEu = subtotal * (appState.descuentoGlobal / 100);
  const baseImp = subtotal - descEu;
  const iva = appState.aplicarIVA ? baseImp * 0.21 : 0;
  const total = baseImp + iva;

  const blockY = y + 20;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("RESUMEN ECONÓMICO", 40, blockY);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Subtotal: ${subtotal.toFixed(2)} €`, 40, blockY + 18);
  pdf.text(`Descuento: -${descEu.toFixed(2)} €`, 40, blockY + 34);
  pdf.text(`Base imponible: ${baseImp.toFixed(2)} €`, 40, blockY + 50);
  pdf.text(`IVA 21%: ${iva.toFixed(2)} €`, 40, blockY + 66);
  pdf.text(`TOTAL: ${total.toFixed(2)} €`, 40, blockY + 86);

  pdf.save(`${codigo}.pdf`);
}

// =========================================================
//  PRESUPUESTO → EXCEL
// =========================================================
function generarExcel() {
  if (!window.XLSX) {
    alert("No está cargado XLSX.");
    return;
  }

  const lineas = getLineasSeleccionadas();
  if (!lineas.length) return alert("No hay líneas.");

  const data = [];

  data.push(["Ref.", "Descripción", "Ud.", "PVP", "Importe"]);

  let subtotal = 0;

  lineas.forEach((l) => {
    const cantidad = Number(l.cantidad) || 0;
    const pvp = Number(l.pvp) || 0;
    const imp = cantidad * pvp;
    subtotal += imp;

    data.push([
      l.ref || "",
      l.descripcion || "",
      cantidad,
      pvp.toFixed(2),
      imp.toFixed(2),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([wbout]), "presupuesto_2N.xlsx");
}

// =====================================================================
// SIMULADOR → PDF (SIN columna "Dto tarifa")
// =====================================================================
function exportSimuladorPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    return alert("jsPDF no cargado.");
  }

  const sim = appState.simulador;
  const lineas = sim.lineasSimuladas || [];
  if (!lineas.length) return alert("No hay líneas simuladas.");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  let y = 40;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Simulación de tarifas 2N", 40, y);

  y += 30;

  // --------- ENCABEZADO ---------
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Proyecto: ${appState.infoPresupuesto?.proyecto || "-"}`, 40, y);
  y += 18;
  pdf.text(`Fecha: ${new Date().toISOString().slice(0, 10)}`, 40, y);
  y += 18;
  pdf.text(
    `Tarifa base: ${sim.tarifaDefecto || "Distributor Price (EUR)"}`,
    40,
    y
  );

  y += 30;

  // --------- TABLA (SIN "Dto tarifa") ---------
  const headers = [
    "Ref.",
    "Descripción",
    "Ud.",
    "Dto línea",
    "PVP final ud.",
    "Importe final",
  ];

  // 6 columnas ajustadas dentro de márgenes
  const colX = [40, 120, 420, 500, 580, 680];

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  headers.forEach((h, i) => pdf.text(h, colX[i], y));
  y += 14;

  pdf.setFont("helvetica", "normal");

  lineas.forEach((l) => {
    if (y > 530) {
      pdf.addPage();
      y = 40;
    }

    const cols = [
      l.ref,
      String(l.descripcion).substring(0, 55),
      l.cantidad,
      `${l.dtoLinea.toFixed(1)} %`, // solo dto línea
      l.pvpFinalUd.toFixed(2) + " €",
      l.subtotalFinal.toFixed(2) + " €",
    ];

    cols.forEach((c, i) => pdf.text(String(c), colX[i], y));
    y += 12;
  });

  pdf.save("Simulacion_2N.pdf");
}

// =====================================================================
// SIMULADOR → EXCEL (SIN columna "Dto tarifa")
// =====================================================================
function exportSimuladorExcel() {
  if (!window.XLSX) {
    return alert("No está cargado XLSX.");
  }

  const sim = appState.simulador;
  const lineas = sim.lineasSimuladas || [];

  if (!lineas.length) return alert("No hay líneas simuladas.");

  const data = [];

  // Cabeceras: añadimos "Dto tarifa"
  data.push([
    "Ref.",
    "Descripción",
    "Ud.",
    "Dto tarifa",
    "Dto línea",
    "PVP final ud.",
    "Importe final",
  ]);

  lineas.forEach((l) =>
    data.push([
      l.ref,
      l.descripcion,
      l.cantidad,
      `${Number(l.dtoTarifa || 0).toFixed(1)} %`, // Dto tarifa
      `${Number(l.dtoLinea || 0).toFixed(1)} %`,  // Dto línea
      Number(l.pvpFinalUd),
      Number(l.subtotalFinal),
    ])
  );

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws["!cols"] = [
    { wch: 12 }, // Ref.
    { wch: 50 }, // Descripción
    { wch: 6 },  // Ud.
    { wch: 10 }, // Dto tarifa
    { wch: 10 }, // Dto línea
    { wch: 12 }, // PVP final ud.
    { wch: 14 }, // Importe final
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Simulación");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([out]), "Simulacion_2N.xlsx");
}


// Exponer funciones globalmente
window.exportSimuladorPDF = exportSimuladorPDF;
window.exportSimuladorExcel = exportSimuladorExcel;
window.generarPDF = generarPDF;
window.generarExcel = generarExcel;
