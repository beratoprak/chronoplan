const { app, BrowserWindow, Menu, Tray, shell, globalShortcut, nativeTheme, ipcMain, screen } = require("electron");
const path = require("path");

// ── Config ─────────────────────────────────────────────────
const APP_URL = "https://chronoplan-three.vercel.app";
const LOCAL_URL = "http://localhost:3000";
const IS_DEV = process.argv.includes("--dev");

let mainWindow;
let widgetWindow;
let tray;

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

  // Smooth show
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Load URL
  const url = IS_DEV ? LOCAL_URL : APP_URL;
  mainWindow.loadURL(url);

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Handle theme change
  nativeTheme.on("updated", () => {
    mainWindow.setBackgroundColor(
      nativeTheme.shouldUseDarkColors ? "#1A1714" : "#F5F0E8"
    );
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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
        {
          label: "Gunluk",
          accelerator: "Cmd+1",
          click: () => evalInWindow("__setView('daily')"),
        },
        {
          label: "Haftalik",
          accelerator: "Cmd+2",
          click: () => evalInWindow("__setView('weekly')"),
        },
        {
          label: "Aylik",
          accelerator: "Cmd+3",
          click: () => evalInWindow("__setView('monthly')"),
        },
        {
          label: "Kanban",
          accelerator: "Cmd+4",
          click: () => evalInWindow("__setView('kanban')"),
        },
        { type: "separator" },
        {
          label: "Widget Göster/Gizle",
          accelerator: "CmdOrCtrl+Shift+W",
          click: () => toggleWidget(),
        },
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

  // Dev mode: add dev tools
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

// ── Widget ────────────────────────────────────────────────
function createWidget() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  widgetWindow = new BrowserWindow({
    width: 300,
    height: 420,
    x: screenWidth - 320,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "widget-preload.js"),
    },
  });

  widgetWindow.loadFile(path.join(__dirname, "widget.html"));

  widgetWindow.once("ready-to-show", () => {
    widgetWindow.showInactive();
  });

  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });

  // Veri akışı: ana pencereden widget'a
  refreshWidgetData();
}

function refreshWidgetData() {
  if (!widgetWindow || !mainWindow) return;
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
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send("widget-data", data);
      }
    })
    .catch(() => {});
}

// Her 60 saniyede widget'ı güncelle
setInterval(() => refreshWidgetData(), 60000);

function toggleWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    if (widgetWindow.isVisible()) {
      widgetWindow.hide();
    } else {
      widgetWindow.showInactive();
      refreshWidgetData();
    }
  } else {
    createWidget();
  }
}

// ── App Lifecycle ──────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createMenu();

  // Widget: kısa süre sonra oluştur (ana pencere yüklensin)
  setTimeout(() => createWidget(), 3000);

  // Cmd+Shift+W ile widget toggle
  globalShortcut.register("CommandOrControl+Shift+W", toggleWidget);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Set app name
app.setName("ChronoPlan");
