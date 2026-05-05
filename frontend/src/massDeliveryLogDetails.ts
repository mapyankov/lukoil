const NL = "\n";

type MaxChatForLog = { chat: string; subtitle: string };

type TeleRow = { name: string; phone: string };
type EmailRow = { name: string; email: string };
type SmsRow = { name: string; mobile: string };

function formatAckLine(ts: number): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function buildMassMaxLogDetail(
  flat: readonly MaxChatForLog[],
  total: number
): string {
  const lines = flat.map(
    (r, i) => `${i + 1}. ${r.chat} — ${r.subtitle}`
  );
  return [
    `Сообщения доставлены по списку чатов: ${total} записей.${NL}${NL}Канал MAX — перечень:`,
    ...lines
  ].join(NL);
}

export function buildMassSmsLogDetail(flat: readonly SmsRow[], total: number): string {
  const lines = flat.map(
    (r, i) => `${i + 1}. ${r.name} — ${r.mobile}`
  );
  return [
    `SMS доставлены по списку абонентов: ${total} номеров.${NL}${NL}Перечень абонентов (мобильный):`,
    ...lines
  ].join(NL);
}

export function buildMassEmailLogDetail(flat: readonly EmailRow[], total: number): string {
  const lines = flat.map(
    (r, i) => `${i + 1}. ${r.name} — ${r.email}`
  );
  return [
    `Письма отправлены по списку адресов: ${total} адресатов.${NL}${NL}Перечень адресатов (E-mail):`,
    ...lines
  ].join(NL);
}

export function buildMassTelephonyLogDetailEnsure(
  flat: readonly TeleRow[],
  total: number
): string {
  const listLines = flat.map(
    (r, i) => `${i + 1}. ${r.name} — тел. ${r.phone}`
  );
  const specialNote =
    "По абонентам «Мастер ПОТУ» (поз. 3 в списке) и «Диспетчер ООО «ЛУКОЙЛ-Транс»» (поз. 9) в демо-сценарии сначала фиксируется «Не подтверждено», затем повторный звонок (10 с) и «Подтверждено»; отметка времени подтверждения попадает в журнал после прохождения экрана «Массовое оповещение» до конца.";
  return [
    `Озвучивание по списку абонентов завершено: ${total} вызовов.`,
    ``,
    `Перечень вызовов с внутренними/внешними номерами:`,
    ...listLines,
    ``,
    specialNote
  ].join(NL);
}

export function buildMassTelephonyLogDetailLive(
  flat: readonly TeleRow[],
  total: number,
  ackByIndex: readonly (number | null)[],
  specialIndexSet: ReadonlySet<number>
): string {
  const lines = flat.map((r, i) => {
    const ts = ackByIndex[i];
    const spec = specialIndexSet.has(i);
    if (ts == null) {
      return `${i + 1}. ${r.name} — тел. ${r.phone} — подтверждение ожидается`;
    }
    const when = formatAckLine(ts);
    const suffix = spec ? " (подтверждение после повторного дозвона)" : "";
    return `${i + 1}. ${r.name} — тел. ${r.phone} — Подтверждено: ${when}${suffix}`;
  });
  return [
    `Озвучивание по списку абонентов завершено: ${total} вызовов.${NL}${NL}Итог по вызовам и подтверждениям:`,
    ...lines
  ].join(NL);
}
