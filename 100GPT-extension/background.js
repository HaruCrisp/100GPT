// background.js
const SERVER = "http://127.0.0.1:8001"; // your FastAPI server

// -------- context menus --------
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "100gpt-paraphrase-text",
      title: "Paraphrase with 100GPT",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "100gpt-humanize-text",
      title: "Humanize with 100GPT",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "100gpt-paraphrase-screenshot",
      title: "Paraphrase from Screenshot (100GPT)",
      contexts: ["page", "frame"]
    });
    chrome.contextMenus.create({
      id: "100gpt-humanize-screenshot",
      title: "Humanize from Screenshot (100GPT)",
      contexts: ["page", "frame"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === "100gpt-paraphrase-text" && info.selectionText) {
      const res = await fetch(`${SERVER}/paraphrase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: info.selectionText })
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`);

      const msg = `Paraphrase:\n\n${json.paraphrased || "(no result)"}`;
      broadcastToPopup(msg);
      await ensurePopupVisible(tab);
      return;
    }

    if (info.menuItemId === "100gpt-humanize-text" && info.selectionText) {
      const res = await fetch(`${SERVER}/humanize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: info.selectionText })
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`);

      const msg = `Humanized:\n\n${json.humanized || "(no result)"}`;
      broadcastToPopup(msg);
      await ensurePopupVisible(tab);
      return;
    }

    if (info.menuItemId === "100gpt-paraphrase-screenshot") {
      const out = await captureAndPipeline(tab, "paraphrase");
      showOCRPipeline(out, "paraphrase");
      return;
    }

    if (info.menuItemId === "100gpt-humanize-screenshot") {
      const out = await captureAndPipeline(tab, "humanize");
      showOCRPipeline(out, "humanize");
      return;
    }
  } catch (e) {
    const err = "Error: " + String(e?.message || e);
    broadcastToPopup(err);
    try { await ensurePopupVisible(tab); } catch {}
  }
});

// -------- popup.js hook --------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CAPTURE_AND_OCR") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const out = await captureAndPipeline(tab, msg.mode || "paraphrase");
        sendResponse(out);
      } catch (e) {
        sendResponse({ error: String(e?.message || e) });
      }
    })();
    return true; // keep port open
  }
});

// -------- helper: capture + crop (MV3-safe) + send to backend --------
async function captureAndPipeline(tab, mode) {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["selector.js"]
  });

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const rect = (window.__100GPT_getSelectionRect && window.__100GPT_getSelectionRect()) || null;
      const dpr = window.devicePixelRatio || 1;
      return { rect, dpr };
    }
  });

  const rect = result?.rect;
  const dpr = result?.dpr || 1;
  if (!rect) return { error: "Selection cancelled" };

  const dataUrl = await chrome.tabs
    .captureVisibleTab(tab.windowId, { format: "png" })
    .catch(() => { throw new Error("Capture failed (page not capturable or no permission)."); });

  const croppedDataUrl = await cropDataUrlWorker(dataUrl, rect, dpr);

  const form = new FormData();
  form.append("mode", mode);
  const blob = await dataURLtoBlobAsync(croppedDataUrl);
  form.append("file", blob, "screenshot.png");

  const res = await fetch(`${SERVER}/ocr_pipeline`, { method: "POST", body: form });
  const json = await safeJson(res);
  if (!res.ok) return { error: json?.detail || `HTTP ${res.status}` };
  return json;
}

function showOCRPipeline(resp, mode) {
  if (resp?.error) return showResult("Error: " + resp.error);
  const { text, ai, fallback, note } = resp || {};
  let msg = "";
  if (note) msg += `Note: ${note}\n\n`;
  msg += `Extracted text:\n${text || "(none)"}\n\n`;
  if (ai) msg += `AI (${fallback ? "fallback" : mode}):\n${ai}`;
  showResult(msg || "(no output)");
}

function showResult(message) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "100GPT",
      message: (message || "").slice(0, 10000)
    });
  } catch {
    console.log("[100GPT]", message);
  }
}

function broadcastToPopup(message) {
  chrome.storage.local.set({ _100gpt_last: { ts: Date.now(), message } });
  chrome.runtime.sendMessage({ type: 'SHOW_IN_POPUP', message }).catch(() => {});
}

async function ensurePopupVisible(tab) {
  try {
    await chrome.action.openPopup();
  } catch {
    // fallback could go here
  }
}

// ------ image utils (MV3-safe) ------
async function cropDataUrlWorker(dataUrl, rect, dpr) {
  const resp = await fetch(dataUrl);
  const srcBlob = await resp.blob();
  const bmp = await createImageBitmap(srcBlob);

  const scale = dpr || 1;
  const sx = Math.max(0, Math.round(rect.x * scale));
  const sy = Math.max(0, Math.round(rect.y * scale));
  const sw = Math.max(1, Math.round(rect.w * scale));
  const sh = Math.max(1, Math.round(rect.h * scale));

  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
  const outBlob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataURL(outBlob);
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

async function dataURLtoBlobAsync(dataURL) {
  const res = await fetch(dataURL);
  return await res.blob();
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
