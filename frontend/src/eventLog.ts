import { getCurrentUserForEventLog } from "./userDisplay";

export type SystemEvent = {
  id: string;
  ts: number;
  action: string;
  detail?: string;
  /** Кто выполнил действие (ФИО и логин в демо). */
  user?: string;
};

const EVENT_LOG_KEY = "lukoil_demo_event_log_v1";
const MAX_EVENTS = 300;

function readRaw(): SystemEvent[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(EVENT_LOG_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (e): e is SystemEvent =>
        e != null &&
        typeof e === "object" &&
        "id" in e &&
        "ts" in e &&
        "action" in e &&
        typeof (e as SystemEvent).id === "string" &&
        typeof (e as SystemEvent).ts === "number" &&
        typeof (e as SystemEvent).action === "string"
    );
  } catch {
    return [];
  }
}

export function getEvents(): SystemEvent[] {
  return readRaw().sort((a, b) => b.ts - a.ts);
}

/** Регистрирует действие в журнале (новые записи сверху, лимит — последние 300). */
export function appendEvent(action: string, detail?: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const entry: SystemEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    ts: Date.now(),
    action,
    detail: detail || undefined,
    user: getCurrentUserForEventLog()
  };
  const next = [entry, ...readRaw()].slice(0, MAX_EVENTS);
  window.localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(next));
}

/**
 * Для существующих событий с заданным action подставляет newDetail, если shouldReplace(detail) возвращает true.
 * Сохраняет id и ts записей (только обновляется detail).
 */
export function updateEventDetailsByAction(
  action: string,
  newDetail: string,
  shouldReplace: (oldDetail: string | undefined) => boolean
): void {
  if (typeof window === "undefined") {
    return;
  }
  const raw = readRaw();
  let changed = false;
  const next = raw.map((e) => {
    if (e.action !== action) {
      return e;
    }
    if (!shouldReplace(e.detail)) {
      return e;
    }
    if (e.detail === newDetail) {
      return e;
    }
    changed = true;
    return { ...e, detail: newDetail };
  });
  if (changed) {
    window.localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(next));
  }
}

export function formatEventTime(ts: number): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
