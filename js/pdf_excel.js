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
  const d = appState.infoPresupuesto || {};

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
  if (d.fecha) {
    pdf.text(`Fecha: ${d.fecha}`, 40, 108);
  }

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

  // --------------------------
  // NOTAS POR SECCIÓN
  // --------------------------
  const presu = (window.appState && appState.presupuesto) || null;
  if (presu) {
    const sectionNotes = presu.sectionNotes || {};
    const extraSections = presu.extraSections || [];
    const sectionOrder = presu.sectionOrder || [];

    const notasSecciones = [];

    // Usar orden de secciones si existe
    sectionOrder.forEach((sec) => {
      const txt = (sectionNotes[sec] || "").trim();
      if (txt) {
        notasSecciones.push({
          seccion: sec,
          nota: txt,
        });
      }
    });

    // Cualquier sección que tenga nota pero no esté en sectionOrder
    Object.keys(sectionNotes).forEach((sec) => {
      if (sectionOrder.includes(sec)) return;
      const txt = (sectionNotes[sec] || "").trim();
      if (txt) {
        notasSecciones.push({
          seccion: sec,
          nota: txt,
        });
      }
    });

    // Secciones extra manuales
    extraSections.forEach((sec) => {
      if (!sec) return;
      const txt = (sec.nota || "").trim();
      if (!txt) return;
      const titulo =
        sec.seccion ||
        sec.titulo ||
        sec.nombre ||
        (sec.id ? `Sección extra ${sec.id}` : "Sección extra");
      notasSecciones.push({
        seccion: titulo,
        nota: txt,
      });
    });

    if (notasSecciones.length) {
      let notesY = blockY + 120;
      const maxY = 530;
      const startNotesY = 60;

      if (notesY > maxY) {
        pdf.addPage();
        notesY = startNotesY;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("NOTAS POR SECCIÓN", 320, notesY);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);

      let yNotas = notesY + 18;

      notasSecciones.forEach((entry) => {
        if (yNotas > maxY) {
          pdf.addPage();
          yNotas = startNotesY;
        }

        const tituloLinea = `${entry.seccion}:`;
        pdf.text(tituloLinea, 40, yNotas);
        yNotas += 14;

        const rawText = String(entry.nota || "");
        const wrapped = pdf.splitTextToSize
          ? pdf.splitTextToSize(rawText, 480)
          : [rawText];

        wrapped.forEach((line) => {
          if (yNotas > maxY) {
            pdf.addPage();
            yNotas = startNotesY;
          }
          pdf.text(line, 60, yNotas);
          yNotas += 12;
        });

        yNotas += 6;
      });
    }
  }

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

  // Cabecera líneas de presupuesto
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

  // NOTAS POR SECCIÓN (desde la página de presupuesto)
  if (window.appState && appState.presupuesto) {
    const presu = appState.presupuesto;
    const sectionNotes = presu.sectionNotes || {};
    const extraSections = presu.extraSections || [];
    const sectionOrder = presu.sectionOrder || [];

    const notasSecciones = [];

    sectionOrder.forEach((sec) => {
      const txt = (sectionNotes[sec] || "").trim();
      if (txt) {
        notasSecciones.push({
          seccion: sec,
          nota: txt,
        });
      }
    });

    Object.keys(sectionNotes).forEach((sec) => {
      if (sectionOrder.includes(sec)) return;
      const txt = (sectionNotes[sec] || "").trim();
      if (txt) {
        notasSecciones.push({
          seccion: sec,
          nota: txt,
        });
      }
    });

    extraSections.forEach((sec) => {
      if (!sec) return;
      const txt = (sec.nota || "").trim();
      if (!txt) return;
      const titulo =
        sec.seccion ||
        sec.titulo ||
        sec.nombre ||
        (sec.id ? `Sección extra ${sec.id}` : "Sección extra");
      notasSecciones.push({
        seccion: titulo,
        nota: txt,
      });
    });

    if (notasSecciones.length) {
      data.push([]);
      data.push(["NOTAS POR SECCIÓN"]);
      data.push(["Sección", "Nota"]);

      notasSecciones.forEach((entry) => {
        data.push([entry.seccion, entry.nota]);
      });
    }
  }

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

  let y = 60;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("SIMULACIÓN TARIFAS / DESCUENTOS 2N", 40, 40);

  // Cabecera de tabla
  const headers = [
    "Ref.",
    "Descripción",
    "Ud.",
    "Dto tarifa",
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
      y = 60;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      headers.forEach((h, i) => pdf.text(h, colX[i], y));
      y += 14;
      pdf.setFont("helvetica", "normal");
    }

    const row = [
      l.ref || "",
      (l.descripcion || "").substring(0, 60),
      l.cantidad || 0,
      `${(l.dtoTarifa || 0).toFixed(1)} %`,
      `${(l.dtoLinea || 0).toFixed(1)} %`,
      `${(l.pvpFinalUd || 0).toFixed(2)} €`,
      `${(l.subtotalFinal || 0).toFixed(2)} €`,
    ];

    row.forEach((c, i) => {
      pdf.text(String(c), colX[i], y);
    });

    y += 12;
  });

  pdf.save("Simulacion_2N.pdf");
}

// =====================================================================
// SIMULADOR → EXCEL (CON columna "Dto tarifa")
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

  lineas.forEach((l) => {
    data.push([
      l.ref || "",
      l.descripcion || "",
      l.cantidad || 0,
      (l.dtoTarifa || 0).toFixed(1) + " %",
      (l.dtoLinea || 0).toFixed(1) + " %",
      (l.pvpFinalUd || 0).toFixed(2) + " €",
      (l.subtotalFinal || 0).toFixed(2) + " €",
    ]);
  });

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
