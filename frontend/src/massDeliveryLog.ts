import { appendEvent, getEvents, updateEventDetailsByAction } from "./eventLog";
import {
  buildMassEmailLogDetail,
  buildMassMaxLogDetail,
  buildMassSmsLogDetail,
  buildMassTelephonyLogDetailEnsure
} from "./massDeliveryLogDetails";
import {
  EMAIL_TOTAL,
  getEmailSubscribersFlat,
  getMaxChatsFlat,
  getSmsSubscribersFlat,
  getTelephonySubscribersFlat,
  MAX_TOTAL,
  SMS_TOTAL,
  TELEPHONY_TOTAL
} from "./MassNotificationPage";

const MASS_DELIVERY_LOG_ENTRIES: readonly { action: string; detail: string }[] = [
  {
    action: "Рассылка в корпоративный мессенджер MAX",
    detail: buildMassMaxLogDetail(getMaxChatsFlat(), MAX_TOTAL)
  },
  {
    action: "Рассылка SMS",
    detail: buildMassSmsLogDetail(getSmsSubscribersFlat(), SMS_TOTAL)
  },
  {
    action: "Почтовая рассылка",
    detail: buildMassEmailLogDetail(getEmailSubscribersFlat(), EMAIL_TOTAL)
  },
  {
    action: "Телефонные оповещения (звонки)",
    detail: buildMassTelephonyLogDetailEnsure(
      getTelephonySubscribersFlat(),
      TELEPHONY_TOTAL
    )
  },
  {
    action: "Оповещение через ЛСО",
    detail:
      "Текст сигнала выведен в локальную систему оповещения предприятия (трансляция завершена)."
  }
];

/** Короткий вариант из ранних версий (одна строка) — обновляем на развёрнутый текст с перечнями. */
function shouldReplaceWithExpandedDetail(
  oldDetail: string | undefined,
  action: string
): boolean {
  if (oldDetail == null || !oldDetail.trim()) {
    return true;
  }
  if (action === "Оповещение через ЛСО") {
    return false;
  }
  if (action === "Телефонные оповещения (звонки)") {
    const lineBreaks = (oldDetail.match(/\n/g) || []).length;
    /** Развёрнутый текст в несколько строк; иначе — «простыня», подставим построчный вариант. */
    if (lineBreaks < 10) {
      return true;
    }
    return false;
  }
  const low = oldDetail.toLowerCase();
  if (low.includes("перечень") || oldDetail.includes("Итог по вызовам")) {
    return false;
  }
  return true;
}

/**
 * Гарантирует в журнале записи о завершении рассылок по всем каналам массового оповещения.
 * Пропускает действия, которые уже есть (по точному совпадению поля action), но обновляет
 * «короткие» старые детализации (из localStorage до появления перечней) на полные.
 */
export function ensureMassDeliveryEventsInLog(): void {
  if (typeof window === "undefined") {
    return;
  }
  for (const { action, detail } of MASS_DELIVERY_LOG_ENTRIES) {
    updateEventDetailsByAction(action, detail, (d) =>
      shouldReplaceWithExpandedDetail(d, action)
    );
  }
  const have = new Set(getEvents().map((e) => e.action));
  for (const { action, detail } of MASS_DELIVERY_LOG_ENTRIES) {
    if (!have.has(action)) {
      appendEvent(action, detail);
    }
  }
}
