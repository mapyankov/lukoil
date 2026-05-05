import * as XLSX from "xlsx";

const EXT = /\.(xlsx|xls|csv)$/i;

/** Ожидаемые имена листов (как в Excel-книге «Импорт контактов»). */
export const SETTINGS_SHEET_MASS = "Массовое оповещение";
export const SETTINGS_SHEET_INCIDENT = "Нештатная ситуация";

export function isContactsSpreadsheetFile(file: File): boolean {
  return EXT.test(file.name);
}

function rowMatrixFromSheet(ws: XLSX.WorkSheet): string[][] {
  const data: unknown[] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false
  });
  return (data as unknown[][]).map((row) =>
    (row ?? []).map((cell) =>
      cell === null || cell === undefined ? "" : String(cell)
    )
  );
}

function findSheetName(sheetNames: string[], want: string): string | null {
  const t = want.trim();
  for (const n of sheetNames) {
    if (n.trim() === t) {
      return n;
    }
  }
  const tl = t.toLowerCase();
  for (const n of sheetNames) {
    if (n.trim().toLowerCase() === tl) {
      return n;
    }
  }
  return null;
}

export type ParsedSettingsSpreadsheet = {
  format: "excel" | "csv";
  allSheetNames: string[];
  massRows: string[][] | null;
  incidentRows: string[][] | null;
  /** Первый лист книги (для справки на вкладке «Импорт»). */
  firstSheetName: string | null;
  firstSheetRows: string[][] | null;
};

/**
 * Разбор Excel: листы «Массовое оповещение» и «Нештатная ситуация».
 * CSV: один «лист» — в firstSheetRows, сценарные вкладки пусты.
 */
export async function parseSettingsSpreadsheet(
  file: File
): Promise<ParsedSettingsSpreadsheet> {
  const name = file.name.toLowerCase();
  let wb: XLSX.WorkBook;

  if (name.endsWith(".csv")) {
    const text = await file.text();
    wb = XLSX.read(text, { type: "string" });
    const sn = wb.SheetNames[0] ?? "CSV";
    const ws = wb.Sheets[sn];
    const rows = ws ? rowMatrixFromSheet(ws) : [];
    return {
      format: "csv",
      allSheetNames: [sn],
      massRows: null,
      incidentRows: null,
      firstSheetName: sn,
      firstSheetRows: rows.length ? rows : null
    };
  }

  const ab = await file.arrayBuffer();
  wb = XLSX.read(ab, { type: "array" });
  const allSheetNames = [...wb.SheetNames];
  const firstName = allSheetNames[0];
  const firstSheet = firstName ? wb.Sheets[firstName] : undefined;
  const firstSheetRows = firstSheet
    ? rowMatrixFromSheet(firstSheet)
    : null;

  const massN = findSheetName(allSheetNames, SETTINGS_SHEET_MASS);
  const incN = findSheetName(allSheetNames, SETTINGS_SHEET_INCIDENT);
  const massRows = massN ? rowMatrixFromSheet(wb.Sheets[massN]!) : null;
  const incidentRows = incN ? rowMatrixFromSheet(wb.Sheets[incN]!) : null;

  return {
    format: "excel",
    allSheetNames,
    massRows,
    incidentRows,
    firstSheetName: firstName ?? null,
    firstSheetRows:
      firstSheet && firstSheetRows
        ? firstSheetRows
        : null
  };
}

/**
 * Первый лист Excel/CSV → массив строк (ячейки — строки для отображения).
 * @deprecated для настроек предпочтительнее {@link parseSettingsSpreadsheet}
 */
export async function parseContactsFileToRows(file: File): Promise<string[][]> {
  const p = await parseSettingsSpreadsheet(file);
  if (p.firstSheetRows) {
    return p.firstSheetRows;
  }
  return [];
}
