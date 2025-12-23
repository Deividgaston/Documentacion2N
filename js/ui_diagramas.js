function _coerceTextFromHandlerResponse(res) {
  if (res == null) return "";
  if (typeof res === "string") return res;

  // Algunos handlers devuelven objetos con el texto en campos típicos
  const candidates = [
    res.text,
    res.output_text,
    res.outputText,
    res.content,
    res.result,
    res.data,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }

  // Si viene algo como { ok:true, response:"..." }
  if (typeof res.response === "string") return res.response;

  // Último recurso: stringify
  try {
    return JSON.stringify(res);
  } catch (_) {
    return String(res);
  }
}

function _extractJsonString(s) {
  const t = String(s || "").trim();
  if (!t) return "";

  // 1) Bloque ```json ... ```
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) return fence[1].trim();

  // 2) Primer { ... último }
  const i0 = t.indexOf("{");
  const i1 = t.lastIndexOf("}");
  if (i0 >= 0 && i1 > i0) return t.slice(i0, i1 + 1).trim();

  return "";
}

function _parseJsonRobust(res) {
  if (res == null) return { ok: false, error: "Respuesta vacía", raw: "" };

  // Si ya es objeto y parece JSON esperado
  if (typeof res === "object") {
    // Si ya tiene la forma final, úsalo
    if (("placements" in res) && ("connections" in res) && ("errors" in res)) {
      return { ok: true, obj: res, raw: "" };
    }
  }

  const rawText = _coerceTextFromHandlerResponse(res);
  const jsonText = _extractJsonString(rawText);

  if (!jsonText) {
    return {
      ok: false,
      error: "La IA devolvió texto sin JSON reconocible (no encuentro { ... }).",
      raw: rawText,
    };
  }

  try {
    const obj = JSON.parse(jsonText);
    return { ok: true, obj, raw: rawText };
  } catch (e) {
    return {
      ok: false,
      error: "El JSON extraído no se puede parsear (JSON.parse falla).",
      raw: rawText,
    };
  }
}

async function diagGenerateDesign() {
  appState.diagramas.lastError = null;
  appState.diagramas.lastResult = null;

  // (opcional) guarda el raw de la IA para debug si algo va mal
  appState.diagramas.lastRaw = null;

  _renderResult();

  // Sync prompt UI
  appState.diagramas.useCustomPrompt = !!(_el("diagUseCustomPrompt") && _el("diagUseCustomPrompt").checked);
  appState.diagramas.customPromptText = _el("diagPromptText")
    ? String(_el("diagPromptText").value || "")
    : appState.diagramas.customPromptText;

  let payload;
  try {
    payload = _buildAiPayload();
  } catch (e) {
    appState.diagramas.lastError = e.message || String(e);
    _renderResult();
    return;
  }

  const handler = window.handleDocSectionAI || window.handleAI || window.callGemini || null;
  if (typeof handler !== "function") {
    appState.diagramas.lastError = "No encuentro el handler de IA (ej. window.handleDocSectionAI).";
    _renderResult();
    return;
  }

  _setBusy(true);
  try {
    const env = _buildHandlerEnvelope(payload);

    const res = await handler(env);

    const parsed = _parseJsonRobust(res);
    if (!parsed.ok) {
      appState.diagramas.lastRaw = parsed.raw || null;
      throw new Error(parsed.error || "La IA no devolvió JSON válido.");
    }

    const obj = parsed.obj;

    // Validación mínima estructura
    if (!obj || typeof obj !== "object") throw new Error("Respuesta IA inválida.");
    if (!("placements" in obj) || !("connections" in obj) || !("errors" in obj)) {
      appState.diagramas.lastRaw = parsed.raw || null;
      throw new Error("JSON sin campos requeridos (placements/connections/errors).");
    }

    appState.diagramas.lastResult = obj;
    appState.diagramas.lastError = null;
    _renderResult();
  } catch (e) {
    console.error(e);
    appState.diagramas.lastError = e.message || String(e);
    appState.diagramas.lastResult = null;
    _renderResult();
  } finally {
    _setBusy(false);
  }
}
