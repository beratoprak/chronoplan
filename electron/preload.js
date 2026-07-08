// Preload script — runs in renderer context before page loads
// Exposes safe bridge between Electron and web app

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
});

// Inject CSS for native title bar spacing
window.addEventListener("DOMContentLoaded", () => {
  const style = document.createElement("style");
  style.textContent = `
    /* Electron: hiddenInset title bar padding */
    body {
      -webkit-app-region: no-drag;
    }

    /* Make topbar draggable (title bar behavior) */
    header {
      -webkit-app-region: drag;
    }

    /* Buttons inside topbar should NOT be draggable */
    header button, header input, header kbd, header a {
      -webkit-app-region: no-drag;
    }

    /* Sidebar top area draggable */
    aside > div:first-child {
      -webkit-app-region: drag;
      padding-top: 8px;
    }
  `;
  document.head.appendChild(style);
});
