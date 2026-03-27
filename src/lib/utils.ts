import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function getTagColorClasses(color: string): { bg: string; text: string; dot: string } {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    work: { bg: "bg-red-50", text: "text-red-800", dot: "bg-tag-work" },
    personal: { bg: "bg-emerald-50", text: "text-emerald-800", dot: "bg-tag-personal" },
    project: { bg: "bg-violet-50", text: "text-violet-800", dot: "bg-tag-project" },
    meeting: { bg: "bg-amber-50", text: "text-amber-800", dot: "bg-tag-meeting" },
  };
  return map[color] || map.work;
}

export function getPriorityLabel(priority: string): string {
  const map: Record<string, string> = {
    urgent: "Acil",
    high: "Yüksek",
    medium: "Orta",
    low: "Düşük",
  };
  return map[priority] || priority;
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    planned: "Planlanan",
    active: "Devam Eden",
    done: "Tamamlanan",
  };
  return map[status] || status;
}

export function getTagColorLabel(color: string): string {
  const map: Record<string, string> = {
    work: "İş",
    personal: "Kişisel",
    project: "Proje",
    meeting: "Toplantı",
  };
  return map[color] || color;
}

export function getRecurrenceLabel(recurrence: string): string {
  const map: Record<string, string> = {
    none: "Tekrar yok",
    daily: "Her gün",
    weekly: "Her hafta",
    monthly: "Her ay",
  };
  return map[recurrence] || recurrence;
}
