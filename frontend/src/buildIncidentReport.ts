import type { SystemEvent } from "./eventLog";
import { formatEventTime } from "./eventLog";
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

export type IncidentScenarioKind =
  | "mass_cancel_incident"
  | "incident_voice"
  | "delivery_archive";

export type IncidentChannelBlock = {
  key: string;
  title: string;
  detail: string;
};

export type IncidentPhaseReport = {
  title: string;
  channels: IncidentChannelBlock[];
};

export type IncidentScenarioReport = {
  id: string;
  kind: IncidentScenarioKind;
  /** Заголовок карточки: дата и время начала инцидента. */
  title: string;
  /** Время начала инцидента (для сортировки). */
  startedAt: number;
  phases: IncidentPhaseReport[];
};

const LSO_CHANNEL_TITLE = "Локальная система оповещения предприятия (ЛСО)";
const LSO_DETAIL_TEXT =
  "Текст сигнала выведен в локальную систему оповещения предприятия (трансляция завершена). Дальнейшие действия:\n— активация зональных оповещателей по утверждённому плану;\n— контроль прозвучания сообщения на ключевых участках;\n— фиксация времени начала и окончания трансляции в журнале дежурной смены.";

const CHANNEL_ACTION_ORDER = [
  {
    action: "Рассылка в корпоративный мессенджер MAX",
    key: "max",
    title: "Корпоративный мессенджер MAX"
  },
  {
    action: "Рассылка SMS",
    key: "sms",
    title: "SMS"
  },
  {
    action: "Почтовая рассылка",
    key: "email",
    title: "Почтовая рассылка (E-mail)"
  },
  {
    action: "Телефонные оповещения (звонки)",
    key: "telephony",
    title: "Телефония"
  },
  {
    action: "Оповещение через ЛСО",
    key: "lso",
    title: LSO_CHANNEL_TITLE
  }
] as const;

type DeliveryAction = (typeof CHANNEL_ACTION_ORDER)[number]["action"];

type ScreenMarkerKind = "mass_bpla" | "cancel_alert" | "incident_voice";

const DELIVERY_ACTION_SET = new Set<string>(
  CHANNEL_ACTION_ORDER.map((c) => c.action)
);

const MASS_ALERT_PHASE_TITLE = "Массовое оповещение - Уровень опасности 2";

function classifyScreenMarker(ev: SystemEvent): ScreenMarkerKind | null {
  if (ev.action === "Открыт экран «Массовое оповещение»") {
    return "mass_bpla";
  }
  if (ev.action === "Открыт экран «Отмена оповещения»") {
    return "cancel_alert";
  }
  if (
    ev.action === "Открыт экран" &&
    ev.detail?.includes("Аудио-запись описания нештатной ситуации")
  ) {
    return "incident_voice";
  }
  return null;
}

function incidentCardTitle(ts: number): string {
  return `Инцидент от ${formatEventTime(ts)}`;
}

/** Шаг по часам между инцидентами в отчёте (демо); минуты и секунды задаются случайно для каждой строки. */
const DEMO_INCIDENT_STEP_HOURS = 2;

function randomMinuteSecondDemo(): { minute: number; second: number } {
  return {
    minute: Math.floor(Math.random() * 60),
    second: Math.floor(Math.random() * 60)
  };
}

function incidentDemoTimestampMs(index: number): number {
  const { minute, second } = randomMinuteSecondDemo();
  const d = new Date();
  d.setHours(8 + index * DEMO_INCIDENT_STEP_HOURS, minute, second, 0);
  return d.getTime();
}

function withSequentialIncidentTimestamps(
  reports: IncidentScenarioReport[]
): IncidentScenarioReport[] {
  if (reports.length === 0) {
    return reports;
  }
  const ordered = [...reports].sort((a, b) => a.startedAt - b.startedAt);
  return ordered.map((r, i) => {
    const ts = incidentDemoTimestampMs(i);
    return {
      ...r,
      startedAt: ts,
      title: incidentCardTitle(ts)
    };
  });
}

function fallbackDetailForChannel(action: DeliveryAction): string {
  switch (action) {
    case "Рассылка в корпоративный мессенджер MAX":
      return buildMassMaxLogDetail(getMaxChatsFlat(), MAX_TOTAL);
    case "Рассылка SMS":
      return buildMassSmsLogDetail(getSmsSubscribersFlat(), SMS_TOTAL);
    case "Почтовая рассылка":
      return buildMassEmailLogDetail(getEmailSubscribersFlat(), EMAIL_TOTAL);
    case "Телефонные оповещения (звонки)":
      return buildMassTelephonyLogDetailEnsure(
        getTelephonySubscribersFlat(),
        TELEPHONY_TOTAL
      );
    case "Оповещение через ЛСО":
      return LSO_DETAIL_TEXT;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

function mergeChannelDetailsFromSlice(slice: SystemEvent[]): Map<string, string> {
  const lastByAction = new Map<string, string>();
  for (const ev of slice) {
    if (!DELIVERY_ACTION_SET.has(ev.action)) {
      continue;
    }
    const action = ev.action as DeliveryAction;
    const text = ev.detail?.trim();
    lastByAction.set(
      action,
      text && text.length > 0 ? ev.detail! : fallbackDetailForChannel(action)
    );
  }
  return lastByAction;
}

function blocksForMassOrCancel(lastByAction: Map<string, string>): IncidentChannelBlock[] {
  return CHANNEL_ACTION_ORDER.map(({ action, key, title }) => ({
    key,
    title,
    detail: lastByAction.get(action) ?? fallbackDetailForChannel(action)
  }));
}

function blocksForIncidentVoice(): IncidentChannelBlock[] {
  return CHANNEL_ACTION_ORDER.map(({ action, key, title }) => ({
    key,
    title,
    detail: fallbackDetailForChannel(action)
  }));
}

/** Следующий маркер, закрывающий текущий инцидент: новое массовое оповещение или экран нештатной ситуации. */
function nextIncidentBoundaryMi(
  markers: readonly { idx: number; kind: ScreenMarkerKind }[],
  fromMi: number
): number {
  for (let i = fromMi + 1; i < markers.length; i++) {
    const k = markers[i].kind;
    if (k === "mass_bpla" || k === "incident_voice") {
      return i;
    }
  }
  return -1;
}

export function buildIncidentReportFromEvents(events: SystemEvent[]): IncidentScenarioReport[] {
  const asc = [...events].sort((a, b) => a.ts - b.ts);
  const markers: { idx: number; kind: ScreenMarkerKind }[] = [];

  asc.forEach((ev, idx) => {
    const kind = classifyScreenMarker(ev);
    if (kind != null) {
      markers.push({ idx, kind });
    }
  });

  const reports: IncidentScenarioReport[] = [];

  const pushArchiveIfNeeded = (slice: SystemEvent[]) => {
    const map = mergeChannelDetailsFromSlice(slice);
    if (map.size === 0) {
      return;
    }
    const firstDeliveryTs =
      slice.find((e) => DELIVERY_ACTION_SET.has(e.action))?.ts ??
      slice[0]?.ts ??
      Date.now();
    reports.push({
      id: `delivery_archive-${firstDeliveryTs}-${reports.length}`,
      kind: "delivery_archive",
      title: incidentCardTitle(firstDeliveryTs),
      startedAt: firstDeliveryTs,
      phases: [
        {
          title: "Сведения по каналам доставки",
          channels: blocksForMassOrCancel(map)
        }
      ]
    });
  };

  if (markers.length === 0) {
    pushArchiveIfNeeded(asc);
    return withSequentialIncidentTimestamps(reports);
  }

  pushArchiveIfNeeded(asc.slice(0, markers[0].idx));

  const consumedMarker = new Set<number>();

  for (let mi = 0; mi < markers.length; mi++) {
    if (consumedMarker.has(mi)) {
      continue;
    }

    const mk = markers[mi];

    if (mk.kind === "incident_voice") {
      const startTs = asc[mk.idx].ts;
      consumedMarker.add(mi);
      reports.push({
        id: `incident_voice-${startTs}-${reports.length}`,
        kind: "incident_voice",
        title: incidentCardTitle(startTs),
        startedAt: startTs,
        phases: [
          {
            title: "Рассылка по каналам после классификации (демо)",
            channels: blocksForIncidentVoice()
          }
        ]
      });
      continue;
    }

    if (mk.kind === "mass_bpla") {
      const boundaryMi = nextIncidentBoundaryMi(markers, mi);
      const endEvIdx = boundaryMi === -1 ? asc.length : markers[boundaryMi].idx;
      const startEvIdx = mk.idx;
      const startTs = asc[startEvIdx].ts;

      const cancelMis: number[] = [];
      for (let i = mi + 1; i < markers.length; i++) {
        if (boundaryMi !== -1 && i >= boundaryMi) {
          break;
        }
        if (markers[i].kind === "cancel_alert") {
          cancelMis.push(i);
        }
      }

      const phases: IncidentPhaseReport[] = [];
      if (cancelMis.length === 0) {
        phases.push({
          title: MASS_ALERT_PHASE_TITLE,
          channels: blocksForMassOrCancel(
            mergeChannelDetailsFromSlice(asc.slice(startEvIdx, endEvIdx))
          )
        });
      } else {
        const firstCancelMi = cancelMis[0];
        const cancelStartIdx = markers[firstCancelMi].idx;
        phases.push({
          title: MASS_ALERT_PHASE_TITLE,
          channels: blocksForMassOrCancel(
            mergeChannelDetailsFromSlice(asc.slice(startEvIdx, cancelStartIdx))
          )
        });
        phases.push({
          title: "Отмена оповещения",
          channels: blocksForMassOrCancel(
            mergeChannelDetailsFromSlice(asc.slice(cancelStartIdx, endEvIdx))
          )
        });
        cancelMis.forEach((i) => consumedMarker.add(i));
      }

      consumedMarker.add(mi);

      reports.push({
        id: `mass-cancel-${startTs}-${reports.length}`,
        kind: "mass_cancel_incident",
        title: incidentCardTitle(startTs),
        startedAt: startTs,
        phases
      });
      continue;
    }

    if (mk.kind === "cancel_alert") {
      const boundaryMi = nextIncidentBoundaryMi(markers, mi);
      const endEvIdx = boundaryMi === -1 ? asc.length : markers[boundaryMi].idx;
      const startEvIdx = mk.idx;
      const startTs = asc[startEvIdx].ts;
      consumedMarker.add(mi);

      reports.push({
        id: `cancel-only-${startTs}-${reports.length}`,
        kind: "mass_cancel_incident",
        title: incidentCardTitle(startTs),
        startedAt: startTs,
        phases: [
          {
            title: "Отмена оповещения",
            channels: blocksForMassOrCancel(
              mergeChannelDetailsFromSlice(asc.slice(startEvIdx, endEvIdx))
            )
          }
        ]
      });
    }
  }

  return withSequentialIncidentTimestamps(reports);
}
