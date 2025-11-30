// js/pdf_excel.js
// Generación de PDF + Excel

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
      importe
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
    -descEu
  ]);
  data.push(["Base imponible", "", "", "", baseImp]);
  data.push([
    `IVA ${appState.aplicarIVA ? "21%" : "(no aplicado)"}`,
    "",
    "",
    "",
    iva
  ]);
  data.push(["TOTAL", "", "", "", total]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");

  const codigo = generarCodigoPresupuesto();
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });

  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
