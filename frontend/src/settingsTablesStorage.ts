import {
  SETTINGS_SHEET_INCIDENT,
  SETTINGS_SHEET_MASS,
  type ParsedSettingsSpreadsheet
} from "./settingsImportPreview";

const STORAGE_KEY = "lukoil-demo-settings-scenario-tables.v1";

export type StoredSettingsScenarioTables = {
  v: 1;
  fileName: string;
  massRows: string[][] | null;
  incidentRows: string[][] | null;
};

function isStringMatrix(x: unknown): x is string[][] {
  if (!Array.isArray(x)) {
    return false;
  }
  return x.every(
    (row) => Array.isArray(row) && row.every((c) => typeof c === "string")
  );
}

/**
 * Сохранение таблиц сценариев (листы «Массовое оповещение» / «Нештатная ситуация»)
 * в localStorage.
 */
export function saveScenarioTablesToStorage(
  data: StoredSettingsScenarioTables
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* квота или режим приватного просмотра */
  }
}

export function loadScenarioTablesFromStorage():
  | StoredSettingsScenarioTables
  | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || (p as { v?: unknown }).v !== 1) {
      return null;
    }
    const o = p as Record<string, unknown>;
    if (typeof o.fileName !== "string" || o.fileName.length === 0) {
      return null;
    }
    const { massRows, incidentRows } = o;
    if (massRows != null && !isStringMatrix(massRows)) {
      return null;
    }
    if (incidentRows != null && !isStringMatrix(incidentRows)) {
      return null;
    }
    if (massRows == null && incidentRows == null) {
      return null;
    }
    return {
      v: 1,
      fileName: o.fileName,
      massRows: (massRows as string[][]) ?? null,
      incidentRows: (incidentRows as string[][]) ?? null
    };
  } catch {
    return null;
  }
}

/** Восстановить объект разбора для отображения на вкладках настроек. */
export function storedScenarioTablesToParseResult(
  s: StoredSettingsScenarioTables
): ParsedSettingsSpreadsheet {
  const allSheetNames: string[] = [];
  if (s.massRows !== null) {
    allSheetNames.push(SETTINGS_SHEET_MASS);
  }
  if (s.incidentRows !== null) {
    allSheetNames.push(SETTINGS_SHEET_INCIDENT);
  }
  return {
    format: "excel",
    allSheetNames,
    massRows: s.massRows,
    incidentRows: s.incidentRows,
    firstSheetName: null,
    firstSheetRows: null
  };
}
