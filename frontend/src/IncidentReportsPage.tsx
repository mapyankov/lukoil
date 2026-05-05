import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildIncidentReportFromEvents,
  type IncidentScenarioReport
} from "./buildIncidentReport";
import { appendEvent, formatEventTime, getEvents } from "./eventLog";
import { downloadIncidentReportsAsExcel } from "./incidentReportExport";
import { ensureMassDeliveryEventsInLog } from "./massDeliveryLog";
import { DISPLAY_USER_NAME } from "./userDisplay";
import UserInfoActions from "./UserInfoActions";
import UserInfoLabel from "./UserInfoLabel";

type IncidentReportsPageProps = {
  onLogout: () => void;
};

function parseDatetimeLocal(value: string): number | null {
  const v = value?.trim();
  if (!v) {
    return null;
  }
  const ms = new Date(v).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function incidentKindLabel(kind: IncidentScenarioReport["kind"]): string {
  switch (kind) {
    case "mass_cancel_incident":
      return "Массовое оповещение / отмена";
    case "incident_voice":
      return "Нештатная ситуация";
    case "delivery_archive":
      return "Архив журнала";
    default:
      return kind;
  }
}

export default function IncidentReportsPage({ onLogout }: IncidentReportsPageProps) {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<IncidentScenarioReport[]>([]);
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  useEffect(() => {
    ensureMassDeliveryEventsInLog();
    appendEvent("Просмотр экрана", "Отчёт по инцидентам");
    const built = buildIncidentReportFromEvents(getEvents());
    setScenarios(built);
  }, []);

  const filteredSorted = useMemo(() => {
    let list = [...scenarios];
    const fromMs = parseDatetimeLocal(filterFrom);
    const toMs = parseDatetimeLocal(filterTo);
    if (fromMs != null) {
      list = list.filter((s) => s.startedAt >= fromMs);
    }
    if (toMs != null) {
      list = list.filter((s) => s.startedAt <= toMs);
    }
    return list.sort((a, b) => b.startedAt - a.startedAt);
  }, [scenarios, filterFrom, filterTo]);

  const hasIncidents = scenarios.length > 0;
  const filterActive = Boolean(filterFrom.trim() || filterTo.trim());

  const toggleRowExpanded = (id: string) => {
    setExpandedRowIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const clearFilter = () => {
    setFilterFrom("");
    setFilterTo("");
  };

  const handleExportExcel = useCallback(() => {
    const n = filteredSorted.length;
    appendEvent(
      "Экспорт отчёта по инцидентам",
      `Файл Excel (демо), инцидентов в выборке: ${n}`
    );
    downloadIncidentReportsAsExcel(filteredSorted);
  }, [filteredSorted]);

  return (
    <div className="app-shell incident-reports-page">
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
          <h1>Отчёт по инцидентам</h1>
          <button
            type="button"
            className="mass-danger-level-btn"
            onClick={() => {
              appendEvent("Навигация", "Корпоративный центр оперативного оповещения");
              navigate("/");
            }}
            aria-label="Перейти на главную"
          >
            На главную страницу
          </button>
        </div>
        <div className="hero__subtitle-row">
          <p className="hero__subtitle incident-reports-page__subtitle">
            Инциденты отсортированы по времени начала (сначала более поздние); доступен фильтр по
            интервалу даты и времени. Массовое оповещение и отмена в одной цепочке — одна строка
            отчёта. Полный текст по каналам — в развёрнутой строке или при экспорте в Excel.
          </p>
          <button
            type="button"
            className="mass-danger-level-btn"
            onClick={() => {
              appendEvent("Навигация", "Журнал событий");
              navigate("/event-log");
            }}
          >
            Журнал событий
          </button>
        </div>
      </header>

      <main className="content incident-reports-page__main">
        {!hasIncidents ? (
          <p className="incident-reports-page__empty">
            Инцидентов пока нет. Откройте «Массовое оповещение», «Отмена оповещения» или
            «Аудио-запись описания нештатной ситуации», затем обновите отчёт (перейдите с
            экрана журнала сюда снова).
          </p>
        ) : (
          <>
            <section
              className="incident-reports-page__filter"
              aria-labelledby="incident-filter-heading"
            >
              <h2 id="incident-filter-heading" className="incident-reports-page__filter-title">
                Фильтр по дате и времени инцидента
              </h2>
              <p className="incident-reports-page__filter-hint">
                Учитывается время начала инцидента в первой колонке таблицы. Можно задать только
                начало, только конец или оба конца интервала.
              </p>
              <div className="incident-reports-page__filter-grid">
                <div className="incident-reports-page__filter-field">
                  <label htmlFor="incident-filter-from">Начало периода</label>
                  <input
                    id="incident-filter-from"
                    type="datetime-local"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                    aria-describedby="incident-filter-heading"
                  />
                </div>
                <div className="incident-reports-page__filter-field">
                  <label htmlFor="incident-filter-to">Конец периода</label>
                  <input
                    id="incident-filter-to"
                    type="datetime-local"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                    aria-describedby="incident-filter-heading"
                  />
                </div>
              </div>
              <div className="incident-reports-page__filter-actions">
                <button
                  type="button"
                  className="incident-reports-page__filter-clear"
                  onClick={clearFilter}
                  disabled={!filterActive}
                >
                  Сбросить фильтр
                </button>
                <button
                  type="button"
                  className="incident-reports-page__filter-export"
                  onClick={handleExportExcel}
                  disabled={filteredSorted.length === 0}
                  aria-label="Экспортировать отфильтрованные инциденты в файл Excel"
                >
                  Экспортировать отчет в XLS
                </button>
                {filterActive ? (
                  <span className="incident-reports-page__filter-status" role="status">
                    Показано {filteredSorted.length} из {scenarios.length}
                  </span>
                ) : null}
              </div>
            </section>

            {filteredSorted.length === 0 ? (
              <p className="incident-reports-page__empty incident-reports-page__empty--filter">
                В выбранном интервале даты и времени инцидентов нет. Измените границы периода
                или сбросьте фильтр.
              </p>
            ) : (
              <div
                className="incident-reports-page__table-wrap"
                role="region"
                aria-label="Таблица инцидентов"
              >
                <table className="incident-reports-page__table">
                  <caption className="incident-reports-page__table-caption">
                    Инциденты после применения фильтра (сначала более поздние по времени начала)
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Время начала</th>
                      <th scope="col">Тип</th>
                      <th scope="col">Этапы</th>
                      <th scope="col" className="incident-reports-page__table-col-action">
                        Действие
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSorted.map((scenario) => {
                      const expanded = expandedRowIds[scenario.id] ?? false;
                      const detailId = `inc-row-detail-${scenario.id}`;
                      const phasesSummary = scenario.phases.map((p) => p.title).join(" · ");
                      return (
                        <Fragment key={scenario.id}>
                          <tr className="incident-reports-page__table-row-main">
                            <td className="incident-reports-page__table-time">
                              <time dateTime={new Date(scenario.startedAt).toISOString()}>
                                {formatEventTime(scenario.startedAt)}
                              </time>
                            </td>
                            <td>{incidentKindLabel(scenario.kind)}</td>
                            <td className="incident-reports-page__table-phases">{phasesSummary}</td>
                            <td className="incident-reports-page__table-col-action">
                              <button
                                type="button"
                                className="incident-reports-page__table-toggle"
                                aria-expanded={expanded}
                                aria-controls={detailId}
                                onClick={() => toggleRowExpanded(scenario.id)}
                              >
                                {expanded ? "Скрыть подробности" : "Подробнее"}
                              </button>
                            </td>
                          </tr>
                          {expanded ? (
                            <tr className="incident-reports-page__table-row-detail">
                              <td colSpan={4}>
                                <div
                                  id={detailId}
                                  className="incident-reports-page__table-detail-inner"
                                >
                                  {scenario.kind === "incident_voice" ? (
                                    <p className="incident-reports-page__scenario-lead">
                                      После подтверждения распознанного текста и классификации (демо)
                                      выполняется рассылка по каналам. Ниже — детализация действий по
                                      каждому каналу доставки.
                                    </p>
                                  ) : null}
                                  {scenario.phases.map((phase, phaseIdx) => (
                                    <div
                                      key={`${scenario.id}-phase-${phaseIdx}`}
                                      className="incident-reports-page__phase"
                                    >
                                      <h3 className="incident-reports-page__phase-title">
                                        {phase.title}
                                      </h3>
                                      <ul
                                        className="incident-reports-page__channels"
                                        aria-label={`Каналы: ${phase.title}`}
                                      >
                                        {phase.channels.map((ch) => (
                                          <li
                                            key={`${scenario.id}-p${phaseIdx}-${ch.key}`}
                                            className="incident-reports-page__channel"
                                          >
                                            <h4 className="incident-reports-page__channel-title">
                                              {ch.title}
                                            </h4>
                                            <pre className="incident-reports-page__channel-body">
                                              {ch.detail}
                                            </pre>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
