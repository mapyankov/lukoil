import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useNavigate } from "react-router-dom";
import { appendEvent } from "./eventLog";
import {
  DISPLAY_USER_NAME,
  getCurrentUserForEventLog
} from "./userDisplay";
import {
  buildTranscriptFromResult,
  getIncidentTelephonySequentialSectionMeta,
  getSpeechRecognitionCtor,
  INCIDENT_CLASSIFICATION_DEMO,
  INCIDENT_DEMO_TRANSCRIPT,
  INCIDENT_MAX_CHANNEL_TITLE,
  INCIDENT_MAX_DEPUTY_RELIABILITY_CHAT,
  INCIDENT_DEPUTY_TELEPHONY_ACK_AFTER_EXEC_MS,
  INCIDENT_DEPUTY_TELEPHONY_EXEC_DURATION_MS,
  INCIDENT_DEPUTY_TELEPHONY_PHONE_AFTER_MAX,
  INCIDENT_MAX_PANEL_DEMO,
  INCIDENT_TELEPHONY_CHANNEL_TITLE,
  INCIDENT_TELEPHONY_PANEL_DEMO,
  INCIDENT_TELEPHONY_SEQUENTIAL_SECTION_TITLE
} from "./incidentSpeechRecognition";
import UserInfoActions from "./UserInfoActions";
import UserInfoLabel from "./UserInfoLabel";
import { formatElapsedHms } from "./massAlertSession";
import { formatTelephonyAckDateTime } from "./MassNotificationPage";

function pickMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4"
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return "";
}

const INCIDENT_NOTIFICATION_CHANNELS = [
  { title: INCIDENT_TELEPHONY_CHANNEL_TITLE, kind: "telephony" as const },
  { title: INCIDENT_MAX_CHANNEL_TITLE, kind: "max" as const }
] as const;

const INCIDENT_CHANNEL_STATUS_DONE = "Выполнено";
const INCIDENT_CHANNEL_STATUS_PROGRESS = "Выполняется";
const NOTIFY_CHANNELS_PROGRESS_MS = 5_000;
const TELEPHONY_ACK_OK = "Подтверждено";
const TELEPHONY_ACK_PENDING = "Не подтверждено";
const MAX_READ_OK = "Прочтено";
const MAX_READ_PENDING = "Не прочитано";
/** Статус для чата ЗамГИ по надёжности (без даты/времени). */
const MAX_READ_DEPUTY_RELIABILITY_STATUS =
  "Не прочтено в течение 10 минут.";
/** Показ статуса ЗамГИ по надёжности в MAX — через столько миллисекунд после классификации. */
const MAX_DEPUTY_RELIABILITY_STATUS_AFTER_MS = 60_000;
const MAX_READ_STEP_MS = 7_000;

const INCIDENT_MAX_DEPUTY_RELIABILITY_ROW_INDEX =
  INCIDENT_MAX_PANEL_DEMO.chats.findIndex(
    (c) => c.chat === INCIDENT_MAX_DEPUTY_RELIABILITY_CHAT
  );

/** Случайная перестановка индексов от 0 до n−1 (тасование Фишера–Йейтса). */
function shuffleIncidentIndices(count: number): number[] {
  const indices = [...Array(count).keys()];
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = indices[i];
    indices[i] = indices[j]!;
    indices[j] = t!;
  }
  return indices;
}

/** Пиктограмма как на странице массового оповещения. */
function IncidentAccordionPictogram() {
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

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: Event) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

const RECOGNITION_MIN_MS = 1500;
const CLASSIFICATION_DURATION_MS = 10_000;

type PostConfirmPhase = null | "classifying" | "complete";

type IncidentAudioRecordPageProps = {
  onLogout: () => void;
};

export default function IncidentAudioRecordPage({
  onLogout
}: IncidentAudioRecordPageProps) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordMime, setRecordMime] = useState<string>("");
  const [voiceNotRecognized, setVoiceNotRecognized] = useState(false);
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [postConfirmPhase, setPostConfirmPhase] =
    useState<PostConfirmPhase>(null);
  const incidentNotifyListUid = useId();
  const [openIncidentChannel, setOpenIncidentChannel] = useState<string | null>(
    null
  );
  const [notifyChannelsDeliveredDone, setNotifyChannelsDeliveredDone] =
    useState(false);
  const [incidentTelephonySequentialDoneCount, setIncidentTelephonySequentialDoneCount] =
    useState(0);
  const [classificationShownAtMs, setClassificationShownAtMs] = useState<
    number | null
  >(null);
  const [maxReadShuffleOrder, setMaxReadShuffleOrder] = useState<number[] | null>(
    null
  );
  const [maxReadDoneIndices, setMaxReadDoneIndices] = useState<ReadonlySet<number>>(
    () => new Set()
  );
  const [
    deputyReliabilityMaxStatusVisible,
    setDeputyReliabilityMaxStatusVisible
  ] = useState(false);
  const [incidentDeputyTelExecDone, setIncidentDeputyTelExecDone] =
    useState(false);
  const [incidentDeputyTelAckAtMs, setIncidentDeputyTelAckAtMs] = useState<
    number | null
  >(null);
  const [incidentPageStartMs] = useState(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const classificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedUrlRef = useRef<string | null>(null);
  const speechRef = useRef<SpeechRec | null>(null);
  const transcriptRef = useRef("");
  const finalizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionFinalizedRef = useRef(false);
  const acceptRecognitionNextStopRef = useRef(false);

  const revokeUrl = useCallback(() => {
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
    setRecordedUrl(null);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopSpeech = useCallback(() => {
    const s = speechRef.current;
    if (s) {
      try {
        s.abort();
      } catch {
        /* ignore */
      }
      speechRef.current = null;
    }
  }, []);

  const clearFinalizeTimer = useCallback(() => {
    if (finalizeTimeoutRef.current) {
      clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }
  }, []);

  const finishRecognition = useCallback(
    (rawText: string) => {
      if (recognitionFinalizedRef.current) {
        return;
      }
      recognitionFinalizedRef.current = true;
      const text = rawText.trim() || INCIDENT_DEMO_TRANSCRIPT;
      clearFinalizeTimer();
      setRecognizedText(text);
      stopStream();
      appendEvent("Распознавание речи", "Текст получен (браузер/демо)");
    },
    [clearFinalizeTimer, stopStream]
  );

  useEffect(() => {
    appendEvent("Открыт экран", "Аудио-запись описания нештатной ситуации");
  }, []);

  useEffect(() => {
    const tick = () => {
      setElapsedSec(
        Math.max(0, Math.floor((Date.now() - incidentPageStartMs) / 1000))
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [incidentPageStartMs]);

  useLayoutEffect(() => {
    if (postConfirmPhase !== "complete") {
      setClassificationShownAtMs(null);
      setDeputyReliabilityMaxStatusVisible(false);
      setIncidentDeputyTelExecDone(false);
      setIncidentDeputyTelAckAtMs(null);
      return;
    }
    setClassificationShownAtMs(Date.now());
  }, [postConfirmPhase]);

  useEffect(() => {
    if (classificationShownAtMs == null) {
      setDeputyReliabilityMaxStatusVisible(false);
      return;
    }
    const id = window.setTimeout(() => {
      setDeputyReliabilityMaxStatusVisible(true);
    }, MAX_DEPUTY_RELIABILITY_STATUS_AFTER_MS);
    return () => clearTimeout(id);
  }, [classificationShownAtMs]);

  useEffect(() => {
    if (!deputyReliabilityMaxStatusVisible) {
      setIncidentDeputyTelExecDone(false);
      setIncidentDeputyTelAckAtMs(null);
      return;
    }
    setIncidentDeputyTelExecDone(false);
    setIncidentDeputyTelAckAtMs(null);
    const execId = window.setTimeout(() => {
      setIncidentDeputyTelExecDone(true);
    }, INCIDENT_DEPUTY_TELEPHONY_EXEC_DURATION_MS);
    const ackId = window.setTimeout(() => {
      setIncidentDeputyTelAckAtMs(Date.now());
    }, INCIDENT_DEPUTY_TELEPHONY_EXEC_DURATION_MS +
      INCIDENT_DEPUTY_TELEPHONY_ACK_AFTER_EXEC_MS);
    return () => {
      clearTimeout(execId);
      clearTimeout(ackId);
    };
  }, [deputyReliabilityMaxStatusVisible]);

  useEffect(() => {
    if (postConfirmPhase !== "complete") {
      setNotifyChannelsDeliveredDone(false);
      return;
    }
    setNotifyChannelsDeliveredDone(false);
    const id = window.setTimeout(() => {
      setNotifyChannelsDeliveredDone(true);
    }, NOTIFY_CHANNELS_PROGRESS_MS);
    return () => clearTimeout(id);
  }, [postConfirmPhase]);

  useEffect(() => {
    if (postConfirmPhase !== "complete") {
      setIncidentTelephonySequentialDoneCount(0);
      return;
    }
    const seqMeta = getIncidentTelephonySequentialSectionMeta();
    if (!seqMeta || seqMeta.count === 0) {
      setIncidentTelephonySequentialDoneCount(0);
      return;
    }
    setIncidentTelephonySequentialDoneCount(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < seqMeta.count; i += 1) {
      const id = window.setTimeout(() => {
        setIncidentTelephonySequentialDoneCount((prev) =>
          Math.max(prev, i + 1)
        );
      }, (i + 1) * NOTIFY_CHANNELS_PROGRESS_MS);
      timers.push(id);
    }
    return () => {
      for (const t of timers) {
        clearTimeout(t);
      }
    };
  }, [postConfirmPhase]);

  useEffect(() => {
    if (postConfirmPhase !== "complete") {
      setMaxReadShuffleOrder(null);
      setMaxReadDoneIndices(new Set());
      return;
    }
    const n = INCIDENT_MAX_PANEL_DEMO.chats.length;
    const otherRowIndices = [...Array(n).keys()].filter(
      (i) => i !== INCIDENT_MAX_DEPUTY_RELIABILITY_ROW_INDEX
    );
    const m = otherRowIndices.length;
    const perm = m > 0 ? shuffleIncidentIndices(m) : [];
    const order = perm.map((j) => otherRowIndices[j]!);
    setMaxReadShuffleOrder(order.length > 0 ? order : null);
    setMaxReadDoneIndices(new Set());
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let step = 0; step < order.length; step += 1) {
      const id = window.setTimeout(() => {
        const rowIdx = order[step]!;
        setMaxReadDoneIndices((prev) => new Set([...prev, rowIdx]));
      }, (step + 1) * MAX_READ_STEP_MS);
      timers.push(id);
    }
    return () => {
      for (const t of timers) {
        clearTimeout(t);
      }
    };
  }, [postConfirmPhase]);

  useEffect(
    () => () => {
      clearFinalizeTimer();
      stopSpeech();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      revokeUrl();
      if (classificationTimerRef.current) {
        clearTimeout(classificationTimerRef.current);
        classificationTimerRef.current = null;
      }
    },
    [clearFinalizeTimer, revokeUrl, stopSpeech]
  );

  const startRecording = useCallback(
    async (opts?: { acceptRecognition?: boolean }) => {
    setError(null);
    setPreparing(true);
    setRecognizedText(null);
    clearFinalizeTimer();
    recognitionFinalizedRef.current = false;
    stopSpeech();
    revokeUrl();
    chunksRef.current = [];
    transcriptRef.current = "";
    setRecordMime("");
    setVoiceNotRecognized(false);
    acceptRecognitionNextStopRef.current = opts?.acceptRecognition === true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const chosenMime = pickMimeType();
      const rec = new MediaRecorder(
        stream,
        chosenMime ? { mimeType: chosenMime } : undefined
      );
      mediaRecorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      rec.onstop = () => {
        const type = rec.mimeType || chosenMime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        setRecordMime(blob.type || type);
        const url = URL.createObjectURL(blob);
        recordedUrlRef.current = url;
        setRecordedUrl(url);
        appendEvent("Аудио-запись", "Остановка записи (демо, файл в браузере)");
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setPreparing(false);

        recognitionFinalizedRef.current = false;

        if (!acceptRecognitionNextStopRef.current) {
          stopSpeech();
          transcriptRef.current = "";
          clearFinalizeTimer();
          setVoiceNotRecognized(true);
          appendEvent("Распознавание речи", "Голос не распознан (демо)");
          return;
        }

        const sp = speechRef.current;
        if (sp) {
          sp.onend = () => {
            finishRecognition(transcriptRef.current);
          };
          sp.onerror = () => {
            finishRecognition(transcriptRef.current);
          };
          try {
            sp.stop();
          } catch {
            finishRecognition("");
          }
        } else {
          finalizeTimeoutRef.current = setTimeout(() => {
            finishRecognition("");
          }, RECOGNITION_MIN_MS);
        }
      };

      rec.onerror = () => {
        setError("Сбой записи. Попробуйте снова.");
        stopStream();
        setIsRecording(false);
        setPreparing(false);
        stopSpeech();
      };

      rec.start(200);
      setIsRecording(true);
      setPreparing(false);
      appendEvent("Аудио-запись", "Старт записи с микрофона (демо)");

      const Ctor = getSpeechRecognitionCtor();
      if (Ctor) {
        const r = new Ctor() as unknown as SpeechRec;
        r.continuous = true;
        r.interimResults = true;
        r.lang = "ru-RU";
        r.onresult = (ev) => {
          transcriptRef.current = buildTranscriptFromResult(ev);
        };
        r.onerror = () => {
          /* оставляем для stop() / onstop */
        };
        speechRef.current = r;
        try {
          r.start();
        } catch {
          speechRef.current = null;
        }
      }
    } catch {
      setError(
        "Нет доступа к микрофону. Разрешите запись в настройках браузера."
      );
      setIsRecording(false);
      setPreparing(false);
    }
  }, [
    clearFinalizeTimer,
    finishRecognition,
    revokeUrl,
    stopSpeech,
    stopStream
  ]);

  const handleRetryRecognition = useCallback(() => {
    void startRecording({ acceptRecognition: true });
  }, [startRecording]);

  useEffect(() => {
    void startRecording();
  }, [startRecording]);

  const handleConfirmAndSend = useCallback(() => {
    appendEvent(
      "Описание нештатной ситуации",
      "Подтверждение и отправка распознанного текста (демо)"
    );
    setPostConfirmPhase("classifying");
    if (classificationTimerRef.current) {
      clearTimeout(classificationTimerRef.current);
    }
    classificationTimerRef.current = setTimeout(() => {
      classificationTimerRef.current = null;
      setPostConfirmPhase("complete");
      appendEvent(
        "Классификация нештатной ситуации",
        "Завершена (демо), сформированы реквизиты оповещения"
      );
    }, CLASSIFICATION_DURATION_MS);
  }, []);

  const toggleIncidentChannel = useCallback((channel: string) => {
    setOpenIncidentChannel((prev) => {
      const next = prev === channel ? null : channel;
      if (next) {
        appendEvent("Канал доставки (нештатная ситуация)", `Раскрыт: ${next}`);
      } else if (prev) {
        appendEvent("Канал доставки (нештатная ситуация)", `Скрыт: ${prev}`);
      }
      return next;
    });
  }, []);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "recording") {
      rec.stop();
    } else {
      setIsRecording(false);
      setPreparing(false);
      stopStream();
    }
  }, [stopStream]);

  const statusText = (() => {
    if (voiceNotRecognized) {
      return "Голос не распознан";
    }
    if (isRecording) {
      return "Идёт запись…";
    }
    if (error) {
      return "Запись не началась или прервалась.";
    }
    if (preparing) {
      return "Подключение к микрофону. Разрешите доступ в запросе браузера — запись начнётся сразу после разрешения.";
    }
    if (recordedUrl) {
      return "Запись готова. Можно прослушать или скачать.";
    }
    return "Нажмите «Начать запись», чтобы записать снова.";
  })();

  const sequentialCupMeta =
    postConfirmPhase === "complete"
      ? getIncidentTelephonySequentialSectionMeta()
      : null;
  const incidentTelephonyBaseHeaderDone =
    sequentialCupMeta != null && sequentialCupMeta.count > 0
      ? incidentTelephonySequentialDoneCount >= sequentialCupMeta.count
      : notifyChannelsDeliveredDone;
  const deputyTelephonyLineExecuting =
    deputyReliabilityMaxStatusVisible && !incidentDeputyTelExecDone;
  const incidentTelephonyHeaderDone =
    incidentTelephonyBaseHeaderDone && !deputyTelephonyLineExecuting;

  const incidentTelephonyAckTally = useMemo(() => {
    const totalStatic = INCIDENT_TELEPHONY_PANEL_DEMO.sections.reduce(
      (n, s) => n + s.subscribers.length,
      0
    );
    const total =
      totalStatic +
      (deputyReliabilityMaxStatusVisible ? 1 : 0);
    let confirmed = 0;
    const seqTitle = INCIDENT_TELEPHONY_SEQUENTIAL_SECTION_TITLE;
    for (const sec of INCIDENT_TELEPHONY_PANEL_DEMO.sections) {
      if (sec.title === seqTitle) {
        confirmed += Math.min(
          incidentTelephonySequentialDoneCount,
          sec.subscribers.length
        );
      } else if (notifyChannelsDeliveredDone) {
        confirmed += sec.subscribers.length;
      }
    }
    if (
      deputyReliabilityMaxStatusVisible &&
      incidentDeputyTelAckAtMs != null
    ) {
      confirmed += 1;
    }
    return { confirmed, total };
  }, [
    incidentTelephonySequentialDoneCount,
    notifyChannelsDeliveredDone,
    deputyReliabilityMaxStatusVisible,
    incidentDeputyTelAckAtMs
  ]);

  const incidentMaxReadTally = useMemo(() => {
    const total = INCIDENT_MAX_PANEL_DEMO.chats.length;
    return { confirmed: maxReadDoneIndices.size, total };
  }, [maxReadDoneIndices]);

  return (
    <div className="app-shell incident-audio-page" role="main">
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
              <UserInfoActions onLogout={onLogout} hidden />
            </div>
          </div>
        </div>
        <div className="hero__title-row">
          <h1>Аудио-запись описания нештатной ситуации</h1>
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
        </div>
        <div className="hero__subtitle-row">
          <p className="hero__subtitle incident-audio-page__lead">
            После разрешения доступа к микрофону запись начинается автоматически. Для
            завершения нажмите «Остановить запись».
          </p>
          <button
            type="button"
            className="mass-danger-level-btn"
            onClick={() => {
              appendEvent(
                "Навигация",
                "Корпоративный центр оперативного оповещения (завершение информирования)"
              );
              navigate("/");
            }}
            aria-label="Перейти в корпоративный центр оперативного оповещения"
          >
            Завершить информирование
          </button>
        </div>
      </header>

      <main className="content incident-audio-page__main">
        {postConfirmPhase === null ? (
        <div
          className="incident-audio-page__panel"
          role="region"
          aria-label="Запись с микрофона"
        >
          <div
            className={
              isRecording
                ? "incident-audio-page__status incident-audio-page__status--rec"
                : voiceNotRecognized
                  ? "incident-audio-page__status incident-audio-page__status--not-recognized"
                  : "incident-audio-page__status"
            }
            aria-live="polite"
          >
            {statusText}
          </div>

          <div className="incident-audio-page__actions">
            {isRecording ? (
              <button
                type="button"
                className="incident-audio-page__stop-btn"
                onClick={stopRecording}
                aria-pressed="true"
              >
                Остановить запись
              </button>
            ) : null}
            {!isRecording && error ? (
              <button
                type="button"
                className="incident-audio-page__record-btn"
                onClick={() => {
                  void startRecording();
                }}
                aria-pressed="false"
              >
                <span className="incident-audio-page__rec-dot" aria-hidden />
                Повторить попытку
              </button>
            ) : null}
            {!isRecording && voiceNotRecognized && !error ? (
              <button
                type="button"
                className="incident-audio-page__record-btn"
                onClick={handleRetryRecognition}
                aria-pressed="false"
              >
                <span className="incident-audio-page__rec-dot" aria-hidden />
                Попробовать снова
              </button>
            ) : null}
            {!isRecording && !error && !preparing && !voiceNotRecognized ? (
              <button
                type="button"
                className="incident-audio-page__record-btn"
                onClick={() => {
                  void startRecording();
                }}
                aria-pressed="false"
              >
                <span className="incident-audio-page__rec-dot" aria-hidden />
                {recordedUrl ? "Перезаписать" : "Начать запись"}
              </button>
            ) : null}
            {preparing && !isRecording ? (
              <p className="incident-audio-page__preparing" aria-hidden>
                Подключение…
              </p>
            ) : null}
          </div>

          {error && (
            <p className="incident-audio-page__err" role="alert">
              {error}
            </p>
          )}

          {recordedUrl && !isRecording && !preparing && (
            <div className="incident-audio-page__playback">
              <p className="incident-audio-page__playback-label">Прослушивание</p>
              <audio
                className="incident-audio-page__player"
                controls
                src={recordedUrl}
                aria-label="Прослушивание записанного фрагмента"
              >
                Ваш браузер не воспроизводит встроенное аудио.
              </audio>
              <a
                className="incident-audio-page__download"
                href={recordedUrl}
                download={
                  recordMime.includes("webm")
                    ? "opisanie-neshtatnoi-situatsii.webm"
                    : recordMime.includes("ogg")
                      ? "opisanie-neshtatnoi-situatsii.ogg"
                      : "opisanie-neshtatnoi-situatsii.m4a"
                }
                aria-label="Скачать запись"
              >
                Скачать запись
              </a>
            </div>
          )}

          {recognizedText && recordedUrl && !isRecording && (
            <div className="incident-audio-page__after-transcript">
              <div className="incident-audio-page__transcript" role="region" aria-label="Распознанный текст">
                <p className="incident-audio-page__transcript-title">
                  Текст по записи
                </p>
                <p className="incident-audio-page__transcript-body">{recognizedText}</p>
              </div>
              <div className="incident-audio-page__confirm-actions">
                <button
                  type="button"
                  className="incident-audio-page__confirm-submit-btn"
                  onClick={handleConfirmAndSend}
                >
                  Подтвердить и отправить
                </button>
              </div>
            </div>
          )}
        </div>
        ) : null}

        {postConfirmPhase === "classifying" ? (
          <div
            className="incident-audio-page__classification-shell"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="incident-audio-page__classification-head">
              <h2 className="incident-audio-page__classification-heading">
                Классификация нештатной ситуации
              </h2>
              <div
                className="incident-audio-page__classification-ring"
                aria-hidden
                style={{
                  animationDuration: `${CLASSIFICATION_DURATION_MS}ms`
                }}
              />
            </div>
            <div className="incident-audio-page__classification-track">
              <div
                className="incident-audio-page__classification-bar"
                style={{
                  animationDuration: `${CLASSIFICATION_DURATION_MS}ms`
                }}
              />
            </div>
            <p className="incident-audio-page__classification-caption">
              Сопоставление описания с типовыми сценариями инцидентов…
            </p>
          </div>
        ) : null}

        {postConfirmPhase === "complete" ? (
          <div
            className="incident-audio-page__classification-result"
            role="region"
            aria-label="Результат классификации нештатной ситуации"
          >
            <h2 className="incident-audio-page__result-heading">
              Классификация завершена
            </h2>
            <dl className="incident-audio-page__result-dl">
              <div className="incident-audio-page__result-row">
                <dt>Название нештатной ситуации</dt>
                <dd>{INCIDENT_CLASSIFICATION_DEMO.situationName}</dd>
              </div>
              <div className="incident-audio-page__result-row">
                <dt>Оповещающий</dt>
                <dd>{getCurrentUserForEventLog()}</dd>
              </div>
              <div className="incident-audio-page__result-row incident-audio-page__result-row--no-border">
                <dt>Оповещаемые</dt>
                <dd>{INCIDENT_CLASSIFICATION_DEMO.notifiedParties}</dd>
              </div>
            </dl>
            <div className="incident-audio-page__notify-section">
              <p className="incident-audio-page__notify-section-label">
                Способы оповещения
              </p>
              <section
                className="mass-status-list incident-audio-page__notify-accordions"
                aria-label="Способы оповещения"
              >
                {INCIDENT_NOTIFICATION_CHANNELS.map(({ title, kind }, index) => {
                  const channelDeliveredDone =
                    kind === "telephony"
                      ? incidentTelephonyHeaderDone
                      : notifyChannelsDeliveredDone;
                  const isOpen = openIncidentChannel === title;
                  const panelId = `${incidentNotifyListUid}-n-${index}`;
                  const headerId = `${incidentNotifyListUid}-h-${index}`;
                  return (
                    <div
                      key={title}
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
                          onClick={() => toggleIncidentChannel(title)}
                        >
                          <IncidentAccordionPictogram />
                          <span className="mass-accordion__title">{title}</span>
                          <span
                            className={
                              kind === "telephony" || kind === "max"
                                ? "mass-accordion__right mass-accordion__right--telephony"
                                : "mass-accordion__right"
                            }
                          >
                            {kind === "telephony" ? (
                              <span className="mass-accordion__telephony-inline">
                                <span
                                  className="mass-accordion__call-tally"
                                  role="status"
                                  aria-live="polite"
                                  aria-label={`Подтверждено соединений: ${incidentTelephonyAckTally.confirmed} из ${incidentTelephonyAckTally.total}`}
                                >
                                  <span className="mass-accordion__call-tally-text">
                                    Подтверждено:{" "}
                                    <span className="mass-accordion__call-tally-num">
                                      {incidentTelephonyAckTally.confirmed}/
                                      {incidentTelephonyAckTally.total}
                                    </span>
                                  </span>
                                </span>
                                {channelDeliveredDone ? (
                                  <span
                                    className="mass-status-item__value mass-status-item__value--ok mass-status-item__value--in-trigger"
                                    role="status"
                                    aria-label={`${title}: ${INCIDENT_CHANNEL_STATUS_DONE}`}
                                  >
                                    {INCIDENT_CHANNEL_STATUS_DONE}
                                  </span>
                                ) : (
                                  <span
                                    className="mass-status-item__value mass-status-item__value--progress mass-status-item__value--in-trigger"
                                    role="status"
                                    aria-label={`${title}: ${INCIDENT_CHANNEL_STATUS_PROGRESS}`}
                                  >
                                    <span className="mass-status-item__value-row">
                                      <span
                                        className="mass-status-spinner"
                                        aria-hidden
                                      />
                                      <span className="mass-status-item__label-text">
                                        {INCIDENT_CHANNEL_STATUS_PROGRESS}
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
                              </span>
                            ) : kind === "max" ? (
                              <span className="mass-accordion__telephony-inline">
                                <span
                                  className="mass-accordion__call-tally"
                                  role="status"
                                  aria-live="polite"
                                  aria-label={`${MAX_READ_OK}: ${incidentMaxReadTally.confirmed} из ${incidentMaxReadTally.total}`}
                                >
                                  <span className="mass-accordion__call-tally-text">
                                    {MAX_READ_OK}:{" "}
                                    <span className="mass-accordion__call-tally-num">
                                      {incidentMaxReadTally.confirmed}/
                                      {incidentMaxReadTally.total}
                                    </span>
                                  </span>
                                </span>
                                {channelDeliveredDone ? (
                                  <span
                                    className="mass-status-item__value mass-status-item__value--ok mass-status-item__value--in-trigger"
                                    role="status"
                                    aria-label={`${title}: ${INCIDENT_CHANNEL_STATUS_DONE}`}
                                  >
                                    {INCIDENT_CHANNEL_STATUS_DONE}
                                  </span>
                                ) : (
                                  <span
                                    className="mass-status-item__value mass-status-item__value--progress mass-status-item__value--in-trigger"
                                    role="status"
                                    aria-label={`${title}: ${INCIDENT_CHANNEL_STATUS_PROGRESS}`}
                                  >
                                    <span className="mass-status-item__value-row">
                                      <span
                                        className="mass-status-spinner"
                                        aria-hidden
                                      />
                                      <span className="mass-status-item__label-text">
                                        {INCIDENT_CHANNEL_STATUS_PROGRESS}
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
                              </span>
                            ) : channelDeliveredDone ? (
                              <span
                                className="mass-status-item__value mass-status-item__value--ok mass-status-item__value--in-trigger"
                                role="status"
                                aria-label={`${title}: ${INCIDENT_CHANNEL_STATUS_DONE}`}
                              >
                                {INCIDENT_CHANNEL_STATUS_DONE}
                              </span>
                            ) : (
                              <span
                                className="mass-status-item__value mass-status-item__value--progress mass-status-item__value--in-trigger"
                                role="status"
                                aria-label={`${title}: ${INCIDENT_CHANNEL_STATUS_PROGRESS}`}
                              >
                                <span className="mass-status-item__value-row">
                                  <span
                                    className="mass-status-spinner"
                                    aria-hidden
                                  />
                                  <span className="mass-status-item__label-text">
                                    {INCIDENT_CHANNEL_STATUS_PROGRESS}
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
                          {kind === "telephony" ? (
                            <div className="mass-telephony mass-telephony--ack">
                              <p className="mass-telephony__intro">
                                {INCIDENT_TELEPHONY_PANEL_DEMO.intro}
                              </p>
                              {INCIDENT_TELEPHONY_PANEL_DEMO.sections.map(
                                (section, sectionIdx) => {
                                  const offset =
                                    INCIDENT_TELEPHONY_PANEL_DEMO.sections
                                      .slice(0, sectionIdx)
                                      .reduce(
                                        (acc, sec) =>
                                          acc + sec.subscribers.length,
                                        0
                                      );
                                  return (
                                    <div
                                      key={section.title}
                                      className="mass-telephony__section"
                                    >
                                      <h3 className="mass-telephony__section-title">
                                        {section.title}
                                      </h3>
                                      <ul
                                        className="mass-telephony__list"
                                        role="list"
                                      >
                                        {section.subscribers.map((sub, j) => {
                                          const gi = offset + j;
                                          const cupSequentialSection =
                                            section.title ===
                                            INCIDENT_TELEPHONY_SEQUENTIAL_SECTION_TITLE;
                                          const lineDone =
                                            cupSequentialSection
                                              ? j < incidentTelephonySequentialDoneCount
                                              : notifyChannelsDeliveredDone;
                                          const ackAtMs =
                                            cupSequentialSection &&
                                            classificationShownAtMs != null
                                              ? classificationShownAtMs +
                                                (j + 1) * NOTIFY_CHANNELS_PROGRESS_MS
                                              : null;
                                          return (
                                            <li
                                              key={`${sub.name}-${j}`}
                                              className={
                                                cupSequentialSection
                                                  ? "mass-telephony__row mass-telephony__row--ack"
                                                  : "mass-telephony__row"
                                              }
                                              style={{ ["--i" as string]: gi }}
                                            >
                                              <span className="mass-telephony__row-num">
                                                {gi + 1}
                                              </span>
                                              <div className="mass-telephony__row-main">
                                                <span className="mass-telephony__row-name">
                                                  {sub.name}
                                                </span>
                                                <span className="mass-telephony__row-phone">
                                                  {sub.phone}
                                                </span>
                                              </div>
                                              {cupSequentialSection ? (
                                                <span
                                                  className={
                                                    lineDone && ackAtMs != null
                                                      ? "mass-telephony__row-ack mass-telephony__row-ack--ok"
                                                      : "mass-telephony__row-ack"
                                                  }
                                                  role="status"
                                                  aria-label={
                                                    lineDone && ackAtMs != null
                                                      ? `${TELEPHONY_ACK_OK}, ${formatTelephonyAckDateTime(ackAtMs)}`
                                                      : TELEPHONY_ACK_PENDING
                                                  }
                                                >
                                                  {lineDone && ackAtMs != null ? (
                                                    <>
                                                      <span className="mass-telephony__row-ack-line">
                                                        {TELEPHONY_ACK_OK}
                                                      </span>
                                                      <time
                                                        className="mass-telephony__row-ack-time"
                                                        dateTime={new Date(
                                                          ackAtMs
                                                        ).toISOString()}
                                                      >
                                                        {formatTelephonyAckDateTime(
                                                          ackAtMs
                                                        )}
                                                      </time>
                                                    </>
                                                  ) : (
                                                    TELEPHONY_ACK_PENDING
                                                  )}
                                                </span>
                                              ) : null}
                                              <span
                                                className={
                                                  lineDone
                                                    ? "mass-status-item__value mass-status-item__value--ok mass-telephony__row-status"
                                                    : "mass-status-item__value mass-status-item__value--progress mass-telephony__row-status mass-telephony__row-status--active"
                                                }
                                                role="status"
                                              >
                                                {lineDone ? (
                                                  INCIDENT_CHANNEL_STATUS_DONE
                                                ) : (
                                                  <>
                                                    <span className="mass-status-item__value-row">
                                                      <span
                                                        className="mass-status-spinner"
                                                        aria-hidden
                                                      />
                                                      <span className="mass-status-item__label-text">
                                                        {
                                                          INCIDENT_CHANNEL_STATUS_PROGRESS
                                                        }
                                                      </span>
                                                    </span>
                                                    <span
                                                      className="mass-status-item__bar"
                                                      aria-hidden
                                                    >
                                                      <span className="mass-status-item__bar-fill" />
                                                    </span>
                                                  </>
                                                )}
                                              </span>
                                            </li>
                                          );
                                        })}
                                        {section.title ===
                                          INCIDENT_TELEPHONY_SEQUENTIAL_SECTION_TITLE &&
                                        deputyReliabilityMaxStatusVisible ? (
                                          <li
                                            key="incident-deputy-tel-after-max"
                                            className="mass-telephony__row mass-telephony__row--ack"
                                            style={{
                                              ["--i" as string]:
                                                offset +
                                                section.subscribers.length
                                            }}
                                          >
                                            <span className="mass-telephony__row-num">
                                              {offset +
                                                section.subscribers.length +
                                                1}
                                            </span>
                                            <div className="mass-telephony__row-main">
                                              <span className="mass-telephony__row-name">
                                                {INCIDENT_MAX_DEPUTY_RELIABILITY_CHAT}
                                              </span>
                                              <span className="mass-telephony__row-phone">
                                                {
                                                  INCIDENT_DEPUTY_TELEPHONY_PHONE_AFTER_MAX
                                                }
                                              </span>
                                            </div>
                                            <span
                                              className={
                                                incidentDeputyTelAckAtMs != null
                                                  ? "mass-telephony__row-ack mass-telephony__row-ack--ok"
                                                  : "mass-telephony__row-ack"
                                              }
                                              role="status"
                                              aria-label={
                                                incidentDeputyTelAckAtMs != null
                                                  ? `${TELEPHONY_ACK_OK}, ${formatTelephonyAckDateTime(incidentDeputyTelAckAtMs)}`
                                                  : TELEPHONY_ACK_PENDING
                                              }
                                            >
                                              {incidentDeputyTelAckAtMs != null ? (
                                                <>
                                                  <span className="mass-telephony__row-ack-line">
                                                    {TELEPHONY_ACK_OK}
                                                  </span>
                                                  <time
                                                    className="mass-telephony__row-ack-time"
                                                    dateTime={new Date(
                                                      incidentDeputyTelAckAtMs
                                                    ).toISOString()}
                                                  >
                                                    {formatTelephonyAckDateTime(
                                                      incidentDeputyTelAckAtMs
                                                    )}
                                                  </time>
                                                </>
                                              ) : (
                                                TELEPHONY_ACK_PENDING
                                              )}
                                            </span>
                                            <span
                                              className={
                                                incidentDeputyTelExecDone
                                                  ? "mass-status-item__value mass-status-item__value--ok mass-telephony__row-status"
                                                  : "mass-status-item__value mass-status-item__value--progress mass-telephony__row-status mass-telephony__row-status--active"
                                              }
                                              role="status"
                                            >
                                              {incidentDeputyTelExecDone ? (
                                                INCIDENT_CHANNEL_STATUS_DONE
                                              ) : (
                                                <>
                                                  <span className="mass-status-item__value-row">
                                                    <span
                                                      className="mass-status-spinner"
                                                      aria-hidden
                                                    />
                                                    <span className="mass-status-item__label-text">
                                                      {
                                                        INCIDENT_CHANNEL_STATUS_PROGRESS
                                                      }
                                                    </span>
                                                  </span>
                                                  <span
                                                    className="mass-status-item__bar"
                                                    aria-hidden
                                                  >
                                                    <span className="mass-status-item__bar-fill" />
                                                  </span>
                                                </>
                                              )}
                                            </span>
                                          </li>
                                        ) : null}
                                      </ul>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          ) : (
                            <div className="mass-telephony mass-telephony--max">
                              <p className="mass-telephony__intro">
                                {INCIDENT_MAX_PANEL_DEMO.intro}
                              </p>
                              <ul
                                className="mass-telephony__list"
                                role="list"
                              >
                                {INCIDENT_MAX_PANEL_DEMO.chats.map((row, idx) => {
                                  const deliveryDone = notifyChannelsDeliveredDone;
                                  const maxReadOk = maxReadDoneIndices.has(idx);
                                  const isDeputyReliabilityRow =
                                    row.chat === INCIDENT_MAX_DEPUTY_RELIABILITY_CHAT;
                                  const deputyStatusShown =
                                    isDeputyReliabilityRow &&
                                    deputyReliabilityMaxStatusVisible;
                                  const readSeqStep =
                                    maxReadShuffleOrder !== null
                                      ? maxReadShuffleOrder.indexOf(idx)
                                      : -1;
                                  const maxReadAtMs =
                                    classificationShownAtMs != null &&
                                    maxReadOk &&
                                    readSeqStep >= 0
                                      ? classificationShownAtMs +
                                        (readSeqStep + 1) * MAX_READ_STEP_MS
                                      : null;
                                  const standardReadShown =
                                    !isDeputyReliabilityRow &&
                                    maxReadOk &&
                                    maxReadAtMs != null;
                                  return (
                                  <li
                                    key={row.chat}
                                    className="mass-telephony__row mass-telephony__row--ack"
                                    style={{ ["--i" as string]: idx }}
                                  >
                                    <span className="mass-telephony__row-num">
                                      {idx + 1}
                                    </span>
                                    <div className="mass-telephony__row-main">
                                      <span className="mass-telephony__row-name">
                                        {row.chat}
                                      </span>
                                      <span className="mass-telephony__row-phone mass-telephony__row-max">
                                        {row.subtitle}
                                      </span>
                                    </div>
                                    <span
                                      className={
                                        deputyStatusShown
                                          ? "mass-telephony__row-ack mass-telephony__row-ack--retry"
                                          : standardReadShown
                                            ? "mass-telephony__row-ack mass-telephony__row-ack--ok"
                                            : "mass-telephony__row-ack"
                                      }
                                      role="status"
                                      aria-label={
                                        deputyStatusShown
                                          ? MAX_READ_DEPUTY_RELIABILITY_STATUS
                                          : standardReadShown
                                            ? `${MAX_READ_OK}, ${formatTelephonyAckDateTime(maxReadAtMs)}`
                                          : MAX_READ_PENDING
                                      }
                                    >
                                      {deputyStatusShown ? (
                                          <span className="mass-telephony__row-ack-line">
                                            {MAX_READ_DEPUTY_RELIABILITY_STATUS}
                                          </span>
                                      ) : standardReadShown ? (
                                          <>
                                            <span className="mass-telephony__row-ack-line">
                                              {MAX_READ_OK}
                                            </span>
                                            <time
                                              className="mass-telephony__row-ack-time"
                                              dateTime={new Date(
                                                maxReadAtMs!
                                              ).toISOString()}
                                            >
                                              {formatTelephonyAckDateTime(
                                                maxReadAtMs!
                                              )}
                                            </time>
                                          </>
                                      ) : (
                                        MAX_READ_PENDING
                                      )}
                                    </span>
                                    <span
                                      className={
                                        deliveryDone
                                          ? "mass-status-item__value mass-status-item__value--ok mass-telephony__row-status"
                                          : "mass-status-item__value mass-status-item__value--progress mass-telephony__row-status mass-telephony__row-status--active"
                                      }
                                      role="status"
                                    >
                                      {deliveryDone ? (
                                        INCIDENT_CHANNEL_STATUS_DONE
                                      ) : (
                                        <>
                                          <span className="mass-status-item__value-row">
                                            <span
                                              className="mass-status-spinner"
                                              aria-hidden
                                            />
                                            <span className="mass-status-item__label-text">
                                              {INCIDENT_CHANNEL_STATUS_PROGRESS}
                                            </span>
                                          </span>
                                          <span
                                            className="mass-status-item__bar"
                                            aria-hidden
                                          >
                                            <span className="mass-status-item__bar-fill" />
                                          </span>
                                        </>
                                      )}
                                    </span>
                                  </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
