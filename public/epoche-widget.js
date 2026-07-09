// ============================================================
// Epoche — iPhone/Mac Widget (Scriptable)
// Cream paleti + Apple Takvim tarzı büyük gün/tarih tipografisi.
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

// ── Epoche tasarım dili — Cream (logo paletinden) ─────────────
const C = {
  bg: new Color("#F3EDE0"), // krem zemin
  espresso: new Color("#3B2A20"), // logodaki saat rengi — ana metin
  text2: new Color("#6B5B3E"),
  muted: new Color("#3B2A20", 0.4),
  gold: new Color("#A0825C"),
  tag: {
    work: new Color("#D14342"),
    personal: new Color("#178A65"),
    project: new Color("#6C63CF"),
    meeting: new Color("#A86A15"),
  },
  priority: {
    urgent: new Color("#D14342"),
    high: new Color("#C24E27"),
    medium: new Color("#A86A15"),
    low: new Color("#178A65"),
  },
};

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUNLER = ["PAZAR", "PAZARTESİ", "SALI", "ÇARŞAMBA", "PERŞEMBE", "CUMA", "CUMARTESİ"];

async function fetchData() {
  const req = new Request(`${BASE_URL}/api/widget?token=${TOKEN}`);
  return await req.loadJSON();
}

// Apple Takvim tarzı satır: renk şeridi + saat + başlık (sistem fontu, büyük)
function addRow(list, { color, time, title, big }) {
  const row = list.addStack();
  row.centerAlignContent();
  row.spacing = 7;

  const bar = row.addStack();
  bar.size = new Size(3, big ? 30 : 26);
  bar.cornerRadius = 1.5;
  bar.backgroundColor = color;

  const col = row.addStack();
  col.layoutVertically();
  const label = col.addText(title);
  label.font = Font.semiboldSystemFont(big ? 15 : 13);
  label.textColor = C.espresso;
  label.lineLimit = 1;
  if (time) {
    const sub = col.addText(time);
    sub.font = Font.systemFont(big ? 13 : 11);
    sub.textColor = C.text2;
  }
  row.addSpacer();
}

async function buildWidget() {
  const size = config.widgetFamily || "medium";
  const widget = new ListWidget();
  widget.backgroundColor = C.bg;
  widget.url = BASE_URL; // dokununca Epoche açılır
  widget.setPadding(14, 16, 12, 16);
  widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  const now = new Date();

  let data = null;
  try {
    data = await fetchData();
    if (data.error) data = null;
  } catch (e) {
    data = null;
  }

  const items = [];
  if (data) {
    for (const e of data.todayEvents) {
      items.push({
        color: C.tag[e.tagColor] ?? C.gold,
        time: e.isAllDay || !e.startTime ? "Tüm gün" : e.endTime ? `${e.startTime} – ${e.endTime}` : e.startTime,
        title: e.title,
      });
    }
    for (const t of data.todayTasks) {
      items.push({
        color: C.priority[t.priority] ?? C.gold,
        time: "Görev",
        title: t.title,
      });
    }
  }

  if (size === "medium" || size === "extraLarge") {
    // ── Sol: büyük gün/tarih bloğu · Sağ: liste ────────────────
    const root = widget.addStack();
    root.topAlignContent();

    const left = root.addStack();
    left.layoutVertically();

    const dayName = left.addText(GUNLER[now.getDay()]);
    dayName.font = Font.boldSystemFont(13);
    dayName.textColor = C.gold;

    const dayNum = left.addText(String(now.getDate()));
    dayNum.font = Font.boldSystemFont(44);
    dayNum.textColor = C.espresso;

    const month = left.addText(AYLAR[now.getMonth()]);
    month.font = Font.mediumSystemFont(14);
    month.textColor = C.text2;

    left.addSpacer();
    const brand = left.addText("Epoche");
    brand.font = new Font("Georgia-Bold", 14);
    brand.textColor = C.gold;

    root.addSpacer(18);

    const right = root.addStack();
    right.layoutVertically();

    if (!data) {
      right.addSpacer(8);
      const err = right.addText("Bağlantı yok — token'ı kontrol edin");
      err.font = Font.systemFont(13);
      err.textColor = C.muted;
    } else if (items.length === 0) {
      right.addSpacer(8);
      const empty = right.addText("Bugün plan yok ✨");
      empty.font = Font.mediumSystemFont(15);
      empty.textColor = C.text2;
      const next = (data.upcoming ?? [])[0];
      if (next) {
        right.addSpacer(6);
        const d = new Date(`${next.date}T12:00:00`);
        const up = right.addText(`Sıradaki: ${d.getDate()} ${AYLAR[d.getMonth()]} — ${next.title}`);
        up.font = Font.systemFont(12);
        up.textColor = C.muted;
        up.lineLimit = 2;
      }
    } else {
      for (const item of items.slice(0, 3)) {
        addRow(right, { ...item, big: true });
        right.addSpacer(6);
      }
      if (items.length > 3) {
        const more = right.addText(`+${items.length - 3} tane daha`);
        more.font = Font.mediumSystemFont(12);
        more.textColor = C.muted;
      }
    }
    right.addSpacer();
  } else if (size === "small") {
    // ── Küçük: gün + rakam + ilk 2 kayıt ───────────────────────
    const dayName = widget.addText(GUNLER[now.getDay()]);
    dayName.font = Font.boldSystemFont(11);
    dayName.textColor = C.gold;

    const dayNum = widget.addText(String(now.getDate()));
    dayNum.font = Font.boldSystemFont(34);
    dayNum.textColor = C.espresso;

    widget.addSpacer(6);
    if (items.length === 0) {
      const empty = widget.addText(data ? "Plan yok ✨" : "Bağlantı yok");
      empty.font = Font.mediumSystemFont(12);
      empty.textColor = C.text2;
    } else {
      for (const item of items.slice(0, 2)) {
        addRow(widget, { ...item, big: false });
        widget.addSpacer(4);
      }
      if (items.length > 2) {
        const more = widget.addText(`+${items.length - 2}`);
        more.font = Font.mediumSystemFont(11);
        more.textColor = C.muted;
      }
    }
    widget.addSpacer();
  } else {
    // ── Büyük: tarih başlık + uzun liste ───────────────────────
    const header = widget.addStack();
    header.bottomAlignContent();
    const dayNum = header.addText(String(now.getDate()));
    dayNum.font = Font.boldSystemFont(40);
    dayNum.textColor = C.espresso;
    header.addSpacer(10);
    const col = header.addStack();
    col.layoutVertically();
    const dayName = col.addText(GUNLER[now.getDay()]);
    dayName.font = Font.boldSystemFont(14);
    dayName.textColor = C.gold;
    const month = col.addText(`${AYLAR[now.getMonth()]} ${now.getFullYear()}`);
    month.font = Font.mediumSystemFont(13);
    month.textColor = C.text2;
    header.addSpacer();
    const brand = header.addText("Epoche");
    brand.font = new Font("Georgia-Bold", 16);
    brand.textColor = C.gold;

    widget.addSpacer(12);

    if (items.length === 0) {
      const empty = widget.addText(data ? "Bugün plan yok ✨" : "Bağlantı yok — token'ı kontrol edin");
      empty.font = Font.mediumSystemFont(15);
      empty.textColor = C.text2;
    } else {
      for (const item of items.slice(0, 8)) {
        addRow(widget, { ...item, big: true });
        widget.addSpacer(7);
      }
    }

    // Yaklaşanlar
    const upcoming = (data?.upcoming ?? []).slice(0, Math.max(0, 8 - items.length));
    if (upcoming.length > 0) {
      widget.addSpacer(4);
      const head = widget.addText("YAKLAŞAN");
      head.font = Font.boldSystemFont(11);
      head.textColor = C.muted;
      widget.addSpacer(5);
      for (const u of upcoming) {
        const d = new Date(`${u.date}T12:00:00`);
        addRow(widget, {
          color: C.gold,
          time: `${d.getDate()} ${AYLAR[d.getMonth()]}`,
          title: u.title,
          big: false,
        });
        widget.addSpacer(5);
      }
    }
    widget.addSpacer();
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
