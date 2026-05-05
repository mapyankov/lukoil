import { useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resetMassAlertSessionStart } from "./massAlertSession";
import { appendEvent } from "./eventLog";
import { DISPLAY_USER_NAME } from "./userDisplay";
import UserInfoActions from "./UserInfoActions";
import UserInfoLabel from "./UserInfoLabel";

type AlertScenario = "uav_threat" | "incident_info";

type ScenarioInfo = {
  title: string;
  subtitle: string;
  action: string;
  accent: string;
};

const scenarioMap: Record<AlertScenario, ScenarioInfo> = {
  uav_threat: {
    title: "Запуск оповещений при угрозе атаки БПЛА",
    subtitle:
      "Автоматический запуск оповещений через корпоративный мессенджер, SMS, почтовую рассылку и телефонию.",
    action: "Запустить оповещение",
    accent: "accent-red"
  },
  incident_info: {
    title: "Информирование о происшествиях и не штатных ситуациях",
    subtitle:
      "Опишите не штатную ситуацию с помощью голосового сообщения и оповестите персонал.",
    action: "Записать обращение",
    accent: "accent-gold"
  }
};

type AlertCenterProps = {
  onLogout: () => void;
};

const DANGER_LEVELS = [1, 2, 3, 4] as const;

export default function AlertCenter({ onLogout }: AlertCenterProps) {
  const navigate = useNavigate();
  const massConfirmTitleId = useId();
  const massConfirmDescId = useId();
  const [selectedScenario, setSelectedScenario] = useState<AlertScenario | null>(
    null
  );
  const [massConfirmOpen, setMassConfirmOpen] = useState(false);
  const [massConfirmDangerLevel, setMassConfirmDangerLevel] =
    useState<(typeof DANGER_LEVELS)[number]>(2);

  useEffect(() => {
    appendEvent("Открыт экран", "Корпоративный центр оперативного оповещения");
  }, []);

  const selectedInfo = useMemo(
    () => (selectedScenario ? scenarioMap[selectedScenario] : null),
    [selectedScenario]
  );

  const selectScenario = (key: AlertScenario) => {
    setSelectedScenario((s) => {
      if (s === key) {
        appendEvent("Снят выбор сценария", scenarioMap[key].title);
        return null;
      }
      appendEvent("Выбран сценарий", scenarioMap[key].title);
      return key;
    });
  };

  useEffect(() => {
    if (!massConfirmOpen) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMassConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [massConfirmOpen]);

  const handleAction = () => {
    if (!selectedScenario) {
      return;
    }

    if (selectedScenario === "uav_threat") {
      appendEvent(
        "Запрос подтверждения массового оповещения",
        "Сценарий: угроза атаки БПЛА"
      );
      setMassConfirmDangerLevel(2);
      setMassConfirmOpen(true);
      return;
    }

    if (selectedScenario === "incident_info") {
      appendEvent("Переход к аудио-записи", "Сценарий: нештатная ситуация");
      navigate("/incident-audio");
      return;
    }
  };

  const confirmMassAlert = () => {
    appendEvent(
      "Переход к массовому оповещению",
      `Сценарий: угроза атаки БПЛА; уровень опасности: ${massConfirmDangerLevel}`
    );
    resetMassAlertSessionStart();
    navigate("/mass-alert", { state: { dangerLevel: massConfirmDangerLevel } });
    setMassConfirmOpen(false);
  };

  return (
    <div className="app-shell">
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
              <UserInfoActions onLogout={onLogout} />
            </div>
          </div>
        </div>
        <div className="hero__title-row">
          <h1>Корпоративный центр оперативного оповещения</h1>
        </div>
        <div className="hero__subtitle-row">
          <p className="hero__subtitle">Выберите сценарий реагирования.</p>
          <button
            type="button"
            className="mass-danger-level-btn"
            onClick={() => {
              appendEvent("Переход к экрану", "Журнал событий");
              navigate("/event-log");
            }}
            aria-label="Открыть журнал событий"
          >
            Журнал событий
          </button>
        </div>
      </header>

      <main className="content">
        <section className="scenario-grid">
          <button
            className={`scenario-card ${
              selectedScenario === "uav_threat" ? "selected" : ""
            }`}
            onClick={() => selectScenario("uav_threat")}
          >
            <span className="scenario-card__tag">Массовое оповещение</span>
            <h2>Запуск оповещений при угрозе атаки БПЛА</h2>
          </button>

          <button
            className={`scenario-card ${
              selectedScenario === "incident_info" ? "selected" : ""
            }`}
            onClick={() => selectScenario("incident_info")}
          >
            <span className="scenario-card__tag">Нештатная ситуация</span>
            <h2>Информирование о происшествиях и не штатных ситуациях</h2>
          </button>
        </section>

        {selectedInfo && (
          <section className="control-panel">
            <div className={`control-panel__info ${selectedInfo.accent}`}>
              <h3>{selectedInfo.title}</h3>
              <p>{selectedInfo.subtitle}</p>
              <button
                className="action-btn"
                type="button"
                onClick={handleAction}
              >
                {selectedInfo.action}
              </button>
            </div>
          </section>
        )}
      </main>

      {massConfirmOpen && (
        <div
          className="mass-confirm-modal__backdrop"
          role="presentation"
          onClick={() => setMassConfirmOpen(false)}
        >
          <div
            className="mass-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={massConfirmTitleId}
            aria-describedby={massConfirmDescId}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={massConfirmTitleId} className="mass-confirm-modal__title">
              Подтверждение запуска
            </h2>
            <p id={massConfirmDescId} className="mass-confirm-modal__warning">
              Вы собираетесь запустить необратимое действие массового оповещения
              сотрудников по выбранным каналам связи. Убедитесь, что данные верны,
              затем выберите уровень опасности и подтвердите действие.
            </p>
            <label className="mass-confirm-modal__field-label" htmlFor="mass-danger-select">
              Уровень опасности
            </label>
            <select
              id="mass-danger-select"
              className="mass-confirm-modal__select"
              value={massConfirmDangerLevel}
              onChange={(e) =>
                setMassConfirmDangerLevel(
                  Number(e.target.value) as (typeof DANGER_LEVELS)[number]
                )
              }
            >
              {DANGER_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl} уровень опасности
                </option>
              ))}
            </select>
            <div className="mass-confirm-modal__actions">
              <button
                type="button"
                className="mass-confirm-modal__btn mass-confirm-modal__btn--secondary"
                onClick={() => setMassConfirmOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="mass-confirm-modal__btn mass-confirm-modal__btn--primary"
                onClick={confirmMassAlert}
              >
                Подтвердить действие
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
