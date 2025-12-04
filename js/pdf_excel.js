// js/pdf_excel.js
// Generación de PDF + Excel (Presupuesto) + PDF Simulador

// =====================================================
// PRESUPUESTO · PDF
// =====================================================
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

  // Cabecera
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("PRESUPUESTO 2N", 40, 40);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Código: ${codigo}`, 40, 60);
  pdf.text(`Cliente: ${d.cliente || "-"}`, 40, 76);
  pdf.text(`Proyecto: ${d.proyecto || "-"}`, 40, 92);
  pdf.text(`Dirección: ${d.direccion || "-"}`, 40, 108);

  pdf.text(`Contacto: ${d.contacto || "-"}`, 320, 60);
  pdf.text(`Email: ${d.email || "-"}`, 320, 76);
  pdf.text(`Teléfono: ${d.telefono || "-"}`, 320, 92);

  // Tabla de líneas
  const startY = 140;
  let y = startY;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("Ref.", 40, y);
  pdf.text("Descripción", 90, y);
  pdf.text("Ud.", 380, y);
  pdf.text("PVP", 420, y);
  pdf.text("Importe", 480, y);

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
    pdf.text(String(cantidad), 380, y, { align: "right" });
    pdf.text(`${pvp.toFixed(2)} €`, 430, y, { align: "right" });
    pdf.text(`${importe.toFixed(2)} €`, 520, y, { align: "right" });

    y += 14;
  });

  // Totales
  let subtotal = 0;
  lineas.forEach((l) => {
    subtotal += (Number(l.cantidad) || 0) * (Number(l.pvp) || 0);
  });
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
  pdf.text(
    `Descuento (${appState.descuentoGlobal}%): -${descEu.toFixed(2)} €`,
    40,
    blockY + 34
  );
  pdf.text(`Base imponible: ${baseImp.toFixed(2)} €`, 40, blockY + 50);
  pdf.text(
    `IVA ${appState.aplicarIVA ? "21%" : "(no aplicado)"}: ${iva.toFixed(2)} €`,
    40,
    blockY + 66
  );
  pdf.text(`TOTAL: ${total.toFixed(2)} €`, 40, blockY + 86);

  // Notas
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("Notas:", 320, blockY + 18);

  pdf.setFont("helvetica", "normal");
  const notas = d.notas || "";
  const notasSplit = pdf.splitTextToSize(notas, 260);
  pdf.text(notasSplit, 320, blockY + 32);

  pdf.save(`${codigo}.pdf`);
}

// =====================================================
// PRESUPUESTO · EXCEL
// =====================================================
function generarExcel() {
  if (!window.XLSX) {
    alert("No se ha cargado XLSX. Revisa los <script> del index.html.");
    return;
  }

  const lineas = getLineasSeleccionadas();
  if (!lineas.length) {
    alert("No hay líneas seleccionadas para el presupuesto.");
    return;
  }

  const data = [];
  data.push(["Ref.", "Descripción", "Ud.", "PVP", "Importe"]);

  let subtotal = 0;

  lineas.forEach((l) => {
    const cantidad = Number(l.cantidad) || 0;
    const pvp = Number(l.pvp) || 0;
    const importe = cantidad * pvp;
    subtotal += importe;

    data.push([l.ref || "", l.descripcion || "", cantidad, pvp, importe]);
  });

  const descEu = subtotal * (appState.descuentoGlobal / 100);
  const baseImp = subtotal - descEu;
  const iva = appState.aplicarIVA ? baseImp * 0.21 : 0;
  const total = baseImp + iva;

  data.push([]);
  data.push(["Subtotal", "", "", "", subtotal]);
  data.push([`Descuento (${appState.descuentoGlobal}%)`, "", "", "", -descEu]);
  data.push(["Base imponible", "", "", "", baseImp]);
  data.push([
    `IVA ${appState.aplicarIVA ? "21%" : "(no aplicado)"}`,
    "",
    "",
    "",
    iva,
  ]);
  data.push(["TOTAL", "", "", "", total]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");

  const codigo = generarCodigoPresupuesto();
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });

  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${codigo}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =====================================================
// SIMULADOR · PDF (tabla ajustada a márgenes A4 vertical)
// =====================================================
window.exportSimuladorPDF = function () {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("No está disponible jsPDF. Revisa la carga de scripts.");
    return;
  }
  if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.API.autoTable) {
    // Si tu versión de jsPDF no expone autoTable así, descomenta el check siguiente:
    // if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.API || !window.jspdf.jsPDF.API.autoTable) {
    alert("No está disponible jsPDF AutoTable. Revisa el script de autotable.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const fmtEur = (n) =>
    (Number(n) || 0).toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €";

  const fmtPct = (n) =>
    (Number(n) || 0).toFixed(1).replace(".", ",") + " %";

  // Datos del presupuesto / simulador
  const presu =
    typeof window.getPresupuestoActual === "function"
      ? window.getPresupuestoActual()
      : null;

  const proyectoNombre = presu?.nombre || "Proyecto sin nombre";
  const fechaPresu = presu?.fecha || new Date().toISOString().slice(0, 10);

  const sim = window.appState?.simulador || {};
  const lineasSim = sim.lineasSimuladas || [];
  const tarifaDefecto = sim.tarifaDefecto || "DIST_PRICE";

  const TARIFAS_MAP = window.TARIFAS_MAP || {};
  const tarifaLabel =
    TARIFAS_MAP[tarifaDefecto]?.label || "Tarifa seleccionada";

  // Totales desde las líneas simuladas
  let totalPvpBase = 0;
  let totalBaseTarifa = 0;
  let totalFinal = 0;

  lineasSim.forEach((l) => {
    const base = Number(l.basePvp || 0);
    const cant = Number(l.cantidad || 0);
    totalPvpBase += base * cant;
    totalBaseTarifa += Number(l.subtotalTarifa || 0);
    totalFinal += Number(l.subtotalFinal || 0);
  });

  const dtoTarifaEf =
    totalPvpBase > 0 ? (1 - totalBaseTarifa / totalPvpBase) * 100 : 0;
  const dtoTotalEf =
    totalPvpBase > 0 ? (1 - totalFinal / totalPvpBase) * 100 : 0;
  const dtoExtraEf =
    totalBaseTarifa > 0 ? (1 - totalFinal / totalBaseTarifa) * 100 : 0;

  const marginX = 40;
  let y = 60;

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Simulación de tarifas 2N", marginX, y);

  // Cabecera texto
  y += 30;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Proyecto: ${proyectoNombre}`, marginX, y);
  y += 16;
  doc.text(`Fecha: ${fechaPresu}`, marginX, y);
  y += 16;
  doc.text(`Tarifa base: ${tarifaLabel}`, marginX, y);

  // Bloque resumen
  y += 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Resumen de simulación (referencia PVP)", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 18;
  doc.text(`PVP base total: ${fmtEur(totalPvpBase)}`, marginX, y);
  y += 14;
  doc.text(
    `Total tras tarifa ${tarifaLabel}: ${fmtEur(totalBaseTarifa)}  (${fmtPct(
      dtoTarifaEf
    )} dto vs PVP)`,
    marginX,
    y
  );
  y += 14;
  doc.text(
    `Total simulado: ${fmtEur(totalFinal)}  (${fmtPct(
      dtoTotalEf
    )} dto total vs PVP)`,
    marginX,
    y
  );
  y += 14;
  doc.text(
    `Descuento extra sobre tarifa (dto adicional de línea): ${fmtPct(
      dtoExtraEf
    )}`,
    marginX,
    y
  );

  if (!lineasSim.length) {
    doc.text(
      "No hay líneas simuladas. Genera primero un presupuesto.",
      marginX,
      y + 30
    );
    doc.save("simulacion_tarifas_2n.pdf");
    return;
  }

  // Cuerpo de la tabla
  const body = lineasSim.map((l) => {
    const tObj = TARIFAS_MAP[l.tarifaId] || {};
    return {
      ref: l.ref || "",
      descripcion: l.descripcion || "",
      cantidad: l.cantidad || 0,
      tarifa: tObj.label || l.tarifaId || "",
      dtoTarifa: fmtPct(l.dtoTarifa || 0),
      dtoLinea: fmtPct(l.dtoLinea || 0),
      pvpFinalUd: fmtEur(l.pvpFinalUd || 0),
      subtotalFinal: fmtEur(l.subtotalFinal || 0),
    };
  });

  const columns = [
    { header: "Ref.", dataKey: "ref" },
    { header: "Descripción", dataKey: "descripcion" },
    { header: "Ud.", dataKey: "cantidad" },
    { header: "Tarifa 2N", dataKey: "tarifa" },
    { header: "Dto tarifa", dataKey: "dtoTarifa" },
    { header: "Dto línea", dataKey: "dtoLinea" },
    { header: "PVP final ud.", dataKey: "pvpFinalUd" },
    { header: "Importe final", dataKey: "subtotalFinal" },
  ];

  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - marginX * 2;

  // Anchos relativos ajustados a A4 vertical
  const widthsRel = {
    ref: 0.12,
    descripcion: 0.32,
    cantidad: 0.06,
    tarifa: 0.20,
    dtoTarifa: 0.08,
    dtoLinea: 0.08,
    pvpFinalUd: 0.07,
    subtotalFinal: 0.07,
  };

  const columnStyles = {};
  Object.keys(widthsRel).forEach((key) => {
    columnStyles[key] = {
      cellWidth: widthsRel[key] * usableWidth,
    };
  });

  doc.autoTable({
    columns,
    body,
    startY: y + 26,
    margin: { left: marginX, right: marginX },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 3,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles,
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      const pageCurrent = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Página ${pageCurrent} / ${pageCount}`,
        pageWidth - marginX,
        doc.internal.pageSize.getHeight() - 20,
        { align: "right" }
      );
    },
  });

  doc.save("simulacion_tarifas_2n.pdf");
};
