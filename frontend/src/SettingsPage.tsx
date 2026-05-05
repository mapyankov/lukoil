import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appendEvent } from "./eventLog";
import { DISPLAY_USER_NAME } from "./userDisplay";
import {
  isContactsSpreadsheetFile,
  parseSettingsSpreadsheet,
  SETTINGS_SHEET_INCIDENT,
  SETTINGS_SHEET_MASS,
  type ParsedSettingsSpreadsheet
} from "./settingsImportPreview";
import UserInfoActions from "./UserInfoActions";
import UserInfoLabel from "./UserInfoLabel";
import {
  loadScenarioTablesFromStorage,
  saveScenarioTablesToStorage,
  storedScenarioTablesToParseResult
} from "./settingsTablesStorage";

const CONTACTS_FILE_ACCEPT = ".csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

type SettingsTabId = "mass" | "incident" | "import";

type SettingsDataPreviewProps = {
  rows: string[][];
  fileName: string | null;
  /** Подзаголовок: имя листа */
  sheetLabel?: string | null;
  /** Уникальный id для заголовка таблицы (a11y) */
  tableTitleId: string;
};

function SettingsDataPreview({
  rows,
  fileName,
  sheetLabel,
  tableTitleId
}: SettingsDataPreviewProps) {
  const hasHeader = rows.length > 1;
  const headCells = hasHeader ? rows[0] : null;
  const bodyRows = hasHeader ? rows.slice(1) : rows;
  const title = sheetLabel
    ? `${fileName ?? "Файл"} — ${sheetLabel}`
    : (fileName ?? "Импортированный файл");

  return (
    <div
      className="settings-page__preview"
      role="region"
      aria-label={sheetLabel ? `Таблица: ${sheetLabel}` : "Таблица из файла"}
    >
      <div className="settings-page__preview-header">
        <span className="settings-page__preview-eyebrow">
          Предпросмотр данных
        </span>
        <h3
          className="settings-page__preview-title"
          id={tableTitleId}
        >
          {title}
        </h3>
        <p className="settings-page__preview-meta">
          {sheetLabel ? `Лист: ${sheetLabel} · ` : ""}
          Показано строк: {rows.length}
        </p>
      </div>
      <div className="settings-page__preview-card">
        <div
          className="settings-page__preview-scroll"
          tabIndex={0}
          role="region"
          aria-labelledby={tableTitleId}
        >
          <table className="settings-page__preview-table">
            {headCells && (
              <thead className="settings-page__preview-thead">
                <tr>
                  {headCells.map((cell, j) => (
                    <th
                      key={j}
                      className="settings-page__preview-th"
                      scope="col"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((row, i) => (
                <tr key={i} className="settings-page__preview-row">
                  {row.map((cell, j) => (
                    <td key={j} className="settings-page__preview-cell">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type SettingsPageProps = {
  onLogout: () => void;
};

export default function SettingsPage({ onLogout }: SettingsPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("mass");
  const [dropActive, setDropActive] = useState(false);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParsedSettingsSpreadsheet | null>(
    null
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastDropAtRef = useRef(0);

  useEffect(() => {
    appendEvent("Открыт экран", "Настройки");
    const stored = loadScenarioTablesFromStorage();
    if (stored) {
      setImportFileName(stored.fileName);
      setParseResult(storedScenarioTablesToParseResult(stored));
    }
  }, []);

  const goTab = useCallback((id: SettingsTabId) => {
    setActiveTab(id);
    const label =
      id === "mass"
        ? "Массовое оповещение"
        : id === "incident"
          ? "Нештатная ситуация"
          : "Импорт контактов";
    appendEvent("Вкладка настроек", label);
  }, []);

  const processFiles = useCallback((files: FileList | null) => {
    void (async () => {
      if (!files?.length) {
        return;
      }
      const list = Array.from(files);
      const names = list.map((f) => f.name).join(", ");
      appendEvent("Импорт списка контактов", `Файл(ы) выбраны: ${names} (демо)`);

      setPreviewError(null);

      const file = list.find((f) => isContactsSpreadsheetFile(f));
      if (!file) {
        appendEvent(
          "Импорт списка контактов",
          "Отклонено: нет файла CSV/XLS/XLSX среди выбранных"
        );
        setPreviewError(
          "Нужен файл Excel или CSV (например «Список контактов.xlsx» в папке exports)."
        );
        return;
      }

      try {
        const parsed = await parseSettingsSpreadsheet(file);
        if (parsed.format === "csv") {
          if (!parsed.firstSheetRows?.length) {
            setPreviewError("В файле нет данных.");
            return;
          }
        } else if (!parsed.allSheetNames.length) {
          setPreviewError("В книге нет листов.");
          return;
        }
        setImportFileName(file.name);
        setParseResult(parsed);
        if (parsed.massRows !== null || parsed.incidentRows !== null) {
          saveScenarioTablesToStorage({
            v: 1,
            fileName: file.name,
            massRows: parsed.massRows,
            incidentRows: parsed.incidentRows
          });
        }
        goTab("mass");
      } catch {
        appendEvent("Импорт списка контактов", "Ошибка чтения файла (демо)");
        setPreviewError("Не удалось прочитать файл. Проверьте формат.");
      }
    })();
  }, [goTab]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
      setDropActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    lastDropAtRef.current = Date.now();
    processFiles(e.dataTransfer.files);
  };

  const openFileDialog = () => {
    if (Date.now() - lastDropAtRef.current < 400) {
      return;
    }
    fileInputRef.current?.click();
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    e.target.value = "";
  };

  return (
    <div className="app-shell settings-page" role="main">
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
          <h1>Настройки</h1>
        </div>
        <div className="hero__subtitle-row">
          <p className="hero__subtitle">Параметры демо-приложения.</p>
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

        <div className="settings-page__tabs">
          <div
            className="settings-page__tablist"
            role="tablist"
            aria-label="Разделы настроек"
          >
            <button
              type="button"
              role="tab"
              id="settings-tab-mass"
              className="settings-page__tab"
              aria-selected={activeTab === "mass"}
              tabIndex={activeTab === "mass" ? 0 : -1}
              onClick={() => goTab("mass")}
            >
              Массовое оповещение
            </button>
            <button
              type="button"
              role="tab"
              id="settings-tab-incident"
              className="settings-page__tab"
              aria-selected={activeTab === "incident"}
              tabIndex={activeTab === "incident" ? 0 : -1}
              onClick={() => goTab("incident")}
            >
              Нештатная ситуация
            </button>
            <button
              type="button"
              role="tab"
              id="settings-tab-import"
              className="settings-page__tab"
              aria-selected={activeTab === "import"}
              tabIndex={activeTab === "import" ? 0 : -1}
              onClick={() => goTab("import")}
            >
              Импорт контактов
            </button>
          </div>

          {activeTab === "mass" && (
            <div
              className="settings-page__tab-panel"
              role="tabpanel"
              id="settings-panel-mass"
              aria-labelledby="settings-tab-mass"
            >
              {!importFileName && (
                <p className="settings-page__tab-lead">
                  Содержимое листа «{SETTINGS_SHEET_MASS}» появится здесь после
                  загрузки Excel на вкладке «Импорт контактов».
                </p>
              )}
              {importFileName && parseResult?.format === "csv" && (
                <p className="settings-page__tab-hint" role="status">
                  В CSV нет листов сценария. Сохраните данные в Excel с листом «
                  {SETTINGS_SHEET_MASS}» — тогда таблица отобразится здесь.
                </p>
              )}
              {importFileName &&
                parseResult?.format === "excel" &&
                parseResult.massRows === null && (
                  <p className="settings-page__tab-empty" role="status">
                    В книге «{importFileName}» нет листа «{SETTINGS_SHEET_MASS}».
                    Добавьте лист с таким именем и загрузите файл снова.
                  </p>
                )}
              {importFileName &&
                parseResult?.format === "excel" &&
                parseResult.massRows &&
                parseResult.massRows.length === 0 && (
                  <p className="settings-page__tab-empty" role="status">
                    Лист «{SETTINGS_SHEET_MASS}» пуст.
                  </p>
                )}
              {importFileName &&
                parseResult &&
                parseResult.massRows &&
                parseResult.massRows.length > 0 && (
                  <SettingsDataPreview
                    tableTitleId="preview-table-mass"
                    rows={parseResult.massRows}
                    fileName={importFileName}
                    sheetLabel={SETTINGS_SHEET_MASS}
                  />
                )}
            </div>
          )}

          {activeTab === "incident" && (
            <div
              className="settings-page__tab-panel"
              role="tabpanel"
              id="settings-panel-incident"
              aria-labelledby="settings-tab-incident"
            >
              {!importFileName && (
                <p className="settings-page__tab-lead">
                  Содержимое листа «{SETTINGS_SHEET_INCIDENT}» появится здесь
                  после загрузки Excel на вкладке «Импорт контактов».
                </p>
              )}
              {importFileName && parseResult?.format === "csv" && (
                <p className="settings-page__tab-hint" role="status">
                  В CSV нет листов сценария. Сохраните данные в Excel с листом «
                  {SETTINGS_SHEET_INCIDENT}».
                </p>
              )}
              {importFileName &&
                parseResult?.format === "excel" &&
                parseResult.incidentRows === null && (
                  <p className="settings-page__tab-empty" role="status">
                    В книге «{importFileName}» нет листа «{SETTINGS_SHEET_INCIDENT}».
                    Добавьте лист с таким именем и загрузите файл снова.
                  </p>
                )}
              {importFileName &&
                parseResult?.format === "excel" &&
                parseResult.incidentRows &&
                parseResult.incidentRows.length === 0 && (
                  <p className="settings-page__tab-empty" role="status">
                    Лист «{SETTINGS_SHEET_INCIDENT}» пуст.
                  </p>
                )}
              {importFileName &&
                parseResult &&
                parseResult.incidentRows &&
                parseResult.incidentRows.length > 0 && (
                  <SettingsDataPreview
                    tableTitleId="preview-table-incident"
                    rows={parseResult.incidentRows}
                    fileName={importFileName}
                    sheetLabel={SETTINGS_SHEET_INCIDENT}
                  />
                )}
            </div>
          )}

          {activeTab === "import" && (
            <div
              className="settings-page__import-wrap"
              role="tabpanel"
              id="settings-panel-import"
              aria-labelledby="settings-tab-import"
            >
              <h2
                className="settings-page__section-title"
                id="contacts-import-title"
              >
                Загрузка документов
              </h2>
              <p className="settings-page__import-hint" id="contacts-import-struct">
                Для сценариев укажите в Excel листы «{SETTINGS_SHEET_MASS}» и «
                {SETTINGS_SHEET_INCIDENT}» — они откроются на соответствующих
                вкладках.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="settings-page__file-input"
                accept={CONTACTS_FILE_ACCEPT}
                multiple
                tabIndex={-1}
                aria-hidden={true}
                onChange={onFileInputChange}
              />
              <div
                className={
                  dropActive
                    ? "settings-page__dropzone settings-page__dropzone--active"
                    : "settings-page__dropzone"
                }
                onClick={openFileDialog}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openFileDialog();
                  }
                }}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                aria-label="Загрузка документов: перетащите файлы сюда или нажмите для выбора"
                aria-describedby="contacts-import-hint contacts-import-struct"
              >
                <div className="settings-page__dropzone-ui" aria-hidden>
                  <span className="settings-page__dropzone-icon" aria-hidden>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 3v10m0 0l-3.5-3.5M12 13l3.5-3.5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <p className="settings-page__dropzone-text">
                    Перетащите документы сюда
                  </p>
                  <p
                    className="settings-page__dropzone-sub"
                    id="contacts-import-hint"
                  >
                    или нажмите, чтобы выбрать (CSV, XLS, XLSX)
                  </p>
                </div>
              </div>

              {previewError && (
                <p className="settings-page__preview-error" role="alert">
                  {previewError}
                </p>
              )}
            </div>
          )}
        </div>
      </header>
    </div>
  );
}
