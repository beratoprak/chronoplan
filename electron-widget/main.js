const { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const DATA_PATH = path.join(
  app.getPath("appData"),
  "Epoche",
  "widget-data.json"
);

let widgetWindow;
let tray;
let reallyQuit = false;

function readWidgetData() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      return fs.readFileSync(DATA_PATH, "utf-8");
    }
  } catch {}
  return JSON.stringify({ events: [], tasks: [] });
}

function createWidget() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  widgetWindow = new BrowserWindow({
    width: 240,
    height: 280,
    x: screenWidth - 260,
    y: 40,
    frame: false,
    transparent: true,
    focusable: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    show: false,
    visibleOnAllWorkspaces: true,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  widgetWindow.loadFile(path.join(__dirname, "widget.html"));

  widgetWindow.once("ready-to-show", () => {
    widgetWindow.show();
    widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    // Başlangıçta alwaysOnTop kapalı — focus mantığı yönetecek
    widgetWindow.setAlwaysOnTop(false);
    sendData();
  });

  // Widget penceresi kapatılamaz — sadece tray'den "Kapat" ile
  widgetWindow.on("close", (e) => {
    if (!reallyQuit) {
      e.preventDefault();
    }
  });

  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });
}

// ── Widget Focus Yönetimi ──────────────────────────────────
// Kendi uygulamamızın herhangi bir penceresi focus aldığında
// widget'ı öne çıkar
app.on("browser-window-focus", () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  widgetWindow.setAlwaysOnTop(true, "floating");
});

// Kendi uygulamamızın herhangi bir penceresi focus kaybettiğinde
// kontrol et: hâlâ bizim bir penceremiz focused mi?
app.on("browser-window-blur", () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;

  // Kısa bir delay ile kontrol et (focus başka bir kendi penceremize
  // geçiyor olabilir, hemen kapatma)
  setTimeout(() => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;

    const anyOwnWindowFocused = BrowserWindow.getAllWindows().some(
      (w) => !w.isDestroyed() && w.isFocused()
    );

    if (!anyOwnWindowFocused) {
      // Başka bir uygulama (Chrome, Finder vs.) öne geçti
      // Widget'ı arkaya al ama görünür bırak
      widgetWindow.setAlwaysOnTop(false);
    }
  }, 100);
});

function sendData() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const data = readWidgetData();
  widgetWindow.webContents.send("widget-data", data);
}

function watchDataFile() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ events: [], tasks: [] }));
  }

  fs.watch(DATA_PATH, { persistent: false }, () => {
    sendData();
  });

  setInterval(() => sendData(), 60000);
}

// Widget'a tıklayınca ana uygulamayı aç
ipcMain.on("open-app", () => {
  execFile("open", ["-a", "Epoche"]);
});

function createTray() {
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAiklEQVQ4T2NkoBAwUqifgWoGsP" +
      "z//59h1t0XDLOBGBkwMjIyMPz7z8Dw9x8Dw59/DAx//jEw/P3PwPD7LwPDr78MDL/+MDD8/M" +
      "PA8OMPA8P3PwwM3/4wMHz9w8Dw5Q8Dw+c/DAwf/zIwfPjLwPDuLwPDm78MDK//MjC8+svA8P" +
      "IvA8OLvwwMz/8yMDwDAF3IOhG7VJzNAAAAAElFTkSuQmCC",
      "base64"
    )
  );

  tray = new Tray(icon);
  tray.setToolTip("Epoche Widget");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Widget Göster/Gizle",
      click: () => {
        if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.isVisible() ? widgetWindow.hide() : widgetWindow.showInactive();
        }
      },
    },
    { type: "separator" },
    {
      label: "Widget'ı Kapat",
      click: () => {
        reallyQuit = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ── App Lifecycle ──────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.show();
    }
  });

  app.whenReady().then(() => {
    createWidget();
    createTray();
    watchDataFile();
    setTimeout(() => app.dock?.hide(), 2000);
  });
}

app.on("before-quit", (e) => {
  if (!reallyQuit) {
    e.preventDefault();
  }
});

app.on("window-all-closed", () => {
  // Hiçbir şey yapma
});