// js/pdf_excel.js
// Generación de PDF + Excel

function generarPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("No se ha cargado jsPDF. Revisa los <script> del index.html.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const codigo = generarCodigoPresupuesto();
  const d = appState.infoPresupuesto;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(
    "Presupuesto de Suministro de Videoportero IP y Control de Accesos 2N",
    40,
    50
  );

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Código: ${codigo}`, 40, 70);

  pdf.text(`Cliente: ${d.cliente || "-"}`, 40, 100);
  pdf.text(`Proyecto / Obra: ${d.proyecto || "-"}`, 40, 120);
  pdf.text(`Dirección: ${d.direccion || "-"}`, 40, 140);
  pdf.text(`Contacto: ${d.contacto || "-"}`, 40, 160);
  pdf.text(`Email: ${d.email || "-"}`, 40, 180);
  pdf.text(`Teléfono: ${d.telefono || "-"}`, 40, 200);

  const body = appState.lineasProyecto.map((l) => [
    l.referencia,
    l.nombreTarifa,
    l.cantidad,
    l.pvp.toFixed(2) + " €",
    (l.cantidad * l.pvp).toFixed(2) + " €"
  ]);

  pdf.autoTable({
    startY: 230,
    head: [["Ref", "Descripción", "Cant.", "PVP", "Total línea"]],
    body,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [0, 0, 0], textColor: 255 }
  });

  let finalY = pdf.lastAutoTable.finalY + 20;

  const subtotal = appState.lineasProyecto.reduce(
    (acc, l) => acc + l.cantidad * l.pvp,
    0
  );
  const descEu = subtotal * (appState.descuentoGlobal / 100);
  const baseImp = subtotal - descEu;
  const iva = appState.aplicarIVA ? baseImp * 0.21 : 0;
  const total = baseImp + iva;

  pdf.setFontSize(11);
  pdf.text(`Subtotal: ${subtotal.toFixed(2)} €`, 40, finalY);
  pdf.text(
    `Descuento (${appState.descuentoGlobal}%): -${descEu.toFixed(2)} €`,
    40,
    finalY + 18
  );
  pdf.text(`Base imponible: ${baseImp.toFixed(2)} €`, 40, finalY + 36);
  pdf.text(`IVA (21%): ${iva.toFixed(2)} €`, 300, finalY + 18);
  pdf.setFont("helvetica", "bold");
  pdf.text(`TOTAL: ${total.toFixed(2)} €`, 300, finalY + 36);
  pdf.setFont("helvetica", "normal");

  finalY += 70;
  pdf.setFontSize(11);
  pdf.text("Notas:", 40, finalY);
  pdf.setFontSize(10);
  pdf.text(d.notas || "", 40, finalY + 18, { maxWidth: 700 });

  finalY += 80;
  const condiciones = [
    "• Presupuesto válido durante 30 días naturales.",
    "• Precios sin IVA.",
    "• Material sujeto a disponibilidad.",
    "• Plazo estimado de entrega 2–4 semanas.",
    "• Garantía estándar 36 meses.",
    "• No incluye instalación ni puesta en marcha.",
    "• Cualquier modificación puede afectar al precio final."
  ];
  pdf.setFontSize(11);
  pdf.text("Condiciones generales:", 40, finalY);
  pdf.setFontSize(10);
  let y = finalY + 18;
  condiciones.forEach((c) => {
    pdf.text(c, 40, y);
    y += 14;
  });

  pdf.save(`Presupuesto_${codigo}.pdf`);
}

function generarExcel() {
  const codigo = generarCodigoPresupuesto();
  const wb = XLSX.utils.book_new();

  const rows = [["Ref", "Descripción", "Cantidad", "PVP", "Total línea"]];

  appState.lineasProyecto.forEach((l) => {
    rows.push([
      l.referencia,
      l.nombreTarifa,
      l.cantidad,
      l.pvp,
      l.cantidad * l.pvp
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");

  const subtotal = appState.lineasProyecto.reduce(
    (acc, l) => acc + l.cantidad * l.pvp,
    0
  );
  const descEu = subtotal * (appState.descuentoGlobal / 100);
  const baseImp = subtotal - descEu;
  const iva = appState.aplicarIVA ? baseImp * 0.21 : 0;
  const total = baseImp + iva;

  const rows2 = [
    ["Subtotal", subtotal],
    [`Descuento ${appState.descuentoGlobal}%`, -descEu],
    ["Base imponible", baseImp],
    ["IVA (21%)", iva],
    ["TOTAL", total]
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  XLSX.utils.book_append_sheet(wb, ws2, "Totales");

  XLSX.writeFile(wb, `Presupuesto_${codigo}.xlsx`);
}
