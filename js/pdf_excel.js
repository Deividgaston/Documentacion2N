// js/pdf_excel.js
// Generación de PDF + Excel (Presupuesto) + PDF Simulador

// ======================================================
// 1) PRESUPUESTO · PDF
// ======================================================
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

// ======================================================
// 2) PRESUPUESTO · EXCEL
// ======================================================
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

    data.push([
      l.ref || "",
      l.descripcion || "",
      cantidad,
      pvp,
      importe,
    ]);
  });

  const descEu = subtotal * (appState.descuentoGlobal / 100);
  const baseImp = subtotal - descEu;
  const iva = appState.aplicarIVA ? baseImp * 0.21 : 0;
  const total = baseImp + iva;

  data.push([]);
  data.push(["Subtotal", "", "", "", subtotal]);
  data.push([
    `Descuento (${appState.descuentoGlobal}%)`,
    "",
    "",
    "",
    -descEu,
  ]);
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

// ======================================================
// 3) SIMULADOR · PDF (sin cadena de márgenes)
// ======================================================
function exportSimuladorPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.autoTable) {
    alert("No está disponible jsPDF o autoTable. Revisa los <script> del index.html.");
    return;
  }

  const { jsPDF } = window.jspdf;
  // 👉 A4 HORIZONTAL para tener más ancho
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const info = appState.infoPresupuesto || {};
  const sim = appState.simulador || {};
  const lineasSim = sim.lineasSimuladas || [];

  if (!lineasSim.length) {
    alert("No hay líneas simuladas. Recalcula la simulación primero.");
    return;
  }

  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 40;
  const marginRight = 40;

  // =============== CABECERA =================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Simulación de tarifas 2N", marginLeft, 40);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const hoy = new Date();
  const fechaStr = hoy.toISOString().slice(0, 10);

  const tarifaDef = sim.tarifaDefecto || "DIST_PRICE";
  const objTarifa = (window.TARIFAS_MAP && window.TARIFAS_MAP[tarifaDef]) || null;
  const etiquetaTarifaBase =
    (objTarifa && objTarifa.label) || "Tarifa seleccionada";

  let y = 40 + 22;
  doc.text(`Proyecto: ${info.proyecto || "Proyecto sin nombre"}`, marginLeft, y);
  y += 14;
  doc.text(`Fecha: ${fechaStr}`, marginLeft, y);
  y += 14;
  doc.text(`Tarifa base: ${etiquetaTarifaBase}`, marginLeft, y);
  y += 22;

  // ========= RESUMEN: recalculamos totales =========
  let totalPvpBase = 0;
  let totalBaseTarifa = 0;
  let totalFinal = 0;

  lineasSim.forEach((l) => {
    const cantidad  = Number(l.cantidad || 0) || 0;
    const base      = Number(l.basePvp || 0) || 0;
    const dtoTarifa = Number(l.dtoTarifa || 0) || 0;
    const dtoLinea  = Number(l.dtoLinea || 0) || 0;

    const factorTarifa = 1 - dtoTarifa / 100;
    const factorLinea  = 1 - dtoLinea  / 100;

    const pvpTarifaUd = base * factorTarifa;
    const pvpFinalUd  = base * factorTarifa * factorLinea;

    totalPvpBase    += base        * cantidad;
    totalBaseTarifa += pvpTarifaUd * cantidad;
    totalFinal      += pvpFinalUd  * cantidad;
  });

  const dtoTarifaEf =
    totalPvpBase > 0 ? (1 - totalBaseTarifa / totalPvpBase) * 100 : 0;
  const dtoTotalEf =
    totalPvpBase > 0 ? (1 - totalFinal / totalPvpBase) * 100 : 0;
  const dtoExtraEf =
    totalBaseTarifa > 0 ? (1 - totalFinal / totalBaseTarifa) * 100 : 0;

  doc.setFont("helvetica", "bold");
  doc.text("Resumen de simulación (referencia PVP)", marginLeft, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.text(`PVP base total: ${totalPvpBase.toFixed(2)} €`, marginLeft, y);
  y += 14;
  doc.text(
    `Total tras tarifa ${etiquetaTarifaBase}: ${totalBaseTarifa.toFixed(
      2
    )} €   (${dtoTarifaEf.toFixed(1)} % dto vs PVP)`,
    marginLeft,
    y
  );
  y += 14;
  doc.text(
    `Total simulado: ${totalFinal.toFixed(
      2
    )} €   (${dtoTotalEf.toFixed(1)} % dto total vs PVP)`,
    marginLeft,
    y
  );
  y += 14;
  doc.text(
    `Descuento extra sobre tarifa (dto adicional de línea): ${dtoExtraEf.toFixed(
      1
    )} %`,
    marginLeft,
    y
  );

  // Separador
  y += 24;
  doc.setDrawColor(220);
  doc.line(marginLeft, y - 10, pageWidth - marginRight, y - 10);

  // =============== TABLA =================
  const body = lineasSim.map((l) => ({
    ref: l.ref || "",
    descripcion: l.descripcion || "",
    cantidad: l.cantidad || 0,
    tarifa: (window.TARIFAS_MAP && window.TARIFAS_MAP[l.tarifaId]?.label) || "",
    dtoTarifa: `${(l.dtoTarifa || 0).toFixed(1)} %`,
    dtoLinea: `${(l.dtoLinea || 0).toFixed(1)} %`,
    pvpFinalUd: `${(l.pvpFinalUd || 0).toFixed(2)} €`,
    subtotalFinal: `${(l.subtotalFinal || 0).toFixed(2)} €`,
  }));

  doc.autoTable({
    startY: y,
    margin: { left: marginLeft, right: marginRight },
    tableWidth: pageWidth - marginLeft - marginRight, // 👉 forzamos ancho total dentro de márgenes
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: {
      cantidad:   { halign: "center" },
      dtoTarifa:  { halign: "right" },
      dtoLinea:   { halign: "right" },
      pvpFinalUd: { halign: "right" },
      subtotalFinal: { halign: "right" },
    },
    columns: [
      { header: "Ref.",         dataKey: "ref" },
      { header: "Descripción",  dataKey: "descripcion" },
      { header: "Ud.",          dataKey: "cantidad" },
      { header: "Tarifa 2N",    dataKey: "tarifa" },
      { header: "Dto tarifa",   dataKey: "dtoTarifa" },
      { header: "Dto línea",    dataKey: "dtoLinea" },
      { header: "PVP ud.",      dataKey: "pvpFinalUd" },   // encabezado más corto
      { header: "Imp. final",   dataKey: "subtotalFinal" } // encabezado más corto
    ],
    body,
    didDrawPage: (data) => {
      const pageCount   = doc.internal.getNumberOfPages();
      const pageCurrent = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text(
        `Página ${pageCurrent} / ${pageCount}`,
        pageWidth - marginRight,
        pageHeight - 20,
        { align: "right" }
      );
    },
  });

  const nombre = `Simulacion_2N_${fechaStr}.pdf`;
  doc.save(nombre);
}
