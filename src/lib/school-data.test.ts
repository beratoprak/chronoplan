import { describe, expect, it } from "vitest";
import { completedCredits, isSchoolSourceStale, requiredFinal, type SchoolCourse, type SchoolGrade } from "./school-data";

describe("okul karar yardımcıları", () => {
  it("yönetmelikteki final alt sınırı 50'yi uygular", () => {
    expect(requiredFinal(85)).toBe(50);
    expect(requiredFinal(50)).toBe(67);
    expect(() => requiredFinal(101)).toThrow(RangeError);
  });

  it("yalnız başarılı veya muaf derslerin AKTS'sini toplar", () => {
    const courses = [
      { kod: "A", ad: "A", yariyil: 1, akts: 4, zorunlu: true, muafiyet_hakki: false, ortalamaya_etki: true },
      { kod: "B", ad: "B", yariyil: 1, akts: 5, zorunlu: true, muafiyet_hakki: true, ortalamaya_etki: false },
      { kod: "C", ad: "C", yariyil: 1, akts: 3, zorunlu: true, muafiyet_hakki: false, ortalamaya_etki: true },
    ] satisfies SchoolCourse[];
    const grades = [
      { id: "1", ders_kodu: "A", donem: "güz", harf: "C3", statu: "normal", kaynak: "manuel", updated_at: "" },
      { id: "2", ders_kodu: "B", donem: "güz", statu: "M2", kaynak: "manuel", updated_at: "" },
      { id: "3", ders_kodu: "C", donem: "güz", harf: "F1", statu: "normal", kaynak: "manuel", updated_at: "" },
    ] satisfies SchoolGrade[];
    expect(completedCredits(courses, grades)).toBe(9);
  });

  it("kaynak yaş sınırı aşılırsa durum taze yazsa bile bayat sayar", () => {
    expect(isSchoolSourceStale({ id: "s", ad: "S", durum: "taze", max_age_hours: 24, last_ok_at: "2026-08-25T00:00:00Z" }, Date.parse("2026-08-27T00:00:01Z"))).toBe(true);
    expect(isSchoolSourceStale({ id: "s", ad: "S", durum: "taze", max_age_hours: 72, last_ok_at: "2026-08-25T00:00:00Z" }, Date.parse("2026-08-27T00:00:01Z"))).toBe(false);
  });
});
