import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { appendEvent } from "./eventLog";
import { DISPLAY_USER_NAME } from "./userDisplay";
import UserInfoLabel from "./UserInfoLabel";

export default function ChangeDangerLevelPage() {
  const navigate = useNavigate();

  useEffect(() => {
    appendEvent("Открыт экран", "Изменение уровня опасности");
  }, []);
  const goMassAlert = (detail: string) => {
    appendEvent("Изменение уровня опасности", detail);
    navigate("/mass-alert");
  };
  const back = () => {
    goMassAlert("Возврат к массовому оповещению");
  };
  const goToCancelAlert = () => {
    appendEvent("Изменение уровня опасности", "Переход к отмене оповещения");
    navigate("/cancel-alert");
  };

  return (
    <div className="app-shell danger-level-page">
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
          <h1>Изменение уровня опасности</h1>
        </div>
        <div className="hero__subtitle-row">
          <p className="hero__subtitle danger-level-page__lead">
            Выберите уровень опасности для сценария оповещения или вернитесь назад.
          </p>
          <button type="button" className="mass-danger-level-btn" onClick={back}>
            Вернуться назад
          </button>
        </div>
      </header>

      <main className="content danger-level-page__main">
        <div
          className="danger-level-page__panel"
          role="group"
          aria-label="Уровни опасности"
        >
          <button
            type="button"
            className="danger-level-page__level-btn"
            onClick={() => goMassAlert("Выбран 1 уровень опасности (демо)")}
          >
            1 уровень
          </button>
          <button
            type="button"
            className="danger-level-page__level-btn danger-level-page__level-btn--current"
            disabled
            aria-current="true"
            aria-label="2 уровень (текущий, выбрано)"
          >
            <span className="danger-level-page__current-mark">Текущий</span>
            2 уровень
          </button>
          <button
            type="button"
            className="danger-level-page__level-btn"
            onClick={() => goMassAlert("Выбран 4 уровень опасности (демо)")}
          >
            4 уровень
          </button>
          <button
            type="button"
            className="danger-level-page__cancel-btn"
            onClick={goToCancelAlert}
          >
            Отмена оповещения
          </button>
        </div>
      </main>
    </div>
  );
}
