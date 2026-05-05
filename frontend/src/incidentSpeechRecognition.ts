/** Текст, если в браузере нет API распознавания или сработал сбой (демо). */
export const INCIDENT_DEMO_TRANSCRIPT =
  "Зафиксирована нештатная ситуация на площадке. Прошу задействовать план " +
  "взаимодействия и оповестить дежурных и ответственных по внутренней связи. " +
  "Требуется уточнение характера и масштаба происшествия.";

type ResultList = {
  length: number;
  [i: number]: { 0: { transcript: string } };
};

export function getSpeechRecognitionCtor():
  | (new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start(): void;
      stop(): void;
      abort(): void;
      onresult: ((ev: Event) => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
    })
  | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as unknown as {
    SpeechRecognition?: new () => unknown;
    webkitSpeechRecognition?: new () => unknown;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) {
    return null;
  }
  return Ctor as new () => never;
}

export function buildTranscriptFromResult(ev: Event): string {
  const e = ev as unknown as { results: ResultList };
  const { results } = e;
  let text = "";
  for (let i = 0; i < results.length; i += 1) {
    const part = results[i]?.[0]?.transcript;
    if (part) {
      text += part;
    }
  }
  return text;
}

/** Итог демонстрационной классификации после подтверждения аудио-описания. */
export const INCIDENT_CLASSIFICATION_DEMO = {
  /** Название классифицированной нештатной ситуации. */
  situationName:
    "Нештатная ситуация на промышленной площадке Цех №1 (инцидент производственного характера)",
  /** Формулировка «кого оповещаем». */
  notifiedParties:
    "Дежурная смена объекта; ответственный за промышленную безопасность; оперативный диспетчер участка; начальник цеха №1"
} as const;

/** Каналы в блоке результатов (как на странице массового оповещения). */
export const INCIDENT_TELEPHONY_CHANNEL_TITLE = "Телефония";
export const INCIDENT_MAX_CHANNEL_TITLE = "Корпоративный мессенджер MAX";

/** Содержимое панели «Телефония» после классификации (демо). */
export const INCIDENT_TELEPHONY_PANEL_DEMO = {
  intro:
    "Список автоматического обзвона по внутренней телефонной сети по сценарию нештатной ситуации (абоненты дежурной смены и подрядных организаций).",
  sections: [
    {
      title: "Начальник смены ЦУП (ответ на инцидент)",
      subscribers: [
        { name: "Начальник ЦУП", phone: "31-43" },
        { name: "Диспетчер ООО «ЛУКОЙЛ-Транс»", phone: "39-94" },
        { name: "Диспетчер ГСО", phone: "39-37" }
      ]
    }
  ]
} as const;

/** Секция с поочередным «Выполнено» по абонентам на экране классификации. */
export const INCIDENT_TELEPHONY_SEQUENTIAL_SECTION_TITLE =
  "Начальник смены ЦУП (ответ на инцидент)";

/** Смещение и число абонентов в секции с последовательным статусом (если секция есть в демо-данных). */
export function getIncidentTelephonySequentialSectionMeta(): {
  offset: number;
  count: number;
} | null {
  let offset = 0;
  for (const sec of INCIDENT_TELEPHONY_PANEL_DEMO.sections) {
    if (sec.title === INCIDENT_TELEPHONY_SEQUENTIAL_SECTION_TITLE) {
      return { offset, count: sec.subscribers.length };
    }
    offset += sec.subscribers.length;
  }
  return null;
}

/** Чат «Заместитель главного инженера по надёжности» в демо MAX — отдельный статус прочтения. */
export const INCIDENT_MAX_DEPUTY_RELIABILITY_CHAT =
  "Заместитель главного инженера по надежности" as const;

/** Телефония: номер строки доп. звонка после статуса «Не прочтено…» ЗамГИ в MAX (демо). */
export const INCIDENT_DEPUTY_TELEPHONY_PHONE_AFTER_MAX = "8 (909) 111-70-15";
/** Демо: «Выполняется» на строке ЗамГИ сколько миллисекунд до появления «Выполнено». */
export const INCIDENT_DEPUTY_TELEPHONY_EXEC_DURATION_MS = 10_000;
/** Демо: через столько миллисекунд после «Выполнено» показывается «Подтверждено». */
export const INCIDENT_DEPUTY_TELEPHONY_ACK_AFTER_EXEC_MS = 5_000;

/** Содержимое панели «Корпоративный мессенджер MAX» (демо). */
export const INCIDENT_MAX_PANEL_DEMO = {
  intro:
    "Список корпоративных чатов в мессенджере MAX, в которые дублируется текст оповещения после классификации (по зонам и ролям).",
  chats: [
    {
      chat: "Начальник Цеха №1",
      subtitle: "https://team.max.ru/u/object-ts1-head"
    },
    {
      chat: "Главный энергетик",
      subtitle: "https://team.max.ru/u/chief-power-engineer"
    },
    {
      chat: INCIDENT_MAX_DEPUTY_RELIABILITY_CHAT,
      subtitle: "https://team.max.ru/u/deputy-gi-reliability"
    }
  ]
} as const;
