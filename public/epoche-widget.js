// ============================================================
// Epoche — iPhone Widget (Scriptable)
// Epoche'nin krem/altın tasarımıyla bugünün programı + görevler.
//
// KURULUM:
// 1. App Store'dan ücretsiz "Scriptable" uygulamasını indirin.
// 2. Scriptable'da + ile yeni betik oluşturun, bu dosyanın
//    tamamını yapıştırın, adını "Epoche" koyun.
// 3. Aşağıdaki TOKEN satırına Epoche → Ayarlar → Takvim Aboneliği
//    adresindeki token= sonrasındaki kodu yapıştırın.
// 4. Ana ekranda boş yere basılı tutun → + → Scriptable → boyut
//    seçin → widget'a dokunup Script: "Epoche" seçin.
// ============================================================

const TOKEN = "BURAYA_TOKENINIZI_YAPISTIRIN";
const BASE_URL = "https://chronoplan-three.vercel.app";

// ── Epoche tasarım dili ───────────────────────────────────────
const C = {
  bg: Color.dynamic(new Color("#FDFBF7"), new Color("#1A1714")),
  bgCard: Color.dynamic(new Color("#F5F0E8"), new Color("#242019")),
  gold: Color.dynamic(new Color("#A0825C"), new Color("#C4A060")),
  text: Color.dynamic(new Color("#2C2518"), new Color("#EDE8DD")),
  text2: Color.dynamic(new Color("#6B5B3E"), new Color("#A09882")),
  muted: Color.dynamic(new Color("#A09882"), new Color("#6B5B3E")),
  tag: {
    work: new Color("#E24B4A"),
    personal: new Color("#1D9E75"),
    project: new Color("#7F77DD"),
    meeting: new Color("#BA7517"),
  },
  priority: {
    urgent: new Color("#E24B4A"),
    high: new Color("#D85A30"),
    medium: new Color("#BA7517"),
    low: new Color("#1D9E75"),
  },
};

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

async function fetchData() {
  const req = new Request(`${BASE_URL}/api/widget?token=${TOKEN}`);
  return await req.loadJSON();
}

function turkishDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${GUNLER[d.getDay()]}`;
}

function addDot(stack, color, size) {
  const dot = stack.addText("●");
  dot.font = Font.systemFont(size ?? 7);
  dot.textColor = color;
  return dot;
}

function addRow(widget, { left, leftColor, title, small }) {
  const row = widget.addStack();
  row.centerAlignContent();
  row.spacing = 5;

  if (left) {
    const time = row.addText(left);
    time.font = Font.mediumSystemFont(small ? 10 : 11);
    time.textColor = C.gold;
  } else if (leftColor) {
    addDot(row, leftColor, small ? 6 : 7);
  }

  const label = row.addText(title);
  label.font = Font.systemFont(small ? 11 : 12);
  label.textColor = C.text;
  label.lineLimit = 1;
  row.addSpacer();
}

async function buildWidget() {
  const size = config.widgetFamily || "medium";
  const widget = new ListWidget();
  widget.backgroundColor = C.bg;
  widget.url = BASE_URL; // dokununca Epoche açılır
  widget.setPadding(14, 14, 12, 14);
  widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  let data;
  try {
    data = await fetchData();
    if (data.error) throw new Error(data.error);
  } catch (e) {
    const t = widget.addText("Epoche");
    t.font = new Font("Georgia-Bold", 16);
    t.textColor = C.gold;
    widget.addSpacer(4);
    const err = widget.addText("Bağlantı yok — token'ı kontrol edin");
    err.font = Font.systemFont(11);
    err.textColor = C.muted;
    return widget;
  }

  // ── Başlık: Epoche + tarih ──────────────────────────────────
  const header = widget.addStack();
  header.centerAlignContent();
  const logo = header.addText("Epoche");
  logo.font = new Font("Georgia-Bold", size === "small" ? 14 : 16);
  logo.textColor = C.gold;
  header.addSpacer();
  if (size !== "small") {
    const date = header.addText(turkishDate(data.today));
    date.font = Font.systemFont(11);
    date.textColor = C.text2;
  }

  widget.addSpacer(size === "small" ? 6 : 8);

  const maxItems = size === "small" ? 3 : size === "large" ? 10 : 4;
  let shown = 0;

  // ── Bugünün etkinlikleri ────────────────────────────────────
  for (const e of data.todayEvents) {
    if (shown >= maxItems) break;
    addRow(widget, {
      left: e.isAllDay || !e.startTime ? null : e.startTime,
      leftColor: C.tag[e.tagColor] ?? C.gold,
      title: e.title,
      small: size === "small",
    });
    widget.addSpacer(3);
    shown++;
  }

  // ── Bugünün görevleri ───────────────────────────────────────
  for (const t of data.todayTasks) {
    if (shown >= maxItems) break;
    addRow(widget, {
      leftColor: C.priority[t.priority] ?? C.gold,
      title: `◻︎ ${t.title}`,
      small: size === "small",
    });
    widget.addSpacer(3);
    shown++;
  }

  // ── Bugün boşsa yaklaşanlardan göster ───────────────────────
  if (shown === 0) {
    const empty = widget.addText("Bugün plan yok ✨");
    empty.font = Font.systemFont(12);
    empty.textColor = C.muted;
    widget.addSpacer(6);
    for (const u of data.upcoming.slice(0, maxItems - 1)) {
      const d = new Date(`${u.date}T12:00:00`);
      addRow(widget, {
        left: `${d.getDate()} ${AYLAR[d.getMonth()].slice(0, 3)}`,
        title: u.type === "task" ? `◻︎ ${u.title}` : u.title,
        small: size === "small",
      });
      widget.addSpacer(3);
    }
  }

  widget.addSpacer();

  // ── Alt bilgi: sayaçlar ─────────────────────────────────────
  if (size !== "small") {
    const footer = widget.addStack();
    footer.centerAlignContent();
    const counts = footer.addText(
      `${data.counts.events} etkinlik · ${data.counts.tasks} görev`
    );
    counts.font = Font.systemFont(10);
    counts.textColor = C.muted;
    footer.addSpacer();
  }

  return widget;
}

const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
