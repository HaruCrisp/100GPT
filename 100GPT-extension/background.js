const SERVER = "http://127.0.0.1:8000"; // your FastAPI server

// -------- context menus --------
chrome.runtime.onInstalled.addListener(() => {
  // Selected text → paraphrase/humanize
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

  // Screenshot (no selection required)
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

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === "100gpt-paraphrase-text" && info.selectionText) {
      const body = JSON.stringify({ text: info.selectionText });
      const res = await fetch(`${SERVER}/paraphrase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      const json = await res.json();
      showResult(`Paraphrase:\n\n${json.paraphrased || json.error || "(no result)"}`);
    }

    if (info.menuItemId === "100gpt-humanize-text" && info.selectionText) {
      const body = JSON.stringify({ text: info.selectionText });
      const res = await fetch(`${SERVER}/humanize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      const json = await res.json();
      showResult(`Humanized:\n\n${json.humanized || json.error || "(no result)"}`);
    }

    if (info.menuItemId === "100gpt-paraphrase-screenshot") {
      const out = await captureAndPipeline(tab, "paraphrase");
      showOCRPipeline(out, "paraphrase");
    }

    if (info.menuItemId === "100gpt-humanize-screenshot") {
      const out = await captureAndPipeline(tab, "humanize");
      showOCRPipeline(out, "humanize");
    }
  } catch (e) {
    showResult("Error: " + String(e));
  }
});

// -------- popup.js also calls this via runtime message --------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CAPTURE_AND_OCR") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const out = await captureAndPipeline(tab, msg.mode || "paraphrase");
        sendResponse(out);
      } catch (e) {
        sendResponse({ error: String(e) });
      }
    })();
    return true; // keep port open
  }
});

// -------- helper: capture + crop + send to backend --------
async function captureAndPipeline(tab, mode) {
  // inject selector overlay
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["selector.js"]
  });

  // get rect from content page (CSS pixels)
  const [{ result: rect }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.__100GPT_getSelectionRect?.()
  });

  if (!rect) return { error: "Selection cancelled" };

  // capture visible area
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });

  // crop using devicePixelRatio
  const croppedDataUrl = await cropDataUrl(dataUrl, rect);

  // send to backend as multipart
  const form = new FormData();
  form.append("mode", mode);
  const blob = dataURLtoBlob(croppedDataUrl);
  form.append("file", blob, "screenshot.png");

  const res = await fetch(`${SERVER}/ocr_pipeline`, { method: "POST", body: form });
  return await res.json();
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
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: "100GPT",
    message: message.slice(0, 10000)
  });
}

// ------ image utils ------
function dataURLtoBlob(dataURL) {
  const parts = dataURL.split(",");
  const byteString = atob(parts[1]);
  const mime = parts[0].match(/:(.*?);/)[1];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new Blob([ab], { type: mime });
}

function cropDataUrl(dataUrl, rect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = self.devicePixelRatio || 1;
      const sx = Math.max(0, Math.round(rect.x * scale));
      const sy = Math.max(0, Math.round(rect.y * scale));
      const sw = Math.max(1, Math.round(rect.w * scale));
      const sh = Math.max(1, Math.round(rect.h * scale));

      const c = new OffscreenCanvas(sw, sh);
      const g = c.getContext("2d");
      g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      c.convertToBlob({ type: "image/png" }).then(blob => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      }, reject);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
