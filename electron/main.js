const { app, BrowserWindow, Menu, shell, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");

// ── Config ─────────────────────────────────────────────────
const APP_URL = "https://chronoplan-three.vercel.app";
const LOCAL_URL = "http://localhost:3000";
const IS_DEV = process.argv.includes("--dev");

const DATA_PATH = path.join(
  app.getPath("appData"),
  "ChronoPlan",
  "widget-data.json"
);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: "ChronoPlan",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1A1714" : "#F5F0E8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, "icon.icns"),
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.loadURL(IS_DEV ? LOCAL_URL : APP_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  nativeTheme.on("updated", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#1A1714" : "#F5F0E8");
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });

  // Widget için veri dosyasına yaz
  startDataExport();
}

// ── Widget Data Export ────────────────────────────────────
function exportWidgetData() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents
    .executeJavaScript(`
      (function() {
        try {
          var raw = localStorage.getItem("chronoplan-storage");
          if (!raw) return JSON.stringify({ events: [], tasks: [] });
          var state = JSON.parse(raw).state || {};
          return JSON.stringify({ events: state.events || [], tasks: state.tasks || [] });
        } catch(e) { return JSON.stringify({ events: [], tasks: [] }); }
      })()
    `)
    .then((data) => {
      try {
        const dir = path.dirname(DATA_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DATA_PATH, data);
      } catch {}
    })
    .catch(() => {});
}

function startDataExport() {
  // İlk export (sayfa yüklendikten sonra)
  setTimeout(() => exportWidgetData(), 3000);
  // Her 30 saniyede güncelle
  setInterval(() => exportWidgetData(), 30000);
}

// ── Menu ───────────────────────────────────────────────────
function createMenu() {
  const template = [
    {
      label: "ChronoPlan",
      submenu: [
        { label: "ChronoPlan Hakkinda", role: "about" },
        { type: "separator" },
        {
          label: "Ayarlar",
          accelerator: "Cmd+,",
          click: () => {
            mainWindow?.webContents.executeJavaScript(
              'document.dispatchEvent(new KeyboardEvent("keydown", { key: ",", metaKey: true }))'
            );
          },
        },
        { type: "separator" },
        { label: "ChronoPlan Gizle", role: "hide" },
        { label: "Digerlerini Gizle", role: "hideOthers" },
        { label: "Tumunu Goster", role: "unhide" },
        { type: "separator" },
        { label: "Cikis", role: "quit" },
      ],
    },
    {
      label: "Duzenle",
      submenu: [
        { label: "Geri Al", role: "undo" },
        { label: "Yeniden Yap", role: "redo" },
        { type: "separator" },
        { label: "Kes", role: "cut" },
        { label: "Kopyala", role: "copy" },
        { label: "Yapistir", role: "paste" },
        { label: "Tumunu Sec", role: "selectAll" },
      ],
    },
    {
      label: "Gorunum",
      submenu: [
        { label: "Gunluk", accelerator: "Cmd+1", click: () => evalInWindow("__setView('daily')") },
        { label: "Haftalik", accelerator: "Cmd+2", click: () => evalInWindow("__setView('weekly')") },
        { label: "Aylik", accelerator: "Cmd+3", click: () => evalInWindow("__setView('monthly')") },
        { label: "Kanban", accelerator: "Cmd+4", click: () => evalInWindow("__setView('kanban')") },
        { type: "separator" },
        { label: "Tam Ekran", role: "togglefullscreen" },
        { type: "separator" },
        { label: "Yakınlastir", role: "zoomIn" },
        { label: "Uzaklastir", role: "zoomOut" },
        { label: "Gercek Boyut", role: "resetZoom" },
      ],
    },
    {
      label: "Pencere",
      submenu: [
        { label: "Kucult", role: "minimize" },
        { label: "Yakınlastir", role: "zoom" },
        { type: "separator" },
        { label: "Ileriye Getir", role: "front" },
      ],
    },
  ];

  if (IS_DEV) {
    template.push({
      label: "Gelistirici",
      submenu: [
        { label: "Yenile", role: "reload" },
        { label: "Zorla Yenile", role: "forceReload" },
        { label: "DevTools", role: "toggleDevTools" },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function evalInWindow(code) {
  mainWindow?.webContents.executeJavaScript(code).catch(() => {});
}

// ── App Lifecycle ──────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.setName("ChronoPlan");
