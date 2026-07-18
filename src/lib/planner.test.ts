import { describe, it, expect } from "vitest";
import {
  expandEvents,
  slotHourOf,
  isAllDayOrTimeless,
  buildWeekHours,
  eventsInSlot,
  getUpcomingTasks,
  getTasksForDate,
  mergeEntities,
  mergeChecklists,
  pruneTombstones,
} from "./planner";
import type { CalendarEvent, Task } from "@/types";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    title: "Test Etkinlik",
    date: "2026-07-08",
    tagColor: "work",
    isAllDay: false,
    recurrence: "none",
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Test Görev",
    status: "planned",
    priority: "medium",
    tags: [],
    checklist: [],
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    order: 0,
    ...overrides,
  };
}

// ── expandEvents ──────────────────────────────────────────────

describe("expandEvents", () => {
  it("tek seferlik etkinliği aralık içindeyse döndürür", () => {
    const events = [makeEvent({ date: "2026-07-08" })];
    const result = expandEvents(events, "2026-07-06", "2026-07-12");
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-07-08");
  });

  it("tek seferlik etkinliği aralık dışındaysa döndürmez", () => {
    const events = [makeEvent({ date: "2026-07-20" })];
    expect(expandEvents(events, "2026-07-06", "2026-07-12")).toHaveLength(0);
  });

  it("aralık sınırlarındaki günleri dahil eder (başlangıç ve bitiş)", () => {
    const events = [makeEvent({ id: "a", date: "2026-07-06" }), makeEvent({ id: "b", date: "2026-07-12" })];
    const result = expandEvents(events, "2026-07-06", "2026-07-12");
    expect(result.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("günlük tekrarlı etkinliği haftanın her gününe açar", () => {
    const events = [makeEvent({ date: "2026-07-06", recurrence: "daily" })];
    const result = expandEvents(events, "2026-07-06", "2026-07-12");
    expect(result).toHaveLength(7);
    expect(result[0].id).toBe("e1-2026-07-06");
    expect(result[6].id).toBe("e1-2026-07-12");
  });

  it("haftalık tekrarlı etkinlik geçmişte başlasa da bu haftaya düşer", () => {
    // Pazartesi 2026-06-01'de başlayan haftalık etkinlik — 6 Temmuz haftasında görünmeli
    const events = [makeEvent({ date: "2026-06-01", recurrence: "weekly" })];
    const result = expandEvents(events, "2026-07-06", "2026-07-12");
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-07-06");
  });

  it("recurrenceEndDate sonrasına açılım yapmaz", () => {
    const events = [
      makeEvent({ date: "2026-07-06", recurrence: "daily", recurrenceEndDate: "2026-07-08" }),
    ];
    const result = expandEvents(events, "2026-07-06", "2026-07-12");
    expect(result).toHaveLength(3); // 6, 7, 8
  });

  it("aylık tekrarlı etkinlik bir sonraki aya düşer", () => {
    const events = [makeEvent({ date: "2026-06-15", recurrence: "monthly" })];
    const result = expandEvents(events, "2026-07-13", "2026-07-19");
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-07-15");
  });
});

// ── Haftalık görünüm yardımcıları ─────────────────────────────

describe("slotHourOf", () => {
  it("saat başını döndürür", () => {
    expect(slotHourOf("09:00")).toBe(9);
    expect(slotHourOf("09:30")).toBe(9); // buçuklu saat kaybolmaz
    expect(slotHourOf("19:45")).toBe(19);
    expect(slotHourOf("00:15")).toBe(0);
  });

  it("saatsizde null döndürür", () => {
    expect(slotHourOf(undefined)).toBeNull();
    expect(slotHourOf("")).toBeNull();
    expect(slotHourOf("xx")).toBeNull();
  });
});

describe("buildWeekHours", () => {
  it("etkinlik yoksa 08:00–18:00 taban aralığını verir", () => {
    const hours = buildWeekHours([]);
    expect(hours[0]).toBe("08:00");
    expect(hours[hours.length - 1]).toBe("18:00");
  });

  it("erken/geç etkinliklerde aralığı genişletir — 19:00 etkinliği artık kaybolmaz", () => {
    const hours = buildWeekHours([
      makeEvent({ startTime: "06:30" }),
      makeEvent({ id: "e2", startTime: "21:00" }),
    ]);
    expect(hours[0]).toBe("06:00");
    expect(hours[hours.length - 1]).toBe("21:00");
  });
});

describe("eventsInSlot", () => {
  it("buçuklu saat etkinliğini saat satırına yerleştirir", () => {
    const events = [makeEvent({ startTime: "09:30" })];
    expect(eventsInSlot(events, "09:00")).toHaveLength(1);
    expect(eventsInSlot(events, "10:00")).toHaveLength(0);
  });

  it("aynı slottaki birden çok etkinliği başlangıç saatine göre sıralar", () => {
    const events = [
      makeEvent({ id: "b", startTime: "09:45" }),
      makeEvent({ id: "a", startTime: "09:15" }),
    ];
    const slot = eventsInSlot(events, "09:00");
    expect(slot.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("tüm gün etkinliğini saat ızgarasına koymaz", () => {
    const events = [makeEvent({ isAllDay: true, startTime: "09:00" })];
    expect(eventsInSlot(events, "09:00")).toHaveLength(0);
    expect(isAllDayOrTimeless(events[0])).toBe(true);
  });

  it("saatsiz etkinlik tüm gün satırına gider", () => {
    expect(isAllDayOrTimeless(makeEvent({ startTime: undefined }))).toBe(true);
  });
});

// ── Görev pencereleri ─────────────────────────────────────────

describe("getUpcomingTasks", () => {
  it("7 gün içindeki görevleri döndürür, uzak gelecektekini döndürmez", () => {
    const tasks = [
      makeTask({ id: "yakın", date: "2026-07-11" }),
      makeTask({ id: "uzak", date: "2026-12-25" }), // uzun tarih — artık 'yaklaşan' değil
    ];
    const result = getUpcomingTasks(tasks, "2026-07-09");
    expect(result.map((t) => t.id)).toEqual(["yakın"]);
  });

  it("bugünü ve geçmişi dahil etmez", () => {
    const tasks = [
      makeTask({ id: "bugün", date: "2026-07-09" }),
      makeTask({ id: "dün", date: "2026-07-08" }),
      makeTask({ id: "yarın", date: "2026-07-10" }),
    ];
    const result = getUpcomingTasks(tasks, "2026-07-09");
    expect(result.map((t) => t.id)).toEqual(["yarın"]);
  });

  it("tamamlanmış görevleri dahil etmez ve tarihe göre sıralar", () => {
    const tasks = [
      makeTask({ id: "c", date: "2026-07-12" }),
      makeTask({ id: "a", date: "2026-07-10" }),
      makeTask({ id: "bitti", date: "2026-07-11", status: "done" }),
    ];
    const result = getUpcomingTasks(tasks, "2026-07-09");
    expect(result.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("limit uygular", () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask({ id: `t${i}`, date: "2026-07-10" })
    );
    expect(getUpcomingTasks(tasks, "2026-07-09", 7, 4)).toHaveLength(4);
  });
});

describe("getTasksForDate", () => {
  it("yalnızca o günün tamamlanmamış görevlerini order sırasıyla verir", () => {
    const tasks = [
      makeTask({ id: "b", date: "2026-07-09", order: 2 }),
      makeTask({ id: "a", date: "2026-07-09", order: 1 }),
      makeTask({ id: "başka-gün", date: "2026-07-10" }),
      makeTask({ id: "bitti", date: "2026-07-09", status: "done" }),
    ];
    expect(getTasksForDate(tasks, "2026-07-09").map((t) => t.id)).toEqual(["a", "b"]);
  });
});

// ── Senkronizasyon birleştirme ────────────────────────────────

interface Item {
  id: string;
  updatedAt?: string;
}

describe("mergeEntities", () => {
  it("silinen kayıt hortlamaz: yerel tombstone varken uzak eski kopya elenir", () => {
    const remote: Item[] = [{ id: "x", updatedAt: "2026-07-01T00:00:00Z" }];
    const tombs = { "tasks:x": "2026-07-05T00:00:00Z" };
    const r = mergeEntities<Item>([], remote, {}, tombs, "tasks");
    expect(r.merged).toHaveLength(0);
    expect(r.toSoftDelete).toHaveLength(1); // sunucuya da silme işareti gider
    expect(r.tombstonesOut["x"]).toBeDefined();
  });

  it("silmeden SONRA başka cihazda düzenlenen kayıt geri gelir", () => {
    const remote: Item[] = [{ id: "x", updatedAt: "2026-07-06T00:00:00Z" }];
    const tombs = { "tasks:x": "2026-07-05T00:00:00Z" };
    const r = mergeEntities<Item>([], remote, {}, tombs, "tasks");
    expect(r.merged).toHaveLength(1);
    expect(r.tombstonesOut["x"]).toBeUndefined();
  });

  it("sunucuda silinen kayıt yerelden de kalkar", () => {
    const local: Item[] = [{ id: "x", updatedAt: "2026-07-01T00:00:00Z" }];
    const r = mergeEntities<Item>(local, [], { x: "2026-07-05T00:00:00Z" }, {}, "tasks");
    expect(r.merged).toHaveLength(0);
    expect(r.tombstonesOut["x"]).toBe("2026-07-05T00:00:00Z");
  });

  it("LWW: daha yeni yerel kazanır ve push edilir", () => {
    const local: Item[] = [{ id: "x", updatedAt: "2026-07-06T00:00:00Z" }];
    const remote: Item[] = [{ id: "x", updatedAt: "2026-07-05T00:00:00Z" }];
    const r = mergeEntities<Item>(local, remote, {}, {}, "tasks");
    expect(r.merged[0].updatedAt).toBe("2026-07-06T00:00:00Z");
    expect(r.toPush).toHaveLength(1);
  });

  it("LWW: daha yeni uzak kazanır", () => {
    const local: Item[] = [{ id: "x", updatedAt: "2026-07-05T00:00:00Z" }];
    const remote: Item[] = [{ id: "x", updatedAt: "2026-07-06T00:00:00Z" }];
    const r = mergeEntities<Item>(local, remote, {}, {}, "tasks");
    expect(r.merged[0].updatedAt).toBe("2026-07-06T00:00:00Z");
    expect(r.toPush).toHaveLength(0);
  });

  it("yalnız yerelde olan kayıt korunur ve push edilir", () => {
    const local: Item[] = [{ id: "x", updatedAt: "2026-07-05T00:00:00Z" }];
    const r = mergeEntities<Item>(local, [], {}, {}, "tasks");
    expect(r.merged).toHaveLength(1);
    expect(r.toPush).toHaveLength(1);
  });

  it("farklı tablonun tombstone'u bu tabloyu etkilemez", () => {
    const remote: Item[] = [{ id: "x", updatedAt: "2026-07-01T00:00:00Z" }];
    const tombs = { "events:x": "2026-07-05T00:00:00Z" };
    const r = mergeEntities<Item>([], remote, {}, tombs, "tasks");
    expect(r.merged).toHaveLength(1);
  });
});

describe("mergeChecklists", () => {
  it("iki cihazda bağımsız eklenen maddelerin ikisini de korur (asıl hata senaryosu)", () => {
    // Mac'te eklenen madde
    const macSide = [
      { id: "1", text: "frontend", completed: true },
      { id: "2", text: "backend", completed: true },
    ];
    // iPhone'da, Mac senkron olmadan ÖNCE aynı göreve eklenen madde
    const iphoneSide = [
      { id: "1", text: "frontend", completed: true },
      { id: "2", text: "backend", completed: true },
      { id: "3", text: "e ticaret gereksinimlerini belirleme", completed: false },
    ];
    // Eski davranış: LWW ile hangisi "daha yeni" ise checklist'in TAMAMI o olurdu
    // ve iPhone'un "3" maddesi Mac kazanırsa sessizce kaybolurdu.
    const merged = mergeChecklists(macSide, iphoneSide);
    expect(merged.map((i) => i.id).sort()).toEqual(["1", "2", "3"]);
    expect(merged.find((i) => i.id === "3")?.text).toBe("e ticaret gereksinimlerini belirleme");
  });

  it("aynı maddede 'tamamlandı' işareti, işaretlenmemiş olana karşı kazanır", () => {
    const a = [{ id: "1", text: "x", completed: false }];
    const b = [{ id: "1", text: "x", completed: true }];
    expect(mergeChecklists(a, b)[0].completed).toBe(true);
    expect(mergeChecklists(b, a)[0].completed).toBe(true);
  });

  it("her iki taraf da boşsa boş döner", () => {
    expect(mergeChecklists([], [])).toEqual([]);
  });

  it("yalnızca bir tarafta madde varsa onu korur", () => {
    const a = [{ id: "1", text: "tek", completed: false }];
    expect(mergeChecklists(a, [])).toHaveLength(1);
    expect(mergeChecklists([], a)).toHaveLength(1);
  });
});

describe("pruneTombstones", () => {
  it("eski tombstone'ları atar, yenileri tutar", () => {
    const recent = new Date().toISOString();
    const old = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    const pruned = pruneTombstones({ "tasks:yeni": recent, "tasks:eski": old });
    expect(pruned["tasks:yeni"]).toBe(recent);
    expect(pruned["tasks:eski"]).toBeUndefined();
  });
});
