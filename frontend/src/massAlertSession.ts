/** Единая отметка времени начала сценария «массовое оповещение» (уровень 2) для всех связанных страниц. */
export const MASS_ALERT_SESSION_START_KEY = "lukoil_demo_mass_alert_start_ms";
/** Зафиксированное «Прошло времени» (сек) в момент открытия страницы «Отмена оповещения». */
export const MASS_ALERT_FROZEN_ELAPSED_SEC_KEY = "lukoil_demo_mass_alert_frozen_elapsed_sec";

export function ensureMassAlertSessionStart(): number {
  if (typeof window === "undefined") {
    return Date.now();
  }
  const raw = window.localStorage.getItem(MASS_ALERT_SESSION_START_KEY);
  if (raw != null) {
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) {
      return n;
    }
  }
  const now = Date.now();
  window.localStorage.setItem(MASS_ALERT_SESSION_START_KEY, String(now));
  return now;
}

/** Новый запуск сценария с главного экрана — таймер «Прошло времени» с нуля. */
export function resetMassAlertSessionStart(): void {
  if (typeof window === "undefined") {
    return;
  }
  const now = Date.now();
  window.localStorage.setItem(MASS_ALERT_SESSION_START_KEY, String(now));
  window.localStorage.removeItem(MASS_ALERT_FROZEN_ELAPSED_SEC_KEY);
}

export function getElapsedSecondsSinceMassAlertStart(startMs: number): number {
  return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
}

/** Останавливает таймер на экране: считает прошедшее время и записывает в localStorage. */
export function freezeMassAlertElapsedSeconds(startMs: number): number {
  const sec = getElapsedSecondsSinceMassAlertStart(startMs);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MASS_ALERT_FROZEN_ELAPSED_SEC_KEY, String(sec));
  }
  return sec;
}

export function formatElapsedHms(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
