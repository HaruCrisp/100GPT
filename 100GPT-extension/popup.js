// popup.js
(() => {
  const out = document.getElementById('out');
  const btnPara = document.getElementById('btn-para');
  const btnHuman = document.getElementById('btn-human');

  function show(msg) {
    out.textContent = msg || '(no output)';
  }

  function setBusy(on, msg = 'Capturing...') {
    btnPara.disabled = on;
    btnHuman.disabled = on;
    out.textContent = on ? msg : '';
  }

  function run(mode) {
    setBusy(true);

    chrome.runtime.sendMessage({ type: 'CAPTURE_AND_OCR', mode }, (resp) => {
      setBusy(false);

      if (chrome.runtime.lastError) {
        show('Error: ' + chrome.runtime.lastError.message);
        return;
      }
      if (!resp) {
        show('No response');
        return;
      }
      if (resp.error) {
        show('Error: ' + resp.error);
        return;
      }

      const { text, ai, fallback, note } = resp;
      let msg = '';
      if (note) msg += `Note: ${note}\n\n`;
      msg += `Extracted text:\n${text || '(none)'}\n\n`;
      if (ai) msg += `AI (${fallback ? 'fallback' : mode}):\n${ai}`;
      show(msg);
    });
  }

  btnPara.addEventListener('click', () => run('paraphrase'));
  btnHuman.addEventListener('click', () => run('humanize'));

  // initial
  show('Ready.');
})();
