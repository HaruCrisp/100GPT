(() => {
  if (window.__100GPT_overlay) {
    window.__100GPT_overlay.remove();
    delete window.__100GPT_overlay;
    delete window.__100GPT_getSelectionRect;
  }

  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
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

    setTimeout(() => {
      overlay.remove();
      rectBox.remove();
      delete window.__100GPT_overlay;
      delete window.__100GPT_getSelectionRect;
    }, 100);

    window.__100GPT_getSelectionRect = () => ({ x, y, w, h });
  }

  overlay.addEventListener("mousedown", onMouseDown);
})();
