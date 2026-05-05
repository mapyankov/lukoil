import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appendEvent, formatEventTime, getEvents, type SystemEvent } from "./eventLog";
import { downloadEventLogAsExcel } from "./eventLogExport";
import { ensureMassDeliveryEventsInLog } from "./massDeliveryLog";
import { DISPLAY_USER_NAME } from "./userDisplay";
import UserInfoActions from "./UserInfoActions";
import UserInfoLabel from "./UserInfoLabel";

type EventLogPageProps = {
  onLogout: () => void;
};

export default function EventLogPage({ onLogout }: EventLogPageProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<SystemEvent[]>([]);

  useEffect(() => {
    ensureMassDeliveryEventsInLog();
    appendEvent("Просмотр экрана", "Журнал событий");
    setEvents(getEvents());
  }, []);

  const rows = useMemo(() => events, [events]);

  const handleExportExcel = useCallback(() => {
    appendEvent("Экспорт журнала событий", "Файл Microsoft Excel (демо)");
    downloadEventLogAsExcel(rows);
  }, [rows]);

  return (
    <div className="app-shell event-log-page">
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
          <h1>Журнал событий</h1>
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
            aria-label="Перейти на главную: корпоративный центр оперативного оповещения"
          >
            На главную страницу
          </button>
        </div>
        <div className="hero__subtitle-row">
          <p className="hero__subtitle">
            Зарегистрированные действия в системе (демонстрационный журнал, хранение в
            браузере).
          </p>
          <div className="event-log-page__hero-actions">
            <button
              type="button"
              className="mass-danger-level-btn"
              onClick={() => {
                appendEvent("Навигация", "Отчёт по инцидентам");
                navigate("/incident-reports");
              }}
            >
              Отчет по инцидентам
            </button>
            <button
              type="button"
              className="mass-danger-level-btn"
              onClick={handleExportExcel}
              aria-label="Экспорт таблицы журнала в файл Excel"
            >
              Экспорт в Excel
            </button>
          </div>
        </div>
      </header>

      <main className="content event-log-page__main">
        <div className="event-log-page__table-wrap" role="region" aria-label="Таблица событий">
          <table className="event-log-page__table">
            <caption className="event-log-page__caption">
              Список событий, отсортированный по времени (сначала новые)
            </caption>
            <thead>
              <tr>
                <th scope="col">Время</th>
                <th scope="col">Пользователь</th>
                <th scope="col">Действие</th>
                <th scope="col">Детали</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="event-log-page__empty">
                    Событий пока нет. Выполните действия в системе (вход, экраны
                    оповещения) — записи появятся здесь.
                  </td>
                </tr>
              ) : (
                rows.map((ev) => (
                  <tr key={ev.id}>
                    <td className="event-log-page__time">{formatEventTime(ev.ts)}</td>
                    <td className="event-log-page__user">
                      {ev.user ?? "—"}
                    </td>
                    <td className="event-log-page__action">{ev.action}</td>
                    <td className="event-log-page__detail">
                      {ev.detail ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
