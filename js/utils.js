// js/utils.js

function formatoEUR(num) {
  const n = Number(num) || 0;
  return n.toFixed(2) + " €";
}

window.formatoEUR = formatoEUR;
