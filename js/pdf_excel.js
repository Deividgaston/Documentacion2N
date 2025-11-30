// js/pdf_excel.js
// Exportaciones básicas – Excel incluye SECCIÓN

function exportarPresupuestoExcel() {
  const lineas = appState.lineasProyecto || [];
  if (!lineas.length) {
    alert("No hay líneas para exportar.");
    return;
  }

  const rows = [];
  rows.push(["Sección", "Referencia", "Descripción", "Cantidad", "PVP", "Importe"]);

  lineas.forEach(l => {
    rows.push([
      l.seccion || "",
      l.ref || "",
      l.descripcion || "",
      Number(l.cantidad || 0),
      Number(l.pvp || 0),
      Number(l.importe || 0),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");

  XLSX.writeFile(wb, "presupuesto_2n.xlsx");
}

function exportarPresupuestoPDF() {
  alert("Exportar PDF todavía lo dejamos básico. Lo afinamos luego si quieres.");
}

window.exportarPresupuestoExcel = exportarPresupuestoExcel;
window.exportarPresupuestoPDF = exportarPresupuestoPDF;
