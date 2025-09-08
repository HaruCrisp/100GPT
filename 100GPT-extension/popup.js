const out = document.getElementById('out');

async function run(mode) {
  out.textContent = 'Capturing...';
  chrome.runtime.sendMessage({ type: 'CAPTURE_AND_OCR', mode }, (resp) => {
    if (chrome.runtime.lastError) {
      out.textContent = 'Error: ' + chrome.runtime.lastError.message;
      return;
    }
    if (!resp) { out.textContent = 'No response'; return; }
    if (resp.error) { out.textContent = 'Error: ' + resp.error; return; }
    const { text, ai, fallback, note } = resp;
    let msg = '';
    if (note) msg += `Note: ${note}\n\n`;
    msg += `Extracted text:\n${text || '(none)'}\n\n`;
    if (ai) msg += `AI (${fallback ? 'fallback' : mode}):\n${ai}`;
    out.textContent = msg;
  });
}

document.getElementById('btn-para').onclick = () => run('paraphrase');
document.getElementById('btn-human').onclick = () => run('humanize');
