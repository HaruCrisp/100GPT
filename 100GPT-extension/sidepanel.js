// sidepanel.js
const inputEl = document.getElementById("inputText");
const runBtn = document.getElementById("runBtn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("resultText");
const errorEl = document.getElementById("error");
const serverUrlEl = document.getElementById("serverUrl");
const saveServerBtn = document.getElementById("saveServer");

// Default server URL
const DEFAULT_SERVER = "http://127.0.0.1:8000";

// Load settings + last selection
(async () => {
  const { _100gpt_server } = await chrome.storage.local.get("_100gpt_server");
  serverUrlEl.value = _100gpt_server || DEFAULT_SERVER;

  // Pick up last highlighted selection if present
  const { _100gpt_last_selection } = await chrome.storage.session.get("_100gpt_last_selection");
  if (_100gpt_last_selection && !_100gpt_last_selection.trim().length === 0) {
    inputEl.value = _100gpt_last_selection;
    // Clear it so it doesn't overwrite next time
    chrome.storage.session.remove("_100gpt_last_selection");
  } else if (_100gpt_last_selection) {
    inputEl.value = _100gpt_last_selection;
    chrome.storage.session.remove("_100gpt_last_selection");
  }
})();

saveServerBtn.addEventListener("click", async () => {
  const url = serverUrlEl.value.trim() || DEFAULT_SERVER;
  await chrome.storage.local.set({ _100gpt_server: url });
  flashStatus("Saved server URL");
});

runBtn.addEventListener("click", async () => {
  clearMsg();
  const text = (inputEl.value || "").trim();
  if (!text) {
    showError("Please enter some text.");
    return;
  }

  const mode = getMode();
  const server = (serverUrlEl.value || DEFAULT_SERVER).replace(/\/+$/, "");

  const endpoint = mode === "humanize" ? "/humanize" : "/paraphrase";
  const url = server + endpoint;

  try {
    setLoading(true);
    const body = JSON.stringify({ text });
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    if (!resp.ok) {
      const err = await safeJson(resp);
      throw new Error(err?.detail || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    const out = data.paraphrased || data.humanized || data.ai || "(no output)";
    resultEl.textContent = out;
    flashStatus("Done");
  } catch (e) {
    showError(e.message || String(e));
  } finally {
    setLoading(false);
  }
});

function getMode() {
  const els = document.querySelectorAll("input[name='mode']");
  for (const el of els) if (el.checked) return el.value;
  return "paraphrase";
}

function setLoading(on) {
  runBtn.disabled = on;
  statusEl.textContent = on ? "Working…" : "";
}

function showError(msg) {
  errorEl.textContent = msg;
}

function clearMsg() {
  errorEl.textContent = "";
  statusEl.textContent = "";
}

function flashStatus(msg) {
  statusEl.textContent = msg;
  setTimeout(() => (statusEl.textContent = ""), 1200);
}

async function safeJson(resp) {
  try { return await resp.json(); } catch { return null; }
}
