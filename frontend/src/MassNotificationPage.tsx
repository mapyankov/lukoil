import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DISPLAY_USER_NAME } from "./userDisplay";
import { appendEvent } from "./eventLog";
import UserInfoLabel from "./UserInfoLabel";
import MassAlertBpdrCancelChecklist from "./MassAlertBpdrCancelChecklist";
import MassAlertBpdrChecklist from "./MassAlertBpdrChecklist";
import {
  buildMassEmailLogDetail,
  buildMassMaxLogDetail,
  buildMassSmsLogDetail,
  buildMassTelephonyLogDetailLive
} from "./massDeliveryLogDetails";
import {
  ensureMassAlertSessionStart,
  formatElapsedHms,
  getElapsedSecondsSinceMassAlertStart
} from "./massAlertSession";

const CHANNELS: { channel: string }[] = [
  { channel: "Корпоративный мессенджер MAX" },
  { channel: "SMS" },
  { channel: "E-mail" },
  { channel: "Телефония" },
  { channel: "Локальная система оповещения предприятия (ЛСО)" }
];

const LSO_CHANNEL = "Локальная система оповещения предприятия (ЛСО)";
const TELEPHONY_CHANNEL = "Телефония";
const EMAIL_CHANNEL = "E-mail";
const SMS_CHANNEL = "SMS";
const MAX_CHANNEL = "Корпоративный мессенджер MAX";
const LSO_COMPLETE_MS = 10_000;
const CHANNEL_STATUS_STEP_MS = 3_000;
const TELEPHONY_ACK_DELAY_MS = 5_000;
const TELEPHONY_SPECIAL_RETRY_MS = 10_000;
const TELEPHONY_SPECIAL_RETRY_MSG = "Не подтверждено. Повторный звонок.";
const TELEPHONY_SUBSCRIBERS_WITH_RETRY: readonly string[] = [
  "Мастер ПОТУ",
  'Диспетчер ООО «ЛУКОЙЛ-Транс»'
];
const TELEPHONY_SPECIAL_RETRY_NAME_SET = new Set(TELEPHONY_SUBSCRIBERS_WITH_RETRY);
const TELEPHONY_ACK_PENDING = "Не подтверждено";
const TELEPHONY_ACK_OK = "Подтверждено";
const NNOS_DOMAIN = "nnos.lukoil.com";

type TelephonySubscriber = { name: string; phone: string };
type EmailSubscriber = { name: string; email: string };
type SmsSubscriber = { name: string; mobile: string };
type MaxChatRow = { chat: string; subtitle: string };

/** Список оповещения (Телефония) — поочерёдное «Выполнено» каждые 3 с при открытой панели. */
const TELEPHONY_SECTIONS: { title: string; subscribers: TelephonySubscriber[] }[] = [
  {
    title: "Начальник смены ЦУП (ПМТ)",
    subscribers: [
      { name: "Начальник смены ЦЗЛ", phone: "48-10" },
      { name: "Диспетчер ГСО", phone: "39-37" },
      { name: "Мастер ПОТУ", phone: "31-43" },
      { name: "Диспетчер ЦППС ФГБУ 3 ОФПС", phone: "39-35, 39-39" }
    ]
  },
  {
    title: "Начальник смены ЦУП (ПКК)",
    subscribers: [
      { name: "Дежурный фельдшер ООО «МЕДИС»", phone: "39-33, 8-920-050-09-35" },
      {
        name: "Начальник смены цеха оперативно-технологического управления энергоснабжением",
        phone: "39-11, 32-32"
      },
      {
        name: "Начальник смены ОДС цеха №3 теплоснабжения Кстовское ТПУ ООО «Инфраструктура ТК»",
        phone: "39-12"
      },
      { name: "Диспетчер ООО «ЭКОИН-НОРСИ»", phone: "39-13" }
    ]
  },
  {
    title: "Начальник смены ЦУП (отгрузка)",
    subscribers: [
      { name: "Диспетчер ООО «ЛУКОЙЛ-Транс»", phone: "39-94" },
      { name: "Диспетчер ООО «СГК»", phone: "37-58" },
      {
        name: "Диспетчер Центра отгрузки (ст. Зелецино)",
        phone: "32-29"
      },
      { name: "Дежурный ООО «Инфраструктура ТК»", phone: "55-29 (АСУТП), 31-90 (КИП)" },
      { name: "Дежурный пост ООО «СНЭМА-СЕРВИС»", phone: "8-902-712-54-70" }
    ]
  }
];

export const TELEPHONY_TOTAL = TELEPHONY_SECTIONS.reduce(
  (n, s) => n + s.subscribers.length,
  0
);

/** Плоские индексы абонентов с сценарием 10 с «повторного звонка» перед «Выполнено» / «Подтверждено». */
export const TELEPHONY_SPECIAL_INDEX_SET: ReadonlySet<number> = (() => {
  const set = new Set<number>();
  let offset = 0;
  for (const sec of TELEPHONY_SECTIONS) {
    sec.subscribers.forEach((sub, k) => {
      if (TELEPHONY_SPECIAL_RETRY_NAME_SET.has(sub.name)) {
        set.add(offset + k);
      }
    });
    offset += sec.subscribers.length;
  }
  return set;
})();

const TELEPHONY_SPECIAL_INDICES: number[] = [...TELEPHONY_SPECIAL_INDEX_SET].sort(
  (a, b) => a - b
);

/** Список рассылки (E-mail) — те же абоненты, адреса @nnos.lukoil.com; поочерёдно «Выполнено» каждые 3 с. */
const EMAIL_SECTIONS: { title: string; subscribers: EmailSubscriber[] }[] = [
  {
    title: "Начальник смены ЦУП (ПМТ)",
    subscribers: [
      { name: "Начальник смены ЦЗЛ", email: `czl_duty@${NNOS_DOMAIN}` },
      { name: "Диспетчер ГСО", email: `gso.dispatch@${NNOS_DOMAIN}` },
      { name: "Мастер ПОТУ", email: `potu.master@${NNOS_DOMAIN}` },
      {
        name: "Диспетчер ЦППС ФГБУ 3 ОФПС",
        email: `cpps.3ofps.a@${NNOS_DOMAIN}, cpps.3ofps.b@${NNOS_DOMAIN}`
      }
    ]
  },
  {
    title: "Начальник смены ЦУП (ПКК)",
    subscribers: [
      {
        name: "Дежурный фельдшер ООО «МЕДИС»",
        email: `medis.duty@${NNOS_DOMAIN}, medis.920alert@${NNOS_DOMAIN}`
      },
      {
        name: "Начальник смены цеха оперативно-технологического управления энергоснабжением",
        email: `otoe.shift@${NNOS_DOMAIN}, otoe.tech@${NNOS_DOMAIN}`
      },
      {
        name: "Начальник смены ОДС цеха №3 теплоснабжения Кстовское ТПУ ООО «Инфраструктура ТК»",
        email: `ods.heat.tpu@${NNOS_DOMAIN}`
      },
      { name: "Диспетчер ООО «ЭКОИН-НОРСИ»", email: `ekoin.norsi@${NNOS_DOMAIN}` }
    ]
  },
  {
    title: "Начальник смены ЦУП (отгрузка)",
    subscribers: [
      { name: "Диспетчер ООО «ЛУКОЙЛ-Транс»", email: `luks.trans@${NNOS_DOMAIN}` },
      { name: "Диспетчер ООО «СГК»", email: `sgk.dispatch@${NNOS_DOMAIN}` },
      {
        name: "Диспетчер Центра отгрузки (ст. Зелецино)",
        email: `otz.zel@${NNOS_DOMAIN}`
      },
      {
        name: "Дежурный ООО «Инфраструктура ТК»",
        email: `infra.asutp@${NNOS_DOMAIN}, infra.kip@${NNOS_DOMAIN}`
      },
      { name: "Дежурный пост ООО «СНЭМА-СЕРВИС»", email: `snema.post@${NNOS_DOMAIN}` }
    ]
  }
];

export const EMAIL_TOTAL = EMAIL_SECTIONS.reduce((n, s) => n + s.subscribers.length, 0);

/** SMS — те же абоненты, вымышленные мобильные номера; поочерёдно «Выполнено» каждые 3 с. */
const SMS_SECTIONS: { title: string; subscribers: SmsSubscriber[] }[] = [
  {
    title: "Начальник смены ЦУП (ПМТ)",
    subscribers: [
      { name: "Начальник смены ЦЗЛ", mobile: "+7 (904) 101-20-01" },
      { name: "Диспетчер ГСО", mobile: "+7 (904) 101-20-02" },
      { name: "Мастер ПОТУ", mobile: "+7 (904) 101-20-03" },
      {
        name: "Диспетчер ЦППС ФГБУ 3 ОФПС",
        mobile: "+7 (904) 101-20-04, +7 (904) 101-20-05"
      }
    ]
  },
  {
    title: "Начальник смены ЦУП (ПКК)",
    subscribers: [
      {
        name: "Дежурный фельдшер ООО «МЕДИС»",
        mobile: "+7 (920) 110-11-10, +7 (902) 220-11-20"
      },
      {
        name: "Начальник смены цеха оперативно-технологического управления энергоснабжением",
        mobile: "+7 (904) 102-30-11, +7 (904) 102-30-12"
      },
      {
        name: "Начальник смены ОДС цеха №3 теплоснабжения Кстовское ТПУ ООО «Инфраструктура ТК»",
        mobile: "+7 (905) 330-40-13"
      },
      { name: "Диспетчер ООО «ЭКОИН-НОРСИ»", mobile: "+7 (906) 440-50-14" }
    ]
  },
  {
    title: "Начальник смены ЦУП (отгрузка)",
    subscribers: [
      { name: "Диспетчер ООО «ЛУКОЙЛ-Транс»", mobile: "+7 (904) 550-60-21" },
      { name: "Диспетчер ООО «СГК»", mobile: "+7 (904) 550-60-22" },
      {
        name: "Диспетчер Центра отгрузки (ст. Зелецино)",
        mobile: "+7 (908) 660-70-23"
      },
      {
        name: "Дежурный ООО «Инфраструктура ТК»",
        mobile: "+7 (909) 770-11-24, +7 (910) 770-11-25"
      },
      { name: "Дежурный пост ООО «СНЭМА-СЕРВИС»", mobile: "+7 (902) 880-12-26" }
    ]
  }
];

export const SMS_TOTAL = SMS_SECTIONS.reduce((n, s) => n + s.subscribers.length, 0);

/** MAX — вымышленные корпоративные чаты; поочерёдно «Выполнено» каждые 3 с, как в SMS. */
const MAX_SECTIONS: { title: string; subscribers: MaxChatRow[] }[] = [
  {
    title: "Производство и диспетчеризация",
    subscribers: [
      {
        chat: "ЦУП · смена ПМТ / дежурные каналы",
        subtitle: "max://nnos/cup/pmt-duty · 118 подписчиков"
      },
      {
        chat: "Координация ГСО и ПОТУ",
        subtitle: "max://nnos/ops/gso-potu · закрытый"
      },
      {
        chat: "ФГБУ 3 ОФПС — ЦППС (обмен)",
        subtitle: "max://ext/cpps-3ofps · служебный"
      },
      {
        chat: "ПКК · коксохим, суточный наряд",
        subtitle: "max://nnos/pkk/daily · 64 подписчика"
      }
    ]
  },
  {
    title: "Техника, энергетика, подрядчики",
    subscribers: [
      {
        chat: "ОТОЭ · энергоснабжение, смены",
        subtitle: "max://nnos/otoe/shift · приоритетный"
      },
      {
        chat: "ОДС-3 / Кстовское ТПУ · теплосети",
        subtitle: "max://nnos/ods-heat/kstovo-tpu"
      },
      {
        chat: "ЭКОИН-НОРСИ · диспетчерская линия",
        subtitle: "max://partner/ekoin-norsi/disp"
      },
      {
        chat: "Инфраструктура ТК · КИП и АСУ ТП",
        subtitle: "max://nnos/infra/kip-asutp · 2 ответственных"
      }
    ]
  },
  {
    title: "Логистика и внешние службы",
    subscribers: [
      {
        chat: "ЛУКОЙЛ-Транс · отгрузка сутки",
        subtitle: "max://nnos/lukoils-trans/day"
      },
      {
        chat: "СГК · тепло и сбросы (оперативка)",
        subtitle: "max://partner/sgk/ops"
      },
      {
        chat: "Центр отгрузки · ст. Зелецино",
        subtitle: "max://nnos/otz/zel · мобильная группа"
      },
      {
        chat: "СНЭМА-СЕРВИС · пост охраны периметра",
        subtitle: "max://contractor/snema/post-1"
      },
      {
        chat: "Техобъекты · операторная (сводка)",
        subtitle: "max://nnos/tech-obj/operator · круглосуточно"
      }
    ]
  }
];

export const MAX_TOTAL = MAX_SECTIONS.reduce((n, s) => n + s.subscribers.length, 0);

export function getTelephonySubscribersFlat() {
  return TELEPHONY_SECTIONS.flatMap((s) => s.subscribers);
}
export function getEmailSubscribersFlat() {
  return EMAIL_SECTIONS.flatMap((s) => s.subscribers);
}
export function getSmsSubscribersFlat() {
  return SMS_SECTIONS.flatMap((s) => s.subscribers);
}
export function getMaxChatsFlat() {
  return MAX_SECTIONS.flatMap((s) => s.subscribers);
}

const LSO_ALERT_TITLE = "ВНИМАНИЕ ВСЕМ";
const LSO_ALERT_TEXT =
  "ВНИМАНИЕ. УГРОЗА ПРИМЕНЕНИЯ БПЛА. ВСЕМУ ПЕРСОНАЛУ УКРЫТЬСЯ В БЛИЖАЙШИХ ЗАЩИТНЫХ СООРУЖЕНИЯХ ИЛИ ПОКИНУТЬ ТЕРРИТОРИЮ ПРЕДПРИЯТИЯ.";
const LSO_CANCEL_TEXT = "ВНИМАНИЕ. ОТБОЙ УГРОЗЫ ПРИМЕНЕНИЯ БПЛА";
const STATUS_IN_PROGRESS = "Выполняется";
const STATUS_DONE = "Выполнено";

export function formatTelephonyAckDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function AccordionPictogram() {
  return (
    <span className="mass-accordion__icon" aria-hidden>
      <svg
        className="mass-accordion__icon-svg"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="1.5"
          y="1.5"
          width="21"
          height="21"
          rx="4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="rgba(196, 20, 42, 0.06)"
        />
        <path
          d="M8.5 5.2L16 12L8.5 18.8"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export type MassNotificationPageProps = {
  pageVariant?: "mass" | "cancel";
};

type MassAlertLocationState = { dangerLevel?: unknown };

function parseDangerLevelFromLocation(state: unknown): 1 | 2 | 3 | 4 {
  const raw =
    state &&
    typeof state === "object" &&
    "dangerLevel" in state &&
    (state as MassAlertLocationState).dangerLevel !== undefined
      ? (state as MassAlertLocationState).dangerLevel
      : undefined;
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : NaN;
  if (n === 1 || n === 2 || n === 3 || n === 4) {
    return n;
  }
  return 2;
}

export default function MassNotificationPage({
  pageVariant = "mass"
}: MassNotificationPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isCancel = pageVariant === "cancel";
  const dangerLevel = isCancel ? 2 : parseDangerLevelFromLocation(location.state);
  const [lsoCompleted, setLsoCompleted] = useState(false);
  const [openChannel, setOpenChannel] = useState<string | null>(null);
  const [telephonyDoneCount, setTelephonyDoneCount] = useState(0);
  const [emailDoneCount, setEmailDoneCount] = useState(0);
  const [smsDoneCount, setSmsDoneCount] = useState(0);
  const [maxDoneCount, setMaxDoneCount] = useState(0);
  const [sessionStartMs] = useState(() => ensureMassAlertSessionStart());
  const [elapsedSec, setElapsedSec] = useState(() =>
    getElapsedSecondsSinceMassAlertStart(sessionStartMs)
  );
  const [telephonyAckByIndex, setTelephonyAckByIndex] = useState<(number | null)[]>(
    () => Array(TELEPHONY_TOTAL).fill(null)
  );
  const [telephonyRetryComplete, setTelephonyRetryComplete] = useState<boolean[]>(() =>
    Array(TELEPHONY_TOTAL).fill(false)
  );
  const telephonyAckTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const listUid = useId();

  useEffect(() => {
    appendEvent(
      isCancel
        ? "Открыт экран «Отмена оповещения»"
        : "Открыт экран «Массовое оповещение»"
    );
  }, [isCancel]);

  useEffect(() => {
    const tick = () => {
      setElapsedSec(getElapsedSecondsSinceMassAlertStart(sessionStartMs));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sessionStartMs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLsoCompleted(true);
    }, LSO_COMPLETE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  /** Прогресс по каналам — в фоне с момента открытия страницы, не привязан к раскрытию аккордеона. */
  useEffect(() => {
    if (telephonyDoneCount >= TELEPHONY_TOTAL) {
      return;
    }
    const waitRetry = TELEPHONY_SPECIAL_INDICES.some(
      (idx) => telephonyDoneCount === idx + 1 && !telephonyRetryComplete[idx]
    );
    if (waitRetry) {
      return;
    }
    const t = window.setTimeout(() => {
      setTelephonyDoneCount((c) => Math.min(c + 1, TELEPHONY_TOTAL));
    }, CHANNEL_STATUS_STEP_MS);
    return () => window.clearTimeout(t);
  }, [telephonyDoneCount, telephonyRetryComplete]);

  /** Подтверждения по телефонии (кроме абонентов со сценарием 10 с повторного звонка). */
  useEffect(() => {
    if (telephonyDoneCount < 1) {
      return;
    }
    const completedIndex = telephonyDoneCount - 1;
    if (TELEPHONY_SPECIAL_INDEX_SET.has(completedIndex)) {
      return;
    }
    const id = window.setTimeout(() => {
      setTelephonyAckByIndex((prev) => {
        if (prev[completedIndex] != null) {
          return prev;
        }
        const next = [...prev];
        next[completedIndex] = Date.now();
        return next;
      });
    }, TELEPHONY_ACK_DELAY_MS);
    telephonyAckTimeoutsRef.current.push(id);
  }, [telephonyDoneCount]);

  /** Абоненты из списка: при count = idx+1 — 10 с «Выполняется» + повторный звонок, затем «Выполнено» + «Подтверждено». */
  useEffect(() => {
    if (TELEPHONY_SPECIAL_INDICES.length === 0) {
      return;
    }
    let id: ReturnType<typeof setTimeout> | undefined;
    for (const s of TELEPHONY_SPECIAL_INDICES) {
      if (telephonyDoneCount !== s + 1) {
        continue;
      }
      if (telephonyRetryComplete[s]) {
        continue;
      }
      id = window.setTimeout(() => {
        setTelephonyRetryComplete((prev) => {
          if (prev[s]) {
            return prev;
          }
          const next = [...prev];
          next[s] = true;
          return next;
        });
        setTelephonyAckByIndex((prev) => {
          if (prev[s] != null) {
            return prev;
          }
          const next = [...prev];
          next[s] = Date.now();
          return next;
        });
      }, TELEPHONY_SPECIAL_RETRY_MS);
      telephonyAckTimeoutsRef.current.push(id);
      break;
    }
    return () => {
      if (id !== undefined) {
        window.clearTimeout(id);
      }
    };
  }, [telephonyDoneCount, telephonyRetryComplete]);

  useEffect(() => {
    const ids = telephonyAckTimeoutsRef.current;
    return () => {
      ids.forEach((t) => clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (emailDoneCount >= EMAIL_TOTAL) {
      return;
    }
    const t = window.setTimeout(() => {
      setEmailDoneCount((c) => Math.min(c + 1, EMAIL_TOTAL));
    }, CHANNEL_STATUS_STEP_MS);
    return () => window.clearTimeout(t);
  }, [emailDoneCount]);

  useEffect(() => {
    if (smsDoneCount >= SMS_TOTAL) {
      return;
    }
    const t = window.setTimeout(() => {
      setSmsDoneCount((c) => Math.min(c + 1, SMS_TOTAL));
    }, CHANNEL_STATUS_STEP_MS);
    return () => window.clearTimeout(t);
  }, [smsDoneCount]);

  useEffect(() => {
    if (maxDoneCount >= MAX_TOTAL) {
      return;
    }
    const t = window.setTimeout(() => {
      setMaxDoneCount((c) => Math.min(c + 1, MAX_TOTAL));
    }, CHANNEL_STATUS_STEP_MS);
    return () => window.clearTimeout(t);
  }, [maxDoneCount]);

  const channelLogRef = useRef({
    lso: false,
    max: false,
    sms: false,
    email: false,
    telephony: false
  });

  useEffect(() => {
    if (isCancel || !lsoCompleted || channelLogRef.current.lso) {
      return;
    }
    channelLogRef.current.lso = true;
    appendEvent(
      "Оповещение через ЛСО",
      "Текст сигнала выведен в локальную систему оповещения предприятия (трансляция завершена)."
    );
  }, [isCancel, lsoCompleted]);

  useEffect(() => {
    if (isCancel || maxDoneCount < MAX_TOTAL || channelLogRef.current.max) {
      return;
    }
    channelLogRef.current.max = true;
    appendEvent(
      "Рассылка в корпоративный мессенджер MAX",
      buildMassMaxLogDetail(getMaxChatsFlat(), MAX_TOTAL)
    );
  }, [isCancel, maxDoneCount]);

  useEffect(() => {
    if (isCancel || smsDoneCount < SMS_TOTAL || channelLogRef.current.sms) {
      return;
    }
    channelLogRef.current.sms = true;
    appendEvent("Рассылка SMS", buildMassSmsLogDetail(getSmsSubscribersFlat(), SMS_TOTAL));
  }, [isCancel, smsDoneCount]);

  useEffect(() => {
    if (isCancel || emailDoneCount < EMAIL_TOTAL || channelLogRef.current.email) {
      return;
    }
    channelLogRef.current.email = true;
    appendEvent(
      "Почтовая рассылка",
      buildMassEmailLogDetail(getEmailSubscribersFlat(), EMAIL_TOTAL)
    );
  }, [isCancel, emailDoneCount]);

  useEffect(() => {
    if (isCancel || telephonyDoneCount < TELEPHONY_TOTAL || channelLogRef.current.telephony) {
      return;
    }
    if (!telephonyAckByIndex.every((t) => t != null)) {
      return;
    }
    channelLogRef.current.telephony = true;
    appendEvent(
      "Телефонные оповещения (звонки)",
      buildMassTelephonyLogDetailLive(
        getTelephonySubscribersFlat(),
        TELEPHONY_TOTAL,
        telephonyAckByIndex,
        TELEPHONY_SPECIAL_INDEX_SET
      )
    );
  }, [isCancel, telephonyDoneCount, telephonyAckByIndex]);

  const toggleChannel = (channel: string) => {
    setOpenChannel((prev) => {
      const next = prev === channel ? null : channel;
      if (next) {
        appendEvent("Канал доставки оповещения", `Раскрыт: ${next}`);
      } else if (prev) {
        appendEvent("Канал доставки оповещения", `Скрыт: ${prev}`);
      }
      return next;
    });
  };

  const telephonyConfirmedCount = telephonyAckByIndex.filter((t) => t != null).length;

  return (
    <div className={`app-shell mass-page${isCancel ? " mass-page--cancel" : ""}`}>
      <header className="hero">
        <div className="hero__head">
          <div className="hero__brand-wrap">
            <img src="/logo.jpg" alt="Логотип ЛУКОЙЛ" className="hero__logo" />
          </div>
          <div className="user-info" aria-label="Текущий пользователь">
            <div className="user-info__inner">
              <div className="user-info__text">
                <UserInfoLabel />
                <span className="user-info__name">{DISPLAY_USER_NAME}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="hero__title-row">
          <h1>{isCancel ? "Отмена оповещения" : "Массовое оповещение"}</h1>
        </div>
        <div className="hero__timer-row">
          <p
            className="mass-page-timer"
            role="timer"
            aria-live="polite"
            aria-label={`Прошло времени: ${formatElapsedHms(elapsedSec)}`}
          >
            <span className="mass-page-timer__label">Прошло времени</span>
            <time className="mass-page-timer__value" dateTime={`PT${elapsedSec}S`}>
              {formatElapsedHms(elapsedSec)}
            </time>
          </p>
          {isCancel && (
            <button
              type="button"
              className="hero__report-btn"
              onClick={() => {
                appendEvent("Навигация", "Журнал событий");
                navigate("/event-log");
              }}
            >
              Журнал событий
            </button>
          )}
          {!isCancel && (
            <p className="danger-level" role="status">
              Уровень опасности {dangerLevel}
            </p>
          )}
        </div>
        <div className="hero__subtitle-row">
          <p className="hero__subtitle">
            {isCancel
              ? "Статусы рассылки оповещений по каналам доставки (отмена оповещения)"
              : "Статусы по каналам доставки оповещения."}
          </p>
          {isCancel ? (
            <button
              type="button"
              className="mass-danger-level-btn"
              onClick={() => {
                appendEvent(
                  "Навигация",
                  "Корпоративный центр оперативного оповещения"
                );
                navigate("/");
              }}
              aria-label="Перейти в корпоративный центр оперативного оповещения"
            >
              На главную страницу
            </button>
          ) : (
            <button
              type="button"
              className="mass-danger-level-btn"
              onClick={() => {
                appendEvent("Навигация", "Изменение уровня опасности");
                navigate("/change-danger-level");
              }}
            >
              Изменить уровень опасности
            </button>
          )}
        </div>
      </header>

      <main className="content mass-content mass-content--with-checklist">
        <section className="mass-status-list" aria-label="Статусы оповещений">
          {CHANNELS.map(({ channel }, index) => {
            const isLso = channel === LSO_CHANNEL;
            const isTelephony = channel === TELEPHONY_CHANNEL;
            const isEmail = channel === EMAIL_CHANNEL;
            const isSms = channel === SMS_CHANNEL;
            const isMax = channel === MAX_CHANNEL;
            const showLsoDone = isLso && lsoCompleted;
            const showTelephonyChannelDone =
              isTelephony && telephonyDoneCount >= TELEPHONY_TOTAL;
            const showEmailChannelDone = isEmail && emailDoneCount >= EMAIL_TOTAL;
            const showSmsChannelDone = isSms && smsDoneCount >= SMS_TOTAL;
            const showMaxChannelDone = isMax && maxDoneCount >= MAX_TOTAL;
            const showHeaderDone =
              showLsoDone ||
              showTelephonyChannelDone ||
              showEmailChannelDone ||
              showSmsChannelDone ||
              showMaxChannelDone;
            const isOpen = openChannel === channel;
            const panelId = `${listUid}-panel-${index}`;
            const headerId = `${listUid}-header-${index}`;

            return (
              <div
                key={channel}
                className={`mass-accordion${isOpen ? " mass-accordion--open" : ""}`}
                style={{ ["--i" as string]: index }}
              >
                <div className="mass-accordion__head">
                  <button
                    type="button"
                    id={headerId}
                    className="mass-accordion__trigger"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleChannel(channel)}
                  >
                    <AccordionPictogram />
                    <span className="mass-accordion__title">{channel}</span>
                    <span
                      className={
                        isTelephony
                          ? "mass-accordion__right mass-accordion__right--telephony"
                          : "mass-accordion__right"
                      }
                    >
                      {isTelephony ? (
                        <span className="mass-accordion__telephony-inline">
                          <span
                            className="mass-accordion__call-tally"
                            role="status"
                            aria-live="polite"
                            aria-label={`Подтверждено соединений: ${telephonyConfirmedCount} из ${TELEPHONY_TOTAL}`}
                          >
                            <span className="mass-accordion__call-tally-text">
                              Подтверждено:{" "}
                              <span className="mass-accordion__call-tally-num">
                                {telephonyConfirmedCount}/{TELEPHONY_TOTAL}
                              </span>
                            </span>
                          </span>
                          {showHeaderDone ? (
                            <span
                              className="mass-status-item__value mass-status-item__value--ok mass-status-item__value--in-trigger"
                              role="status"
                              aria-label={`${channel}: ${STATUS_DONE}`}
                            >
                              {STATUS_DONE}
                            </span>
                          ) : (
                            <span
                              className="mass-status-item__value mass-status-item__value--progress mass-status-item__value--in-trigger"
                              role="status"
                              aria-label={`${channel}: ${STATUS_IN_PROGRESS}`}
                            >
                              <span className="mass-status-item__value-row">
                                <span className="mass-status-spinner" aria-hidden />
                                <span className="mass-status-item__label-text">
                                  {STATUS_IN_PROGRESS}
                                </span>
                              </span>
                              <span className="mass-status-item__bar" aria-hidden>
                                <span className="mass-status-item__bar-fill" />
                              </span>
                            </span>
                          )}
                        </span>
                      ) : showHeaderDone ? (
                        <span
                          className="mass-status-item__value mass-status-item__value--ok mass-status-item__value--in-trigger"
                          role="status"
                          aria-label={`${channel}: ${STATUS_DONE}`}
                        >
                          {STATUS_DONE}
                        </span>
                      ) : (
                        <span
                          className="mass-status-item__value mass-status-item__value--progress mass-status-item__value--in-trigger"
                          role="status"
                          aria-label={`${channel}: ${STATUS_IN_PROGRESS}`}
                          >
                          <span className="mass-status-item__value-row">
                            <span className="mass-status-spinner" aria-hidden />
                            <span className="mass-status-item__label-text">
                              {STATUS_IN_PROGRESS}
                            </span>
                          </span>
                          <span className="mass-status-item__bar" aria-hidden>
                            <span className="mass-status-item__bar-fill" />
                          </span>
                        </span>
                      )}
                    </span>
                  </button>
                </div>

                <div
                  id={panelId}
                  className="mass-accordion__panel"
                  role="region"
                  aria-labelledby={headerId}
                  aria-hidden={!isOpen}
                >
                  <div className="mass-accordion__panel-inner">
                    {isLso ? (
                      <div className="mass-lso-body">
                        <h2 className="mass-lso-body__title">{LSO_ALERT_TITLE}</h2>
                        <p className="mass-lso-body__text">
                          {isCancel ? LSO_CANCEL_TEXT : LSO_ALERT_TEXT}
                        </p>
                      </div>
                    ) : isMax ? (
                      <div className="mass-telephony mass-telephony--max">
                        <p className="mass-telephony__intro">
                          Список корпоративных чатов в мессенджере MAX, в которые
                          дублируется текст оповещения начальниками смен ЦУП (по зонам и
                          ролям).
                        </p>
                        {MAX_SECTIONS.map((section, sectionIdx) => {
                          const offset = MAX_SECTIONS.slice(0, sectionIdx).reduce(
                            (a, s) => a + s.subscribers.length,
                            0
                          );
                          return (
                            <div key={section.title} className="mass-telephony__section">
                              <h3 className="mass-telephony__section-title">
                                {section.title}
                              </h3>
                              <ul className="mass-telephony__list" role="list">
                                {section.subscribers.map((sub, j) => {
                                  const globalIndex = offset + j;
                                  const lineDone = globalIndex < maxDoneCount;
                                  const { chat, subtitle } = sub;
                                  return (
                                    <li
                                      key={`${section.title}-max-${j}-${chat.slice(0, 24)}`}
                                      className="mass-telephony__row"
                                      style={{ ["--i" as string]: globalIndex }}
                                    >
                                      <span className="mass-telephony__row-num">
                                        {globalIndex + 1}
                                      </span>
                                      <div className="mass-telephony__row-main">
                                        <span className="mass-telephony__row-name">
                                          {chat}
                                        </span>
                                        <span className="mass-telephony__row-phone mass-telephony__row-max">
                                          {subtitle}
                                        </span>
                                      </div>
                                      {lineDone ? (
                                        <span
                                          className="mass-status-item__value mass-status-item__value--ok mass-telephony__row-status"
                                          role="status"
                                        >
                                          {STATUS_DONE}
                                        </span>
                                      ) : (
                                        <span
                                          className="mass-status-item__value mass-status-item__value--progress mass-telephony__row-status mass-telephony__row-status--active"
                                          role="status"
                                        >
                                          <span className="mass-status-item__value-row">
                                            <span
                                              className="mass-status-spinner"
                                              aria-hidden
                                            />
                                            <span className="mass-status-item__label-text">
                                              {STATUS_IN_PROGRESS}
                                            </span>
                                          </span>
                                          <span
                                            className="mass-status-item__bar"
                                            aria-hidden
                                          >
                                            <span className="mass-status-item__bar-fill" />
                                          </span>
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    ) : isSms ? (
                      <div className="mass-telephony mass-telephony--sms">
                        <p className="mass-telephony__intro">
                          Список SMS-рассылки дежурного (сменного) персонала предприятия
                          и сервисных организаций по мобильным номерам начальниками смен
                          ЦУП.
                        </p>
                        {SMS_SECTIONS.map((section, sectionIdx) => {
                          const offset = SMS_SECTIONS.slice(0, sectionIdx).reduce(
                            (a, s) => a + s.subscribers.length,
                            0
                          );
                          return (
                            <div key={section.title} className="mass-telephony__section">
                              <h3 className="mass-telephony__section-title">
                                {section.title}
                              </h3>
                              <ul className="mass-telephony__list" role="list">
                                {section.subscribers.map((sub, j) => {
                                  const globalIndex = offset + j;
                                  const lineDone = globalIndex < smsDoneCount;
                                  const { name, mobile } = sub;
                                  return (
                                    <li
                                      key={`${section.title}-sms-${j}-${name.slice(0, 20)}`}
                                      className="mass-telephony__row"
                                      style={{ ["--i" as string]: globalIndex }}
                                    >
                                      <span className="mass-telephony__row-num">
                                        {globalIndex + 1}
                                      </span>
                                      <div className="mass-telephony__row-main">
                                        <span className="mass-telephony__row-name">
                                          {name}
                                        </span>
                                        <span className="mass-telephony__row-phone mass-telephony__row-sms">
                                          {mobile}
                                        </span>
                                      </div>
                                      {lineDone ? (
                                        <span
                                          className="mass-status-item__value mass-status-item__value--ok mass-telephony__row-status"
                                          role="status"
                                        >
                                          {STATUS_DONE}
                                        </span>
                                      ) : (
                                        <span
                                          className="mass-status-item__value mass-status-item__value--progress mass-telephony__row-status mass-telephony__row-status--active"
                                          role="status"
                                        >
                                          <span className="mass-status-item__value-row">
                                            <span
                                              className="mass-status-spinner"
                                              aria-hidden
                                            />
                                            <span className="mass-status-item__label-text">
                                              {STATUS_IN_PROGRESS}
                                            </span>
                                          </span>
                                          <span
                                            className="mass-status-item__bar"
                                            aria-hidden
                                          >
                                            <span className="mass-status-item__bar-fill" />
                                          </span>
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    ) : isTelephony ? (
                      <div className="mass-telephony mass-telephony--ack">
                        <p className="mass-telephony__intro">
                          Список оповещения дежурного (сменного) персонала предприятия и
                          сервисных организаций начальниками смен ЦУП.
                        </p>
                        {TELEPHONY_SECTIONS.map((section, sectionIdx) => {
                          const offset = TELEPHONY_SECTIONS.slice(0, sectionIdx).reduce(
                            (a, s) => a + s.subscribers.length,
                            0
                          );
                          return (
                            <div key={section.title} className="mass-telephony__section">
                              <h3 className="mass-telephony__section-title">
                                {section.title}
                              </h3>
                              <ul className="mass-telephony__list" role="list">
                                {section.subscribers.map((sub, j) => {
                                  const globalIndex = offset + j;
                                  const isSpecialRetry = TELEPHONY_SPECIAL_INDEX_SET.has(
                                    globalIndex
                                  );
                                  const lineDone = isSpecialRetry
                                    ? telephonyDoneCount > globalIndex &&
                                      telephonyRetryComplete[globalIndex]
                                    : globalIndex < telephonyDoneCount;
                                  const { name, phone } = sub;
                                  const ackAt = telephonyAckByIndex[globalIndex] ?? null;
                                  const showSpecialRetry =
                                    isSpecialRetry &&
                                    telephonyDoneCount > globalIndex &&
                                    !telephonyRetryComplete[globalIndex];
                                  const ackClass =
                                    ackAt != null
                                      ? "mass-telephony__row-ack mass-telephony__row-ack--ok"
                                      : showSpecialRetry
                                        ? "mass-telephony__row-ack mass-telephony__row-ack--retry"
                                        : "mass-telephony__row-ack";
                                  const ackLabel =
                                    ackAt != null
                                      ? `${TELEPHONY_ACK_OK}, ${formatTelephonyAckDateTime(ackAt)}`
                                      : showSpecialRetry
                                        ? TELEPHONY_SPECIAL_RETRY_MSG
                                        : TELEPHONY_ACK_PENDING;
                                  return (
                                    <li
                                      key={`${section.title}-${j}-${name.slice(0, 20)}`}
                                      className="mass-telephony__row mass-telephony__row--ack"
                                      style={{ ["--i" as string]: globalIndex }}
                                    >
                                      <span className="mass-telephony__row-num">
                                        {globalIndex + 1}
                                      </span>
                                      <div className="mass-telephony__row-main">
                                        <span className="mass-telephony__row-name">
                                          {name}
                                        </span>
                                        <span className="mass-telephony__row-phone">
                                          {phone}
                                        </span>
                                      </div>
                                      <span className={ackClass} role="status" aria-label={ackLabel}>
                                        {ackAt != null ? (
                                          <>
                                            <span className="mass-telephony__row-ack-line">
                                              {TELEPHONY_ACK_OK}
                                            </span>
                                            <time
                                              className="mass-telephony__row-ack-time"
                                              dateTime={new Date(ackAt).toISOString()}
                                            >
                                              {formatTelephonyAckDateTime(ackAt)}
                                            </time>
                                          </>
                                        ) : showSpecialRetry ? (
                                          <span className="mass-telephony__row-ack-line">
                                            {TELEPHONY_SPECIAL_RETRY_MSG}
                                          </span>
                                        ) : (
                                          TELEPHONY_ACK_PENDING
                                        )}
                                      </span>
                                      {lineDone ? (
                                        <span
                                          className="mass-status-item__value mass-status-item__value--ok mass-telephony__row-status"
                                          role="status"
                                        >
                                          {STATUS_DONE}
                                        </span>
                                      ) : (
                                        <span
                                          className="mass-status-item__value mass-status-item__value--progress mass-telephony__row-status mass-telephony__row-status--active"
                                          role="status"
                                        >
                                          <span className="mass-status-item__value-row">
                                            <span
                                              className="mass-status-spinner"
                                              aria-hidden
                                            />
                                            <span className="mass-status-item__label-text">
                                              {STATUS_IN_PROGRESS}
                                            </span>
                                          </span>
                                          <span
                                            className="mass-status-item__bar"
                                            aria-hidden
                                          >
                                            <span className="mass-status-item__bar-fill" />
                                          </span>
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    ) : isEmail ? (
                      <div className="mass-telephony mass-telephony--email">
                        <p className="mass-telephony__intro">
                          Список рассылки дежурного (сменного) персонала предприятия и
                          сервисных организаций по электронной почте (домен {NNOS_DOMAIN}
                          ) начальниками смен ЦУП.
                        </p>
                        {EMAIL_SECTIONS.map((section, sectionIdx) => {
                          const offset = EMAIL_SECTIONS.slice(0, sectionIdx).reduce(
                            (a, s) => a + s.subscribers.length,
                            0
                          );
                          return (
                            <div key={section.title} className="mass-telephony__section">
                              <h3 className="mass-telephony__section-title">
                                {section.title}
                              </h3>
                              <ul className="mass-telephony__list" role="list">
                                {section.subscribers.map((sub, j) => {
                                  const globalIndex = offset + j;
                                  const lineDone = globalIndex < emailDoneCount;
                                  const { name, email: emailAddr } = sub;
                                  return (
                                    <li
                                      key={`${section.title}-email-${j}-${name.slice(0, 20)}`}
                                      className="mass-telephony__row"
                                      style={{ ["--i" as string]: globalIndex }}
                                    >
                                      <span className="mass-telephony__row-num">
                                        {globalIndex + 1}
                                      </span>
                                      <div className="mass-telephony__row-main">
                                        <span className="mass-telephony__row-name">
                                          {name}
                                        </span>
                                        <span className="mass-telephony__row-phone mass-telephony__row-email">
                                          {emailAddr}
                                        </span>
                                      </div>
                                      {lineDone ? (
                                        <span
                                          className="mass-status-item__value mass-status-item__value--ok mass-telephony__row-status"
                                          role="status"
                                        >
                                          {STATUS_DONE}
                                        </span>
                                      ) : (
                                        <span
                                          className="mass-status-item__value mass-status-item__value--progress mass-telephony__row-status mass-telephony__row-status--active"
                                          role="status"
                                        >
                                          <span className="mass-status-item__value-row">
                                            <span
                                              className="mass-status-spinner"
                                              aria-hidden
                                            />
                                            <span className="mass-status-item__label-text">
                                              {STATUS_IN_PROGRESS}
                                            </span>
                                          </span>
                                          <span
                                            className="mass-status-item__bar"
                                            aria-hidden
                                          >
                                            <span className="mass-status-item__bar-fill" />
                                          </span>
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mass-accordion__hint">
                        Текст уведомления передаётся в канал доставки. Полный сценарий
                        сообщения для сотрудников — в разделе «{LSO_CHANNEL}».
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
        {isCancel ? <MassAlertBpdrCancelChecklist /> : <MassAlertBpdrChecklist />}
      </main>
    </div>
  );
}
