// js/ui_doc_prescripcion.js
// ========================================================
// PRESCRIPCIÓN 2N (versión premium Notion B3)
// --------------------------------------------------------
// BLOQUE 1 - Estado global, helpers, modal genérico
// ========================================================

window.appState = window.appState || {};
appState.prescripcion = appState.prescripcion || {
  capitulos: [], // [{ id, nombre, texto, lineas: [...] }]
  selectedCapituloId: null,
  plantillas: [], // [{ id, nombre, texto }]
  plantillasLoaded: false,
  extraRefs: [], // [{ id, codigo, descripcion, unidad, pvp }]
  extraRefsLoaded: false,
  exportLang: "es", // idioma de exportación ("es" | "en" | "pt")
  // NUEVO: términos de búsqueda
  plantillasSearchTerm: "",
  extraRefsSearchTerm: "",
};

// ========================================================
// MODAL GENÉRICO (usa el modal global definido en index.html)
// ========================================================

function openPrescModal({ title, bodyHTML, onSave }) {
  const modal = document.getElementById("prescModal");
  const titleEl = document.getElementById("prescModalTitle");
  const bodyEl = document.getElementById("prescModalBody");
  const btnSave = document.getElementById("prescModalSave");
  const btnClose = document.getElementById("prescModalClose");
  const btnCancel = document.getElementById("prescModalCancel");

  if (!modal) {
    console.warn("[PRESCRIPCIÓN] Modal no encontrado en index.html");
    return;
  }

  titleEl.textContent = title || "";
  bodyEl.innerHTML = bodyHTML || "";
  modal.style.display = "flex";

  const close = () => {
    modal.style.display = "none";
    btnSave.onclick = null;
    btnClose.onclick = null;
    btnCancel.onclick = null;
  };

  btnClose.onclick = close;
  btnCancel.onclick = close;

  btnSave.onclick = async () => {
    if (typeof onSave === "function") await onSave();
    close();
  };
}

// ========================================================
// Helpers de Firestore/Auth (compat con tu arquitectura)
// ========================================================

function getFirestorePresc() {
  if (typeof window.getFirestoreInstance === "function") {
    const db = window.getFirestoreInstance();
    if (db) return db;
  }
  if (window.db) return window.db;

  try {
    return window.firebase.firestore();
  } catch {
    console.warn("[PRESCRIPCIÓN] Firestore no disponible");
    return null;
  }
}

function getAuthPresc() {
  if (typeof window.getAuthInstance === "function") {
    const a = window.getAuthInstance();
    if (a) return a;
  }
  if (window.auth) return window.auth;

  try {
    return window.firebase.auth();
  } catch {
    return null;
  }
}
// ========================================================
// Rutas por usuario (guardado en Firestore)
// users/{uid}/prescripcion_plantillas/{id}
// users/{uid}/prescripcion_referencias_extra/{id}
// ========================================================

function getCurrentUidPresc() {
  const auth = getAuthPresc();

  // 1) Firebase Auth estándar
  if (auth && auth.currentUser && auth.currentUser.uid) return auth.currentUser.uid;

  // 2) Fallbacks: algunos módulos guardan el usuario en appState
  try {
    if (window.appState && window.appState.user && window.appState.user.uid) {
      return window.appState.user.uid;
    }
    if (window.appState && window.appState.auth && window.appState.auth.uid) {
      return window.appState.auth.uid;
    }
  } catch (_) {}

  return null;
}

function getUserSubcollectionRefPresc(subName) {
  const db = getFirestorePresc();
  const uid = getCurrentUidPresc();
  if (!db || !uid) return null;

  // Firestore compat (v8 / compat)
  if (typeof db.collection === "function") {
    return db.collection("users").doc(uid).collection(subName);
  }

  console.warn(
    "[PRESCRIPCIÓN] Firestore instance no soporta .collection(); usa compat o adapta tu getFirestoreInstance()."
  );
  return null;
}

// ========================================================
// Obtener el contenedor principal (como en Doc / Gestión Doc)
// ========================================================

function getPrescripcionAppContent() {
  if (typeof window.getDocAppContent === "function") return window.getDocAppContent();
  if (typeof window.getAppContent === "function") return window.getAppContent();
  return document.getElementById("appContent");
}

// ========================================================
// Obtener presupuesto actual (para generar secciones)
// ========================================================

function getPresupuestoActualSafe() {
  if (typeof window.getPresupuestoActual === "function") {
    try {
      return window.getPresupuestoActual();
    } catch (e) {
      console.error("[PRESCRIPCIÓN] Error obteniendo presupuesto:", e);
      return null;
    }
  }
  console.warn("[PRESCRIPCIÓN] getPresupuestoActual no existe");
  return null;
}

// ========================================================
// BLOQUE 2 - Secciones del presupuesto para Prescripción
// ========================================================

// Añadimos estructura para secciones si no existe
appState.prescripcion.sectionsFromBudget = appState.prescripcion.sectionsFromBudget || [];
/**
 * Convierte las líneas del presupuesto en secciones agregadas
 */
function buildPrescSectionsFromPresupuesto() {
  const presu = getPresupuestoActualSafe();
  if (!presu) {
    console.warn("[PRESCRIPCIÓN] No hay presupuesto cargado para generar secciones.");
    appState.prescripcion.sectionsFromBudget = [];
    return [];
  }

  const seccionesMap = presu.secciones || presu.sections || {};
  const lineas = presu.lineas || presu.lines || presu.lineItems || [];

  const bySection = {};

  lineas.forEach((l) => {
    const secId =
      l.seccionId ||
      l.sectionId ||
      l.seccion ||
      l.capituloId ||
      l.chapterId ||
      "SIN_SECCION";

    if (!bySection[secId]) {
      const def = seccionesMap[secId] || seccionesMap[String(secId)] || {};
      const nombreSec =
        def.nombre ||
        def.name ||
        def.titulo ||
        def.title ||
        (secId === "SIN_SECCION" ? "Sin sección" : String(secId));

      bySection[secId] = {
        id: "sec-" + String(secId),
        rawId: secId,
        nombre: nombreSec,
        totalRefs: 0,
        totalImporte: 0,
        refs: [],
      };
    }

    const cantidad = l.cantidad || l.qty || l.unidades || l.cant || 1;

    const pvp =
      typeof l.pvp === "number"
        ? l.pvp
        : typeof l.precio === "number"
        ? l.precio
        : typeof l.price === "number"
        ? l.price
        : 0;

    const unidad = l.unidad || l.ud || l.unit || "Ud";

    const importe = (Number(cantidad) || 0) * (Number(pvp) || 0);

    bySection[secId].refs.push({
      codigo: l.codigo || l.ref || l.sku || "",
      descripcion: l.descripcion || l.desc || l.concepto || l.nombre || l.title || "",
      unidad,
      cantidad: Number(cantidad) || 0,
      pvp,
      importe,
    });

    bySection[secId].totalRefs += 1;
    bySection[secId].totalImporte += importe;
  });

  const sectionsArr = Object.values(bySection).sort((a, b) =>
    (a.nombre || "").toString().localeCompare((b.nombre || "").toString(), "es")
  );

  appState.prescripcion.sectionsFromBudget = sectionsArr;

  console.log("[PRESCRIPCIÓN] Secciones generadas desde presupuesto:", sectionsArr.length);

  return sectionsArr;
}

/**
 * Helper para asegurar que las secciones están construidas
 */
function ensurePrescSectionsFromBudget() {
  if (!appState.prescripcion.sectionsFromBudget || !appState.prescripcion.sectionsFromBudget.length) {
    return buildPrescSectionsFromPresupuesto();
  }
  return appState.prescripcion.sectionsFromBudget;
}
// ========================================================
// i18n UI + Traducción de CONTENIDO (Gemini) con caché
// ========================================================

const PRESC_UI = {
  es: {
    title: "Prescripción técnica del proyecto",
    subtitle:
      "Arrastra secciones del presupuesto para generar capítulos. Usa referencias extra o plantillas si lo necesitas.",
    exportLang: "Idioma exportación",
    regen: "🔄 Regenerar secciones",
    excel: "⬇️ Excel",
    pdf: "⬇️ PDF",
    bc3: "⬇️ BC3",

    col1Title: "Secciones del presupuesto",
    col1Sub: "Arrastra una sección para crear o actualizar un capítulo",
    col2Title: "Capítulo seleccionado",
    col2Sub: "Nombre, texto descriptivo y referencias del capítulo",

    tplTitle: "Plantillas",
    tplSub: "Arrastra y suelta para rellenar texto técnico",
    extraTitle: "Referencias extra",
    extraSub: "Switches, cable, mano de obra…",

    previewTitle: "Previsualización de la prescripción",
    previewSub: "Capítulos añadidos, totales y desglose desplegable",
  },
  en: {
    title: "Project technical specification",
    subtitle: "Drag budget sections to generate chapters. Use extra references or templates if needed.",
    exportLang: "Export language",
    regen: "🔄 Rebuild sections",
    excel: "⬇️ Excel",
    pdf: "⬇️ PDF",
    bc3: "⬇️ BC3",

    col1Title: "Budget sections",
    col1Sub: "Drag a section to create or update a chapter",
    col2Title: "Selected chapter",
    col2Sub: "Name, description text and chapter references",

    tplTitle: "Templates",
    tplSub: "Drag & drop to fill technical text",
    extraTitle: "Extra references",
    extraSub: "Switches, cable, labour…",

    previewTitle: "Specification preview",
    previewSub: "Added chapters, totals and expandable breakdown",
  },
  pt: {
    title: "Especificação técnica do projeto",
    subtitle: "Arraste seções do orçamento para gerar capítulos. Use referências extra ou modelos se necessário.",
    exportLang: "Idioma de exportação",
    regen: "🔄 Regerar seções",
    excel: "⬇️ Excel",
    pdf: "⬇️ PDF",
    bc3: "⬇️ BC3",

    col1Title: "Seções do orçamento",
    col1Sub: "Arraste uma seção para criar ou atualizar um capítulo",
    col2Title: "Capítulo selecionado",
    col2Sub: "Nome, texto descritivo e referências do capítulo",

    tplTitle: "Modelos",
    tplSub: "Arraste e solte para preencher texto técnico",
    extraTitle: "Referências extra",
    extraSub: "Switches, cabo, mão de obra…",

    previewTitle: "Pré-visualização da especificação",
    previewSub: "Capítulos adicionados, totais e detalhe expansível",
  },
};

function prescUI(key) {
  const lang = appState.prescripcion.exportLang || "es";
  return (PRESC_UI[lang] && PRESC_UI[lang][key]) || PRESC_UI.es[key] || key;
}

// ---- Caché de traducciones (local + memoria) ----
appState.prescripcion._i18n = appState.prescripcion._i18n || {
  baseCaptured: false,
  base: null, // snapshot ES (fuente)
  cacheMem: {}, // { cacheKey: translatedText }
};
// Captura ES como “fuente” (solo 1 vez)
function capturePrescBaseIfNeeded() {
  const st = appState.prescripcion._i18n || (appState.prescripcion._i18n = { cacheMem: {} });

  const capsNow = appState.prescripcion.capitulos || [];
  const secsNow = appState.prescripcion.sectionsFromBudget || [];
  const tplsNow = appState.prescripcion.plantillas || [];
  const extraNow = appState.prescripcion.extraRefs || [];

  // ✅ Si ya capturamos pero ahora hay MÁS cosas, recapturamos
  const needRecapture =
    !st.baseCaptured ||
    !st.base ||
    (st.base.caps?.length || 0) < capsNow.length ||
    (st.base.sections?.length || 0) < secsNow.length ||
    (st.base.plantillas?.length || 0) < tplsNow.length ||
    (st.base.extraRefs?.length || 0) < extraNow.length;

  if (!needRecapture) return;

  const caps = capsNow.map((c) => ({ id: c.id, nombre: c.nombre || "", texto: c.texto || "" }));
  const sections = secsNow.map((s) => ({ id: s.id, nombre: s.nombre || "" }));
  const plantillas = tplsNow.map((p) => ({ id: p.id, nombre: p.nombre || "", texto: p.texto || "" }));
  const extraRefs = extraNow.map((r) => ({
    id: r.id,
    codigo: r.codigo || "",
    descripcion: r.descripcion || "",
    unidad: r.unidad || "Ud",
  }));

  st.base = { caps, sections, plantillas, extraRefs };
  st.baseCaptured = true;
}

function restorePrescBaseEs() {
  const st = appState.prescripcion._i18n;
  if (!st.baseCaptured || !st.base) return;

  // capítulos
  const capsById = new Map((st.base.caps || []).map((x) => [x.id, x]));
  (appState.prescripcion.capitulos || []).forEach((c) => {
    const b = capsById.get(c.id);
    if (b) {
      c.nombre = b.nombre;
      c.texto = b.texto;
    }
  });

  // secciones (solo nombre)
  const secById = new Map((st.base.sections || []).map((x) => [x.id, x]));
  (appState.prescripcion.sectionsFromBudget || []).forEach((s) => {
    const b = secById.get(s.id);
    if (b) s.nombre = b.nombre;
  });

  // plantillas
  const tplById = new Map((st.base.plantillas || []).map((x) => [x.id, x]));
  (appState.prescripcion.plantillas || []).forEach((p) => {
    const b = tplById.get(p.id);
    if (b) {
      p.nombre = b.nombre;
      p.texto = b.texto;
    }
  });

  // refs extra (solo descripción)
  const exById = new Map((st.base.extraRefs || []).map((x) => [x.id, x]));
  (appState.prescripcion.extraRefs || []).forEach((r) => {
    const b = exById.get(r.id);
    if (b) {
      r.descripcion = b.descripcion;
    }
  });
}

// Adapter: traducción con Gemini (reutiliza tus hooks si existen) + caché
async function prescTranslateWithGemini(text, targetLang) {
  const s = String(text || "").trim();
  if (!s) return s;
  if (targetLang === "es") return s;

  // cache key estable
  const key = `presc_i18n_v2|${targetLang}|${s.length}|` + s.slice(0, 80);
  const st = appState.prescripcion._i18n || (appState.prescripcion._i18n = { cacheMem: {} });

  if (st.cacheMem && st.cacheMem[key]) return st.cacheMem[key];

  try {
    const lsKey = "PRESC_TCACHE_" + key;
    const fromLS = localStorage.getItem(lsKey);
    if (fromLS) {
      st.cacheMem[key] = fromLS;
      return fromLS;
    }
  } catch (_) {}

  // hash simple para sectionKey único
  const hash = (str) => {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
    return (h >>> 0).toString(36);
  };

  let out = null;

  // 1) Hooks directos (si algún día los tienes)
  if (typeof window.geminiTranslate === "function") {
    out = await window.geminiTranslate(s, targetLang);
  } else if (typeof window.translateWithGemini === "function") {
    out = await window.translateWithGemini(s, { to: targetLang });
  } else if (typeof window.aiTranslateText === "function") {
    out = await window.aiTranslateText(s, targetLang);

  // 2) ✅ TU CASO REAL: handleDocSectionAI
  } else if (typeof window.handleDocSectionAI === "function") {
    const sectionKey = `presc_i18n_${targetLang}_${hash(s)}`;

    // Llamada (no asumimos formato de retorno)
    const res = await window.handleDocSectionAI({
      sectionKey,
      idioma: targetLang,
      titulo: "Prescripcion",
      texto: s,
      proyecto: appState.proyecto || {},
      presupuesto: (typeof window.getPresupuestoActual === "function") ? window.getPresupuestoActual() : null,
      modo: "tecnica",
    });

    // Intentar obtener texto traducido de distintas formas
    if (typeof res === "string") out = res;
    else if (res && typeof res.text === "string") out = res.text;
    else if (res && typeof res.result === "string") out = res.result;
    else if (res && typeof res.output === "string") out = res.output;

    // Si handleDocSectionAI guarda en appState.documentacion.secciones[sectionKey]
    if (!out) {
      try {
        const saved =
          window.appState?.documentacion?.secciones?.[sectionKey] ??
          window.appState?.documentacion?.sections?.[sectionKey];
        if (typeof saved === "string") out = saved;
      } catch (_) {}
    }
  } else {
    return s; // sin IA disponible
  }

  const translated = String(out || "").trim();
  const finalText = translated || s;

  if (st.cacheMem) st.cacheMem[key] = finalText;
  try { localStorage.setItem("PRESC_TCACHE_" + key, finalText); } catch (_) {}

  return finalText;
}

// Traduce TODO el CONTENIDO visible (capítulos + secciones + plantillas + refs extra)
async function translatePrescAllContentTo(lang) {
  // Asegura snapshot ES completo
  capturePrescBaseIfNeeded();

  if (lang === "es") {
    restorePrescBaseEs();
    return;
  }

  // Siempre partimos de ES limpio
  restorePrescBaseEs();

  const safeT = async (txt) => {
    try {
      return await prescTranslateWithGemini(txt, lang);
    } catch (e) {
      console.warn("[PRESC] Traducción falló, dejo original:", e);
      return txt; // no rompas el resto
    }
  };

  for (const c of appState.prescripcion.capitulos || []) {
    c.nombre = await safeT(c.nombre);
    c.texto = await safeT(c.texto);
  }

  for (const s of appState.prescripcion.sectionsFromBudget || []) {
    s.nombre = await safeT(s.nombre);
  }

  // ✅ AQUÍ lo importante: si una plantilla falla, no aborta
  for (const p of appState.prescripcion.plantillas || []) {
    p.nombre = await safeT(p.nombre);
    p.texto = await safeT(p.texto);
  }

  for (const r of appState.prescripcion.extraRefs || []) {
    r.descripcion = await safeT(r.descripcion);
  }
}
// ✅ Exponer por si algún bloque la usa vía window
window.prescTranslateWithGemini = prescTranslateWithGemini;

// Cambia idioma “de verdad”: UI + contenido + re-render
async function setPrescLanguageAll(lang) {
  appState.prescripcion.exportLang = lang || "es";

  await ensurePrescPlantillasLoaded();
  await ensureExtraRefsLoaded();
  ensurePrescSectionsFromBudget();

  // ✅ clave: capturar base cuando YA está todo cargado
  capturePrescBaseIfNeeded();

  await translatePrescAllContentTo(appState.prescripcion.exportLang);

  renderDocPrescripcionView();
}
// ✅ Exponer para que el handler del select lo encuentre
window.setPrescLanguageAll = setPrescLanguageAll;

// ========================================================
// BLOQUE 3 - Render básico de la vista Prescripción
// ========================================================

function renderDocPrescripcionView() {
  const container = getPrescripcionAppContent();
  if (!container) return;

  const ui = (k) => prescUI(k);

  try {
    ensurePrescSectionsFromBudget();
  } catch (e) {
    console.warn("[PRESC] ensurePrescSectionsFromBudget error:", e);
  }

  appState.prescripcion = appState.prescripcion || {};
  appState.prescripcion.plantillas = appState.prescripcion.plantillas || [];
  appState.prescripcion.extraRefs = appState.prescripcion.extraRefs || [];

  const currentLang = appState.prescripcion.exportLang || "es";

  container.innerHTML = `
    <div class="presc-root" style="display:flex; flex-direction:column; height:100%; min-height:0;">

      <!-- CABECERA -->
      <div class="card" style="margin-bottom:1rem;">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
          <div>
            <div class="card-title">${ui("title")}</div>
            <div class="card-subtitle">${ui("subtitle")}</div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.35rem; align-items:flex-end;">
            <div style="display:flex; gap:0.35rem; align-items:center; flex-wrap:wrap;">
              <span style="font-size:0.75rem; color:#6b7280;">
                ${ui("exportLang")}
              </span>
              <select id="prescExportLang"
                      class="form-control form-control-sm"
                      style="min-width:140px; font-size:0.75rem;">
                <option value="es" ${currentLang === "es" ? "selected" : ""}>Castellano</option>
                <option value="en" ${currentLang === "en" ? "selected" : ""}>English</option>
                <option value="pt" ${currentLang === "pt" ? "selected" : ""}>Português</option>
              </select>
            </div>

            <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
              <button id="prescReloadSectionsBtn" class="btn btn-outline btn-sm">
                ${ui("regen")}
              </button>
              <button id="prescExportExcelBtn" class="btn btn-sm btn-outline">
                ${ui("excel")}
              </button>
              <button id="prescExportPdfBtn" class="btn btn-sm btn-outline">
                ${ui("pdf")}
              </button>
              <button id="prescExportBc3Btn" class="btn btn-sm btn-outline">
                ${ui("bc3")}
              </button>
            </div>
          </div>
        </div>
      </div>
      <!-- CUERPO -->
      <div class="presc-main" style="flex:1; min-height:0; display:flex; flex-direction:column; gap:1rem;">

        <div class="presc-layout"
             style="display:grid; grid-template-columns:1fr 1.4fr 1.2fr; gap:1rem; flex:1; min-height:0;">

          <!-- COLUMNA 1 -->
          <div class="card" style="display:flex; flex-direction:column; overflow:hidden;">
            <div class="card-header">
              <div class="card-title">${ui("col1Title")}</div>
              <div class="card-subtitle">${ui("col1Sub")}</div>
            </div>
            <div id="prescSectionsList" class="card-body" style="flex:1; overflow:auto; padding:0.75rem;"></div>
          </div>

          <!-- COLUMNA 2 -->
          <div class="card" style="display:flex; flex-direction:column; overflow:hidden;">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div class="card-title">${ui("col2Title")}</div>
                <div class="card-subtitle">${ui("col2Sub")}</div>
              </div>
              <div style="display:flex; gap:0.25rem;">
                <button id="prescCapNuevoBtn" class="btn btn-xs btn-secondary">＋</button>
                <button id="prescCapGuardarBtn" class="btn btn-xs btn-secondary">💾</button>
              </div>
            </div>
            <div id="prescCapituloContent" class="card-body" style="flex:1; overflow:auto;"></div>
          </div>

          <!-- COLUMNA 3 -->
          <div style="display:flex; flex-direction:column; gap:1rem; min-height:0;">

            <div class="card" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
              <div class="card-header">
                <div class="card-title">${ui("tplTitle")}</div>
                <div class="card-subtitle">${ui("tplSub")}</div>
              </div>
              <div id="prescPlantillasList" class="card-body" style="flex:1; overflow:auto;"></div>
            </div>

            <div class="card" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
              <div class="card-header">
                <div class="card-title">${ui("extraTitle")}</div>
                <div class="card-subtitle">${ui("extraSub")}</div>
              </div>
              <div id="prescExtraRefsList" class="card-body" style="flex:1; overflow:auto;"></div>
            </div>

          </div>
        </div>
      </div>

      <!-- PREVIEW -->
      <div class="card presc-preview-card" style="flex:0 0 32vh; min-height:240px; overflow:hidden;">
        <div class="card-header">
          <div class="card-title">${ui("previewTitle")}</div>
          <div class="card-subtitle">${ui("previewSub")}</div>
        </div>
        <div id="prescPreview" class="card-body" style="height:100%; overflow:auto;"></div>
      </div>

    </div>
  `;

  // ===== Handlers =====
  container.querySelector("#prescReloadSectionsBtn")?.addEventListener("click", () => {
    try {
      buildPrescSectionsFromPresupuesto();
    } catch (e) {
      console.error("[PRESC] buildPrescSectionsFromPresupuesto error:", e);
    }
    renderDocPrescripcionView();
  });

  container.querySelector("#prescCapNuevoBtn")?.addEventListener("click", () => {
    try {
      createManualCapitulo();
    } catch (e) {
      console.error("[PRESC] createManualCapitulo error:", e);
    }
    renderDocPrescripcionView();
  });

  // (mantengo tu comportamiento: el botón 💾 crea uno; si luego quieres “guardar actual”, lo cambiamos)
  container.querySelector("#prescCapGuardarBtn")?.addEventListener("click", () => {
    try {
      createManualCapitulo();
    } catch (e) {
      console.error("[PRESC] createManualCapitulo (guardar) error:", e);
    }
    renderDocPrescripcionView();
  });

 const langSelect = container.querySelector("#prescExportLang");
if (langSelect) {
  langSelect.value = currentLang;
  langSelect.addEventListener("change", async () => {
    const lang = langSelect.value || "es";
    try {
      if (typeof setPrescLanguageAll === "function") {
        await setPrescLanguageAll(lang);
      } else if (typeof window.setPrescLanguageAll === "function") {
        await window.setPrescLanguageAll(lang);
      } else {
        appState.prescripcion.exportLang = lang;
      }
    } catch (e) {
      console.error("[PRESC] setPrescLanguageAll error:", e);
    }
    
  });
}


  container.querySelector("#prescExportExcelBtn")?.addEventListener("click", () => handlePrescExport("excel"));
  container.querySelector("#prescExportPdfBtn")?.addEventListener("click", () => handlePrescExport("pdf"));
  container.querySelector("#prescExportBc3Btn")?.addEventListener("click", () => handlePrescExport("bc3"));

  // ✅ Cambio mínimo clave: defer a siguiente frame + try/catch por subrender
  requestAnimationFrame(() => {
    try { renderPrescSectionsList(); } catch (e) { console.error("[PRESC] renderPrescSectionsList", e); }
    try { renderPrescCapituloContent(); } catch (e) { console.error("[PRESC] renderPrescCapituloContent", e); }
    try { attachPrescDropZone(); } catch (e) { console.error("[PRESC] attachPrescDropZone", e); }
    try { renderPrescPlantillasList(); } catch (e) { console.error("[PRESC] renderPrescPlantillasList", e); }
    try { renderPrescExtraRefsList(); } catch (e) { console.error("[PRESC] renderPrescExtraRefsList", e); }
    try { renderPrescPreview(); } catch (e) { console.error("[PRESC] renderPrescPreview", e); }
  });
}
// ========================================================
// BLOQUE 4 - Secciones Notion Premium (arrastrables)
// ========================================================

function renderPrescSectionsList() {
  const container = document.getElementById("prescSectionsList");
  if (!container) return;

  const sections = ensurePrescSectionsFromBudget();
  if (!sections.length) {
    container.innerHTML = `
      <p class="text-muted" style="padding:0.5rem; font-size:0.8rem;">
        No hay secciones en el presupuesto actual.
      </p>
    `;
    return;
  }

  container.innerHTML = sections
    .map((sec) => {
      const preview = sec.refs
        .slice(0, 3)
        .map((r) => `${r.descripcion || ""} x${r.cantidad}`)
        .join(" • ");

      return `
        <div class="presc-section-card"
             draggable="true"
             data-section-id="${sec.id}"
             title="Arrastra esta sección para crear o actualizar un capítulo">
          <div class="presc-section-title">${sec.nombre}</div>
          <div class="presc-section-preview">
            ${preview ? preview : "<i>Sin referencias</i>"}
          </div>
        </div>
      `;
    })
    .join("");

  attachPrescSectionsDragHandlers();
}

// Estilos cards secciones
(function injectPrescSectionStyles() {
  if (document.getElementById("presc-section-styles")) return;

  const style = document.createElement("style");
  style.id = "presc-section-styles";

  style.innerHTML = `
    .presc-section-card {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 0.75rem 1rem;
      margin-bottom: 0.75rem;
      background: #ffffff;
      cursor: grab;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      transition: all 0.15s ease;
    }
    .presc-section-card:hover {
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
      transform: translateY(-1px);
    }
    .presc-section-card:active {
      cursor: grabbing;
      transform: scale(0.98);
    }
    .presc-section-title {
      font-size: 0.95rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
      color: #111827;
    }
    .presc-section-preview {
      font-size: 0.78rem;
      color: #6b7280;
      line-height: 1.25;
    }
  `;

  document.head.appendChild(style);
})();

// Drag handlers secciones
function attachPrescSectionsDragHandlers() {
  document.querySelectorAll(".presc-section-card[draggable='true']").forEach((el) => {
    el.addEventListener("dragstart", (ev) => {
      const secId = el.getAttribute("data-section-id");
      ev.dataTransfer.setData("text/presc-section-id", secId);
      el.style.opacity = "0.6";
    });

    el.addEventListener("dragend", () => {
      el.style.opacity = "1";
    });
  });
}
// ========================================================
// BLOQUE 5 - Lógica DROP sección → capítulo
// ========================================================

function attachPrescDropZone() {
  const dropZone = document.getElementById("prescCapituloContent");
  if (!dropZone) return;

  // ✅ FIX mínimo: evita listeners duplicados (MutationObserver llamaba muchas veces)
  if (dropZone.dataset.prescDropAttached === "1") return;
  dropZone.dataset.prescDropAttached = "1";

  dropZone.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    dropZone.style.background = "#f9fafb";
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.style.background = "transparent";
  });

  dropZone.addEventListener("drop", (ev) => {
    ev.preventDefault();
    dropZone.style.background = "transparent";

    const secId = ev.dataTransfer.getData("text/presc-section-id");
    if (!secId) return;

    handleSectionDrop(secId);
  });
}

function handleSectionDrop(secId) {
  const sections = ensurePrescSectionsFromBudget();
  const sec = sections.find((s) => s.id === secId);

  if (!sec) {
    console.warn("[PRESCRIPCIÓN] Sección no encontrada:", secId);
    return;
  }

  const capActual = getSelectedCapitulo();

  if (!capActual) {
    createChapterFromSection(sec);
    return;
  }

  askOverwriteOrAppend(sec, capActual);
}

function createChapterFromSection(sec) {
  const newId = "cap-" + Date.now();

  appState.prescripcion.capitulos.push({
    id: newId,
    nombre: sec.nombre,
    texto: "",
    lineas: cloneSectionRefs(sec),
  });

  appState.prescripcion.selectedCapituloId = newId;

  renderDocPrescripcionView();
}

function cloneSectionRefs(sec) {
  return sec.refs.map((r) => ({
    id: "sec-ref-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    tipo: "budget",
    codigo: r.codigo,
    descripcion: r.descripcion,
    unidad: r.unidad,
    cantidad: r.cantidad,
    pvp: r.pvp,
    importe: r.importe,
    extraRefId: null,
  }));
}

function askOverwriteOrAppend(sec, cap) {
  openPrescModal({
    title: "¿Qué quieres hacer?",
    bodyHTML: `
      <p style="margin-bottom:0.75rem;">
        Has soltado la sección <strong>${sec.nombre}</strong> sobre el capítulo
        <strong>${cap.nombre || "(sin título)"}</strong>.
      </p>

      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        <label><input type="radio" name="secAction" value="overwrite" checked>
          <strong>Sobrescribir capítulo</strong> (renombra y sustituye referencias)
        </label>

        <label><input type="radio" name="secAction" value="append">
          <strong>Añadir referencias</strong> (mantiene nombre y añade las referencias nuevas)
        </label>
      </div>
    `,
    onSave: () => {
      const action = document.querySelector("input[name='secAction']:checked")?.value;

      if (action === "overwrite") {
        overwriteChapterWithSection(cap, sec);
      } else {
        appendSectionToChapter(cap, sec);
      }

      renderDocPrescripcionView();
    },
  });
}

function overwriteChapterWithSection(cap, sec) {
  cap.nombre = sec.nombre;
  cap.texto = "";
  cap.lineas = cloneSectionRefs(sec);
}

function appendSectionToChapter(cap, sec) {
  const existing = cap.lineas || [];
  const newOnes = cloneSectionRefs(sec);

  newOnes.forEach((r) => {
    const dup = existing.find(
      (ex) =>
        ex.codigo === r.codigo &&
        ex.descripcion === r.descripcion &&
        ex.unidad === r.unidad &&
        ex.pvp === r.pvp
    );

    if (!dup) existing.push(r);
  });

  cap.lineas = existing;
}

// Observador para que la dropzone siempre esté conectada
(function setupDropZoneInterval() {
  const observer = new MutationObserver(() => {
    attachPrescDropZone();
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
// ========================================================
// BLOQUE 6 - Capítulos: helpers + render columna central
// ========================================================

function ensurePrescCapitulosArray() {
  if (!appState.prescripcion) appState.prescripcion = {};
  if (!Array.isArray(appState.prescripcion.capitulos)) {
    appState.prescripcion.capitulos = [];
  }
}

function getSelectedCapitulo() {
  ensurePrescCapitulosArray();
  const caps = appState.prescripcion.capitulos;
  if (!caps.length) return null;

  let selId = appState.prescripcion.selectedCapituloId;
  if (!selId) {
    selId = caps[0].id;
    appState.prescripcion.selectedCapituloId = selId;
  }

  return caps.find((c) => c.id === selId) || caps[0] || null;
}

function setSelectedCapitulo(id) {
  appState.prescripcion.selectedCapituloId = id || null;
}

function createManualCapitulo() {
  ensurePrescCapitulosArray();

  const id = "manual-" + Date.now();
  const nuevo = {
    id,
    nombre: "Capítulo manual",
    texto: "",
    lineas: [],
  };

  appState.prescripcion.capitulos.push(nuevo);
  appState.prescripcion.selectedCapituloId = id;

  console.log("[PRESCRIPCIÓN] Capítulo manual creado:", nuevo);
}

function deleteCapituloById(capId) {
  ensurePrescCapitulosArray();
  const caps = appState.prescripcion.capitulos || [];
  const idx = caps.findIndex((c) => c.id === capId);
  if (idx === -1) {
    console.warn("[PRESCRIPCIÓN] No se encontró el capítulo a borrar:", capId);
    return;
  }

  const ok = window.confirm("¿Seguro que quieres eliminar este capítulo de la prescripción?");
  if (!ok) return;

  caps.splice(idx, 1);

  if (appState.prescripcion.selectedCapituloId === capId) {
    appState.prescripcion.selectedCapituloId = caps.length ? caps[0].id : null;
  }

  if (appState.prescripcion.previewExpanded && appState.prescripcion.previewExpanded[capId]) {
    delete appState.prescripcion.previewExpanded[capId];
  }
}

// Render columna central
function renderPrescCapituloContent() {
  const container = document.getElementById("prescCapituloContent");
  if (!container) return;

  const cap = getSelectedCapitulo();
  if (!cap) {
    container.innerHTML = `
      <p class="text-muted" style="font-size:0.85rem;">
        Aún no hay capítulos creados. Puedes:
      </p>
      <ul class="text-muted" style="font-size:0.8rem; padding-left:1.2rem;">
        <li>Crear un capítulo manual con el botón <strong>"Añadir capítulo"</strong>.</li>
        <li>Arrastrar una sección del presupuesto a esta zona para generar un capítulo automáticamente.</li>
      </ul>
    `;
    return;
  }

  const lineas = cap.lineas || [];

  let refsHTML = "";
  if (!lineas.length) {
    refsHTML = `
      <p class="text-muted" style="font-size:0.8rem;">
        Este capítulo no tiene referencias todavía. Arrastra una sección del presupuesto o añade referencias extra desde la derecha.
      </p>
    `;
  } else {
    refsHTML = `
      <div>
        <table class="table table-compact" style="width:100%; font-size:0.8rem; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;">Código</th>
              <th style="text-align:left;">Descripción</th>
              <th style="text-align:center;">Ud</th>
              <th style="text-align:right;">Cant.</th>
              <th style="text-align:right;">PVP</th>
              <th style="text-align:right;">Importe</th>
              <th style="width:2.5rem;"></th>
            </tr>
          </thead>
          <tbody>
            ${lineas
              .map((l) => {
                const isExtra = l.tipo === "extra";
                const cod = l.codigo || "";
                const desc = l.descripcion || "";
                const unidad = l.unidad || "Ud";
                const cant = Number(l.cantidad) || 0;
                const pvp = typeof l.pvp === "number" ? l.pvp : 0;
                const importe = cant * pvp;

                return `
                  <tr data-presc-line-id="${l.id}">
                    <td>${cod}</td>
                    <td>${desc}</td>
                    <td style="text-align:center;">${unidad}</td>
                    <td style="text-align:right;">
                      ${
                        isExtra
                          ? `<input type="number" min="0" step="0.01"
                                   class="presc-line-qty-input"
                                   value="${cant}"
                                   style="width:4rem; text-align:right; font-size:0.78rem;" />`
                          : cant
                      }
                    </td>
                    <td style="text-align:right;">${pvp.toFixed(2)} €</td>
                    <td style="text-align:right;">${importe.toFixed(2)} €</td>
                    <td style="text-align:center;">
                      ${
                        isExtra
                          ? `<button type="button"
                                     class="btn btn-xs btn-outline presc-line-del-btn"
                                     title="Quitar referencia extra">
                               ✖
                             </button>`
                          : ""
                      }
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.75rem;">

      <div class="form-group">
        <label>Título del capítulo</label>
        <input id="prescCapTitulo"
               type="text"
               class="form-control"
               value="${(cap.nombre || "").replace(/"/g, "&quot;")}" />
      </div>

      <div class="form-group">
        <label>Texto descriptivo (mediciones)</label>
        <textarea id="prescCapTexto"
                  class="form-control"
                  style="width:100%; min-height:130px; resize:vertical;"
                  placeholder="Aquí puedes escribir o pegar el texto técnico de mediciones del capítulo...">${cap.texto || ""}</textarea>
      </div>

      <div class="form-group">
        <label>Referencias del capítulo</label>
        ${refsHTML}
      </div>
    </div>
  `;

  const tituloInput = container.querySelector("#prescCapTitulo");
  if (tituloInput) {
    tituloInput.addEventListener("input", (ev) => {
      cap.nombre = ev.target.value || "";
    });
  }

  const textoArea = container.querySelector("#prescCapTexto");
  if (textoArea) {
    textoArea.addEventListener("input", (ev) => {
      cap.texto = ev.target.value || "";
    });
  }

  container.querySelectorAll("tr[data-presc-line-id]").forEach((row) => {
    const lineId = row.getAttribute("data-presc-line-id");
    const linea = (cap.lineas || []).find((l) => l.id === lineId);
    if (!linea) return;

    if (linea.tipo === "extra") {
      const qtyInput = row.querySelector(".presc-line-qty-input");
      const delBtn = row.querySelector(".presc-line-del-btn");

      if (qtyInput) {
        qtyInput.addEventListener("input", () => {
          linea.cantidad = Number(qtyInput.value) || 0;
        });
      }

      if (delBtn) {
        delBtn.addEventListener("click", () => {
          cap.lineas = (cap.lineas || []).filter((l) => l.id !== lineId);
          renderDocPrescripcionView();
        });
      }
    }
  });
}

// ========================================================
// BLOQUE 7 - Plantillas + Referencias extra (Firestore)
// ========================================================

// Auth helper: asegurar UID antes de tocar Firestore (evita "solo local")
function ensurePrescUidReady(timeoutMs = 15000) {
  return new Promise((resolve) => {
    const uidNow = getCurrentUidPresc();
    if (uidNow) return resolve(uidNow);

    const auth = getAuthPresc();
    if (!auth || typeof auth.onAuthStateChanged !== "function") return resolve(null);

    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(getCurrentUidPresc());
    }, Math.max(0, Number(timeoutMs) || 0));

    try {
      auth.onAuthStateChanged((user) => {
        if (done) return;
        if (user && user.uid) {
          done = true;
          clearTimeout(timer);
          resolve(user.uid);
        }
      });
    } catch (_) {
      clearTimeout(timer);
      resolve(getCurrentUidPresc());
    }
  });
}

// ========================
// PLANTILLAS
// ========================

async function ensurePrescPlantillasLoaded() {
  await ensurePrescUidReady();
  appState.prescripcion.plantillas = appState.prescripcion.plantillas || [];
  if (appState.prescripcion.plantillasLoaded) return;

  const db = getFirestorePresc();
  if (!db) {
    console.warn("[PRESCRIPCIÓN] Firestore no disponible para plantillas, solo local.");
    appState.prescripcion.plantillasLoaded = true;
    return;
  }

  try {
    const q = getUserSubcollectionRefPresc("prescripcion_plantillas");
    if (!q) {
      appState.prescripcion.plantillasLoaded = true;
      return;
    }

    const snap = await q.get();
    const list = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      list.push({
        id: doc.id,
        nombre: d.nombre || "(sin nombre)",
        texto: d.texto || "",
      });
    });

    appState.prescripcion.plantillas = list;
    appState.prescripcion.plantillasLoaded = true;
    console.log("[PRESCRIPCIÓN] Plantillas cargadas:", list.length);
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error cargando plantillas:", e);
    appState.prescripcion.plantillasLoaded = true;
  }
}

async function createPrescPlantilla(nombre, texto) {
  await ensurePrescUidReady();
  nombre = (nombre || "").trim();
  texto = texto || "";
  if (!nombre) {
    alert("La plantilla necesita un nombre.");
    return;
  }

  const db = getFirestorePresc();

  let newItem = { id: "local-" + Date.now(), nombre, texto };
  appState.prescripcion.plantillas = [newItem, ...(appState.prescripcion.plantillas || [])];

  if (!db) return;

  try {
    const col = getUserSubcollectionRefPresc("prescripcion_plantillas");
    if (!col) return;

    const docRef = await col.add({
      nombre,
      texto,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    newItem.id = docRef.id;
    appState.prescripcion.plantillas[0] = newItem;
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error creando plantilla:", e);
  }
}

async function updatePrescPlantilla(id, nombre, texto) {
  await ensurePrescUidReady();
  if (!id) return;
  nombre = (nombre || "").trim();
  texto = texto || "";

  const list = appState.prescripcion.plantillas || [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], nombre, texto };
    appState.prescripcion.plantillas = list;
  }

  const db = getFirestorePresc();
  if (!db) return;

  try {
    const col = getUserSubcollectionRefPresc("prescripcion_plantillas");
    if (!col) return;

    await col.doc(id).update({ nombre, texto, updatedAt: Date.now() });
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error actualizando plantilla:", e);
  }
}

async function deletePrescPlantilla(id) {
  await ensurePrescUidReady();
  if (!id) return;
  const ok = window.confirm("¿Seguro que quieres borrar esta plantilla?");
  if (!ok) return;

  appState.prescripcion.plantillas = (appState.prescripcion.plantillas || []).filter((p) => p.id !== id);

  const db = getFirestorePresc();
  if (!db) return;

  try {
    const col = getUserSubcollectionRefPresc("prescripcion_plantillas");
    if (!col) return;

    await col.doc(id).delete();
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error borrando plantilla:", e);
  }
}

// ========================
// REFERENCIAS EXTRA
// ========================

async function ensureExtraRefsLoaded() {
  await ensurePrescUidReady();
  appState.prescripcion.extraRefs = appState.prescripcion.extraRefs || [];
  if (appState.prescripcion.extraRefsLoaded) return;

  const db = getFirestorePresc();
  if (!db) {
    console.warn("[PRESCRIPCIÓN] Firestore no disponible para refs extra, solo local.");
    appState.prescripcion.extraRefsLoaded = true;
    return;
  }

  try {
    const q = getUserSubcollectionRefPresc("prescripcion_referencias_extra");
    if (!q) {
      appState.prescripcion.extraRefsLoaded = true;
      return;
    }

    const snap = await q.get();
    const list = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      list.push({
        id: doc.id,
        codigo: d.codigo || "",
        descripcion: d.descripcion || "",
        unidad: d.unidad || "Ud",
        pvp: typeof d.pvp === "number" ? d.pvp : 0,
      });
    });

    appState.prescripcion.extraRefs = list;
    appState.prescripcion.extraRefsLoaded = true;
    console.log("[PRESCRIPCIÓN] Refs extra cargadas:", list.length);
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error cargando refs extra:", e);
    appState.prescripcion.extraRefsLoaded = true;
  }
}

async function createExtraRef(codigo, descripcion, unidad, pvp) {
  await ensurePrescUidReady();
  codigo = (codigo || "").trim();
  descripcion = (descripcion || "").trim();
  unidad = (unidad || "Ud").trim() || "Ud";
  pvp = Number(pvp) || 0;

  if (!codigo && !descripcion) {
    alert("La referencia necesita al menos código o descripción.");
    return;
  }

  const db = getFirestorePresc();

  let newItem = { id: "local-" + Date.now(), codigo, descripcion, unidad, pvp };
  appState.prescripcion.extraRefs = [newItem, ...(appState.prescripcion.extraRefs || [])];

  if (!db) return;

  try {
    const col = getUserSubcollectionRefPresc("prescripcion_referencias_extra");
    if (!col) return;

    const docRef = await col.add({
      codigo,
      descripcion,
      unidad,
      pvp,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    newItem.id = docRef.id;
    appState.prescripcion.extraRefs[0] = newItem;
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error creando ref extra:", e);
  }
}

async function updateExtraRef(id, codigo, descripcion, unidad, pvp) {
  await ensurePrescUidReady();
  if (!id) return;
  codigo = (codigo || "").trim();
  descripcion = (descripcion || "").trim();
  unidad = (unidad || "Ud").trim() || "Ud";
  pvp = Number(pvp) || 0;

  const list = appState.prescripcion.extraRefs || [];
  const idx = list.findIndex((r) => r.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], codigo, descripcion, unidad, pvp };
    appState.prescripcion.extraRefs = list;
  }

  const db = getFirestorePresc();
  if (!db) return;

  try {
    const col = getUserSubcollectionRefPresc("prescripcion_referencias_extra");
    if (!col) return;

    await col.doc(id).update({ codigo, descripcion, unidad, pvp, updatedAt: Date.now() });
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error actualizando ref extra:", e);
  }
}

async function deleteExtraRef(id) {
  await ensurePrescUidReady();
  if (!id) return;
  const ok = window.confirm("¿Seguro que quieres borrar esta referencia extra?");
  if (!ok) return;

  appState.prescripcion.extraRefs = (appState.prescripcion.extraRefs || []).filter((r) => r.id !== id);

  const db = getFirestorePresc();
  if (!db) return;

  try {
    const col = getUserSubcollectionRefPresc("prescripcion_referencias_extra");
    if (!col) return;

    await col.doc(id).delete();
  } catch (e) {
    console.error("[PRESCRIPCIÓN] Error borrando ref extra:", e);
  }
}

async function duplicateExtraRef(id) {
  const list = appState.prescripcion.extraRefs || [];
  const r = list.find((x) => x.id === id);
  if (!r) return;

  const nuevoCodigo = r.codigo ? r.codigo + "_COPY" : "";
  await createExtraRef(nuevoCodigo, r.descripcion, r.unidad, r.pvp);
}

function addExtraRefToCurrentCap(extraId) {
  const cap = getSelectedCapitulo();
  if (!cap) {
    alert("Selecciona o crea un capítulo primero.");
    return;
  }
  const list = appState.prescripcion.extraRefs || [];
  const r = list.find((x) => x.id === extraId);
  if (!r) return;

  cap.lineas = cap.lineas || [];
  cap.lineas.push({
    id: "extra-" + extraId + "-" + Date.now(),
    tipo: "extra",
    codigo: r.codigo,
    descripcion: r.descripcion,
    unidad: r.unidad || "Ud",
    cantidad: 1,
    pvp: r.pvp || 0,
    importe: (r.pvp || 0) * 1,
    extraRefId: extraId,
  });
}

// ===============================================
// Helper: texto efectivo de plantilla
// (si texto está vacío y el nombre parece "tocho",
// usamos el nombre como texto)
// ===============================================
function getPrescPlantillaEffectiveText(tpl) {
  const rawName = String(tpl?.nombre || "");
  const rawText = String(tpl?.texto || "");

  const nameLooksLikeText = rawName.length > 80 || rawName.includes("\n");
  const effectiveText = rawText.trim() ? rawText : (nameLooksLikeText ? rawName : "");
  return effectiveText;
}



// ========================================================
// Render PLANTILLAS (con buscador) - FIX: no recargar + debounce + escapes
// ========================================================

async function renderPrescPlantillasList() {
  const container = document.getElementById("prescPlantillasList");
  if (!container) return;

  const escHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const escAttr = (s) => escHtml(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const escTextarea = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  if (!appState.prescripcion.plantillasLoaded) {
    await ensurePrescPlantillasLoaded();
  }

  const plantillas = appState.prescripcion.plantillas || [];
  const searchTerm = (appState.prescripcion.plantillasSearchTerm || "").toLowerCase();

  const filtered = plantillas.filter((p) => {
    if (!searchTerm) return true;
    const base = (p.nombre || "") + " " + (p.texto || "");
    return base.toLowerCase().includes(searchTerm);
  });

  if (!plantillas.length) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
        <input id="prescPlantillasSearch"
               type="text"
               class="form-control form-control-sm"
               placeholder="Buscar plantilla..."
               value="${escAttr(appState.prescripcion.plantillasSearchTerm || "")}"
               style="font-size:0.75rem; max-width:60%;">
        <button id="prescNewPlantillaBtn" class="btn btn-xs btn-secondary" title="Nueva plantilla">＋</button>
      </div>
      <p class="text-muted" style="font-size:0.8rem;">
        Aún no tienes plantillas. Crea tu primera plantilla de texto técnico.
      </p>
    `;
  } else {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
        <input id="prescPlantillasSearch"
               type="text"
               class="form-control form-control-sm"
               placeholder="Buscar plantilla..."
               value="${escAttr(appState.prescripcion.plantillasSearchTerm || "")}"
               style="font-size:0.75rem; max-width:60%;">
        <button id="prescNewPlantillaBtn" class="btn btn-xs btn-secondary" title="Nueva plantilla">＋</button>
      </div>
      <div>
        ${
          (filtered.length
            ? filtered
                .map((p) => {
                  const rawName = String(p.nombre || "");
const rawText = String(p.texto || "");

// si el nombre parece un tocho, lo tratamos como texto
const nameLooksLikeText = rawName.length > 80 || rawName.includes("\n");

// nombre mostrado (corto)
const displayName = nameLooksLikeText
  ? (rawName.trim().split("\n")[0].slice(0, 60) + "…")
  : rawName;

// texto real para preview (si texto vacío y nombre era tocho, usamos nombre)
const effectiveText = rawText.trim() ? rawText : (nameLooksLikeText ? rawName : "");

const preview =
  effectiveText
    ? effectiveText.split("\n").slice(0, 3).join(" ").slice(0, 220) + (effectiveText.length > 220 ? "..." : "")
    : "";

const safeName = escHtml(displayName || "(sin nombre)");
const safePreview = preview ? escHtml(preview) : "";

                  return `
                    <div class="presc-plantilla-item"
                         draggable="true"
                         data-presc-plantilla-id="${escAttr(p.id)}">
                      <div class="presc-plantilla-header">
                        <span class="presc-plantilla-name">📄 ${safeName}</span>
                        <span class="presc-plantilla-actions">
                          <button class="btn btn-xs btn-outline" data-presc-plantilla-edit="${escAttr(p.id)}">✏️</button>
                          <button class="btn btn-xs" data-presc-plantilla-del="${escAttr(p.id)}">🗑️</button>
                        </span>
                      </div>
                      <div class="presc-plantilla-preview">
                        ${safePreview || "<i>(sin texto)</i>"}
                      </div>
                      <div class="presc-plantilla-footer">
                        <button class="btn btn-xs" data-presc-plantilla-apply="${escAttr(p.id)}">
                          ➕ Aplicar al capítulo
                        </button>
                      </div>
                    </div>
                  `;
                })
                .join("")
            : `
                <p class="text-muted" style="font-size:0.8rem;">
                  No hay plantillas que coincidan con la búsqueda.
                </p>
              `)
        }
      </div>
    `;
  }

  const searchInput = container.querySelector("#prescPlantillasSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value || "";
      const pos = typeof e.target.selectionStart === "number" ? e.target.selectionStart : val.length;

      appState.prescripcion.plantillasSearchTerm = val;

      if (appState.prescripcion._tplSearchDebounce) clearTimeout(appState.prescripcion._tplSearchDebounce);

      appState.prescripcion._tplSearchDebounce = setTimeout(() => {
        Promise.resolve(renderPrescPlantillasList()).then(() => {
          requestAnimationFrame(() => {
            const again = document.getElementById("prescPlantillasSearch");
            if (!again) return;
            again.focus();
            try { again.setSelectionRange(pos, pos); } catch (_) {}
          });
        });
      }, 60);
    });
  }

  const btnNew = container.querySelector("#prescNewPlantillaBtn");
  if (btnNew) {
    btnNew.addEventListener("click", () => {
      openPrescModal({
        title: "Nueva plantilla de prescripción",
        bodyHTML: `
          <div class="form-group">
            <label>Nombre</label>
            <input id="tplNombre" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Texto</label>
            <textarea id="tplTexto" rows="8" class="form-control"></textarea>
          </div>
        `,
        onSave: async () => {
          const nombre = (document.getElementById("tplNombre").value || "").trim();
          const texto = document.getElementById("tplTexto").value || "";
          await createPrescPlantilla(nombre, texto);
          renderDocPrescripcionView();
        },
      });
    });
  }

  container.querySelectorAll(".presc-plantilla-item[draggable='true']").forEach((el) => {
    el.addEventListener("dragstart", (ev) => {
      const id = el.getAttribute("data-presc-plantilla-id");
      if (!id || !ev.dataTransfer) return;
      ev.dataTransfer.setData("text/presc-plantilla-id", id);
      el.style.opacity = "0.6";
    });
    el.addEventListener("dragend", () => {
      el.style.opacity = "1";
    });
  });

  container.querySelectorAll("[data-presc-plantilla-apply]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-presc-plantilla-apply");
      const plantillasList = appState.prescripcion.plantillas || [];
      const tpl = plantillasList.find((p) => p.id === id);
      if (!tpl) return;

      const cap = getSelectedCapitulo();
      if (!cap) {
        alert("Selecciona o crea un capítulo primero.");
        return;
      }

      cap.texto = getPrescPlantillaEffectiveText(tpl) || "";

      const ta = document.getElementById("prescCapTexto");
      if (ta) ta.value = cap.texto;
    });
  });

  container.querySelectorAll("[data-presc-plantilla-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-presc-plantilla-edit");
      const plantillasList = appState.prescripcion.plantillas || [];
      const tpl = plantillasList.find((p) => p.id === id);
      if (!tpl) return;

      openPrescModal({
        title: "Editar plantilla",
        bodyHTML: `
          <div class="form-group">
            <label>Nombre</label>
            <input id="tplNombre" type="text" class="form-control"
                   value="${escAttr(tpl.nombre || "")}" />
          </div>
          <div class="form-group">
            <label>Texto</label>
            <textarea id="tplTexto" rows="8" class="form-control">${escTextarea(tpl.texto || "")}</textarea>
          </div>
        `,
        onSave: async () => {
          const nombre = (document.getElementById("tplNombre").value || "").trim();
          const texto = document.getElementById("tplTexto").value || "";
          await updatePrescPlantilla(id, nombre, texto);
          renderDocPrescripcionView();
        },
      });
    });
  });

  container.querySelectorAll("[data-presc-plantilla-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-presc-plantilla-del");
      await deletePrescPlantilla(id);
      renderDocPrescripcionView();
    });
  });

  const capTextarea = document.getElementById("prescCapTexto");
  if (capTextarea) {
    capTextarea.addEventListener("dragover", (ev) => {
      if (ev.dataTransfer && ev.dataTransfer.types.includes("text/presc-plantilla-id")) ev.preventDefault();
    });

    capTextarea.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const id = ev.dataTransfer?.getData("text/presc-plantilla-id");
      if (!id) return;

      const plantillasList = appState.prescripcion.plantillas || [];
      const tpl = plantillasList.find((p) => p.id === id);
      if (!tpl) return;

      const cap = getSelectedCapitulo();
      if (!cap) return;

      cap.texto = tpl.texto || "";
      capTextarea.value = cap.texto;
    });
  }
}

// ========================================================
// Render REFERENCIAS EXTRA (con buscador)
// FIX: debounce + preservar cursor (mismo bug 1 carácter)
// ========================================================

async function renderPrescExtraRefsList() {
  const container = document.getElementById("prescExtraRefsList");
  if (!container) return;

  await ensureExtraRefsLoaded();
  const refs = appState.prescripcion.extraRefs || [];
  const searchTerm = (appState.prescripcion.extraRefsSearchTerm || "").toLowerCase();

  const filtered = refs.filter((r) => {
    if (!searchTerm) return true;
    const base = (r.codigo || "") + " " + (r.descripcion || "");
    return base.toLowerCase().includes(searchTerm);
  });

  if (!refs.length) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
        <input id="prescExtraRefsSearch"
               type="text"
               class="form-control form-control-sm"
               placeholder="Buscar referencia..."
               value="${appState.prescripcion.extraRefsSearchTerm || ""}"
               style="font-size:0.75rem; max-width:60%;">
        <button id="prescNewExtraRefBtn" class="btn btn-xs btn-secondary" title="Nueva referencia extra">➕</button>
      </div>
      <p class="text-muted" style="font-size:0.8rem;">
        Aún no tienes referencias extra. Crea materiales, mano de obra, etc.
      </p>
    `;
  } else {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
        <input id="prescExtraRefsSearch"
               type="text"
               class="form-control form-control-sm"
               placeholder="Buscar referencia..."
               value="${appState.prescripcion.extraRefsSearchTerm || ""}"
               style="font-size:0.75rem; max-width:60%;">
        <button id="prescNewExtraRefBtn" class="btn btn-xs btn-secondary" title="Nueva referencia extra">➕</button>
      </div>
      <div>
        ${
          (filtered.length
            ? filtered
                .map((r) => {
                  const cod = r.codigo || "";
                  const desc = r.descripcion || "";
                  const unidad = r.unidad || "Ud";
                  const pvp = typeof r.pvp === "number" ? r.pvp.toFixed(2) : "0.00";

                  return `
                    <div class="presc-extra-item" data-presc-extra-id="${r.id}">
                      <div class="presc-extra-main">
                        <div class="presc-extra-line1">
                          <span class="presc-extra-code">${cod}</span>
                          <span class="presc-extra-price">${pvp} € / ${unidad}</span>
                        </div>
                        <div class="presc-extra-desc">
                          ${desc || "<i>(sin descripción)</i>"}
                        </div>
                      </div>
                      <div class="presc-extra-actions">
                        <button class="btn btn-xs" data-presc-extra-add="${r.id}">➕ Añadir al capítulo</button>
                        <button class="btn btn-xs btn-outline" data-presc-extra-dup="${r.id}">⧉</button>
                        <button class="btn btn-xs btn-outline" data-presc-extra-edit="${r.id}">✏️</button>
                        <button class="btn btn-xs" data-presc-extra-del="${r.id}">🗑️</button>
                      </div>
                    </div>
                  `;
                })
                .join("")
            : `
              <p class="text-muted" style="font-size:0.8rem;">
                No hay referencias que coincidan con la búsqueda.
              </p>
            `)
        }
      </div>
    `;
  }

  const searchInput = container.querySelector("#prescExtraRefsSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value || "";
      const pos = typeof e.target.selectionStart === "number" ? e.target.selectionStart : val.length;

      appState.prescripcion.extraRefsSearchTerm = val;

      if (appState.prescripcion._extraSearchDebounce) clearTimeout(appState.prescripcion._extraSearchDebounce);

      appState.prescripcion._extraSearchDebounce = setTimeout(() => {
        Promise.resolve(renderPrescExtraRefsList()).then(() => {
          requestAnimationFrame(() => {
            const again = document.getElementById("prescExtraRefsSearch");
            if (!again) return;
            again.focus();
            try { again.setSelectionRange(pos, pos); } catch (_) {}
          });
        });
      }, 60);
    });
  }

  const btnNew = container.querySelector("#prescNewExtraRefBtn");
  if (btnNew) {
    btnNew.addEventListener("click", () => {
      openPrescModal({
        title: "Nueva referencia extra",
        bodyHTML: `
          <div class="form-group">
            <label>Código</label>
            <input id="extCodigo" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <textarea id="extDesc" rows="3" class="form-control"></textarea>
          </div>
          <div class="form-group">
            <label>Unidad de medida</label>
            <select id="extUnidad" class="form-control">
              <option value="Ud">Ud (unidad)</option>
              <option value="m">m (metro)</option>
              <option value="m²">m² (metro cuadrado)</option>
              <option value="h">h (hora)</option>
              <option value="m³">m³ (metro cúbico)</option>
              <option value="kg">kg</option>
            </select>
          </div>
          <div class="form-group">
            <label>PVP</label>
            <input id="extPvp" type="number" class="form-control" value="0" />
          </div>
        `,
        onSave: async () => {
          const codigo = (document.getElementById("extCodigo").value || "").trim();
          const descripcion = (document.getElementById("extDesc").value || "").trim();
          const unidad = (document.getElementById("extUnidad").value || "Ud").trim() || "Ud";
          const pvp = Number(document.getElementById("extPvp").value || 0);
          await createExtraRef(codigo, descripcion, unidad, pvp);
          renderDocPrescripcionView();
        },
      });
    });
  }

  container.querySelectorAll("[data-presc-extra-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-presc-extra-add");
      addExtraRefToCurrentCap(id);
      renderDocPrescripcionView();
    });
  });

  container.querySelectorAll("[data-presc-extra-dup]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-presc-extra-dup");
      await duplicateExtraRef(id);
      renderDocPrescripcionView();
    });
  });

  container.querySelectorAll("[data-presc-extra-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-presc-extra-edit");
      const list = appState.prescripcion.extraRefs || [];
      const r = list.find((x) => x.id === id);
      if (!r) return;

      openPrescModal({
        title: "Editar referencia extra",
        bodyHTML: `
          <div class="form-group">
            <label>Código</label>
            <input id="extCodigo" type="text" class="form-control"
                   value="${(r.codigo || "").replace(/"/g, "&quot;")}" />
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <textarea id="extDesc" rows="3" class="form-control">${r.descripcion || ""}</textarea>
          </div>
          <div class="form-group">
            <label>Unidad de medida</label>
            <select id="extUnidad" class="form-control">
              <option value="Ud" ${r.unidad === "Ud" ? "selected" : ""}>Ud (unidad)</option>
              <option value="m" ${r.unidad === "m" ? "selected" : ""}>m (metro)</option>
              <option value="m²" ${r.unidad === "m²" ? "selected" : ""}>m² (metro cuadrado)</option>
              <option value="h" ${r.unidad === "h" ? "selected" : ""}>h (hora)</option>
              <option value="m³" ${r.unidad === "m³" ? "selected" : ""}>m³ (metro cúbico)</option>
              <option value="kg" ${r.unidad === "kg" ? "selected" : ""}>kg</option>
            </select>
          </div>
          <div class="form-group">
            <label>PVP</label>
            <input id="extPvp" type="number" class="form-control" value="${r.pvp || 0}" />
          </div>
        `,
        onSave: async () => {
          const codigo = (document.getElementById("extCodigo").value || "").trim();
          const descripcion = (document.getElementById("extDesc").value || "").trim();
          const unidad = (document.getElementById("extUnidad").value || "Ud").trim() || "Ud";
          const pvp = Number(document.getElementById("extPvp").value || 0);
          await updateExtraRef(id, codigo, descripcion, unidad, pvp);
          renderDocPrescripcionView();
        },
      });
    });
  });

  container.querySelectorAll("[data-presc-extra-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-presc-extra-del");
      await deleteExtraRef(id);
      renderDocPrescripcionView();
    });
  });
}

// Estilos plantillas y refs extra
(function injectPrescTemplatesAndExtraStyles() {
  if (document.getElementById("presc-templates-extra-styles")) return;
  const style = document.createElement("style");
  style.id = "presc-templates-extra-styles";
  style.innerHTML = `
    .presc-plantilla-item {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.5rem;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      font-size: 0.78rem;
      cursor: grab;
      transition: box-shadow 0.15s ease, transform 0.15s ease;
    }
    .presc-plantilla-item:hover {
      box-shadow: 0 2px 4px rgba(0,0,0,0.08);
      transform: translateY(-1px);
    }
    .presc-plantilla-header {
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:0.25rem;
    }
    .presc-plantilla-name { font-weight:600; color:#111827; }
    .presc-plantilla-actions button { font-size:0.7rem; }
    .presc-plantilla-preview { color:#6b7280; margin-bottom:0.35rem; }
    .presc-plantilla-footer { text-align:right; }

    .presc-extra-item {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.5rem;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
      font-size:0.78rem;
    }
    .presc-extra-main { margin-bottom:0.35rem; }
    .presc-extra-line1 {
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:0.1rem;
    }
    .presc-extra-code { font-weight:600; color:#111827; }
    .presc-extra-price { color:#111827; font-weight:500; }
    .presc-extra-desc { color:#6b7280; font-size:0.76rem; }
    .presc-extra-actions {
      display:flex; flex-wrap:wrap; gap:0.25rem; justify-content:flex-end;
    }
  `;
  document.head.appendChild(style);
})();

// ========================================================
// BLOQUE 8/9 - Preview + Export (se mantienen como en tu código original)
// ========================================================

// ⚠️ NOTA: aquí no reescribo tu preview/export BC3/PDF/CSV para no tocar más de lo necesario.
// Si quieres que te lo deje TODO dentro del mismo fichero (incluyendo tu BLOQUE 8/9 completo),
// dímelo y lo encajo en partes 11+ sin cambiar lógica.

// Exponer helpers al window si tu router los llama
window.renderDocPrescripcionView = renderDocPrescripcionView;
window.setPrescLanguageAll = setPrescLanguageAll;
// ========================================================
// BLOQUE 8 - Preview (capítulos + totales + desplegable)
// ========================================================

appState.prescripcion.previewExpanded = appState.prescripcion.previewExpanded || {};

function formatEur(n) {
  const v = Number(n) || 0;
  try {
    return v.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
  } catch {
    return v.toFixed(2) + " €";
  }
}

function computeCapituloTotals(cap) {
  const lineas = cap?.lineas || [];
  const total = lineas.reduce((acc, l) => {
    const cant = Number(l.cantidad) || 0;
    const pvp = Number(l.pvp) || 0;
    return acc + cant * pvp;
  }, 0);

  return { total, numLineas: lineas.length };
}

function computePrescTotals() {
  const caps = appState.prescripcion.capitulos || [];
  let total = 0;
  let totalLineas = 0;

  caps.forEach((c) => {
    const t = computeCapituloTotals(c);
    total += t.total;
    totalLineas += t.numLineas;
  });

  return { total, totalLineas, totalCaps: caps.length };
}

function renderPrescPreview() {
  const container = document.getElementById("prescPreview");
  if (!container) return;

  const caps = appState.prescripcion.capitulos || [];
  if (!caps.length) {
    container.innerHTML = `
      <div class="text-muted" style="font-size:0.85rem;">
        Aún no hay capítulos. Arrastra una sección del presupuesto para generar el primero.
      </div>
    `;
    return;
  }

  const totals = computePrescTotals();

  const expanded = appState.prescripcion.previewExpanded || {};
  const selectedId = appState.prescripcion.selectedCapituloId;

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap;">
        <div style="display:flex; flex-direction:column;">
          <div style="font-weight:700; color:#111827;">Total prescripción: ${formatEur(totals.total)}</div>
          <div style="font-size:0.78rem; color:#6b7280;">
            ${totals.totalCaps} capítulos • ${totals.totalLineas} líneas
          </div>
        </div>
        <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
          <button class="btn btn-xs btn-outline" id="prescCollapseAllBtn">Contraer</button>
          <button class="btn btn-xs btn-outline" id="prescExpandAllBtn">Expandir</button>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        ${caps
          .map((c) => {
            const t = computeCapituloTotals(c);
            const isOpen = !!expanded[c.id];
            const isSel = c.id === selectedId;

            return `
              <div class="presc-prev-cap" data-cap-id="${c.id}"
                   style="border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; background:#fff;">
                <div class="presc-prev-cap-h"
                     style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem;
                            padding:0.65rem 0.75rem; cursor:pointer; ${isSel ? "background:#f3f4f6;" : ""}">
                  <div style="display:flex; flex-direction:column; min-width:0;">
                    <div style="font-weight:700; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      ${c.nombre || "(sin título)"}
                    </div>
                    <div style="font-size:0.75rem; color:#6b7280;">
                      ${t.numLineas} líneas • ${formatEur(t.total)}
                    </div>
                  </div>

                  <div style="display:flex; gap:0.35rem; align-items:center;">
                    <button class="btn btn-xs btn-outline presc-prev-select" data-cap-select="${c.id}">Seleccionar</button>
                    <button class="btn btn-xs presc-prev-del" data-cap-del="${c.id}">🗑️</button>
                    <span style="font-size:0.9rem; padding-left:0.25rem;">${isOpen ? "▾" : "▸"}</span>
                  </div>
                </div>

                ${
                  isOpen
                    ? `
                      <div class="presc-prev-cap-b" style="padding:0.65rem 0.75rem; border-top:1px solid #e5e7eb;">
                        ${
                          (c.texto || "").trim()
                            ? `<div style="margin-bottom:0.5rem; font-size:0.8rem; color:#111827; white-space:pre-wrap;">${escapeHtmlSafe(
                                c.texto
                              )}</div>`
                            : `<div class="text-muted" style="margin-bottom:0.5rem; font-size:0.78rem;">(sin texto)</div>`
                        }

                        ${
                          (c.lineas || []).length
                            ? `
                              <div style="overflow:auto;">
                                <table class="table table-compact" style="width:100%; font-size:0.78rem; border-collapse:collapse;">
                                  <thead>
                                    <tr>
                                      <th style="text-align:left;">Código</th>
                                      <th style="text-align:left;">Descripción</th>
                                      <th style="text-align:center;">Ud</th>
                                      <th style="text-align:right;">Cant.</th>
                                      <th style="text-align:right;">PVP</th>
                                      <th style="text-align:right;">Importe</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    ${(c.lineas || [])
                                      .map((l) => {
                                        const cant = Number(l.cantidad) || 0;
                                        const pvp = Number(l.pvp) || 0;
                                        const imp = cant * pvp;
                                        return `
                                          <tr>
                                            <td>${escapeHtmlSafe(l.codigo || "")}</td>
                                            <td>${escapeHtmlSafe(l.descripcion || "")}</td>
                                            <td style="text-align:center;">${escapeHtmlSafe(l.unidad || "Ud")}</td>
                                            <td style="text-align:right;">${cant}</td>
                                            <td style="text-align:right;">${formatEur(pvp)}</td>
                                            <td style="text-align:right;">${formatEur(imp)}</td>
                                          </tr>
                                        `;
                                      })
                                      .join("")}
                                  </tbody>
                                </table>
                              </div>
                            `
                            : `<div class="text-muted" style="font-size:0.78rem;">(sin referencias)</div>`
                        }
                      </div>
                    `
                    : ""
                }
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

  // handlers
  container.querySelector("#prescCollapseAllBtn")?.addEventListener("click", () => {
    appState.prescripcion.previewExpanded = {};
    renderPrescPreview();
  });

  container.querySelector("#prescExpandAllBtn")?.addEventListener("click", () => {
    const next = {};
    (appState.prescripcion.capitulos || []).forEach((c) => (next[c.id] = true));
    appState.prescripcion.previewExpanded = next;
    renderPrescPreview();
  });

  container.querySelectorAll(".presc-prev-cap-h").forEach((h) => {
    h.addEventListener("click", (ev) => {
      // evita toggle si clicaste en botones
      const t = ev.target;
      if (t && t.closest && t.closest("button")) return;

      const wrap = h.closest(".presc-prev-cap");
      const id = wrap?.getAttribute("data-cap-id");
      if (!id) return;

      appState.prescripcion.previewExpanded[id] = !appState.prescripcion.previewExpanded[id];
      renderPrescPreview();
    });
  });

  container.querySelectorAll("[data-cap-select]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = btn.getAttribute("data-cap-select");
      setSelectedCapitulo(id);
      renderDocPrescripcionView();
    });
  });

  container.querySelectorAll("[data-cap-del]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = btn.getAttribute("data-cap-del");
      deleteCapituloById(id);
      renderDocPrescripcionView();
    });
  });
}

// safe html escape
function escapeHtmlSafe(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
// ========================================================
// BLOQUE 9 - Export (Excel/CSV, PDF, BC3)
// ========================================================

function buildPrescFlatLines() {
  const caps = appState.prescripcion.capitulos || [];
  const rows = [];

  caps.forEach((cap, capIdx) => {
    const capName = cap.nombre || `Capítulo ${capIdx + 1}`;
    const capText = cap.texto || "";

    (cap.lineas || []).forEach((l) => {
      rows.push({
        capitulo: capName,
        textoCapitulo: capText,
        codigo: l.codigo || "",
        descripcion: l.descripcion || "",
        unidad: l.unidad || "Ud",
        cantidad: Number(l.cantidad) || 0,
        pvp: Number(l.pvp) || 0,
        importe: (Number(l.cantidad) || 0) * (Number(l.pvp) || 0),
        tipo: l.tipo || "budget",
      });
    });

    if (!(cap.lineas || []).length) {
      rows.push({
        capitulo: capName,
        textoCapitulo: capText,
        codigo: "",
        descripcion: "",
        unidad: "",
        cantidad: 0,
        pvp: 0,
        importe: 0,
        tipo: "empty",
      });
    }
  });

  return rows;
}

function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function toCsv(rows) {
  const headers = [
    "capitulo",
    "textoCapitulo",
    "codigo",
    "descripcion",
    "unidad",
    "cantidad",
    "pvp",
    "importe",
    "tipo",
  ];

  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [];
  lines.push(headers.join(";"));
  rows.forEach((r) => {
    lines.push(
      headers
        .map((h) => {
          const val = r[h];
          // números con coma para ES, separador ; para Excel
          if (["cantidad", "pvp", "importe"].includes(h)) {
            const n = Number(val) || 0;
            return esc(n.toString().replace(".", ","));
          }
          return esc(val);
        })
        .join(";")
    );
  });

  return lines.join("\n");
}

function buildPrescPreviewHtmlForPdf() {
  const totals = computePrescTotals();
  const caps = appState.prescripcion.capitulos || [];

  const capHtml = caps
    .map((c) => {
      const t = computeCapituloTotals(c);
      const text = (c.texto || "").trim();

      const linesHtml = (c.lineas || [])
        .map((l) => {
          const cant = Number(l.cantidad) || 0;
          const pvp = Number(l.pvp) || 0;
          const imp = cant * pvp;
          return `
            <tr>
              <td>${escapeHtmlSafe(l.codigo || "")}</td>
              <td>${escapeHtmlSafe(l.descripcion || "")}</td>
              <td style="text-align:center;">${escapeHtmlSafe(l.unidad || "Ud")}</td>
              <td style="text-align:right;">${cant}</td>
              <td style="text-align:right;">${pvp.toFixed(2)} €</td>
              <td style="text-align:right;">${imp.toFixed(2)} €</td>
            </tr>
          `;
        })
        .join("");

      return `
        <div style="page-break-inside:avoid; margin-bottom:18px;">
          <h2 style="margin:0 0 6px 0; font-size:16px;">${escapeHtmlSafe(c.nombre || "(sin título)")}</h2>
          <div style="color:#444; font-size:12px; margin-bottom:6px;">
            ${t.numLineas} líneas • Total capítulo: ${t.total.toFixed(2)} €
          </div>
          ${
            text
              ? `<div style="white-space:pre-wrap; font-size:12px; margin:8px 0 10px 0;">${escapeHtmlSafe(
                  text
                )}</div>`
              : ""
          }
          <table style="width:100%; border-collapse:collapse; font-size:11px;">
            <thead>
              <tr>
                <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px;">Código</th>
                <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px;">Descripción</th>
                <th style="text-align:center; border-bottom:1px solid #ddd; padding:6px;">Ud</th>
                <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px;">Cant.</th>
                <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px;">PVP</th>
                <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px;">Importe</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml || ""}
            </tbody>
          </table>
        </div>
      `;
    })
    .join("");

  return `
    <div style="font-family:Arial, sans-serif; padding:18px;">
      <h1 style="margin:0 0 4px 0; font-size:18px;">Prescripción técnica</h1>
      <div style="color:#444; font-size:12px; margin-bottom:12px;">
        Total prescripción: <strong>${totals.total.toFixed(2)} €</strong>
        • ${totals.totalCaps} capítulos • ${totals.totalLineas} líneas
      </div>
      ${capHtml}
    </div>
  `;
}

function buildBC3Basic() {
  // BC3 mínimo (muy básico) para no romper si no tienes tu generador.
  // Si ya tienes uno, se usará antes (handlePrescExport).
  const rows = buildPrescFlatLines();

  const lines = [];
  lines.push("~V|Prescripcion2N|1.0|");
  lines.push("~K|0|"); // cabecera básica

  let idx = 1;
  rows.forEach((r) => {
    // ~C: Concepto | Código | Resumen | Unidad | Precio
    const code = (r.codigo || `PRESC_${idx}`).replace(/\|/g, " ");
    const desc = (r.descripcion || r.capitulo || "").replace(/\|/g, " ");
    const unit = (r.unidad || "Ud").replace(/\|/g, " ");
    const price = (Number(r.pvp) || 0).toFixed(2);
    lines.push(`~C|${code}|${desc}|${unit}|${price}|`);
    idx++;
  });

  return lines.join("\n");
}

async function handlePrescExport(type) {
  const t = String(type || "").toLowerCase();

  // Preferir funciones existentes del proyecto (mínima intrusión)
  try {
    if (t === "excel") {
      if (typeof window.exportPrescToExcel === "function") {
        return await window.exportPrescToExcel(appState.prescripcion);
      }
      const csv = toCsv(buildPrescFlatLines());
      return downloadTextFile("prescripcion.csv", csv, "text/csv;charset=utf-8");
    }

    if (t === "pdf") {
      const html = buildPrescPreviewHtmlForPdf();

      if (typeof window.exportDocToPdf === "function") {
        // tu pipeline
        return await window.exportDocToPdf({ html, filename: "prescripcion.pdf" });
      }

      if (typeof window.generatePdfFromHtml === "function") {
        return await window.generatePdfFromHtml(html, "prescripcion.pdf");
      }

      // fallback: abrir ventana e imprimir/guardar PDF
      const w = window.open("", "_blank");
      if (!w) {
        alert("No se pudo abrir ventana para exportar PDF (bloqueador de popups).");
        return;
      }
      w.document.open();
      w.document.write(`
        <html><head><title>prescripcion</title></head>
        <body>${html}</body></html>
      `);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 350);
      return;
    }

    if (t === "bc3") {
      if (typeof window.exportPrescToBC3 === "function") {
        return await window.exportPrescToBC3(appState.prescripcion);
      }
      if (typeof window.generateBC3 === "function") {
        const out = await window.generateBC3(appState.prescripcion);
        return downloadTextFile("prescripcion.bc3", out, "text/plain;charset=utf-8");
      }

      const bc3 = buildBC3Basic();
      return downloadTextFile("prescripcion.bc3", bc3, "text/plain;charset=utf-8");
    }
  } catch (e) {
    console.error("[PRESC] Export error:", e);
    alert("Error exportando. Mira consola para detalle.");
  }
}
// ========================================================
// BLOQUE 10 - Boot / Exports
// ========================================================

// Render inicial “suave” (evita que se quede solo en local por UID no listo)
async function initPrescripcionView() {
  try {
    await ensurePrescUidReady();
    await ensurePrescPlantillasLoaded();
    await ensureExtraRefsLoaded();
    ensurePrescSectionsFromBudget();
  } catch (e) {
    console.warn("[PRESC] initPrescripcionView:", e);
  }

  try {
    capturePrescBaseIfNeeded();
  } catch (_) {}

  renderDocPrescripcionView();
}

// Exponer cosas que tu router / menú puede usar
window.initPrescripcionView = initPrescripcionView;
window.renderPrescPreview = renderPrescPreview;
window.handlePrescExport = handlePrescExport;

// Si tu app llama directamente a renderDocPrescripcionView desde el router,
// no auto-ejecutamos init. Pero si quieres auto-cargar al entrar, puedes llamar:
// initPrescripcionView();
// ========================================================
// EXPORTS a window (necesario para que el select dispare traducción real)
// ========================================================

window.setPrescLanguageAll = setPrescLanguageAll;
window.translatePrescAllContentTo = translatePrescAllContentTo;
window.prescTranslateWithGemini = prescTranslateWithGemini;

