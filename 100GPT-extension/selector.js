// selector.js
(() => {
  // remove old overlay if still present
  if (window.__100GPT_overlay) {
    try { window.__100GPT_overlay.remove(); } catch {}
    delete window.__100GPT_overlay;
    delete window.__100GPT_getSelectionRect;
  }

  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    cursor: "crosshair",
    background: "rgba(0,0,0,0.05)"
  });
  document.body.appendChild(overlay);
  window.__100GPT_overlay = overlay;

  let startX, startY, rectBox;

  function onMouseDown(e) {
    startX = e.clientX;
    startY = e.clientY;

    rectBox = document.createElement("div");
    Object.assign(rectBox.style, {
      position: "fixed",
      border: "2px dashed #0f62fe",
      background: "rgba(15,98,254,0.15)",
      left: startX + "px",
      top: startY + "px",
      zIndex: "2147483647",
      pointerEvents: "none"
    });
    document.body.appendChild(rectBox);

    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e) {
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    Object.assign(rectBox.style, {
      left: x + "px",
      top: y + "px",
      width: w + "px",
      height: h + "px"
    });
  }

  function onMouseUp(e) {
    overlay.removeEventListener("mousemove", onMouseMove);
    overlay.removeEventListener("mouseup", onMouseUp);

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    // expose getter that background.js will call
    window.__100GPT_getSelectionRect = () => ({ x, y, w, h });

    // small delay so the getter can be called, then cleanup
    setTimeout(() => {
      try { overlay.remove(); } catch {}
      try { rectBox.remove(); } catch {}
      delete window.__100GPT_overlay;
      // NOT deleting __100GPT_getSelectionRect immediately; background will read it
      setTimeout(() => { delete window.__100GPT_getSelectionRect; }, 2000);
    }, 100);
  }

  overlay.addEventListener("mousedown", onMouseDown);
})();

(() => {
  if (window.__100GPT_active) return; // prevent double inject
  window.__100GPT_active = true;

  let startX, startY, box;
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.zIndex = "2147483647";
  overlay.style.cursor = "crosshair";
  overlay.style.background = "rgba(0,0,0,0.05)";
  document.body.appendChild(overlay);

  function cleanup() {
    overlay.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    window.__100GPT_active = false;
  }

  function onMouseDown(e) {
    startX = e.clientX;
    startY = e.clientY;
    if (!box) {
      box = document.createElement("div");
      box.style.position = "fixed";
      box.style.border = "2px solid #00f";
      box.style.background = "rgba(0, 0, 255, 0.2)";
      overlay.appendChild(box);
    }
    box.style.left = startX + "px";
    box.style.top = startY + "px";
    box.style.width = "0px";
    box.style.height = "0px";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e) {
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    box.style.left = x + "px";
    box.style.top = y + "px";
    box.style.width = w + "px";
    box.style.height = h + "px";
  }

  function onMouseUp(e) {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    window.__100GPT_getSelectionRect = () => ({ x, y, w, h });

    cleanup(); // remove overlay & listeners
  }

  overlay.addEventListener("mousedown", onMouseDown);
})();
