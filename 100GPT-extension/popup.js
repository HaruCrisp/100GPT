// popup.js
(() => {
  const out = document.getElementById('out');
  const btnPara = document.getElementById('btn-para');
  const btnHuman = document.getElementById('btn-human');

  function show(msg) { out.textContent = msg || '(no output)'; }
  function setBusy(on, msg = 'Processing...') {
    btnPara && (btnPara.disabled = on);
    btnHuman && (btnHuman.disabled = on);
    if (on) out.textContent = msg;
  }

  // --- read any last result saved by background.js
  async function loadLast() {
    const { _100gpt_last } = await chrome.storage.local.get('_100gpt_last');
    if (_100gpt_last?.message) show(_100gpt_last.message);
  }

  // --- live updates from background.js (when popup is open)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SHOW_IN_POPUP') show(msg.message);
  });

  // --- also react to storage changes (if message came while popup closed)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes._100gpt_last?.newValue?.message) {
      show(changes._100gpt_last.newValue.message);
    }
  });

  // --- Screenshot buttons (CAPTURE_AND_OCR flow)
  async function run(mode) {
    setBusy(true);
    chrome.runtime.sendMessage({ type: 'CAPTURE_AND_OCR', mode }, (resp) => {
      setBusy(false);
      if (chrome.runtime.lastError) return show('Error: ' + chrome.runtime.lastError.message);
      if (!resp) return show('No response');
      if (resp.error) return show('Error: ' + resp.error);

      const { text, ai, fallback, note } = resp;
      let msg = '';
      if (note) msg += `Note: ${note}\n\n`;
      msg += `Extracted text:\n${text || '(none)'}\n\n`;
      if (ai) msg += `AI (${fallback ? 'fallback' : mode}):\n${ai}`;
      show(msg);
      // persist too
      chrome.storage.local.set({ _100gpt_last: { ts: Date.now(), message: msg } });
    });
  }

  btnPara?.addEventListener('click', () => run('paraphrase'));
  btnHuman?.addEventListener('click', () => run('humanize'));

  // initial load
  loadLast().then(() => { if (!out.textContent) show('Ready.'); });
})();

